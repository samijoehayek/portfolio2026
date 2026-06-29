// Three.js cursor-driven PIXEL-SHATTER for a card image.
// The image is quantized into a grid of tiles; tiles near the cursor blow apart
// (offset away from it, with dark grout between them) and snap back on leave.
// Lazy-loaded chunk; listens to the carousel's CustomEvents; falls back to <img>.
import * as THREE from "three";

export interface PixelDistortionOpts {
  tiles?: number;
  radius?: number;
  pushForce?: number;
  approach?: number;
  dpr?: number;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D u_image;
  uniform sampler2D u_dataTex;   // per-tile UV offset (tiles x tiles), NEAREST
  uniform sampler2D u_depth;     // grayscale depth (1=near, 0=far); only if u_hasDepth
  uniform float u_hasDepth;      // 0/1 — enables 2.5D parallax
  uniform vec2  u_pointer;       // smoothed look direction, ~[-1,1]
  uniform float u_parallax;      // max UV shift
  uniform float u_overscan;      // <1 zooms in slightly = border buffer so the
                                 // parallax never samples past the image edge
  uniform vec2  u_imageAspect;
  uniform float u_planeAspect;
  uniform float u_tiles;
  varying vec2 vUv;

  vec2 coverUv(vec2 uv, float imgAspect, float planeAspect) {
    vec2 s = (planeAspect > imgAspect)
      ? vec2(1.0, imgAspect / planeAspect)
      : vec2(planeAspect / imgAspect, 1.0);
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    vec2 tileCenter = (floor(vUv * u_tiles) + 0.5) / u_tiles;
    vec2 disp = texture2D(u_dataTex, tileCenter).rg;   // this tile's offset

    float imgAspect = u_imageAspect.x / u_imageAspect.y;
    vec2 baseUv = coverUv(vUv + disp, imgAspect, u_planeAspect);

    // inset slightly so the parallax offset always has headroom before the edge
    vec2 insetUv = (baseUv - 0.5) * u_overscan + 0.5;

    // 2.5D parallax: shift the sample by per-pixel depth around a mid pivot,
    // so near elements and the far background slide opposite ways as you look.
    // The depth map is pre-blurred, so this warp is smooth instead of tearing.
    float d = mix(0.5, texture2D(u_depth, insetUv).r, u_hasDepth);
    vec2 sampleUv = insetUv + u_pointer * (d - 0.5) * u_parallax;

    vec3 col = texture2D(u_image, sampleUv).rgb;

    // dark grout at tile edges, scaled by how far the tile has shattered
    vec2 f = abs(fract(vUv * u_tiles) - 0.5) * 2.0;
    float edge = max(f.x, f.y);
    float amt = clamp(length(disp) * 7.0, 0.0, 1.0);
    col *= 1.0 - smoothstep(0.74, 1.0, edge) * amt;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export class PixelDistortionImage {
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera = new THREE.Camera();
  private mesh?: THREE.Mesh;
  private uniforms: any;
  private dataTex?: THREE.DataTexture;
  private data!: Float32Array;
  private jitter!: Float32Array; // per-tile [magFactor, angleOffset]
  private grid = 16;
  private radius = 0.3;
  private pushForce = 0.2;
  private approach = 0.16;
  private mouse = { x: 0.5, y: 0.5 };
  private hovering = false;
  private raf = 0;
  private paused = false;
  alive = false;
  // 2.5D parallax (only when a depth map is supplied)
  private hasDepth = false;
  private depthTex?: THREE.Texture;
  private time = 0;
  private pCur = { x: 0, y: 0 };
  private parFade = 1; // parallax weight: eases to 0 on hover (shatter takes over)

  async init(canvas: HTMLCanvasElement, imageURL: string, opts: PixelDistortionOpts = {}, depthURL?: string): Promise<void> {
    this.grid = opts.tiles ?? 16;
    this.radius = opts.radius ?? 0.3;
    this.pushForce = opts.pushForce ?? 0.2;
    this.approach = opts.approach ?? 0.16;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(opts.dpr ?? window.devicePixelRatio, 2));
    this.renderer = renderer;
    this.scene = new THREE.Scene();

    const tex = await new THREE.TextureLoader().loadAsync(imageURL);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    const iw = tex.image?.width ?? 1;
    const ih = tex.image?.height ?? 1;

    if (depthURL) {
      try {
        const dtex = await new THREE.TextureLoader().loadAsync(depthURL);
        dtex.minFilter = THREE.LinearFilter;
        dtex.magFilter = THREE.LinearFilter;
        this.depthTex = dtex;
        this.hasDepth = true;
      } catch {
        /* depth optional — parallax simply stays off */
      }
    }

    const g = this.grid;
    this.data = new Float32Array(g * g * 4);
    this.jitter = new Float32Array(g * g * 2);
    for (let k = 0; k < g * g; k++) {
      this.jitter[k * 2] = 0.55 + Math.random() * 0.8; // magnitude variance
      this.jitter[k * 2 + 1] = (Math.random() - 0.5) * 0.7; // angle wobble (rad)
    }
    this.dataTex = new THREE.DataTexture(this.data, g, g, THREE.RGBAFormat, THREE.FloatType);
    this.dataTex.minFilter = THREE.NearestFilter;
    this.dataTex.magFilter = THREE.NearestFilter;
    this.dataTex.needsUpdate = true;

    this.uniforms = {
      u_image: { value: tex },
      u_dataTex: { value: this.dataTex },
      u_depth: { value: this.depthTex ?? null },
      u_hasDepth: { value: this.hasDepth ? 1 : 0 },
      u_pointer: { value: new THREE.Vector2(0, 0) },
      u_parallax: { value: 0.046 },
      u_overscan: { value: 0.9 },
      u_imageAspect: { value: new THREE.Vector2(iw, ih) },
      u_planeAspect: { value: 1 },
      u_tiles: { value: g },
    };

    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms }),
    );
    this.scene.add(this.mesh);

    const r = canvas.getBoundingClientRect();
    this.resize(r.width || canvas.clientWidth || 1, r.height || canvas.clientHeight || 1);
    this.renderer.render(this.scene, this.camera); // sharp first frame, no black flash

    this.alive = true;
    this.loop();
  }

  setMouse(uvX: number, uvY: number) {
    this.mouse.x = uvX;
    this.mouse.y = uvY;
  }
  setHover(on: boolean) {
    this.hovering = on;
  }
  reset() {
    // clear any leftover shatter so a reused/re-shown card starts from the clean image
    this.data.fill(0);
    this.hovering = false;
    if (this.dataTex) this.dataTex.needsUpdate = true;
  }

  triggerBurst() {
    // scatter all tiles, then step() relaxes them back = "shatter assemble" entrance
    const g = this.grid;
    for (let k = 0; k < g * g; k++) {
      this.data[k * 4] = (Math.random() - 0.5) * 0.32;
      this.data[k * 4 + 1] = (Math.random() - 0.5) * 0.32;
    }
    if (this.dataTex) this.dataTex.needsUpdate = true;
  }

  resize(width: number, height: number) {
    if (!this.renderer) return;
    this.renderer.setSize(width, height, false);
    if (this.uniforms) this.uniforms.u_planeAspect.value = width / Math.max(height, 1);
  }

  private loop = () => {
    if (!this.alive || this.paused) return;
    this.raf = requestAnimationFrame(this.loop);
    this.step();
    this.renderer!.render(this.scene!, this.camera);
  };

  private step() {
    // 2.5D look-direction: follow the pointer while hovering, else a slow idle
    // drift so the card stays "alive" with no interaction (and on touch).
    if (this.hasDepth) {
      this.time += 0.016;
      // Parallax is the AMBIENT idle drift (the "alive" resting state). On hover
      // it eases out so the pixel-shatter owns the cursor, then eases back in
      // when the pointer leaves.
      const tx = Math.sin(this.time * 0.5) * 0.6;
      const ty = Math.cos(this.time * 0.38) * 0.42;
      this.pCur.x += (tx - this.pCur.x) * 0.04;
      this.pCur.y += (ty - this.pCur.y) * 0.04;
      const fadeTarget = this.hovering ? 0 : 1;
      this.parFade += (fadeTarget - this.parFade) * 0.06;
      this.uniforms.u_pointer.value.set(this.pCur.x * this.parFade, this.pCur.y * this.parFade);
    }

    const g = this.grid;
    const data = this.data;
    const jit = this.jitter;
    const mx = this.mouse.x;
    const my = this.mouse.y;
    for (let j = 0; j < g; j++) {
      for (let i = 0; i < g; i++) {
        const t = j * g + i;
        const idx = t * 4;
        let tx = 0;
        let ty = 0;
        if (this.hovering) {
          const cx = (i + 0.5) / g - mx;
          const cy = (j + 0.5) / g - my;
          const dist = Math.hypot(cx, cy);
          if (dist < this.radius) {
            const fo = 1 - dist / this.radius;
            const mag = fo * fo * this.pushForce * jit[t * 2];
            const inv = 1 / (dist || 1e-4);
            // away-from-cursor direction, wobbled per tile
            const a = jit[t * 2 + 1];
            const dxn = cx * inv;
            const dyn = cy * inv;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            tx = (dxn * ca - dyn * sa) * mag;
            ty = (dxn * sa + dyn * ca) * mag;
          }
        }
        data[idx] += (tx - data[idx]) * this.approach;
        data[idx + 1] += (ty - data[idx + 1]) * this.approach;
      }
    }
    this.dataTex!.needsUpdate = true;
  }

  pause() {
    this.paused = true;
    cancelAnimationFrame(this.raf);
  }
  resume() {
    if (!this.alive || !this.paused) return;
    this.paused = false;
    this.loop();
  }
  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.mesh?.geometry.dispose();
    (this.mesh?.material as THREE.Material | undefined)?.dispose();
    this.uniforms?.u_image.value?.dispose?.();
    this.depthTex?.dispose();
    this.dataTex?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = undefined;
    this.scene = undefined;
    this.mesh = undefined;
  }
}

