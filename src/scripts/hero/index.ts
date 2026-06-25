// Hero orchestrator: one pointer source + one rAF drive the character (eyes,
// head tilt, blink, breathing, 2.5D depth) and the cloud parallax; the Three.js
// coin orbit is lazy-loaded and fed the head geometry so the coins stay glued to
// the head across resizes/breakpoints. Mirrors AboutSection's init pattern.
import type { CoinOrbit } from "./coins";

// where the head sits inside the 896×1200 character frame (tunable, eyeballed)
const HEAD_CX = 0.47;
const HEAD_CY = 0.30;
const HEAD_R = 0.23;

function webglOK(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function initHero(): void {
  const hero = document.querySelector<HTMLElement>("[data-hero]");
  if (!hero) return;

  const head = hero.querySelector<HTMLElement>("[data-head]");
  const pupils = hero.querySelector<HTMLElement>("[data-pupils]");
  const eyelids = hero.querySelector<HTMLElement>("[data-eyelids]");
  const sky = hero.querySelector<HTMLElement>("[data-sky]");
  const charEl = hero.querySelector<HTMLElement>("[data-char]");
  const character = hero.querySelector<HTMLElement>("[data-character]");
  const canvas = hero.querySelector<HTMLCanvasElement>("[data-coincanvas]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── coin orbit (lazy, gated) ──────────────────────────────────────────────
  let orbit: CoinOrbit | null = null;
  if (canvas && webglOK()) {
    import("./coins")
      .then((m) => {
        orbit = m.createCoinOrbit(canvas);
        layoutCoins();
        if (reduce) {
          orbit.renderOnce(); // static frame, no animation
        } else {
          const io = new IntersectionObserver(
            (es) => orbit?.setActive(es[0].isIntersecting),
            { threshold: 0.01 },
          );
          io.observe(hero);
        }
      })
      .catch(() => {});
  }

  function layoutCoins() {
    if (!orbit || !character || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const br = character.getBoundingClientRect();
    const left = br.left - cr.left;
    const top = br.top - cr.top;
    orbit.setOccluder(left, top, br.width, br.height);
    orbit.setHead(left + br.width * HEAD_CX, top + br.height * HEAD_CY, br.width * HEAD_R);
  }

  // ── pointer-driven motion (single rAF) ────────────────────────────────────
  if (!reduce && head && pupils && sky) {
    let tx = 0, ty = 0, cx = 0, cy = 0;

    window.addEventListener(
      "pointermove",
      (e) => {
        tx = (e.clientX / window.innerWidth) * 2 - 1;
        ty = (e.clientY / window.innerHeight) * 2 - 1;
      },
      { passive: true },
    );

    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;

      pupils.style.setProperty("--px", `${(cx * 2.5).toFixed(2)}px`);
      pupils.style.setProperty("--py", `${(cy * 1.2).toFixed(2)}px`);
      // head: subtle tilt + a SMALL independent travel. Kept small on purpose:
      // until the tucked-neck head asset (Part B) lands, a large head/body
      // differential would re-expose the neck seam. Bump these up afterwards.
      head.style.setProperty("--hr", `${(cx * 0.3).toFixed(2)}deg`);
      head.style.setProperty("--hx", `${(cx * 2).toFixed(2)}px`);
      head.style.setProperty("--hy", `${(cy * 1).toFixed(2)}px`);
      // body parallax (the whole character drifts with the cursor)
      if (charEl) charEl.style.translate = `${(cx * 2.5).toFixed(2)}px ${(cy * 1.4).toFixed(2)}px`;
      sky.style.translate = `${(cx * -9).toFixed(2)}px ${(cy * -5).toFixed(2)}px`;

      orbit?.setPointer(cx, cy);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // natural random blink (+ occasional double-blink)
    if (eyelids) {
      const blink = () => {
        eyelids.classList.add("is-closed");
        setTimeout(() => eyelids.classList.remove("is-closed"), 110);
      };
      const schedule = () => {
        setTimeout(() => {
          blink();
          if (Math.random() < 0.25) setTimeout(blink, 280);
          schedule();
        }, 2600 + Math.random() * 3800);
      };
      schedule();
    }
  }

  // ── keep coins glued to the head on resize ────────────────────────────────
  let rzt = 0;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(rzt);
      rzt = window.setTimeout(() => {
        orbit?.resize();
        layoutCoins();
      }, 150);
    },
    { passive: true },
  );
}
