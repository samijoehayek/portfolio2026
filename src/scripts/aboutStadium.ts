// About — orchestration. Pins the section and scrubs a single progress value that
// drives the Three.js stadium (camera crane + materialize). Also flies in the ABOUT
// card, wires pointer→ball, and updates the scoreboard. First section to need
// ScrollTrigger, so it does the one-time ScrollTrigger<->Lenis wiring too.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createAboutExperience, type AboutExperience } from "./about/experience";

gsap.registerPlugin(ScrollTrigger);

export function initAboutStadium(): void {
  const section = document.querySelector<HTMLElement>("[data-about]");
  if (!section || section.dataset.booted) return;
  section.dataset.booted = "1";

  const canvas = section.querySelector<HTMLCanvasElement>("[data-canvas]");
  const card = section.querySelector<HTMLElement>("[data-card]");
  const homeEl = section.querySelector<HTMLElement>("[data-home-score]");
  const awayEl = section.querySelector<HTMLElement>("[data-away-score]");
  const scoreboard = section.querySelector<HTMLElement>("[data-scoreboard]");
  if (!canvas) return;

  const exp: AboutExperience = createAboutExperience(canvas);
  let home = 0;
  let away = 0;
  exp.onScore = (side) => {
    if (side === "home") { home += 1; if (homeEl) homeEl.textContent = String(home); }
    else { away += 1; if (awayEl) awayEl.textContent = String(away); }
    if (scoreboard) {
      scoreboard.classList.add("is-flash");
      window.setTimeout(() => scoreboard.classList.remove("is-flash"), 650);
    }
  };

  wireLenisToScrollTrigger();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // pointer → ball. Only claim the pointer when a press actually grabs the ball;
  // otherwise a touch swipe stays free to scroll the pinned section (the canvas is
  // touch-action: pan-y on mobile, so vertical swipes drive the fly-in scrub).
  canvas.addEventListener("pointerdown", (e) => {
    const grabbed = exp.pointer(e.clientX, e.clientY, "down");
    if (grabbed) {
      try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
  });
  canvas.addEventListener("pointermove", (e) => exp.pointer(e.clientX, e.clientY, "move"));
  const up = (e: PointerEvent) => {
    exp.pointer(e.clientX, e.clientY, "up");
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  // double-click / double-tap anywhere brings the ball back to the centre spot
  canvas.addEventListener("dblclick", () => exp.resetBall());

  // pause the renderer when off-screen; track in-view for keyboard play
  let inView = false;
  const io = new IntersectionObserver((es) => {
    inView = es[0]?.isIntersecting ?? false;
    exp.setActive(inView);
  }, { threshold: 0 });
  io.observe(section);

  // keyboard "kick" (a11y): arrows nudge the ball, space resets it
  window.addEventListener("keydown", (e) => {
    if (!inView) return;
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    const K = 6;
    if (e.key === "ArrowRight") exp.kick(K, 0);
    else if (e.key === "ArrowLeft") exp.kick(-K, 0);
    else if (e.key === "ArrowUp") exp.kick(0, -K);
    else if (e.key === "ArrowDown") exp.kick(0, K);
    else if (e.key === " ") exp.resetBall();
    else return;
    e.preventDefault();
  });

  let rt = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => { exp.resize(); ScrollTrigger.refresh(); }, 150);
  });

  if (reduce) {
    exp.setProgress(1);
    if (card) gsap.set(card, { yPercent: 0, opacity: 1 });
    return;
  }
  if (card) gsap.set(card, { yPercent: -120, opacity: 0 });

  const mm = gsap.matchMedia();
  mm.add("(min-width: 861px)", () => build(5.2));
  mm.add("(max-width: 860px)", () => build(4.0));

  function build(endVH: number) {
    // PRE-PIN approach: the grid draws itself on as the section rises into view, so the
    // lines start forming the instant you leave the previous section (not after the pin).
    const approach = ScrollTrigger.create({
      trigger: section,
      start: "top bottom",
      end: "top top",
      scrub: true,
      onUpdate: (self) => exp.setApproach(self.progress),
    });

    const state = { p: 0 };
    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => "+=" + window.innerHeight * endVH,
        pin: true,
        scrub: 1,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });
    tl.to(state, { p: 1, duration: 1, onUpdate: () => exp.setProgress(state.p) }, 0);
    if (card)
      tl.fromTo(
        card,
        { yPercent: -120, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.16, ease: "power3.out" },
        0.62,
      );
    return () => { approach.kill(); tl.scrollTrigger?.kill(); tl.kill(); };
  }
}

function wireLenisToScrollTrigger(): void {
  const w = window as typeof window & {
    lenis?: { on(ev: string, cb: () => void): void };
    __aboutStWired?: boolean;
  };
  if (w.__aboutStWired) return;
  const attach = () => {
    if (w.__aboutStWired || !w.lenis) return;
    w.lenis.on("scroll", ScrollTrigger.update);
    w.__aboutStWired = true;
    ScrollTrigger.refresh();
  };
  if (w.lenis) attach();
  else window.addEventListener("lenis:ready", attach, { once: true });
}
