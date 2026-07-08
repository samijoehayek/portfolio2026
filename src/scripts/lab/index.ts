// Lab index — the progressive-enhancement layer over a fully-working static
// page. Everything here is optional: the masthead reveal, scroll reveals,
// magnetic tilt, the featured cover's WebGL pixel-shatter, and FLIP tag
// filtering. With JS off (or reduced motion) the page is a clean, accessible
// grid of links — nothing here is required to read or navigate.
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { PixelDistortionImage } from "../pixelDistortion";

gsap.registerPlugin(Flip);

const EASE = "power3.out";

let booted = false;

export function initLab(): void {
  if (booted) return;
  booted = true;

  const root = document.querySelector<HTMLElement>("[data-lab]");
  if (!root) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Filtering is functional (not decorative), so it runs regardless of motion.
  initFilter(root);

  // Reduced motion: no reveals, no shatter, no idle drift — the static <Image>
  // and instantly-visible grid stay exactly as rendered. Filtering still works.
  if (reduce) return;

  initMasthead(root);
  initReveals(root);
  initShaders(root);
}

// ── masthead: masked char rise + fade-ins + counter count-up ──────────────
function initMasthead(root: HTMLElement): void {
  const chars = root.querySelectorAll<HTMLElement>(".lab__char");
  const fades = root.querySelectorAll<HTMLElement>("[data-reveal-fade]");
  const countNum = root.querySelector<HTMLElement>("[data-count-num]");

  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

  if (chars.length) {
    gsap.set(chars, { yPercent: 115 });
    tl.to(chars, { yPercent: 0, duration: 0.95, stagger: 0.045 }, 0.1);
  }
  if (fades.length) {
    gsap.set(fades, { autoAlpha: 0, y: 18 });
    tl.to(fades, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, 0.5);
  }

  if (countNum) {
    const target = parseInt(countNum.dataset.target ?? "0", 10) || 0;
    const obj = { n: 0 };
    tl.to(
      obj,
      {
        n: target,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => {
          countNum.textContent = String(Math.round(obj.n)).padStart(2, "0");
        },
      },
      0.6,
    );
  }
}

// ── scroll reveals: cards rise + fade as they enter the viewport ──────────
function initReveals(root: HTMLElement): void {
  const cells = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-reveal]"));
  if (!cells.length) return;

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          gsap.to(e.target, { autoAlpha: 1, y: 0, duration: 0.8, ease: EASE });
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
  );

  // Only cards BELOW the fold get hidden + revealed on scroll. Cards already in
  // view stay visible from the first frame — no load delay, and (crucially) they
  // are never invisible at a View-Transition snapshot, so the cover→hero morph
  // always has something to animate to/from.
  const vh = window.innerHeight;
  cells.forEach((cell) => {
    if (cell.getBoundingClientRect().top >= vh * 0.9) {
      gsap.set(cell, { autoAlpha: 0, y: 46 });
      io.observe(cell);
    }
  });
}

// ── every card's cover: reuse the Work-section pixel-shatter shader ────────
// One WebGL context per card (capped), paused while off-screen. Each stays as a
// static <Image> until its own context boots, and forever if WebGL is missing.
const MAX_SHADERS = 8; // headroom over the current article count; well under the context limit

function initShaders(root: HTMLElement): void {
  if (!webglOK()) return; // static <Image> stays as the fallback everywhere

  const cards = gsap.utils
    .toArray<HTMLElement>(root.querySelectorAll(".acard[data-cover]"))
    .slice(0, MAX_SHADERS);

  cards.forEach((card) => bootCardShader(card));
}

function bootCardShader(card: HTMLElement): void {
  const canvas = card.querySelector<HTMLCanvasElement>("[data-canvas]");
  const cover = card.dataset.cover;
  if (!canvas || !cover) return;

  const frame = canvas.parentElement as HTMLElement; // .acard__frame
  const featured = card.classList.contains("acard--featured");
  const inst = new PixelDistortionImage();

  inst
    .init(
      canvas,
      cover,
      { dpr: Math.min(window.devicePixelRatio, 2), tiles: featured ? 22 : 16 },
      card.dataset.depth,
    )
    .then(() => {
      const fit = () => {
        const r = frame.getBoundingClientRect();
        inst.resize(r.width, r.height);
      };
      fit();
      card.setAttribute("data-shader-on", "");
      window.addEventListener("resize", fit);

      // pause the render loop while the card is off-screen (saves the GPU)
      new IntersectionObserver(
        (es) => (es[0]?.isIntersecting ? inst.resume() : inst.pause()),
        { threshold: 0 },
      ).observe(card);

      frame.addEventListener("pointermove", (e) => {
        const r = frame.getBoundingClientRect();
        if (r.width <= 0) return;
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
        inst.setHover(inside);
        if (inside) inst.setMouse(x, 1 - y);
      });
      frame.addEventListener("pointerleave", () => inst.setHover(false));
    })
    .catch(() => {
      /* leave the static <Image> in place */
    });
}

// ── tag filter with a FLIP reflow ─────────────────────────────────────────
function initFilter(root: HTMLElement): void {
  const grid = root.querySelector<HTMLElement>("[data-lab-grid]");
  const chips = gsap.utils.toArray<HTMLButtonElement>(root.querySelectorAll("[data-filter]"));
  const cells = gsap.utils.toArray<HTMLElement>(root.querySelectorAll("[data-cell]"));
  const empty = root.querySelector<HTMLElement>("[data-empty]");
  if (!grid || !chips.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const tagsOf = (cell: HTMLElement) =>
    (cell.querySelector<HTMLElement>("[data-tags]")?.dataset.tags ?? "").split(",");

  function apply(filter: string) {
    const matches = (cell: HTMLElement) => filter === "ALL" || tagsOf(cell).includes(filter);

    if (reduce) {
      let shown = 0;
      cells.forEach((c) => {
        const ok = matches(c);
        c.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      return;
    }

    const state = Flip.getState(cells, { props: "opacity" });
    let shown = 0;
    cells.forEach((c) => {
      const ok = matches(c);
      c.hidden = !ok;
      if (ok) shown++;
    });
    if (empty) empty.hidden = shown > 0;

    Flip.from(state, {
      duration: 0.55,
      ease: "power3.inOut",
      scale: true,
      absolute: true,
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.4 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.3 }),
    });
  }

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-selected", on ? "true" : "false");
      });
      apply(chip.dataset.filter ?? "ALL");
    });
  });
}

function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
