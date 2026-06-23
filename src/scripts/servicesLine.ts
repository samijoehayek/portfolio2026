// Services "laundry line" — the row of cards hangs from a fixed cable and swings
// like washing. Page scroll AND grab-drag (with inertia) move the row; the motion
// velocity tilts each card ±8° and it settles upright when still.
// Transform-only, gsap.quickTo for the damped return, prefers-reduced-motion safe.
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(Draggable, InertiaPlugin, ScrollTrigger);

const MAX_TILT = 8; // degrees — the clamp from the analysis
const DRAG_K = 0.012; // px/s → degrees (a hard flick ≈ ±8°)
const SCROLL_K = 0.01; // scroll px/s → degrees

export function initServicesLine(): void {
  const section = document.querySelector<HTMLElement>("[data-services]");
  if (!section || section.dataset.booted) return;
  section.dataset.booted = "1";

  const scroller = section.querySelector<HTMLElement>("[data-scroller]");
  const track = section.querySelector<HTMLElement>("[data-track]");
  const cable = section.querySelector<HTMLElement>("[data-cable]");
  const inners = gsap.utils.toArray<HTMLElement>("[data-inner]");
  if (!scroller || !track || inners.length === 0) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // The cable spans the whole (wider-than-viewport) track and never moves.
  const sizeCable = () => {
    if (cable) cable.style.width = `${track.scrollWidth}px`;
  };
  sizeCable();

  // ── word-cycle on every card's journey pair ───────────────
  startWordCycle(section, reduce);

  if (reduce) {
    // Native horizontal scroll handles it (CSS); no inertia, no swing. Done.
    window.addEventListener("resize", sizeCable);
    return;
  }

  // ── geometry ──────────────────────────────────────────────
  let minX = 0; // most-negative x (last card flush right); maxX is always 0
  const measure = () => {
    minX = Math.min(0, scroller.clientWidth - track.scrollWidth);
    sizeCable();
  };
  measure();

  const clampX = (x: number) => gsap.utils.clamp(minX, 0, x);
  const setX = (x: number) => gsap.set(track, { x });
  const getX = () => (gsap.getProperty(track, "x") as number) || 0;

  // ── the swing: one damped rotation setter per card ────────
  const setRot = inners.map((el) =>
    gsap.quickTo(el, "rotation", { duration: 0.6, ease: "power3" }),
  );
  let settleTimer: number | undefined;
  const settle = () => setRot.forEach((fn) => fn(0));
  function applySwing(velocity: number, k: number) {
    const rot = gsap.utils.clamp(-MAX_TILT, MAX_TILT, -velocity * k); // lags travel
    setRot.forEach((fn) => fn(rot));
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 140); // ease upright when motion stops
  }

  // ── drag + momentum ───────────────────────────────────────
  let pointerActive = false;
  const draggable = Draggable.create(track, {
    type: "x",
    inertia: true,
    cursor: "grab",
    activeCursor: "grabbing",
    allowNativeTouchScrolling: true, // keep vertical page scroll on touch
    bounds: { minX, maxX: 0 },
    onPress() {
      pointerActive = true;
    },
    onDrag(this: Draggable) {
      applySwing(this.deltaX * 60, DRAG_K); // deltaX (px/tick) → ~px/s
    },
    onThrowUpdate(this: Draggable) {
      applySwing(this.deltaX * 60, DRAG_K);
    },
    onDragEnd() {
      pointerActive = false;
      settle();
    },
    onThrowComplete() {
      pointerActive = false;
      settle();
    },
  })[0];

  // ── scroll coupling (no pin): map section progress → x ────
  // dragOffset preserves where the user left the row so scroll adds to it
  // instead of snapping back to the progress-derived baseline.
  let dragOffset = 0;
  const baseX = (progress: number) => progress * minX; // 0 → minX
  const syncOffset = () => {
    dragOffset = getX() - baseX(scrollProgress);
  };
  let scrollProgress = 0;

  // keep the offset honest once a throw/drag settles
  draggable.addEventListener("dragend", syncOffset);
  draggable.addEventListener("throwcomplete", syncOffset);

  ScrollTrigger.create({
    trigger: section,
    start: "top bottom",
    end: "bottom top",
    onUpdate(self) {
      scrollProgress = self.progress;
      if (pointerActive || draggable.isThrowing) return;
      const x = clampX(baseX(scrollProgress) + dragOffset);
      setX(x);
      draggable.x = x;
      draggable.update(); // keep Draggable's internal model in sync
      applySwing(self.getVelocity(), SCROLL_K);
    },
  });

  // ── keyboard nav (a11y) ───────────────────────────────────
  let inView = false;
  new IntersectionObserver((e) => (inView = e[0]?.isIntersecting ?? false), {
    threshold: 0.2,
  }).observe(section);
  window.addEventListener("keydown", (e) => {
    if (!inView) return;
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    const step = (inners[0]?.offsetWidth ?? 360) + 40;
    if (e.key === "ArrowRight") nudge(-step);
    else if (e.key === "ArrowLeft") nudge(step);
  });
  function nudge(dx: number) {
    const x = clampX(getX() + dx);
    gsap.to(track, {
      x,
      duration: 0.5,
      ease: "power3.out",
      onUpdate: () => {
        draggable.x = getX();
      },
      onComplete: () => {
        draggable.update();
        dragOffset = x - baseX(scrollProgress);
      },
    });
    applySwing(-dx * 4, DRAG_K);
  }

  // ── resize ────────────────────────────────────────────────
  let rt: number | undefined;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      measure();
      draggable.applyBounds({ minX, maxX: 0 });
      setX(clampX(getX()));
      ScrollTrigger.refresh();
    }, 150);
  });
}

// each card's two journey words alternate which one is "lit" (accent fill)
function startWordCycle(section: HTMLElement, reduce: boolean): void {
  const cards = gsap.utils.toArray<HTMLElement>(
    section.querySelectorAll(".service-card__journey"),
  );
  cards.forEach((j, i) => {
    const words = j.querySelectorAll<HTMLElement>(".word");
    if (words.length < 2) return;
    if (reduce) {
      words[1].classList.add("is-lit");
      return;
    }
    let lit = 0;
    words[lit].classList.add("is-lit");
    window.setInterval(() => {
      words[lit].classList.remove("is-lit");
      lit = (lit + 1) % words.length;
      words[lit].classList.add("is-lit");
    }, 1600 + i * 120); // stagger so the row shimmers rather than blinks in unison
  });
}
