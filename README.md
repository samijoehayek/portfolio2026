# portfolio2026

> The personal portfolio of **Samijoe Hayek** — full-stack & blockchain engineer, founder of **SajeLabs**, Dubai, UAE.

Not a template. Every section is a small, hand-built interactive world — a neo-brutalist site where the scroll *is* the story: an illustrated hero that watches your cursor, a WebGL carousel that shatters into pixels, service cards pegged to a laundry line, a camera that flies you into a stadium, and a sign-off you can literally play like a guitar.

```bash
npm install
npm run dev      # → http://localhost:4321
```

---

## The tour

Each section is authored in code — no page builders, no stock components. Scroll top to bottom:

| # | Section | What makes it move |
|---|---------|--------------------|
| 🎨 | **Hero** | An illustrated character composited from hand-cut layers: eyes that track the cursor, a natural blink, drifting tonal clouds, and three crypto coins (BTC · ETH · SOL) orbiting the head in real 3D via **Three.js**. |
| 🚴 | **Work** | A stacked project carousel driven by a custom **WebGL pixel-distortion shader** — cards shatter and reform on transition, with grayscale depth maps giving select images 2.5D parallax and idle drift. |
| 🧺 | **Services** | Discipline cards clipped to a hanging "laundry line," floating over a layered blue **wave background**, each with a rainbow accent and *real* `backdrop-filter` frosted glass. A sub-discipline timeline strings the tech beneath each card. |
| 🏟️ | **About** | A "fly-into-the-stadium" scroll: the camera zooms and tilts into 3D as an `ABOUT` card sails in, backed by a code-generated stadium and scoreboard. |
| 🎸 | **Contact** | The whole footer is one full-screen, playable guitar. Hover-strum the six strings — or press keys `1`–`6` — and hear them ring out through a **Karplus–Strong** string-synthesis model in the Web Audio API. Standard tuning, `E2` → `E4`. |

The site content lives as data, separate from presentation — see [`src/data/`](src/data). Swap the copy, projects, services, or guitar tuning without touching a line of animation code.

---

## Built with

| Tool | Role |
|------|------|
| **[Astro 6](https://astro.build)** | Zero-JS-by-default framework; ships only the interactivity each section needs |
| **[GSAP](https://gsap.com)** | Scroll-driven timelines and the section choreography |
| **[Lenis](https://lenis.darkroom.engineering)** | Buttery smooth-scroll the animations hang off |
| **[Three.js](https://threejs.org)** | The orbiting hero coins and the Work-section shader |
| **[Rive](https://rive.app)** | Vector/rig runtime for illustrated motion |
| **Web Audio API** | The Contact guitar's real-time string synthesis |

No React, no CSS framework — plain Astro components, TypeScript client scripts, and hand-written CSS in a neo-brutalist voice.

---

## Getting started

Requires **Node 18+** (developed on Node 24).

```bash
npm install       # install dependencies
npm run dev       # dev server with HMR at http://localhost:4321
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

---

## Project layout

```
src/
├── pages/index.astro       # the single page — assembles every section
├── layouts/Layout.astro    # <head>, fonts, smooth-scroll bootstrap
├── components/             # one .astro component per section
│   ├── HeroSection.astro
│   ├── WorkSection.astro
│   ├── ServicesSection.astro
│   ├── AboutSection.astro
│   └── ContactSection.astro
├── scripts/                # the client-side motion, grouped by section
│   ├── hero/               # cursor eyes, blink, orbiting coins
│   ├── work/               # carousel + cyclist sprite
│   ├── pixelDistortion.ts  # the WebGL shatter shader
│   ├── servicesWaves.ts    # layered wave background
│   ├── aboutStadium.ts     # fly-into-the-stadium camera
│   └── contactGuitar.ts    # Karplus–Strong string synth
└── data/                   # content as data — projects, services, bio, tuning
```

**Design principle:** content (`data/`) → structure (`components/`) → motion (`scripts/`). Each section is self-contained, so it can be tuned, rebuilt, or ripped out in isolation.

---

<sub>© Samijoe Hayek / SajeLabs. Built by hand — cursor-tracking eyes and all.</sub>