// ── LRU manager: bounds the number of live WebGL contexts ──
class WebGLManager {
  private live = new Map<HTMLElement, PixelDistortionImage>();
  private max = 8; // headroom for all 6 cards + buffer; well under the WebGL context limit

  async acquire(host: HTMLElement, canvas: HTMLCanvasElement, url: string, opts: PixelDistortionOpts, depthURL?: string) {
    const existing = this.live.get(host);
    if (existing) {
      this.live.delete(host);
      this.live.set(host, existing);
      return existing;
    }
    while (this.live.size >= this.max) {
      const oldest = this.live.keys().next().value as HTMLElement;
      this.release(oldest);
    }
    const inst = new PixelDistortionImage();
    this.live.set(host, inst);
    await inst.init(canvas, url, opts, depthURL);
    return inst;
  }
  release(host: HTMLElement) {
    const inst = this.live.get(host);
    if (inst) {
      inst.destroy();
      this.live.delete(host);
      host.removeAttribute("data-shader-on");
    }
  }
  get(host: HTMLElement) {
    return this.live.get(host);
  }
  forEach(fn: (inst: PixelDistortionImage, host: HTMLElement) => void) {
    this.live.forEach(fn);
  }
  resizeAll() {
    this.live.forEach((inst, host) => {
      const cv = host.querySelector<HTMLCanvasElement>(".preview__canvas");
      const r = (cv ?? host).getBoundingClientRect();
      inst.resize(r.width, r.height);
    });
  }
}

