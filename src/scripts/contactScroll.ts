// Contact — transition + curve-following title.
//   • The title letters are laid along the SAME seam curve the border draws (sampled
//     by length), each rotated to the local tangent, and dropped in one-by-one on a
//     SCRUBBED timeline as you scroll into the section.
//   • The seam shadow grows on the pitch and the guitar drifts (parallax) on scroll.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Must match EDGE_D in ContactSection.astro (viewBox 0 0 1440 300).
const EDGE_D = "M0,120 C130,18 400,2 640,135 C840,245 1000,275 1180,238 C1320,208 1390,182 1440,190";
const VB_W = 1440;
// The curve SVG renders at a fixed 300px height (preserveAspectRatio="none"),
// its top sitting this many px above the title container's origin.
const SVG_TOP = -240;
const Y_OFFSET = 116;  // push letters well clear of the border, onto the blue
const F_START = 0.05;  // first letter's horizontal fraction along the curve
const F_END = 0.85;    // last letter — title spans ~80% of the silhouette

export function initContactScroll(): void {
  const section = document.querySelector<HTMLElement>("[data-contact]");
  if (!section || section.dataset.scrollBooted) return;
  section.dataset.scrollBooted = "1";

  wireLenis();

  const title = section.querySelector<HTMLElement>("[data-contact-title]");
  const guitar = section.querySelector<HTMLElement>("[data-guitar]");
  const shadow = section.querySelector<HTMLElement>("[data-curve-shadow]");
  const chars = title ? Array.from(title.querySelectorAll<HTMLElement>(".ct-char")) : [];
  const inners = chars.map((c) => c.firstElementChild as HTMLElement);

  // offscreen path we can sample by length
  const ns = "http://www.w3.org/2000/svg";
  const probe = document.createElementNS(ns, "svg");
  probe.setAttribute("viewBox", `0 0 ${VB_W} 300`);
  probe.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  const probePath = document.createElementNS(ns, "path");
  probePath.setAttribute("d", EDGE_D);
  probe.appendChild(probePath);
  document.body.appendChild(probe);
  const total = probePath.getTotalLength();

  // length L on the path whose x == targetX (x is monotonic L→R) via binary search
  const lengthAtX = (targetX: number) => {
    let lo = 0, hi = total;
    for (let i = 0; i < 22; i++) {
      const mid = (lo + hi) / 2;
      if (probePath.getPointAtLength(mid).x < targetX) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  // place every letter on the curve, rotated to the local tangent
  const layout = () => {
    if (!title || !chars.length) return;
    const W = title.getBoundingClientRect().width;
    const n = chars.length;
    chars.forEach((ch, i) => {
      const f = n === 1 ? F_START : F_START + (i / (n - 1)) * (F_END - F_START);
      const targetX = f * VB_W;
      const L = lengthAtX(targetX);
      const p = probePath.getPointAtLength(L);
      const a = probePath.getPointAtLength(Math.max(0, L - 1));
      const b = probePath.getPointAtLength(Math.min(total, L + 1));
      const dx = ((b.x - a.x) / VB_W) * W; // screen-space tangent (x stretches to W)
      const dy = b.y - a.y;                // y is 1:1 (fixed 300px height)
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      ch.style.left = `${(p.x / VB_W) * W}px`;
      ch.style.top = `${SVG_TOP + p.y + Y_OFFSET}px`;
      ch.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    });

    // Clip the title to BELOW the seam curve, so a dropping letter emerges from
    // behind the black border instead of floating up over the pitch above it.
    const pts: string[] = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const vbX = (i / N) * VB_W;
      const cy = SVG_TOP + probePath.getPointAtLength(lengthAtX(vbX)).y + 8;
      pts.push(`${((vbX / VB_W) * W).toFixed(1)} ${cy.toFixed(1)}`);
    }
    title.style.clipPath = `path('M ${pts.join(" L ")} L ${W} 3000 L 0 3000 Z')`;
  };
  layout();

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    gsap.set(inners, { opacity: 1, y: 0 });
    if (shadow) gsap.set(shadow, { opacity: 0.4 });
    return;
  }

  // letters drop in one-by-one, scrubbed to scroll
  if (inners.length) {
    gsap.fromTo(
      inners,
      { yPercent: -160, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        ease: "power3.out",
        duration: 1,
        stagger: 0.55,
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "top 32%",
          // smoothed scrub → the drop plays at your scroll SPEED (catches up over
          // ~0.8s): scroll slow, letters fall slow; scroll fast, they fall fast.
          scrub: 0.8,
          invalidateOnRefresh: true,
        },
      },
    );
  }

  // the rising panel casts a growing shadow on the pitch
  if (shadow) {
    gsap.fromTo(
      shadow,
      { opacity: 0, y: -50 },
      {
        opacity: 0.4,
        y: 0,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top bottom",
          end: "top 45%",
          scrub: true,
          invalidateOnRefresh: true,
        },
      },
    );
  }

  // parallax: guitar drifts slower than the scroll for depth
  if (guitar) {
    gsap.to(guitar, {
      yPercent: -8,
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        invalidateOnRefresh: true,
      },
    });
  }

  let rt = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(rt);
    rt = window.setTimeout(() => { layout(); ScrollTrigger.refresh(); }, 150);
  });
}

// Share the one Lenis→ScrollTrigger bridge with the About section (same flag).
function wireLenis(): void {
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
