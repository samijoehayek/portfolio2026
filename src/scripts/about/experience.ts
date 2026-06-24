// About — the real-time Three.js stadium. A single scroll progress (0..1) cranes a
// camera from straight-down to a broadcast angle while the stadium CONSTRUCTS itself:
// a glowing neon energy-grid draws itself from the centre out (the "entry"), then the
// pitch paints in radially and the tiered neon stands RISE from that same footprint —
// one cohesive build, not a cross-fade. Procedural geometry + Higgsfield textures.
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const PITCH_L = 86; // marked field length (fits inside the oval bowl with grass run-off)
const PITCH_W = 54;
const HALF_L = PITCH_L / 2;
const HALF_W = PITCH_W / 2;
const BOWL_RX = 58;
const BOWL_RZ = 46;
const REVEAL_MAX = 66; // world radius that fully exposes the pitch (corner ≈ 62.6)
const BLUE = 0x2b47ff;
const NIGHT = 0x05071c;

export interface AboutExperience {
  setProgress(p: number): void;
  setApproach(a: number): void;
  kick(vx: number, vz: number): void;
  resize(): void;
  setActive(on: boolean): void;
  pointer(clientX: number, clientY: number, kind: "down" | "move" | "up"): void;
  resetBall(): void;
  dispose(): void;
  onScore?: (side: "home" | "away") => void;
}

