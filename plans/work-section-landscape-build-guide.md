# Work-Section Landscape — Build Guide (Rive + Higgsfield → SVG)

How to recreate the daveholloway.uk work-section scene: a **static background hill image**, your
**carousel card**, and an **animated Rive foreground** (road sweeping toward the viewer, swaying
trees/flowers, cyclist drinking) — layered so the card sits *inside* the landscape.

---

## 0. The target structure (verified from the live site)

Three layers, all `position: absolute; bottom: 0`, pinned to the bottom of a `position: relative` section,
and each **wider than the viewport** so the road bleeds off the bottom edge:

| Layer | Element | z-index | Notes |
|------|---------|---------|-------|
| Background hills | `<img>` (static) | **0** | plain raster/SVG, no animation |
| Carousel card | `.portfolio-card` | **1** | your work card, fully interactive |
| Foreground scene | `<canvas>` (Rive) | **66** | `pointer-events: none` so clicks pass through to the card |

The depth illusion = this z-sandwich. The "road going off-screen" = one-point perspective **drawn into
the art** (road wide at the bottom, narrowing into the hills) + the canvas being oversized and bottom-pinned.
No 3D, no WebGL.

---

## Phase 1 — Generate reference art (Higgsfield)

You're generating **flat, layer-separable vector-style stills** — not final assets, and never animation.
Generate at 16:9, high res. Two pieces:

**A) Background hills (static layer):**
```
Flat 2D vector illustration of rolling green hills under a clear sky, gentle layered
hillsides receding into the distance, simple bold shapes, minimal detail, no texture,
no gradient banding, clean vector cartoon style, bright saturated greens, no people,
no road, wide 16:9 composition, empty foreground, solid flat color fills
```

**B) Foreground scene (to become the Rive layer):**
```
Flat 2D vector illustration, foreground countryside viewed from ground level, a paved
road sweeping in one-point perspective from the bottom of the frame toward distant hills
(wide at bottom, narrowing into the distance), a low stone wall along the right side, a
few stylized trees and clusters of wildflowers, a cyclist in a blue jersey standing
beside a road bike drinking from a water bottle, bold clean shapes, bright flat colors,
cartoon vector style, empty/plain sky area above the horizon, every element clearly
separated with space around it so each can be cut out as its own layer
```

Generate **6–12 variations**; pick the one with the cleanest, most separated shapes. "Separated" matters
more than "pretty" here — overlapping/merged elements are painful to rig.

> Tip: also generate the trees, the cyclist, and a flower cluster as **isolated** elements (same prompt,
> "single tree, centered, plain background") — clean cut-outs trace far better than extracting from a busy scene.

---

## Phase 2 — Vectorize + separate into layers (SVG)

Goal: a clean, **layered** SVG where every animatable thing is its own named group.

1. Trace each Higgsfield raster to vector — Illustrator **Image Trace** (flat-color preset), Figma, or a
   tracer like vectorizer.ai. Flat fills, expand, then simplify anchor points hard (fewer points = cleaner rig).
2. Break the scene into **separate groups**, named:
   - `road`, `hill-foreground`, `stone-wall`, `ground`
   - `tree-1`, `tree-2`, `tree-3` … (each tree its own group)
   - `flowers-1`, `flowers-2` …
   - `cyclist-body`, `cyclist-arm`, `cyclist-bottle`, `bike`
3. For each tree/flower, make sure the **base sits at the bottom of its group's bounding box** — that's
   where the sway pivot (bone) will go.
4. Keep fills flat and solid (Rive meshes/bones behave best on clean shapes). Export as SVG.

**Riggability checklist:** each tree separate ✓, cyclist arm + bottle separate from body ✓, no clipping
masks baked in ✓, no raster embeds ✓, reasonable point counts ✓.

---

## Phase 3 — Rig + animate in Rive  *(manual, in the Rive editor — not codeable)*

Rive editor is free at rive.app. This phase is GUI work; Claude Code can't do it, but it's the core of the effect.

