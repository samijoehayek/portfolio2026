// Hero crypto-coin orbit: three metallic coins (ETH / BTC / SOL) circling the
// character's head like electrons round a nucleus — each on its own tilted
// elliptical orbit, each flipping on its own axis. Logos are drawn procedurally
// to a CanvasTexture (crisp at any DPR, no asset / no bg-removal artifacts).
// An invisible depth-only plane of the head silhouette gives REAL occlusion:
// coins passing behind the head vanish behind its exact outline.
// Factory mirrors src/scripts/about/experience.ts (imperative API + single rAF).
import * as THREE from "three";

export interface CoinOrbit {
  /** head centre + radius, in CSS px relative to the canvas top-left */
  setHead(cssX: number, cssY: number, radiusPx: number): void;
  /** character box (the full head-base frame) in CSS px — drives the occluder */
  setOccluder(left: number, top: number, width: number, height: number): void;
  /** smoothed pointer, each component -1..1 — leans the whole constellation */
  setPointer(nx: number, ny: number): void;
  setActive(on: boolean): void;
  /** draw a single static frame (reduced-motion path) */
  renderOnce(): void;
  resize(): void;
  dispose(): void;
}

type CoinKind = "eth" | "btc" | "sol";

interface CoinCfg {
  kind: CoinKind;
  radius: number; // orbit radius, in multiples of the head radius
  tilt: number; // orbit-plane tilt about X (rad)
  yaw: number; // orbit-plane yaw about Y (rad) — keeps the 3 ellipses non-coplanar
  phase: number; // starting angle (rad)
  speed: number; // orbital angular speed (rad/s)
  spin: number; // axial flip speed (rad/s)
  size: number; // coin radius, in multiples of the head radius
}

const COINS: CoinCfg[] = [
  { kind: "eth", radius: 1.45, tilt: 0.62, yaw: 0.0, phase: 0.0, speed: 0.55, spin: 1.4, size: 0.40 },
  { kind: "btc", radius: 1.08, tilt: 1.05, yaw: 0.7, phase: 2.1, speed: 0.82, spin: 1.9, size: 0.32 },
  { kind: "sol", radius: 1.78, tilt: 0.34, yaw: -0.5, phase: 4.2, speed: 0.42, spin: -1.2, size: 0.46 },
];

const CAM_DIST = 10;
const FOV = 35;
const ELLIPSE_SQUASH = 0.62; // <1 → elliptical, not circular