export function createAboutExperience(canvas: HTMLCanvasElement): AboutExperience {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const bgColor = new THREE.Color(BLUE);
  scene.background = bgColor.clone();
  scene.fog = new THREE.Fog(BLUE, 360, 1700);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 4000);

  const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x0a1a44, 0.85);
  scene.add(hemi);
  const flood = new THREE.DirectionalLight(0xffffff, 2.1);
  flood.position.set(60, 170, 70);
  flood.castShadow = true;
  flood.shadow.mapSize.set(2048, 2048);
  flood.shadow.camera.near = 20;
  flood.shadow.camera.far = 460;
  const sc = flood.shadow.camera as THREE.OrthographicCamera;
  sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120;
  flood.shadow.bias = -0.0004;
  scene.add(flood);

  // ── textures ──────────────────────────────────────────────────
  const txl = new THREE.TextureLoader();
  const turfTex = tex(txl, "/about/turf.jpg", 8, 7);
  const crowdTex = tex(txl, "/about/crowd.jpg", 34, 7);
  const ballTex = tex(txl, "/about/ball.jpg");
  ballTex.wrapS = ballTex.wrapT = THREE.ClampToEdgeWrapping;
  const netTex = makeNetTexture();

  // ── radial "paint-in" reveal: patch a material to discard beyond a world radius ─
  const revealSetters: ((r: number) => void)[] = [];
  function patchReveal(material: THREE.Material) {
    material.onBeforeCompile = (sh) => {
      sh.uniforms.uRevealR = { value: 0 };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWXZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(transformed,1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uRevealR;\nvarying vec3 vWXZ;")
        .replace("#include <dithering_fragment>", "if (length(vWXZ.xz) > uRevealR) discard;\n#include <dithering_fragment>");
      (material as THREE.Material & { __sh?: typeof sh }).__sh = sh;
    };
    revealSetters.push((r) => {
      const s = (material as THREE.Material & { __sh?: { uniforms: { uRevealR: { value: number } } } }).__sh;
      if (s) s.uniforms.uRevealR.value = r;
    });
  }

  const solid = new THREE.Group();
  scene.add(solid);

  // the whole bowl interior is lush grass (no black gaps) — an oval turf "ground" that
  // tucks under the stands; the white-lined field sits in the middle with grass run-off.
  const groundGeo = new THREE.CircleGeometry(1, 96);
  groundGeo.rotateX(-Math.PI / 2);
  groundGeo.scale(BOWL_RX + 2, 1, BOWL_RZ + 2);
  const pitchMat = new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.96, metalness: 0 });
  patchReveal(pitchMat);
  const ground = new THREE.Mesh(groundGeo, pitchMat);
  ground.receiveShadow = true;
  solid.add(ground);

  // markings (soft white — not blinding) hovering just above the turf
  const markMat = new THREE.MeshBasicMaterial({ map: makeMarkingsTexture(), transparent: true, opacity: 0.78, depthWrite: false, color: 0xaeb8c4 });
  patchReveal(markMat);
  const markings = new THREE.Mesh(new THREE.PlaneGeometry(PITCH_L, PITCH_W), markMat);
  markings.rotation.x = -Math.PI / 2;
  markings.position.y = 0.05;
  solid.add(markings);

  // the bowl (tiered neon stands) — rises from the footprint
  const bowl = buildBowl(crowdTex);
  solid.add(bowl.group);

  // goals
  const goalL = buildGoal(netTex, patchReveal);
  const goalR = buildGoal(netTex, patchReveal);
  goalL.position.set(-HALF_L, 0, 0);
  goalR.position.set(HALF_L, 0, 0);
  goalR.rotation.y = Math.PI;
  solid.add(goalL, goalR);

  // ── neon energy-grid (the entry) ──────────────────────────────
  const grid = buildGrid();
  scene.add(grid.line);

  // ── ball ──────────────────────────────────────────────────────
  const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, color: 0xa6a6a6, roughness: 0.78, metalness: 0, transparent: true, opacity: 0 });
  const BALL_R = 1.5;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), ballMat);
  ball.castShadow = false; // turned on only once the ball is actually visible
  ball.visible = false;
  ball.position.set(0, BALL_R, 0);
  solid.add(ball);
  const GOAL_HALF = 3.7;
  const GOAL_DEPTH = 2.4;
  const B = { x: 0, z: 0, vx: 0, vz: 0, r: BALL_R, dragging: false, scored: false, resetAt: 0, last: [] as { x: number; z: number; t: number }[] };

  // ── post-processing ──────────────────────────────────────────
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.5, 0.6);
  composer.addPass(bloom);

  // ── camera crane ─────────────────────────────────────────────
  const camCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 380, 0.01),
    new THREE.Vector3(0, 250, 8),
    new THREE.Vector3(0, 150, 38),
    new THREE.Vector3(0, 98, 66),
    new THREE.Vector3(0, 66, 90),
  ]);
  const tgtStart = new THREE.Vector3(0, 0, 0);
  const tgtEnd = new THREE.Vector3(0, 13, -2);

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const planeXZ = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  let progress = 0;
  let active = true;
  const clock = new THREE.Clock();
  let elapsed = 0;

  function setProgress(p: number) {
    progress = THREE.MathUtils.clamp(p, 0, 1);
    const e = easeInOut(progress);
    camCurve.getPoint(e, camera.position);
    camera.lookAt(tgtStart.clone().lerp(tgtEnd, e));

    // grid is already drawn (forming happens in the approach phase, pre-pin); here it
    // just calms its squiggle and hands off to the solid stadium
    grid.setReveal(1.12);
    grid.setSquiggle(1 - smoothRange(progress, 0.04, 0.42) * 0.85);
    grid.setOpacity(1 - smoothRange(progress, 0.34, 0.58));
    grid.line.visible = progress < 0.62;

    // the pitch + apron + goals paint in radially from the centre (build, not fade)
    const revealR = smoothRange(progress, 0.18, 0.56) * REVEAL_MAX;
    for (const set of revealSetters) set(revealR);

    // the stands rise from the footprint + ignite
    bowl.setReveal(smoothRange(progress, 0.22, 0.34), smoothRange(progress, 0.26, 0.66), smoothRange(progress, 0.32, 0.74));

    ballMat.opacity = smoothRange(progress, 0.82, 0.94);
    ball.visible = ballMat.opacity > 0.02; // no ghost shadow before the ball exists
    ball.castShadow = ballMat.opacity > 0.55;

    bgColor.copy(new THREE.Color(BLUE)).lerp(new THREE.Color(NIGHT), smoothRange(progress, 0.34, 0.74));
    scene.background = bgColor;
    (scene.fog as THREE.Fog).color = bgColor;
  }

  // the approach (pre-pin): the energy-grid draws itself on, top-down, as the section
  // rises into view — so the lines start the instant you leave the previous section.
  function setApproach(a: number) {
    const e = THREE.MathUtils.clamp(a, 0, 1);
    camCurve.getPoint(0, camera.position);
    camera.lookAt(tgtStart);
    grid.line.visible = true;
    grid.setReveal(e * 1.12);
    grid.setSquiggle(1);
    grid.setOpacity(1);
  }

  function stepBall() {
    if (ballMat.opacity < 0.5) return;
    if (B.resetAt && performance.now() > B.resetAt) resetBall(); // kick-off after a goal
    if (!B.dragging) {
      B.vx *= 0.985; B.vz *= 0.985;
      if (Math.hypot(B.vx, B.vz) < 0.02) { B.vx = 0; B.vz = 0; }
      B.x += B.vx; B.z += B.vz;
      bounds();
    }
    ball.position.set(B.x, B.r, B.z);
  }
  // touchlines bounce; the two goal mouths let the ball THROUGH (clean score), then it
  // settles in the net for a beat before the centre-spot kick-off reset.
  function bounds() {
    const bx = HALF_L - B.r;
    const bz = HALF_W - B.r;
    if (B.z > bz) { B.z = bz; B.vz *= -0.72; }
    else if (B.z < -bz) { B.z = -bz; B.vz *= -0.72; }

    const inMouth = Math.abs(B.z) < GOAL_HALF;
    if (inMouth) {
      if (!B.scored && B.x > HALF_L) return goal("home");
      if (!B.scored && B.x < -HALF_L) return goal("away");
      if (B.scored) {
        const into = HALF_L + GOAL_DEPTH - B.r; // caught by the net
        if (B.x > into) { B.x = into; B.vx = 0; }
        else if (B.x < -into) { B.x = -into; B.vx = 0; }
      }
      return; // no end-wall bounce inside the mouth
    }
    if (B.x > bx) { B.x = bx; B.vx *= -0.72; }
    else if (B.x < -bx) { B.x = -bx; B.vx *= -0.72; }
  }
  function goal(side: "home" | "away") {
    B.scored = true;
    api.onScore?.(side);
    B.resetAt = performance.now() + 1100; // celebrate in the net, then kick off
  }
  function resetBall() {
    B.x = 0; B.z = 0; B.vx = 0; B.vz = 0; B.scored = false; B.resetAt = 0;
  }

  function pointerToPitch(cx: number, cy: number): THREE.Vector3 | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((cx - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((cy - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return raycaster.ray.intersectPlane(planeXZ, hit) ? hit : null;
  }
  function pointer(cx: number, cy: number, kind: "down" | "move" | "up") {
    if (ballMat.opacity < 0.5) return;
    const hit = pointerToPitch(cx, cy);
    if (kind === "down") {
      if (hit && Math.hypot(hit.x - B.x, hit.z - B.z) < 7) {
        B.dragging = true; B.vx = 0; B.vz = 0;
        B.last = [{ x: hit.x, z: hit.z, t: performance.now() }];
      }
    } else if (kind === "move" && B.dragging && hit) {
      B.x = THREE.MathUtils.clamp(hit.x, -HALF_L + 2, HALF_L - 2);
      B.z = THREE.MathUtils.clamp(hit.z, -HALF_W + 2, HALF_W - 2);
      B.last.push({ x: B.x, z: B.z, t: performance.now() });
      if (B.last.length > 6) B.last.shift();
    } else if (kind === "up" && B.dragging) {
      B.dragging = false;
      const a = B.last[0], b = B.last[B.last.length - 1];
      if (a && b && b.t > a.t) {
        const dt = (b.t - a.t) / 16;
        B.vx = ((b.x - a.x) / dt) * 1.2;
        B.vz = ((b.z - a.z) / dt) * 1.2;
      }
    }
  }

  let raf = 0;
  function frame() {
    const dt = clock.getDelta();
    elapsed += dt;
    grid.update(elapsed);
    stepBall();
    composer.render();
    raf = requestAnimationFrame(frame);
  }
  function setActive(on: boolean) {
    if (on === active) return;
    active = on;
    if (on) raf = requestAnimationFrame(frame);
    else cancelAnimationFrame(raf);
  }
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  setProgress(0);
  raf = requestAnimationFrame(frame);

  function kick(vx: number, vz: number) {
    if (ballMat.opacity < 0.5) return;
    B.dragging = false; B.scored = false; B.resetAt = 0; B.vx = vx; B.vz = vz;
  }

  const api: AboutExperience = {
    setProgress, setApproach, kick, resize, setActive, pointer, resetBall,
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    },
  };
  return api;
}

// ───────────────────────── helpers ─────────────────────────────
function tex(loader: THREE.TextureLoader, url: string, rx = 1, ry = 1) {
  const t = loader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}
function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function smoothRange(p: number, a: number, b: number) {
  const t = THREE.MathUtils.clamp((p - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeNetTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  x.strokeStyle = "rgba(255,255,255,0.6)";
  x.lineWidth = 1.5;
  for (let i = 0; i <= 128; i += 9) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1.5);
  return t;
}

function makeMarkingsTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = Math.round((W * PITCH_W) / PITCH_L);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  const sx = W / 105; // proportion markings to a real 105 m pitch, drawn into the field plane
  const m = (v: number) => v * sx;
  x.strokeStyle = "rgba(255,255,255,0.95)";
  x.lineWidth = Math.max(2, m(0.2));
  x.lineCap = "round";
  const inset = m(2.5);
  x.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  x.beginPath(); x.moveTo(W / 2, inset); x.lineTo(W / 2, H - inset); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, m(9.15), 0, Math.PI * 2); x.stroke();
  dot(x, W / 2, H / 2, m(0.5));
  for (const dir of [1, -1]) {
    const edge = dir === 1 ? inset : W - inset;
    const penW = m(16.5), penH = m(40.3), gaW = m(5.5), gaH = m(18.3);
    rectFrom(x, edge, dir, penW, penH, H);
    rectFrom(x, edge, dir, gaW, gaH, H);
    const spotX = edge + dir * m(11);
    dot(x, spotX, H / 2, m(0.5));
    x.beginPath();
    x.arc(spotX, H / 2, m(9.15), dir === 1 ? -0.9 : Math.PI - 0.9, dir === 1 ? 0.9 : Math.PI + 0.9);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function rectFrom(x: CanvasRenderingContext2D, edge: number, dir: number, w: number, h: number, H: number) {
  x.strokeRect(dir === 1 ? edge : edge - w, H / 2 - h / 2, w, h);
}
function dot(x: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  x.beginPath(); x.arc(cx, cy, Math.max(2, r), 0, Math.PI * 2);
  x.fillStyle = "rgba(255,255,255,0.95)"; x.fill();
}

function buildBowl(crowd: THREE.Texture) {
  const steps: [number, number][] = [
    [1.0, 0.0], [1.0, 2.6], [1.16, 3.0], [1.22, 9.5], [1.4, 10.2],
    [1.48, 18.5], [1.68, 19.4], [1.78, 29.5], [2.02, 30.6], [2.12, 41.0],
  ];
  const profile = steps.map(([r, h]) => new THREE.Vector2(r, h));
  const geo = new THREE.LatheGeometry(profile, 100);
  geo.scale(BOWL_RX, 1, BOWL_RZ);
  const mat = new THREE.MeshStandardMaterial({
    map: crowd, emissive: new THREE.Color(BLUE), emissiveMap: crowd, emissiveIntensity: 0,
    roughness: 0.65, metalness: 0.1, side: THREE.DoubleSide, transparent: true, opacity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    setReveal(appear: number, rise: number, ignite: number) {
      mat.opacity = appear;
      mat.emissiveIntensity = ignite * 1.9;
      group.scale.y = 0.03 + rise * 0.97;
    },
  };
}

// a real-looking soccer goal: white frame + back/roof net cage
function buildGoal(net: THREE.Texture, patch: (m: THREE.Material) => void): THREE.Group {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.05 });
  patch(white);
  const H = 2.44, W = 7.32, D = 2.4, R = 0.17;
  const cyl = (len: number) => new THREE.CylinderGeometry(R, R, len, 12);
  const post = (geo: THREE.BufferGeometry, x: number, y: number, z: number, rot?: [number, number, number]) => {
    const msh = new THREE.Mesh(geo, white);
    msh.position.set(x, y, z);
    if (rot) msh.rotation.set(...rot);
    msh.castShadow = true;
    g.add(msh);
  };
  // front frame (on the goal line, opening faces +x toward the pitch)
  post(cyl(H), 0, H / 2, W / 2);
  post(cyl(H), 0, H / 2, -W / 2);
  post(cyl(W), 0, H, 0, [Math.PI / 2, 0, 0]); // crossbar
  // back base + short back posts
  post(cyl(W), -D, R, 0, [Math.PI / 2, 0, 0]);
  post(cyl(1.0), -D, 0.5, W / 2);
  post(cyl(1.0), -D, 0.5, -W / 2);

  const netMat = new THREE.MeshBasicMaterial({ map: net, transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false });
  patch(netMat);
  // back wall net (slopes from crossbar down to back base)
  const slope = Math.hypot(D, H - 1.0);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(slope, W), netMat);
  back.position.set(-D / 2, (H + 1.0) / 2, 0);
  back.rotation.set(0, Math.PI / 2, Math.atan2(H - 1.0, D));
  g.add(back);
  // roof net
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(D, W), netMat);
  roof.position.set(-D / 2, H - 0.02, 0);
  roof.rotation.x = -Math.PI / 2;
  g.add(roof);
  return g;
}

