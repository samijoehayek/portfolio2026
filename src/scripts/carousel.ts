// Project carousel — GSAP slide transitions, height-morph, keyboard/drag/wheel.
// Emits window CustomEvents only; it never imports three.js (the shader listens
// to these events independently so the carousel works with or without WebGL).
import gsap from "gsap";
import { Observer } from "gsap/Observer";

gsap.registerPlugin(Observer);

const STORE_KEY = "work-carousel-index";

export function initCarousel(): void {
  const root = document.querySelector<HTMLElement>("[data-carousel]");
  if (!root || root.dataset.booted) return;
  root.dataset.booted = "1";

  const stage = root.querySelector<HTMLElement>("[data-stage]");
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-slide]"));
  const markers = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-go]"));
  const live = root.querySelector<HTMLElement>("[data-live]");
  const N = cards.length;
  if (!stage || N === 0) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wrap = (i: number) => ((i % N) + N) % N;

  let current = wrap(parseInt(sessionStorage.getItem(STORE_KEY) ?? "0", 10) || 0);
  let animating = false;

  const paneOf = (card: HTMLElement) => card.querySelector<HTMLElement>("[data-pane]");

  function emit(name: string, card: HTMLElement) {
    const pane = paneOf(card);
    if (!pane) return;
    window.dispatchEvent(
      new CustomEvent(name, {
        detail: { host: pane, image: pane.dataset.img, accent: pane.dataset.accent },
      }),
    );
  }

  function updateMeta(i: number) {
    markers.forEach((m, idx) => {
      const on = idx === i;
      m.parentElement?.toggleAttribute("data-active", on);
      if (on) m.setAttribute("aria-current", "true");
      else m.removeAttribute("aria-current");
    });
    if (live) live.textContent = `Project ${i + 1} of ${N}`;
    sessionStorage.setItem(STORE_KEY, String(i));
  }

  function showInstant(i: number) {
    cards.forEach((c, idx) => {
      const on = idx === i;
      c.toggleAttribute("data-active", on);
      c.setAttribute("aria-hidden", on ? "false" : "true");
    });
    if (stage) stage.style.height = `${cards[i].offsetHeight}px`;
    updateMeta(i);
  }

  function goTo(target: number, dir: number) {
    target = wrap(target);
    if (target === current || animating) return;
    const outgoing = cards[current];
    const incoming = cards[target];
    // spawn the incoming card's shader NOW (during the slide) so the image+effect
    // arrive WITH the card, not after it (kills the flash).
    emit("carousel-slide-visible", incoming);

    if (reduce) {
      showInstant(target);
      current = target;
      emit("carousel-slide-hidden", outgoing);
      return;
    }

    animating = true;
    incoming.setAttribute("aria-hidden", "false");
    incoming.setAttribute("data-active", "");
    const targetH = incoming.offsetHeight;

    const tl = gsap.timeline({
      onComplete: () => {
        outgoing.removeAttribute("data-active");
        outgoing.setAttribute("aria-hidden", "true");
        gsap.set([outgoing, incoming], { clearProps: "transform" });
        current = target;
        animating = false;
        emit("carousel-slide-hidden", outgoing); // release the old shader after it's gone
      },
    });
    // vertical CONVEYOR, no fade: next = slide DOWN, prev = UP.
    // outgoing leaves slow->fast (accelerates out); incoming arrives from the opposite edge.
    const sign = dir > 0 ? 1 : -1;
    tl.to(outgoing, { yPercent: sign * 135, duration: 0.72, ease: "power4.in" }, 0)
      .fromTo(
        incoming,
        { yPercent: -sign * 135 },
        { yPercent: 0, duration: 0.7, ease: "power3.out" },
        0.08,
      )
      .to(stage, { height: targetH, duration: 0.62, ease: "power3.inOut" }, 0);

    updateMeta(target);
  }

  const next = () => goTo(current + 1, 1);
  const prev = () => goTo(current - 1, -1);

  // ── controls ───────────────────────────────────────────
  root.querySelector("[data-next]")?.addEventListener("click", next);
  root.querySelector("[data-prev]")?.addEventListener("click", prev);
  markers.forEach((m, idx) =>
    m.addEventListener("click", () => goTo(idx, idx > current ? 1 : -1)),
  );

  // keyboard when the section is in view
  let inView = false;
  new IntersectionObserver(
    (e) => (inView = e[0]?.isIntersecting ?? false),
    { threshold: 0.2 },
  ).observe(root);
  window.addEventListener("keydown", (e) => {
    if (!inView) return;
    const tag = (document.activeElement?.tagName ?? "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  });

  // drag / swipe (and horizontal-dominant wheel only, so Lenis keeps vertical scroll)
  Observer.create({
    target: stage,
    type: "wheel,touch,pointer",
    lockAxis: true,
    tolerance: 40,
    preventDefault: false,
    onLeft: next,
    onRight: prev,
    onChangeX: (self) => {
      if (self.event.type === "wheel" && Math.abs(self.deltaX) <= Math.abs(self.deltaY)) return;
    },
  });

  // ── boot ───────────────────────────────────────────────
  showInstant(current);
  // first shader spawn waits for the section's entrance reveal (or fires now if reduced/instant)
  const fireFirst = () => emit("carousel-slide-visible", cards[current]);
  if (reduce) fireFirst();
  else window.addEventListener("work:revealed", fireFirst, { once: true });

  // resize: re-measure active height (no animation) + tell shaders
  let rt: number | undefined;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => {
      if (stage) stage.style.height = `${cards[current].offsetHeight}px`;
      window.dispatchEvent(new CustomEvent("resize-pixel-distortion"));
    }, 150);
  });
}
