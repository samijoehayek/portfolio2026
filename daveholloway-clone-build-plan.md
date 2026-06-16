# Build Plan — "daveholloway.uk"-style site

A neo-brutalist creative portfolio. This brief is written to hand to Claude Code prompt-by-prompt.
Focus of this document: **Foundation → Loader → Navbar.** Everything else is sketched at the end.

---

## 0. What the original actually is (verified by inspecting the live site)

- **Framework:** Astro (uses Astro's `ClientRouter` / View Transitions; every component compiles to its own island script).
- **Animation:** GSAP (timelines power the loader and the navbar). Now 100% free incl. all plugins.
- **Smooth scroll:** Lenis (`<html class="lenis">`).
- **Hero character + the little bottom "GOLD" toggle:** Rive animations (vector, interactive — not video).
- **Portfolio images:** a WebGL "pixel distortion" shader on hover.
- **Aesthetic:** neo-brutalist — thick **3px black** borders everywhere, **electric blue + gold**, heavy black display type, hard edges, no soft shadows.

> The loader and navbar are pure SVG/CSS/GSAP — no AI assets needed. Save Higgsfield/Rive for the hero character and portfolio later.

---

## 1. Design tokens (define these FIRST, reuse everywhere)

```css
:root {
  /* color */
  --c-blue:  #2B47FF;   /* header + hero background (rgb 43,71,255) */
  --c-gold:  #FFAE00;   /* CTA button, accents (rgb 255,174,0) */
  --c-black: #000000;   /* borders + text */
  --c-white: #FFFFFF;   /* loader background */

  /* structure */
  --border:  3px solid var(--c-black);   /* the signature line — used on header bottom, CTA left, cards */
  --header-h: 6.3rem;                    /* ~101px tall header */
  --gutter:  1.8rem;                     /* ~29px horizontal padding */

  /* type */
  --font-sans:    "Neulis Sans", system-ui, sans-serif;  /* nav + body (see font note) */
  --font-display: "Anton", "Neulis Sans", sans-serif;    /* the giant "HEY!" — heavy condensed */

  /* z-index scale */
  --z-header: 1000;
  --z-loader: 9999999;
}
```

**Font note:** the original uses **Neulis Sans** (a paid font) for nav/body and a very heavy display face for "HEY!". For a legally-clean clone, start with free stand-ins — e.g. **Anton** or **Archivo Black** for display, **Space Grotesk** or **Archivo** for nav/body — and swap in a licensed face later. Do NOT copy Dave's actual brand assets/logo; build your own mark in the same style.

---

## 2. Foundation setup (do this before the loader)

1. `npm create astro@latest` → empty/minimal template, TypeScript optional.
2. Install deps: `npm i gsap lenis`.
3. File structure to aim for:
   ```
   src/
     layouts/Layout.astro        ← <html>, <head>, global CSS, Lenis init, GSAP registration
     styles/tokens.css           ← the :root block above
     styles/global.css           ← reset, body bg #000, font-face declarations
     components/
       Logo.astro                ← your monogram as inline SVG (reused by loader + header)
       LoadingSequence.astro     ← the loader (section 4)
       Header.astro              ← the navbar (section 5)
     pages/index.astro           ← wires Loader + Header + a placeholder hero
   public/fonts/                 ← font files
   ```
4. In `Layout.astro`: set `<body>` background to `--c-black`, mount Lenis, register GSAP once globally so islands can share it.
5. Lenis + GSAP wiring (concept): create the Lenis instance, drive it from `requestAnimationFrame`, and (later) sync ScrollTrigger via `lenis.on('scroll', ...)`.

**✅ Checkpoint:** a black page that scrolls smoothly. Nothing else yet.

---

## 3. The logo (build this before the loader — both reuse it)

The mark reads as an abstract **monogram built from 4 vertical "slices"** of different heights, the outer two with rounded outer corners (think: a little skyline / stacked bars). This matters because the loader **assembles the logo slice-by-slice**, so the logo must be made of independent vertical pieces.

- Build it as **inline SVG** (or 4 stacked `<div>`s) where each vertical slice is its own element you can target/animate individually.
- Keep one source of truth: a `Logo.astro` that renders at any size via a `size` prop. The header uses it small (~40px), the loader uses it large (centered).
- Make your OWN geometry — same *construction* (4 sliced verticals), not Dave's exact paths.

**✅ Checkpoint:** logo renders crisply at 40px and at 120px from the same component.

---

## 4. THE LOADER — full spec

### 4.1 What it does, visually
A **plain white full-screen overlay** with the black monogram in the dead center. The logo **builds itself slice-by-slice** (each slice slides up into place from behind a mask), holds for a beat, then the **whole white panel lifts away** to reveal the hero underneath. Total runtime ≈ **2–3 seconds**.

### 4.2 DOM structure
```
#loading-sequence.loading-sequence.loading-sequence--init
  └ .loading-sequence__inner
      └ .loading-sequence__logo-wrap
          ├ .ls-group  (slice 1)
          │   └ .ls-mask        ← overflow:hidden (the reveal window)
          │       └ .ls-slide   ← the colored shape that translates up
          ├ .ls-group  (slice 2) → .ls-mask → .ls-slide
          ├ .ls-group  (slice 3) → .ls-mask → .ls-slide
          └ .ls-group  (slice 4) → .ls-mask → .ls-slide
```
- The original nests **3 tonal layers per slice** (`--color-1/2/3`) for a subtle layered reveal. Optional — start with 1 layer per slice; add the extra two later for richness.
- Add `data-astro-transition-persist="loading-sequence"` so the loader isn't recreated during Astro page transitions.

### 4.3 CSS essentials
```css
.loading-sequence {
  position: fixed; inset: 0; z-index: var(--z-loader);
  background: var(--c-white);
  display: grid; place-items: center;
  will-change: transform;
}
.loading-sequence__logo-wrap { display: flex; align-items: flex-end; gap: 6px; }
.ls-mask  { overflow: hidden; }            /* the reveal window */
.ls-slide { transform: translateY(110%); } /* start hidden below the mask */
html.loading-done .loading-sequence { pointer-events: none; } /* after exit */
```

### 4.4 GSAP timeline (the heart of it)
Exact values pulled from the original: durations **0.35 / 0.6 / 0.8 / 1.0s**, eases **`power3.out`** (builds) and **`power3.inOut`** (the exit/handoff).

```js
import { gsap } from "gsap";

const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

// 1) build the logo slice-by-slice
gsap.set(".ls-slide", { yPercent: 110 });
tl.to(".ls-slide", { yPercent: 0, duration: 0.6, stagger: 0.08 });

// 2) tiny hold / settle
tl.to(".loading-sequence__logo-wrap", { scale: 1.04, duration: 0.35 }, "+=0.15");

// 3) hand off to the hero (the original reveals hero-box, hero body,
//    work section, CTA, header here — fade/slide them in as the panel leaves)
tl.add("reveal");
tl.to(".loading-sequence", { yPercent: -100, duration: 0.8, ease: "power3.inOut" }, "reveal");
tl.from([".site-header", ".hero-box", ".hero-body"], { y: 24, opacity: 0, duration: 0.8, stagger: 0.06 }, "reveal+=0.1");

// 4) flag done
tl.add(() => document.documentElement.classList.add("loading-done"));
```

### 4.5 The session logic (important polish)
The original only shows the full loader **once per session** (stores a flag; on later navigations it skips or shows a shortened version). Implement with `sessionStorage`:
- On load: if `sessionStorage.getItem('ls-seen')` → skip the build, reveal instantly.
- Else: play the full timeline, then `sessionStorage.setItem('ls-seen','1')`.
- Class flow: starts `--init`; on completion remove `--init`, add `--hidden`, and add `loading-done` to `<html>`.

### 4.6 Things that make it feel premium (don't skip)
- Set the panel `z-index` extremely high so nothing peeks through.
- Lock scroll (`lenis.stop()`) while the loader runs; `lenis.start()` on completion.
- Respect `prefers-reduced-motion`: if set, skip straight to revealed.
- The exit ease (`power3.inOut`) is what gives that confident "lift". Keep it.

**✅ Checkpoint:** white screen → monogram builds slice-by-slice → panel lifts → hero shows. Re-loading within the session skips the build.

---

## 5. THE NAVBAR — full spec

### 5.1 Look (exact values)
- `<header class="site-header">`, `position: fixed; top: 0; z-index: 1000`, full width, height **~101px** (`--header-h`).
- `display: flex; align-items: center; justify-content: space-between`.
- Background **electric blue `#2B47FF`**; **`border-bottom: 3px solid black`**.
- Left padding `~29px` (`--gutter`); right padding **0** so the CTA sits **flush to the screen edge**.
- **Left:** the monogram (`.logo-link` → your `Logo.astro`).
- **Center/right:** nav links **WORK · SERVICES · ABOUT · CONTACT · LAB** — font weight **700**, **uppercase**, black, ~16px.
- **Far right:** CTA **"Let's talk"** — full-height **gold `#FFAE00`** block, black text, **`border-left: 3px solid black`**, flush right (~187px wide).

### 5.2 The signature interaction — per-character text swap
This is the detail that makes it feel expensive. Each link is **two stacked copies of the label, each split into individual letters**:
```
.site-header-nav-link
 ├ .menu-text-1   → for each letter: .menu-char-wrap (overflow:hidden) > .menu-char
 └ .menu-text-2   → same per-letter structure
```
- On `mouseenter`: GSAP slides `menu-text-1` letters **up & out** while `menu-text-2` letters slide **in from below**, **staggered per character** (left→right ripple). On `mouseleave`: reverse.
- The CTA swaps to a **different word**: "Let's talk" → **"Fun Stuff"** (text-2 holds the alt label). Pick your own pair.
- Implementation: split text into chars at build time (or with a tiny split helper). Each `.menu-char-wrap` is the mask; animate `yPercent` of the chars. Keep stagger small (~0.02–0.03s).

### 5.3 Behaviors to wire
- **Scroll-spy:** add `site-header-nav-link--current` to the link whose section is in view (IntersectionObserver per section).
- **`Lab` link** has special handling in the original (`data-lab-nav-link`) — treat it as a one-off (e.g. routes elsewhere / different active logic).
- **Mobile:** below a breakpoint, collapse links into a toggle (hamburger) menu; events: `click`, `keydown` (Esc to close), `touchend`, and `resize` to reset layout.
- **Keyboard/a11y:** focus styles, `aria-expanded` on the mobile toggle, links reachable in tab order.

### 5.4 CSS essentials
```css
.site-header {
  position: fixed; top: 0; left: 0; width: 100%;
  height: var(--header-h); z-index: var(--z-header);
  display: flex; align-items: center; justify-content: space-between;
  padding-left: var(--gutter);
  background: var(--c-blue);
  border-bottom: var(--border);
}
.site-header-nav-link { font-weight: 700; text-transform: uppercase; color: var(--c-black); }
.menu-char-wrap { overflow: hidden; display: inline-block; }
.menu-char      { display: inline-block; will-change: transform; }
.site-header-cta {
  height: 100%; display: grid; place-items: center;
  padding: 0 var(--gutter);
  background: var(--c-gold);
  border-left: var(--border);
}
```

**✅ Checkpoint:** fixed blue bar, thick black underline, gold flush-right CTA; hovering any link ripples the letters and swaps the word; active link tracks scroll position; collapses cleanly on mobile.

---

## 6. Suggested Claude Code prompt sequence (paste these one at a time)

1. "Create a minimal Astro project. Add `gsap` and `lenis`. Set up `Layout.astro` with a black body, a `tokens.css` with these design tokens [paste section 1], and initialise Lenis smooth scroll driven by requestAnimationFrame."
2. "Create `Logo.astro`: an inline-SVG monogram made of 4 independently-targetable vertical slices of varying heights, outer two with rounded outer corners. Accept a `size` prop. Render it on the page at 40px and 120px so I can check it."
3. "Create `LoadingSequence.astro` per this spec [paste section 4]. White full-screen overlay, monogram builds slice-by-slice via a GSAP timeline (durations 0.35/0.6/0.8/1.0, eases power3.out + power3.inOut), then the panel lifts away with power3.inOut. Lock Lenis while it runs. Add sessionStorage 'once per session' logic and prefers-reduced-motion support."
4. "Create `Header.astro` per this spec [paste section 5]. Fixed blue bar, 3px black bottom border, gold flush-right CTA. Implement the per-character hover swap with GSAP (two stacked labels, letters split into masked chars, staggered yPercent). CTA swaps 'Let's talk' → 'Fun Stuff'."
5. "Add scroll-spy (IntersectionObserver) to set the active nav link, and a mobile hamburger menu with click/Esc/resize handling and aria-expanded."
6. "Wire `index.astro`: Loader + Header + a placeholder blue hero with a giant 'HEY!' so I can see the loader handoff."

---

## 7. After loader + navbar (roadmap, lower detail)

- **Hero:** big blue panel, oversized display "HEY!", intro copy in a bordered card, your character art (this is where **Rive** or a Higgsfield/exported animation goes — Rive if you want it interactive/eye-tracking, video/Lottie if simpler).
- **Work carousel:** horizontal portfolio with the **WebGL pixel-distortion** hover effect (OGL or a small custom shader; reveal on hover).
- **Services / About / Contact** sections, all in the same bordered, blocky language.
- **The "GOLD" toggle:** a Rive-powered theme/easter-egg switch — tackle last.
- **Page transitions:** Astro View Transitions + the persisted loader element.

---

### TL;DR on where to start
Tokens → Lenis → Logo → **Loader** → **Navbar**. The loader and navbar share the logo and the GSAP setup, so doing them back-to-back is the efficient path. Everything visual hinges on three things: the **3px black border**, the **blue/gold** palette, and the **per-letter GSAP staggers**. Nail those and it already *feels* like the original.