export function createCoinOrbit(canvas: HTMLCanvasElement): CoinOrbit {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_DIST);
  camera.lookAt(0, 0, 0);

  // ── lighting: warm key (upper-left) + cool fill → moving metal highlights ──
  const key = new THREE.DirectionalLight(0xfff1da, 2.6);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const fill = new THREE.HemisphereLight(0xbcd2ff, 0x14122a, 1.1);
  scene.add(fill);

  // ── on-brand procedural environment (blue top → gold bottom) for reflections ─
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSrc = makeEnvTexture();
  const envRT = pmrem.fromEquirectangular(envSrc);
  scene.environment = envRT.texture;
  envSrc.dispose();
  pmrem.dispose();

  // ── coins ──────────────────────────────────────────────────────────────
  const planes: THREE.Group[] = []; // one orbit-plane group per coin
  const coins: THREE.Mesh[] = [];
  const baseTilt: number[] = [];
  const disposables: { dispose(): void }[] = [];

  for (const cfg of COINS) {
    const plane = new THREE.Group();
    plane.rotation.set(cfg.tilt, cfg.yaw, 0);
    baseTilt.push(cfg.tilt);
    scene.add(plane);
    planes.push(plane);

    const coin = makeCoin(cfg.kind, disposables);
    plane.add(coin);
    coins.push(coin);
  }

  // ── invisible head-silhouette occluder (writes depth, not colour) ──────────
  const occGeo = new THREE.PlaneGeometry(1, 1);
  const occTex = new THREE.TextureLoader().load("/hero/head-base.webp", () => {
    // if we're parked on a static frame (reduced-motion), redraw now the
    // silhouette has arrived so occlusion is correct
    if (!active && placedOnce) renderer.render(scene, camera);
  });
  occTex.colorSpace = THREE.SRGBColorSpace;
  // NOTE: alphaTest (not transparent) so the occluder renders in the OPAQUE pass
  // and writes its depth BEFORE the coins are drawn; transparent pixels are
  // discarded so only the head silhouette occupies the depth buffer.
  const occMat = new THREE.MeshBasicMaterial({
    map: occTex,
    alphaTest: 0.5,
    depthWrite: true,
  });
  occMat.colorWrite = false; // occupies the depth buffer only — head webp shows through
  const occluder = new THREE.Mesh(occGeo, occMat);
  occluder.position.z = 0;
  occluder.renderOrder = -1; // lay down depth before the coins
  scene.add(occluder);
  disposables.push(occGeo, occMat, occTex);

  // ── layout state (CSS px relative to the canvas) ───────────────────────────
  let headX = 0, headY = 0, headR = 120;
  let occBox = { left: 0, top: 0, width: 0, height: 0 };
  let px = 0, py = 0; // smoothed pointer -1..1
  let cssW = 1, cssH = 1;

  function readSize() {
    const r = canvas.getBoundingClientRect();
    cssW = Math.max(1, r.width);
    cssH = Math.max(1, r.height);
  }

  // world units per CSS px at the z=0 focal plane (camera looks down -Z at origin)
  function worldPerPx() {
    const visibleH = 2 * CAM_DIST * Math.tan((FOV * Math.PI) / 360);
    return visibleH / cssH;
  }
  // convert a CSS-px point (origin top-left) to world coords on the z=0 plane
  function toWorld(cssX: number, cssY: number) {
    const wpp = worldPerPx();
    return { x: (cssX - cssW / 2) * wpp, y: (cssH / 2 - cssY) * wpp };
  }

  function applyLayout() {
    const wpp = worldPerPx();
    const c = toWorld(headX, headY);
    const hr = headR * wpp;
    for (let i = 0; i < COINS.length; i++) {
      planes[i].position.set(c.x, c.y, 0);
      coins[i].scale.setScalar(COINS[i].size * hr);
    }
    // occluder: cover the whole character frame; alphaTest keeps only the head
    const w = occBox.width * wpp;
    const h = occBox.height * wpp;
    const oc = toWorld(occBox.left + occBox.width / 2, occBox.top + occBox.height / 2);
    occluder.position.set(oc.x, oc.y, 0);
    occluder.scale.set(w || 1, h || 1, 1);
  }

  // ── animation ────────────────────────────────────────────────────────────
  const clock = new THREE.Clock(false);
  let raf = 0;
  let active = false;
  let placedOnce = false;

  // position every coin for absolute time t (dt drives the axial flip)
  function place(t: number, dt: number) {
    placedOnce = true;
    const wpp = worldPerPx();
    const hr = headR * wpp;
    for (let i = 0; i < COINS.length; i++) {
      const cfg = COINS[i];
      const a = t * cfg.speed + cfg.phase;
      const r = cfg.radius * hr;
      const coin = coins[i];
      coin.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * ELLIPSE_SQUASH);
      coin.rotation.y += cfg.spin * dt; // the flip
      coin.rotation.x = 0.18 * Math.sin(t * 0.9 + cfg.phase); // gentle tumble

      // pointer leans each orbit plane toward the cursor (additive to base tilt)
      planes[i].rotation.x = baseTilt[i] + py * 0.14;
      planes[i].rotation.z = px * 0.12;
    }
  }

  function frame() {
    place(clock.elapsedTime, Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    readSize();
    renderer.setSize(cssW, cssH, false);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    applyLayout();
  }

  readSize();
  resize();

  return {
    setHead(x, y, radiusPx) {
      headX = x; headY = y; headR = radiusPx;
      applyLayout();
    },
    setOccluder(left, top, width, height) {
      occBox = { left, top, width, height };
      applyLayout();
    },
    setPointer(nx, ny) { px = nx; py = ny; },
    setActive(on) {
      if (on === active) return;
      active = on;
      if (on) { clock.start(); raf = requestAnimationFrame(frame); }
      else { clock.stop(); cancelAnimationFrame(raf); }
    },
    renderOnce() {
      place(0, 0);
      renderer.render(scene, camera);
    },
    resize,
    dispose() {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      disposables.forEach((d) => d.dispose());
      envRT.texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

// ── coin mesh: milled rim + two stamped faces ───────────────────────────────
function makeCoin(kind: CoinKind, bin: { dispose(): void }[]): THREE.Mesh {
  const R = 1; // unit coin; scaled per-frame to head size
  const thickness = 0.16 * R;
  const pal = PALETTE[kind];

  const rimGeo = new THREE.CylinderGeometry(R, R, thickness, 64, 1, true);
  rimGeo.rotateX(Math.PI / 2); // faces look down ±Z
  const rimMat = new THREE.MeshStandardMaterial({
    color: pal.rim,
    metalness: 0.95,
    roughness: 0.42,
  });
  const coin = new THREE.Mesh(rimGeo, rimMat);
  bin.push(rimGeo, rimMat);

  const faceTex = makeFaceTexture(kind);
  const bumpTex = makeBumpTexture(kind);
  const faceGeo = new THREE.CircleGeometry(R * 0.985, 64);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: faceTex,
    bumpMap: bumpTex,
    bumpScale: 0.02,
    metalness: 0.9,
    roughness: 0.34,
  });
  bin.push(faceGeo, faceMat, faceTex, bumpTex);

  const front = new THREE.Mesh(faceGeo, faceMat);
  front.position.z = thickness / 2 + 0.001;
  coin.add(front);
  const back = new THREE.Mesh(faceGeo, faceMat);
  back.position.z = -thickness / 2 - 0.001;
  back.rotation.y = Math.PI;
  coin.add(back);

  return coin;
}

// ── palettes ────────────────────────────────────────────────────────────────
const PALETTE: Record<CoinKind, { rim: number; metalA: string; metalB: string; ring: string }> = {
  eth: { rim: 0xbfc8de, metalA: "#eef1f8", metalB: "#9aa6c6", ring: "#5b6794" },
  btc: { rim: 0xe7a93a, metalA: "#ffe39a", metalB: "#d4881c", ring: "#9a5e0a" },
  sol: { rim: 0x4a4566, metalA: "#3a3556", metalB: "#191527", ring: "#0d0a18" },
};

// metal face: radial gradient + inner ring + engraved/colour logo
function makeFaceTexture(kind: CoinKind): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  const pal = PALETTE[kind];

  // radial metal gradient (light upper-left → dark lower-right)
  const g = ctx.createRadialGradient(S * 0.36, S * 0.32, S * 0.05, S * 0.5, S * 0.5, S * 0.62);
  g.addColorStop(0, pal.metalA);
  g.addColorStop(1, pal.metalB);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.fill();

  // thin inner ring (milled edge)
  ctx.strokeStyle = pal.ring;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = S * 0.022;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  drawLogo(ctx, kind, S);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// grayscale height for the engrave (mid-gray ground, logo recessed darker)
function makeBumpTexture(kind: CoinKind): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "#1a1a1a";
  drawLogoPath(ctx, kind, S);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

// draw the brand mark filled with its on-coin colour
function drawLogo(ctx: CanvasRenderingContext2D, kind: CoinKind, S: number) {
  const pal = PALETTE[kind];
  if (kind === "sol") {
    // Solana keeps its signature purple→teal gradient (bright on a dark coin)
    const grad = ctx.createLinearGradient(S * 0.2, S * 0.25, S * 0.8, S * 0.75);
    grad.addColorStop(0, "#9945ff");
    grad.addColorStop(1, "#14f195");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = pal.ring; // engraved dark brand tone for ETH / BTC
  }
  drawLogoPath(ctx, kind, S);
  ctx.fill();
}

// the path geometry only (used by both colour fill and bump)
function drawLogoPath(ctx: CanvasRenderingContext2D, kind: CoinKind, S: number) {
  ctx.beginPath();
  if (kind === "eth") {
    const poly = (pts: number[][]) => {
      pts.forEach(([x, y], i) =>
        i ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S),
      );
      ctx.closePath();
    };
    // upper rhombus
    poly([[0.5, 0.16], [0.78, 0.50], [0.5, 0.62], [0.22, 0.50]]);
    // lower kite (slight centre notch at top → reads as the classic two-part mark)
    poly([[0.22, 0.55], [0.5, 0.65], [0.78, 0.55], [0.5, 0.86]]);
  } else if (kind === "sol") {
    const bar = (y0: number, y1: number) => {
      const x0 = 0.16, x1 = 0.84, sk = 0.12;
      ctx.moveTo((x0 + sk) * S, y0 * S);
      ctx.lineTo(x1 * S, y0 * S);
      ctx.lineTo((x1 - sk) * S, y1 * S);
      ctx.lineTo(x0 * S, y1 * S);
      ctx.closePath();
    };
    bar(0.22, 0.34);
    bar(0.44, 0.56);
    bar(0.66, 0.78);
  } else {
    // BTC: a bold "B" plus two vertical stems → the ₿ glyph, font-independent
    ctx.save();
    ctx.fillStyle = ctx.fillStyle; // keep current fill
    ctx.font = `bold ${Math.round(S * 0.6)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", S * 0.5, S * 0.54);
    ctx.restore();
    // stems
    const w = S * 0.05;
    ctx.rect(S * 0.43 - w / 2, S * 0.16, w, S * 0.68);
    ctx.rect(S * 0.57 - w / 2, S * 0.16, w, S * 0.68);
  }
}

// equirectangular env: brand blue at the top fading to warm gold at the bottom
function makeEnvTexture(): THREE.CanvasTexture {
  const w = 512, h = 256;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0.0, "#3a5bff"); // sky
  g.addColorStop(0.45, "#9fb4ff");
  g.addColorStop(0.62, "#ffffff"); // horizon glare → moving specular streak
  g.addColorStop(0.8, "#ffce6a");
  g.addColorStop(1.0, "#e08a12"); // warm gold floor bounce
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