function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

let booted = false;

export function initShaders(): void {
  if (booted) return;
  booted = true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !webglOK()) return;

  const manager = new WebGLManager();
  const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  let active: HTMLElement | null = null;

  // Make a card's shader the ACTIVE one: create it if missing (REUSED on revisit),
  // resume + reset it, and pause every other card's shader. Shaders are kept alive
  // (one per card, capped) and paused when off — NO per-slide create/destroy, so
  // WebGL contexts never churn or run out (the bug that killed hover after a change).
  async function activate(pane: HTMLElement | undefined, image?: string) {
    if (!pane || !image) return;
    const canvas = pane.querySelector<HTMLCanvasElement>(".preview__canvas");
    if (!canvas) return;
    try {
      const inst = await manager.acquire(pane, canvas, image, { dpr: Math.min(window.devicePixelRatio, 2) }, pane.dataset.depth);
      const r = canvas.getBoundingClientRect();
      inst.resize(r.width, r.height);
      inst.reset();
      inst.resume();
      pane.setAttribute("data-shader-on", "");
      active = pane;
      manager.forEach((o, host) => {
        if (host !== pane) o.pause();
      });
    } catch {
      /* keep the static <img> fallback */
    }
  }

  window.addEventListener("carousel-slide-visible", (e: Event) => {
    const d = (e as CustomEvent).detail;
    activate(d.host, d.image);
  });
  window.addEventListener("carousel-slide-hidden", (e: Event) => {
    manager.get((e as CustomEvent).detail.host)?.pause();
  });
  window.addEventListener("resize-pixel-distortion", () => manager.resizeAll());

  // hover drives ONLY the active card's shader
  if (!isTouch) {
    window.addEventListener(
      "pointermove",
      (e) => {
        if (!active) return;
        const inst = manager.get(active);
        const cv = active.querySelector<HTMLCanvasElement>(".preview__canvas");
        if (!inst || !cv) return;
        const r = cv.getBoundingClientRect();
        if (r.width <= 0) return;
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
        inst.setHover(inside);
        if (inside) inst.setMouse(x, 1 - y);
      },
      { passive: true },
    );
  }

  // pause/resume the active shader when the section scrolls off/on screen
  const section = document.querySelector("[data-work]");
  if (section) {
    new IntersectionObserver(
      (es) => {
        const vis = es[0]?.isIntersecting;
        if (!active) return;
        const inst = manager.get(active);
        if (vis) inst?.resume();
        else inst?.pause();
      },
      { threshold: 0 },
    ).observe(section);
  }

  const initialPane = document.querySelector<HTMLElement>("[data-slide][data-active] [data-pane]");
  if (initialPane) activate(initialPane, initialPane.dataset.img);
}
