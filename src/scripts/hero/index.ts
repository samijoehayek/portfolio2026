// Hero orchestrator: boots the Rive character (clouds + face rig) and feeds the
// cursor into its data-binding View Model (pointerX/pointerY, 0–100). Mirrors the
// Rive web-runtime best practices: resizeDrawingSurfaceToCanvas() on load + resize,
// IntersectionObserver pause offscreen, prefers-reduced-motion pause, full cleanup.
// Returns a teardown fn so the Astro island can dispose on View-Transition swaps.
import { Rive, Layout, Fit, Alignment } from "@rive-app/canvas";

export function initHero(): (() => void) | void {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return;
  const canvas = hero.querySelector<HTMLCanvasElement>("[data-rivecanvas]");
  if (!canvas) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // pointer state, written into the View Model once per frame (rAF-throttled)
  let pointerX: { value: number } | null = null;
  let pointerY: { value: number } | null = null;
  let pending: { x: number; y: number } | null = null;
  let raf = 0;

  const rive = new Rive({
    src: "/hero-section.riv",
    canvas,
    // artboard omitted → use the file's default ("Slide 16:9 - 1")
    stateMachines: "State Machine 1",
    autoplay: !reduce,
    autoBind: true, // bind the default ViewModelInstance → rive.viewModelInstance
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    onLoad: () => {
      rive.resizeDrawingSurfaceToCanvas(); // crisp on hi-DPI — must run after load
      const vmi = (rive as unknown as {
        viewModelInstance?: { number(name: string): { value: number } | null };
      }).viewModelInstance;
      pointerX = vmi?.number("pointerX") ?? null;
      pointerY = vmi?.number("pointerY") ?? null;
    },
    onLoadError: (e) => console.error("[hero] Rive failed to load", e),
  });

  // ── cursor → View Model (full viewport; Rive Y is bottom-up, so invert) ──
  const onMove = (e: PointerEvent) => {
    pending = { x: e.clientX, y: e.clientY };
    if (!raf) raf = requestAnimationFrame(flush);
  };
  const flush = () => {
    raf = 0;
    if (pending && pointerX && pointerY) {
      pointerX.value = (pending.x / window.innerWidth) * 100;
      pointerY.value = 100 - (pending.y / window.innerHeight) * 100;
      pending = null;
    }
  };
  if (!reduce) window.addEventListener("pointermove", onMove, { passive: true });

  // ── keep the drawing surface crisp on resize / DPR change ──
  const ro = new ResizeObserver(() => rive.resizeDrawingSurfaceToCanvas());
  ro.observe(canvas);

  // ── pause the state machine when the hero is offscreen ──
  const io = new IntersectionObserver(
    ([entry]) => {
      if (reduce) return;
      entry.isIntersecting ? rive.play() : rive.pause();
    },
    { threshold: 0.01 },
  );
  io.observe(hero);

  // ── teardown ──
  return () => {
    window.removeEventListener("pointermove", onMove);
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    rive.cleanup();
  };
}