1. **Import** your layered SVG. Set the **artboard** to the scene size (e.g. 1920×800), art bottom-aligned.
2. **Trees/flowers — the wind sway:**
   - Add a **bone** at the base of each tree, running up the trunk. For organic bend, attach the tree shape
     as a **mesh** bound to the bone (mesh deform = natural bend, not a stiff rotate).
   - Create a **looping timeline** ("sway"): rotate/bend the bone ~±2–4°, ease in/out (Rive's cubic),
     ~2–3s per cycle, ping-pong.
   - **Stagger** each tree: duplicate the timeline with a different duration/phase offset so they don't move
     in unison (this is the detail that sells "wind"). Smaller, faster sway on flowers.
3. **Cyclist — the drinking loop:**
   - Rig the **arm + bottle** with a short bone chain (shoulder → elbow → bottle).
   - Looping timeline ("drink"): raise bottle to mouth, small head tilt, hold, lower, pause — ~4–6s loop.
   - Optionally a separate nested artboard so the cyclist is self-contained.
4. **State machine** ("idle"): one state that **plays all loops simultaneously** (sway timelines + drink
   layered/additive). Autoplay on load. Optional inputs for later: a `windStrength` number, or a `hover`
   trigger to gust.
5. **Responsive:** the original ships `langbar-foreground.riv` plus a separate hero `*-responsive.riv` —
   Rive supports multiple **artboards** (e.g. desktop vs mobile framing). Build at least a wide artboard;
   add a portrait one if mobile framing differs.
6. **Export → `.riv`**. Drop it in your Astro `public/` folder.

---

## Phase 4 — Web integration  *(this part IS codeable — hand to Claude Code)*

Stack: Astro + `@rive-app/canvas` (the WASM canvas runtime). Prompt for Claude Code:

```
In my Astro site, build a "WorkLandscape" section that layers three elements inside a
position:relative section, all position:absolute; bottom:0; and wider than the viewport:

1. <img class="langbar-bg"> static hills image, z-index 0.
2. The portfolio carousel card, z-index 1 (already exists / placeholder for now).
3. <canvas class="langbar-fg"> z-index 66, pointer-events:none, rendering a Rive file
   public/langbar-foreground.riv.

Use @rive-app/canvas. Instantiate Rive with:
- src: "/langbar-foreground.riv"
- the state machine named "idle", autoplay true
- layout fit "cover", alignment bottom-center
- handle devicePixelRatio for crispness, and call rive.resizeDrawingSurfaceToCanvas()
  on load and on window resize.

Performance + a11y:
- Use an IntersectionObserver to play() the Rive instance only while the section is in
  view and pause() it when off-screen.
- If prefers-reduced-motion is set, render a single static frame (no loop).

Make the canvas and bg image scale so the road's wide end bleeds off the bottom edge of
the viewport on all screen sizes.
```

Key implementation notes:
- `pointer-events: none` on the foreground canvas is **non-negotiable** — without it the canvas eats clicks
  meant for the card behind it.
- Match the original's framing: foreground canvas a bit taller and wider than the section, anchored bottom.
- Lazy-load the `.riv` (only when the section approaches the viewport) so it doesn't block first paint.

---

## Effort / expectations

- **Hardest part:** Phase 3 (learning Rive bones + mesh + state machines). Budget a few evenings the first
  time. Trees/flowers are easy; a believable drinking loop takes the most fiddling.
- **Higgsfield's role:** stills only (background + reference to trace). It will not produce the animation.
- **Fidelity:** this route matches the original 1:1 because it *is* the original's method (Rive `.riv` on a
  `pointer-events:none` canvas, sandwiched over a static image and the card).

---

### Recommended order
Generate stills (Higgsfield) → trace to layered SVG → rig + loop in Rive → export `.riv` → wire the
3-layer section in Astro with `@rive-app/canvas`. Start the trees-sway loop first — it's the quickest win
and proves the whole pipeline before you invest in the cyclist.
