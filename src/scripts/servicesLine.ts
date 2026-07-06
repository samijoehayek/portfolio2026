// Services "laundry line" — the row of cards hangs from a fixed cord and swings
// like washing. You grab-and-fling the row (with inertia) end to end; the motion
// velocity tilts each card ±8° and it settles upright when still. The section does
// NOT move with page scroll. Transform-only, gsap.quickTo for the damped return.
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";

gsap.registerPlugin(Draggable, InertiaPlugin);

const MAX_TILT = 8; // degrees — the clamp from the analysis
const DRAG_K = 0.012; // px/s → degrees (a hard flick ≈ ±8°)

export function initServicesLine(): void {
  const section = document.querySelector<HTMLElement>("[data-services]");
  if (!section || section.dataset.booted) return;
  section.dataset.booted = "1";

  const scroller = section.querySelector<HTMLElement>("[data-scroller]");
  const track = section.querySelector<HTMLElement>("[data-track]");
  const inners = gsap.utils.toArray<HTMLElement>("[data-inner]");
  if (!scroller || !track || inners.length === 0) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── word-cycle on every card's journey pair ───────────────
  startWordCycle(section, reduce);

  if (reduce) {
    // Native horizontal scroll handles it (CSS); no inertia, no swing. Done.
    return;
  }

  // ── geometry ──────────────────────────────────────────────
  let minX = 0; // most-negative x (last card flush right); maxX is always 0
  const cards = gsap.utils.toArray<HTMLElement>(
    section.querySelectorAll(".service-card"),
  );
  let step = 0; // distance between consecutive card left edges (card width + gap)
  const measure = () => {
    minX = Math.min(0, scroller.clientWidth - track.scrollWidth);
    step =
      cards.length > 1
        ? cards[1].offsetLeft - cards[0].offsetLeft
        : (inners[0]?.offsetWidth ?? 360);
  };
  measure();

  // Mobile: snap the row so every swipe lands a card at the same left position
  // (the next card peeks in) — a clean "these are swipeable cards" feel. Desktop
  // keeps its free grab-and-fling, so it stays unchanged.
  const snapOn = window.matchMedia("(max-width: 860px)").matches;
  const snapX = (v: number) =>
    step ? gsap.utils.clamp(minX, 0, Math.round(v / step) * step) : v;

  const clampX = (x: number) => gsap.utils.clamp(minX, 0, x);
  const getX = () => (gsap.getProperty(track, "x") as number) || 0;

  // ── the swing: one damped rotation setter per card ────────
  const setRot = inners.map((el) =>
    gsap.quickTo(el, "rotation", { duration: 0.6, ease: "power3" }),
  );
  let settleTimer: number | undefined;
  const settle = () => setRot.forEach((fn) => fn(0));
  function applySwing(velocity: number) {
    const rot = gsap.utils.clamp(-MAX_TILT, MAX_TILT, -velocity * DRAG_K); // lags travel
    setRot.forEach((fn) => fn(rot));
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(settle, 140); // ease upright when motion stops
  }

  // ── drag + momentum (the only thing that moves the row) ───
  const draggable = Draggable.create(track, {
    type: "x",
    inertia: true,
    cursor: "grab",
    activeCursor: "grabbing",
    allowNativeTouchScrolling: true, // keep vertical page scroll on touch
    bounds: { minX, maxX: 0 },
    snap: snapOn ? { x: snapX } : undefined, // mobile: land a card per swipe
    onDrag(this: Draggable) {
      applySwing(this.deltaX * 60); // deltaX (px/tick) → ~px/s
    },
    onThrowUpdate(this: Draggable) {
      applySwing(this.deltaX * 60);
    },
    onDragEnd: settle,
    onThrowComplete: settle,
  })[0];

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
      onComplete: () => draggable.update(),
    });
    applySwing(-dx * 4);
  }

  // ── resize ────────────────────────────────────────────────
  let rt: number | undefined;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      measure();
      draggable.applyBounds({ minX, maxX: 0 });
      gsap.set(track, { x: clampX(getX()) });
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
