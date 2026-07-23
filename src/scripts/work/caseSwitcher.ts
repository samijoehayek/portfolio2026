// Seamless same-document switching between /work/[slug] case-study pages.
// The rail's prev/next arrows are real links (progressive enhancement); this
// intercepts them, fetches the target page, and swaps just the rail + content
// inside a View Transition so the sidebar slides in its new colour and the
// content lifts in — no full reload. Falls back to normal navigation when the
// View Transition API or JS is unavailable.

interface Win {
  lenis?: { scrollTo: (t: number, o?: { immediate?: boolean }) => void };
}

export function initCaseSwitcher(): void {
  if (typeof document === "undefined") return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cache = new Map<string, Document>();
  let busy = false;

  async function fetchDoc(url: string): Promise<Document | null> {
    const key = new URL(url, location.href).pathname;
    if (cache.has(key)) return cache.get(key)!;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const doc = new DOMParser().parseFromString(await res.text(), "text/html");
      cache.set(key, doc);
      return doc;
    } catch {
      return null;
    }
  }

  function swap(doc: Document, url: string, push: boolean): boolean {
    const curMain = document.querySelector<HTMLElement>(".cs");
    const newMain = doc.querySelector<HTMLElement>(".cs");
    const curRail = document.querySelector(".cs__rail");
    const newRail = doc.querySelector(".cs__rail");
    const curContent = document.querySelector(".cs__content");
    const newContent = doc.querySelector(".cs__content");
    if (!curMain || !newMain || !curRail || !newRail || !curContent || !newContent) {
      return false; // structure changed — let the caller hard-navigate
    }
    curRail.replaceWith(newRail);
    curContent.replaceWith(newContent);
    curMain.style.setProperty("--accent", newMain.style.getPropertyValue("--accent"));
    document.title = doc.title;
    if (push) history.pushState({ cs: true }, "", url);
    const lenis = (window as unknown as Win).lenis;
    if (lenis?.scrollTo) lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
    return true;
  }

  async function go(
    url: string,
    dir: "next" | "prev" | null,
    push = true,
  ): Promise<void> {
    if (busy) return;
    busy = true;
    const doc = await fetchDoc(url);
    if (!doc) {
      window.location.href = url;
      return;
    }
    const root = document.documentElement;
    const run = () => {
      if (!swap(doc, url, push)) window.location.href = url;
    };

    const startVT = (
      document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<unknown> };
      }
    ).startViewTransition;

    if (reduce || !startVT) {
      run();
      busy = false;
      return;
    }

    if (dir) root.classList.add(dir === "next" ? "cs-dir-next" : "cs-dir-prev");
    const vt = startVT.call(document, run);
    vt.finished.finally(() => {
      root.classList.remove("cs-dir-next", "cs-dir-prev");
      busy = false;
    });
  }

  // Click (delegated → survives the content swaps)
  document.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(
      "[data-case-switch]",
    );
    if (!a) return;
    const me = e as MouseEvent;
    if (me.defaultPrevented || me.metaKey || me.ctrlKey || me.shiftKey || me.button !== 0)
      return;
    e.preventDefault();
    go(a.href, a.getAttribute("data-case-switch") === "next" ? "next" : "prev");
  });

  // Prefetch the neighbours on hover/focus so the swap feels instant
  const prefetch = (e: Event) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(
      "[data-case-switch]",
    );
    if (a) fetchDoc(a.href);
  };
  document.addEventListener("pointerover", prefetch);
  document.addEventListener("focusin", prefetch);

  // Back / forward within the work pages → swap (neutral cross-fade, no direction)
  window.addEventListener("popstate", () => {
    if (location.pathname.startsWith("/work/")) go(location.href, null, false);
  });
}
