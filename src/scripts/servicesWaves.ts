// Services wave background — the layered blue ribbons behind the "laundry line".
// Five stacked, in-family blue waves (lightest at back → pure --c-blue at the front)
// give the section depth; the front wave IS --c-blue so it bleeds into the stadium
// (About) below. Shape + colour + entrance live in ServicesSection.astro; this file
// owns the MOTION: a gentle always-on "breathing" (sine drift) plus a scroll-linked
// horizontal parallax so the curves slide past each other as you scroll through.
//
// Transform-only (GPU), one rAF loop that runs ONLY while the section is on screen,
// and a hard bail under prefers-reduced-motion. No GSAP — plain DOM, like the swing
// script's lighter cousins.

// per-layer motion tuning, back (0) → front (4). Front layers drift a touch more so
// the parallax reads as depth; alternating sign makes adjacent ribbons cross.
const IDLE_AMP = [34, 27, 21, 16, 12]; // px — breathing sway (bounded, no wrap needed)
const IDLE_FREQ = [0.12, 0.15, 0.18, 0.22, 0.26]; // rad/s — slow, each a little different
const IDLE_PHASE = [0, 1.1, 2.3, 3.4, 4.6]; // desync so they never sway in unison
// px shifted per px scrolled — the scroll parallax. Alternating sign + increasing
// magnitude front→back makes the ribbons visibly slide past each other as you scroll.
const DRIFT_SPEED = [-0.1, 0.15, -0.2, 0.27, -0.34];

export function initServicesWaves(): void {
  const section = document.querySelector<HTMLElement>("[data-services]");
  if (!section || section.dataset.wavesBooted) return;

  const layers = Array.from(
    section.querySelectorAll<HTMLElement>("[data-wave] .services__wave-inner"),
  );
  if (layers.length === 0) return;

  section.dataset.wavesBooted = "1";

  // reduced motion: leave the waves static at rest (CSS never hides them either).
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let running = false;
  let rafId = 0;

  const frame = () => {
    const rect = section.getBoundingClientRect();
    // px the section top has scrolled past the top of the viewport (0 → +as it leaves)
    const scrolled = -rect.top;
    const t = performance.now() / 1000;
    // never shift more than the smallest layer overhang (--tile is 54–72vw), so a
    // long scroll can't expose a tile edge on any aspect ratio.
    const maxOff = window.innerWidth * 0.45;

    for (let i = 0; i < layers.length; i++) {
      const idle = IDLE_AMP[i] * Math.sin(t * IDLE_FREQ[i] + IDLE_PHASE[i]);
      const drift = scrolled * DRIFT_SPEED[i];
      const off = Math.max(-maxOff, Math.min(maxOff, idle + drift));
      // rounded to 0.1px to avoid sub-pixel churn; translateX only — the outer
      // .services__wave owns the Y entrance transform, so these never fight.
      layers[i].style.transform = `translate3d(${off.toFixed(1)}px,0,0)`;
    }

    if (running) rafId = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  // only animate while the section is anywhere near the viewport
  const io = new IntersectionObserver(
    (entries) => (entries[0]?.isIntersecting ? start() : stop()),
    { rootMargin: "20% 0px 20% 0px" },
  );
  io.observe(section);

  // pause when the tab is hidden (no point burning frames)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (isInView(section)) start();
  });
}

function isInView(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return r.bottom > -vh * 0.2 && r.top < vh * 1.2;
}
