// Work-section cyclist: a small autoplaying Rive scene (buzzcut cyclist drinking +
// breathing loop) placed on the road at the right of the Work section. Mirrors the
// hero's Rive best-practices: resizeDrawingSurfaceToCanvas on load + resize,
// IntersectionObserver pause offscreen, prefers-reduced-motion static, full cleanup.
// Returns a teardown fn so the Astro island can dispose on View-Transition swaps.
import { Rive, Layout, Fit, Alignment } from "@rive-app/canvas";

export function initWorkCyclist(): (() => void) | void {
  const section = document.querySelector<HTMLElement>("[data-work]");
  if (!section) return;
  const canvas = section.querySelector<HTMLCanvasElement>("[data-cyclist]");
  if (!canvas) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const rive = new Rive({
    src: "/work-section.riv",
    canvas,
    artboard: "Cyclist_Rig",
    stateMachines: "State Machine 1",
    autoplay: !reduce,
    layout: new Layout({ fit: Fit.Contain, alignment: Alignment.BottomCenter }),
    onLoad: () => rive.resizeDrawingSurfaceToCanvas(), // crisp on hi-DPI — after load
    onLoadError: (e) => console.error("[work] cyclist Rive failed to load", e),
  });

  // keep the drawing surface crisp on resize / DPR change
  const ro = new ResizeObserver(() => rive.resizeDrawingSurfaceToCanvas());
  ro.observe(canvas);

  // only animate while the cyclist is actually on screen
  const io = new IntersectionObserver(
    ([entry]) => {
      if (reduce) return;
      entry.isIntersecting ? rive.play() : rive.pause();
    },
    { threshold: 0.01 },
  );
  io.observe(canvas);

  return () => {
    ro.disconnect();
    io.disconnect();
    rive.cleanup();
  };
}