// the neon energy-grid: concentric ellipses + radial spokes, drawn with a custom
// shader that draws-on from the centre, undulates (squiggle) and glows (additive).
function buildGrid() {
  const ringN = 9, segN = 64, spokeN = 30, rFrom = 0.42, rTo = 2.12;
  const pos: number[] = [];
  const aR: number[] = [];
  const aA: number[] = [];
  const push = (f: number, ang: number) => {
    pos.push(Math.cos(ang) * f * BOWL_RX, 0.06, Math.sin(ang) * f * BOWL_RZ);
    aR.push(f / rTo);
    aA.push(ang);
  };
  for (let i = 0; i < ringN; i++) {
    const f = rFrom + (rTo - rFrom) * (i / (ringN - 1));
    for (let s = 0; s < segN; s++) {
      push(f, (s / segN) * Math.PI * 2);
      push(f, ((s + 1) / segN) * Math.PI * 2);
    }
  }
  for (let s = 0; s < spokeN; s++) {
    const ang = (s / spokeN) * Math.PI * 2;
    push(rFrom, ang);
    push(rTo, ang);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aR", new THREE.Float32BufferAttribute(aR, 1));
  geo.setAttribute("aA", new THREE.Float32BufferAttribute(aA, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 1 },
      uSquiggle: { value: 1 },
      uColA: { value: new THREE.Color(0x5f7bff) },
      uColB: { value: new THREE.Color(0xdfeaff) },
    },
    vertexShader: `
      uniform float uTime, uSquiggle;
      attribute float aR; attribute float aA;
      varying float vR; varying float vGlow;
      void main(){
        vec3 p = position;
        float r = length(p.xz);
        vec2 dir = r > 0.001 ? normalize(p.xz) : vec2(1.0,0.0);
        vec2 perp = vec2(-dir.y, dir.x);
        float w1 = sin(aA*6.0 + uTime*1.6 + r*0.05);
        float w2 = sin(aA*3.0 - uTime*1.1 + r*0.025);
        float amp = uSquiggle * (1.2 + r*0.02);
        p.x += dir.x*w1*amp + perp.x*w2*amp*0.6;
        p.z += dir.y*w1*amp + perp.y*w2*amp*0.6;
        p.y += sin(aA*4.0 + uTime*1.3)*uSquiggle*0.5;
        vR = aR;
        vGlow = 0.5 + 0.5*sin(r*0.1 - uTime*2.4);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
      }`,
    fragmentShader: `
      uniform float uReveal, uOpacity;
      uniform vec3 uColA, uColB;
      varying float vR; varying float vGlow;
      void main(){
        float a = smoothstep(uReveal, uReveal-0.14, vR);
        if (a <= 0.002) discard;
        float edge = smoothstep(uReveal-0.07, uReveal, vR);
        vec3 col = mix(uColA, uColB, vGlow*0.7) + edge*1.8;
        gl_FragColor = vec4(col*(0.7+vGlow*0.7), a*uOpacity);
      }`,
  });
  const line = new THREE.LineSegments(geo, mat);
  return {
    line,
    update(t: number) { mat.uniforms.uTime.value = t; },
    setReveal(v: number) { mat.uniforms.uReveal.value = v; },
    setOpacity(v: number) { mat.uniforms.uOpacity.value = v; },
    setSquiggle(v: number) { mat.uniforms.uSquiggle.value = v; },
  };
}
