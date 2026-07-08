// Article reading page — progressive enhancement over fully-readable static
// HTML. Adds: gold scroll-progress bar, TOC scroll-spy, masked title reveal,
// a subtle hero parallax, and copy buttons on code blocks. Nothing here is
// required to read the article.
import { gsap } from "gsap";

let booted = false;

export function initArticle(): void {
  if (booted) return;
  booted = true;

  const article = document.querySelector<HTMLElement>("[data-article]");
  if (!article) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Functional regardless of motion preference.
  initCodeCopy(article);
  initTocSpy(article);
  initProgress(article);
  initTocScroll(reduce);

  if (reduce) return;

  initTitleReveal(article);
  initHeroParallax(article);
}

// ── gold scroll-progress bar ──────────────────────────────────────────────
function initProgress(article: HTMLElement): void {
  const bar = document.querySelector<HTMLElement>("[data-progress]");
  if (!bar) return;

  const update = () => {
    const span = article.offsetHeight - window.innerHeight;
    const scrolled = -article.getBoundingClientRect().top;
    const p = span > 0 ? Math.min(Math.max(scrolled / span, 0), 1) : 0;
    bar.style.transform = `scaleX(${p})`;
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

// ── TOC scroll-spy: highlight the section you're reading ──────────────────
function initTocSpy(article: HTMLElement): void {
  const links = Array.from(document.querySelectorAll<HTMLElement>("[data-toc-link]"));
  if (!links.length) return;

  const targets = links
    .map((l) => document.getElementById(l.dataset.tocLink ?? ""))
    .filter((el): el is HTMLElement => !!el);

  const threshold = () => {
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 6;
    return headerH * 16 + 40; // rem → px + a little breathing room
  };

  const setActive = (id: string | null) => {
    links.forEach((l) => l.classList.toggle("is-active", l.dataset.tocLink === id));
  };

  const update = () => {
    const y = threshold();
    let current: string | null = targets[0]?.id ?? null;
    for (const t of targets) {
      if (t.getBoundingClientRect().top <= y) current = t.id;
      else break;
    }
    setActive(current);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
}

// ── smooth-scroll a TOC click to its section (Lenis, header-offset) ───────
function initTocScroll(reduce: boolean): void {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-toc-link]"));
  if (!links.length) return;

  const lenis = (window as unknown as { lenis?: { scrollTo: (t: Element, o?: object) => void } }).lenis;
  const offsetPx =
    (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 6) * 16 + 24;

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.dataset.tocLink ?? "";
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (lenis && !reduce) {
        lenis.scrollTo(target, { offset: -offsetPx, duration: 0.9 });
      } else {
        const y = target.getBoundingClientRect().top + window.scrollY - offsetPx;
        window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
      }
      history.replaceState(null, "", `#${id}`);
    });
  });
}

// ── masked title reveal (matches the index masthead) ──────────────────────
function initTitleReveal(article: HTMLElement): void {
  const chars = article.querySelectorAll<HTMLElement>(".atitle__char");
  const fades = article.querySelectorAll<HTMLElement>("[data-reveal-fade]");
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });

  if (chars.length) {
    gsap.set(chars, { yPercent: 115 });
    tl.to(chars, { yPercent: 0, duration: 0.85, stagger: 0.02 }, 0.05);
  }
  if (fades.length) {
    gsap.set(fades, { autoAlpha: 0, y: 16 });
    tl.to(fades, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.12 }, 0.4);
  }
}

// ── subtle hero parallax ──────────────────────────────────────────────────
function initHeroParallax(article: HTMLElement): void {
  const img = article.querySelector<HTMLElement>("[data-hero]");
  const frame = img?.parentElement;
  if (!img || !frame) return;

  gsap.set(img, { yPercent: -8 });
  const update = () => {
    const r = frame.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return;
    const progress = 1 - (r.top + r.height) / (window.innerHeight + r.height); // 0..1 across viewport
    gsap.set(img, { yPercent: -8 + progress * 16 });
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

// ── code blocks: wrap with a language label + copy button ─────────────────
function initCodeCopy(article: HTMLElement): void {
  const blocks = Array.from(article.querySelectorAll<HTMLPreElement>(".article-prose pre"));
  blocks.forEach((pre) => {
    if (pre.closest(".code-wrap")) return;

    const code = pre.querySelector("code");
    const lang =
      pre.dataset.language ||
      (code?.className.match(/language-([\w-]+)/)?.[1] ?? "") ||
      (pre.className.match(/language-([\w-]+)/)?.[1] ?? "") ||
      "code";

    const wrap = document.createElement("div");
    wrap.className = "code-wrap";
    const bar = document.createElement("div");
    bar.className = "code-wrap__bar";

    const label = document.createElement("span");
    label.className = "code-wrap__lang";
    label.textContent = lang;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-wrap__copy";
    btn.textContent = "Copy";

    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code?.innerText ?? pre.innerText);
        btn.textContent = "Copied";
        btn.dataset.copied = "";
        setTimeout(() => {
          btn.textContent = "Copy";
          delete btn.dataset.copied;
        }, 1600);
      } catch {
        /* clipboard blocked — no-op */
      }
    });

    bar.append(label, btn);
    pre.replaceWith(wrap);
    wrap.append(bar, pre);
  });
}
