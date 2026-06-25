// Contact guitar — the playable instrument (horizontal).
//   • Sound: Karplus–Strong plucked-string synthesis in raw WebAudio (no samples).
//   • Motion: each string SVG <path> bows in Y then twangs out via a GSAP elastic ease.
//   • Input: HOVER-STRUM — moving the pointer across a string plucks it (no click).
//     Number keys 1–6 also pluck, Enter strums, for keyboard access.
// AudioContext is created lazily and resumed on the first user gesture (browser rule).
import gsap from "gsap";

type StringEl = {
  el: SVGPathElement;
  hit: SVGPathElement;
  x1: number; y: number; x2: number;
  freq: number;
  key: string;
  state: { off: number };
  cx: number;   // last pluck x (control-point), in SVG units
  busy: boolean; // currently ringing → don't re-trigger every mousemove
};

export function initContactGuitar(): void {
  const wrap = document.querySelector<HTMLElement>("[data-guitar]");
  if (!wrap || wrap.dataset.booted) return;
  wrap.dataset.booted = "1";

  const svg = wrap.querySelector<SVGSVGElement>("svg.gtr");
  if (!svg) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const paths = Array.from(wrap.querySelectorAll<SVGPathElement>("[data-string]"));
  const hits = Array.from(wrap.querySelectorAll<SVGPathElement>("[data-string-hit]"));
  const strings: StringEl[] = paths.map((el, i) => ({
    el,
    hit: hits[i] ?? el,
    x1: +el.dataset.x1!, y: +el.dataset.y1!, x2: +el.dataset.x2!,
    freq: +el.dataset.freq!,
    key: el.dataset.key ?? "",
    state: { off: 0 },
    cx: 0,
    busy: false,
  }));

  const draw = (s: StringEl) => {
    // horizontal string: a quadratic bowed in Y, control point under the pluck x
    const cx = s.cx || (s.x1 + s.x2) / 2;
    const d = `M${s.x1} ${s.y} Q${cx} ${s.y + s.state.off} ${s.x2} ${s.y}`;
    s.el.setAttribute("d", d);
    s.hit.setAttribute("d", d);
  };

  // ── audio (Karplus–Strong) ──────────────────────────────────
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  const ensureAudio = () => {
    if (reduce) return;
    if (!ac) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }
    if (ac.state === "suspended") void ac.resume();
  };

  // Browsers forbid starting audio from mouse-move alone — a real gesture
  // (click / key / tap) is required ONCE per page. So we unlock on the first
  // gesture ANYWHERE on the site (nav click, dragging the stadium ball, a
  // keypress…). By the time the pointer reaches the strings, audio is already
  // live and hover-strum just plays — no click on the guitar needed.
  if (!reduce) {
    const unlockEvents = ["pointerdown", "mousedown", "touchstart", "keydown"];
    const unlock = () => {
      ensureAudio();
      // prime with a silent tick so the first real pluck has zero latency
      if (ac) {
        const b = ac.createBuffer(1, 1, ac.sampleRate);
        const s = ac.createBufferSource();
        s.buffer = b;
        s.connect(ac.destination);
        s.start();
      }
      if (ac && ac.state === "running") {
        unlockEvents.forEach((ev) => window.removeEventListener(ev, unlock, true));
      }
    };
    unlockEvents.forEach((ev) => window.addEventListener(ev, unlock, true));
  }

  const tone = (freq: number, dur = 1.7) => {
    if (!ac || !master) return;
    const sr = ac.sampleRate;
    const N = Math.max(2, Math.round(sr / freq));
    const len = Math.floor(sr * dur);
    const buf = ac.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    const R = Math.min(0.997, 0.992 + N / 40000); // damping: highs ring shorter
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const next = ring[(idx + 1) % N];
      out[i] = cur;
      ring[idx] = 0.5 * (cur + next) * R; // canonical KS lowpass feedback
      idx = (idx + 1) % N;
    }
    const fade = Math.min(len, Math.floor(sr * 0.08));
    for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;

    const src = ac.createBufferSource();
    src.buffer = buf;
    const g = ac.createGain();
    g.gain.value = 0.9;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4000;
    src.connect(lp).connect(g).connect(master);
    src.start();
  };

  const pluck = (s: StringEl, atX?: number) => {
    ensureAudio();
    tone(s.freq);
    if (reduce) return;
    s.cx = atX ?? (s.x1 + s.x2) / 2;
    s.busy = true;
    const amp = 26 * (Math.random() < 0.5 ? -1 : 1);
    gsap.killTweensOf(s.state);
    s.state.off = amp;
    draw(s);
    gsap.to(s.state, {
      off: 0,
      duration: 0.9,
      ease: "elastic.out(1, 0.16)",
      onUpdate: () => draw(s),
      onComplete: () => { s.busy = false; },
    });
  };

  // ── hover-strum: map pointer → SVG units, pluck the string we cross into ──
  const pt = svg.createSVGPoint();
  const toSvg = (e: PointerEvent) => {
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : null;
  };
  const BAND = GAP_HALF();
  function GAP_HALF() {
    if (strings.length < 2) return 40;
    return Math.abs(strings[1].y - strings[0].y) / 2;
  }

  const nearest = (svgY: number) => {
    let idx = -1, best = BAND;
    for (let i = 0; i < strings.length; i++) {
      const dy = Math.abs(svgY - strings[i].y);
      if (dy < best) { best = dy; idx = i; }
    }
    return idx;
  };

  let lastHit = -1;
  wrap.addEventListener("pointermove", (e) => {
    const p = toSvg(e);
    if (!p) return;
    const idx = nearest(p.y);
    if (idx === -1) { lastHit = -1; return; }
    // pluck only when we cross into a *new* string (so a swipe strums each once)
    if (idx !== lastHit && !strings[idx].busy) pluck(strings[idx], p.x);
    lastHit = idx;
  });
  wrap.addEventListener("pointerleave", () => { lastHit = -1; });
  // a tap/click on a string also plays it (unlocks audio + instant feedback)
  wrap.addEventListener("pointerdown", (e) => {
    const p = toSvg(e);
    if (!p) return;
    const idx = nearest(p.y);
    if (idx !== -1) pluck(strings[idx], p.x);
  });

  // keyboard access
  let inView = false;
  new IntersectionObserver((es) => { inView = es[0]?.isIntersecting ?? false; }, { threshold: 0.15 })
    .observe(wrap);
  const strum = () => strings.forEach((s, i) => window.setTimeout(() => pluck(s), i * 60));
  window.addEventListener("keydown", (e) => {
    if (!inView) return;
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "Enter") { strum(); e.preventDefault(); return; }
    const s = strings.find((st) => st.key === e.key);
    if (s) { pluck(s); e.preventDefault(); }
  });
}
