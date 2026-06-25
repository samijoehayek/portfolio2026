// Hero crypto-coin halo: three metallic coins (ETH / BTC / SOL) ride ONE nearly
// HORIZONTAL ring around the character's head — a plane parallel to the ground
// (XY, with Z up), viewed almost edge-on so it reads as a flat plane the coins
// glide along: they sweep across the FRONT (toward the viewer), pass to the
// side, then travel around the BACK where they slide behind the head and vanish,
// reappearing on the far side — a true 3D orbit, not a 2D circle. The 3 coins
// are spaced 120° apart at a shared speed so they hold constant separation and
// never bunch or merge. An invisible depth-only plane of the head silhouette
// makes the back pass genuinely disappear behind the head (per-pixel, logical).
// Logos are drawn procedurally to a CanvasTexture (crisp at any DPR, no asset).
// Factory mirrors src/scripts/about/experience.ts (imperative API + single rAF).
import * as THREE from "three";

export interface CoinOrbit {
  /** head centre + radius, in CSS px relative to the canvas top-left */
  setHead(cssX: number, cssY: number, radiusPx: number): void;
  /** character box (the full head-base frame) in CSS px — drives the occluder */
  setOccluder(left: number, top: number, width: number, height: number): void;
  /** smoothed pointer, each component -1..1 — leans the whole ring */
  setPointer(nx: number, ny: number): void;
  setActive(on: boolean): void;
  /** draw a single static frame (reduced-motion path) */
  renderOnce(): void;
  resize(): void;
  dispose(): void;
}

type CoinKind = "eth" | "btc" | "sol";

// ── halo tuning (all radii/sizes are multiples of the head radius) ──────────
// RING_TILT is the angle of the orbit plane away from perfectly horizontal:
//   ~0    = dead edge-on (coins glide on a flat horizontal line)
//   ~0.35 = a shallow look-down onto a near-horizontal plane (the 3D-plane look)
//   ~1.1  = a steep, almost face-on circle (the old "2D" look)
const RING_TILT = 0.36;     // rad — near-horizontal plane, slight look-down
const RING_RADIUS = 1.32;   // orbit radius from the head centre (smaller circle)
const DEPTH_SQUASH = 0.78;  // <1 flattens the depth axis → less front/back protrusion
const RING_SPEED = 0.4;     // rad/s — slow, majestic
const RING_XOFFSET = -0.4;  // ring-centre horizontal offset (- = left)
const RING_YOFFSET = 1.1;   // ring-centre height vs the head centre (+ = higher; >1 floats above the crown)
const COIN_SIZE = 0.2;      // coin radius (uniform → clean, uniform halo)
const LEAN = 0.08;          // how much the cursor tilts the whole ring

// coins evenly spaced on the ring; only the axial flip speed differs
const COIN_DEFS: { kind: CoinKind; phase: number; spin: number }[] = [
  { kind: "eth", phase: 0, spin: 1.3 },
  { kind: "btc", phase: (2 * Math.PI) / 3, spin: 1.7 },
  { kind: "sol", phase: (4 * Math.PI) / 3, spin: -1.1 },
];

const CAM_DIST = 10;
const FOV = 35;

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

  // ── the halo ring (one group; coins are children so they share its tilt) ──
  const ring = new THREE.Group();
  scene.add(ring);
  const coins: THREE.Mesh[] = [];
  const disposables: { dispose(): void }[] = [];
  for (const def of COIN_DEFS) {
    const coin = makeCoin(def.kind, disposables);
    ring.add(coin);
    coins.push(coin);
  }

  // ── invisible head-silhouette occluder (writes depth, not colour) ──────────
  const occGeo = new THREE.PlaneGeometry(1, 1);
  const occTex = new THREE.TextureLoader().load("/hero/head-base.webp", () => {
    if (!active && placedOnce) renderer.render(scene, camera);
  });
  occTex.colorSpace = THREE.SRGBColorSpace;
  // alphaTest (not transparent) so the occluder renders in the OPAQUE pass and
  // writes depth BEFORE the coins; transparent pixels are discarded so only the
  // head silhouette occupies the depth buffer.
  const occMat = new THREE.MeshBasicMaterial({
    map: occTex,
    alphaTest: 0.5,
    depthWrite: true,
  });
  occMat.colorWrite = false; // depth only — the real head webp shows through
  const occluder = new THREE.Mesh(occGeo, occMat);
  occluder.renderOrder = -1;
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

  // world units per CSS px at the z=0 focal plane
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
    const hr = headR * wpp;
    const c = toWorld(headX, headY);
    ring.position.set(c.x + RING_XOFFSET * hr, c.y + RING_YOFFSET * hr, 0);
    for (const coin of coins) coin.scale.setScalar(COIN_SIZE * hr);
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

  // position every coin on the ring for absolute time t (dt drives the flip)
  function place(t: number, dt: number) {
    placedOnce = true;
    const wpp = worldPerPx();
    const r = RING_RADIUS * headR * wpp;
    ring.rotation.x = RING_TILT + py * LEAN;
    ring.rotation.z = px * LEAN;
    for (let i = 0; i < coins.length; i++) {
      const def = COIN_DEFS[i];
      const a = t * RING_SPEED + def.phase;
      const coin = coins[i];
      // in ring-local space: circular path; the ring's tilt makes the on-screen
      // ellipse and routes front=low / back=high
      coin.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * DEPTH_SQUASH);
      coin.rotation.y += def.spin * dt;          // the flip
      coin.rotation.z = 0.12 * Math.sin(t + def.phase); // tiny tumble for life
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

  const g = ctx.createRadialGradient(S * 0.36, S * 0.32, S * 0.05, S * 0.5, S * 0.5, S * 0.62);
  g.addColorStop(0, pal.metalA);
  g.addColorStop(1, pal.metalB);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
  ctx.fill();

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
  return new THREE.CanvasTexture(c);
}

// draw the brand mark filled with its on-coin colour
function drawLogo(ctx: CanvasRenderingContext2D, kind: CoinKind, S: number) {
  const pal = PALETTE[kind];
  if (kind === "sol") {
    const grad = ctx.createLinearGradient(S * 0.2, S * 0.25, S * 0.8, S * 0.75);
    grad.addColorStop(0, "#9945ff");
    grad.addColorStop(1, "#14f195");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = pal.ring;
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
    poly([[0.5, 0.16], [0.78, 0.50], [0.5, 0.62], [0.22, 0.50]]);
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
    ctx.font = `bold ${Math.round(S * 0.6)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("B", S * 0.5, S * 0.54);
    ctx.restore();
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
  g.addColorStop(0.0, "#3a5bff");
  g.addColorStop(0.45, "#9fb4ff");
  g.addColorStop(0.62, "#ffffff");
  g.addColorStop(0.8, "#ffce6a");
  g.addColorStop(1.0, "#e08a12");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
