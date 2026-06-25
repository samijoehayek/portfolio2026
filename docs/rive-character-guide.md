# Rive Hero Character — Build Guide

Goal: rebuild the hero character as a **vector** Rive rig that looks at the cursor,
tilts its head, blinks, and breathes — DH-level "alive" with zero seams. This guide
is tailored to the SajeLabs character (bearded man, navy tee, blond hair) and to the
Astro integration already scaffolded in `src/scripts/hero/`.

Runtime verified against **Rive web runtime 2.38.x** (2026). Editor steps use the
current Rive editor.

---

## 0. The asset / layer spec (draw these as separate, COMPLETE vector parts)

The golden rule of rigging: **every part is drawn whole**, as if the parts in front of
it were invisible. That is what removes the seams forever (e.g. the neck continues
fully *down behind* the collar; the eye-white is a full shape behind the lids).

Draw on a **896 × 1200** artboard (matches the current frame & the integration math).
Suggested stacking order (back → front) and pivot for each:

| # | Part | Must include / notes | Pivot (for animation) |
|---|------|----------------------|------------------------|
| 1 | `hair-back` | hair mass behind the head silhouette | head pivot |
| 2 | `head-base` | face skin + ears + **full neck drawn all the way down** | neck base (≈ 50%, 92%) |
| 3 | `beard` | full beard shape | head pivot |
| 4 | `nose` | — | head pivot |
| 5 | `eye-white-L`, `eye-white-R` | full ovals (drawn complete behind lids) | each eye centre |
| 6 | `iris-pupil-L`, `iris-pupil-R` | iris + pupil as one group, **clipped** to its eye-white | each eye centre |
| 7 | `lid-upper-L`, `lid-upper-R` | skin-coloured eyelid that covers the eye when closed | top of each eye |
| 8 | `lid-lower-L/R` (optional) | subtle lower lid for a softer blink | bottom of each eye |
| 9 | `brow-L`, `brow-R` (optional) | separate → enables expression later | above each eye |
| 10 | `hair-front` | top/side hair overlapping the forehead | head pivot |
| 11 | `mouth` (optional separate) | enables smile/talk later | mouth centre |
| 12 | `body` | t-shirt + shoulders + visible arm + **collar drawn HIGH** to overlap the neck | shoulders (≈ 50%, 100%) |
| 13 | `collar-shadow` (optional) | soft shadow the chin casts on the collar | — |

Group everything as: `Character > {Head group: 1–11} + {Body group: 12–13}`.
The **Head group** is what tilts; the **Body group** stays mostly still (breathes).

> Keep colours on-brand: navy tee `#2b4a73`-ish (sample from `body.webp`), skin/blond
> from `head-base.webp`. I can hand you a clean vector base to trace (see asset prep).

---

## 1. Editor setup
1. New file → artboard **896 × 1200**, transparent background.
2. Import the vector parts (SVG) — or paste from Illustrator/Figma. Order them per §0.
3. Group into `Head` and `Body` as above. Name everything exactly (the runtime/you
   will reference names; tidy names save pain).

## 2. Eyes — look-at + clip
1. Add an empty **Target** node `look` near the face (this is what the eyes follow).
2. For each `iris-pupil`, add a **Translation Constraint** targeting `look`, with a
   small **Strength** (≈ 15–25%) and **Clamp** so the pupil travels only a few px.
3. **Clip** each `iris-pupil` to its `eye-white` (select pupil → Clipping → choose the
   eye-white shape). Now pupils can never leave the socket — same effect as the old CSS
   mask, but native.
4. Driving `look`: two ways —
   - **(Recommended) Number inputs:** in the State Machine, create `xAxis`, `yAxis`
     (Number, 0–100). Use them in a **1D/2D blend** or bind them to `look`'s X/Y via a
     constraint/keyed poses. The Astro code sets these from the cursor.
   - **Listener + Align Target:** a pointer-move Listener with an **Align Target**
     action on `look` (Preserve Offset on). Self-contained, no JS math. Pick ONE.

## 3. Head — gentle tilt (the anti-seam move)
- Option A (simplest): parent the **Head group** to a **Bone** at the neck base; key a
  small rotation (±3–5°) + translate driven by `xAxis`/`yAxis`. Because the neck is
  drawn full and the collar overlaps it, the tilt never opens a gap.
- Option B (more organic): lay a **Mesh** over the head, add interior vertices, bind to
  2 bones (neck + crown), and **weight the vertices** to them. ⚠️ Vertices you don't
  weight stay rigid — the #1 mesh gotcha. Vector meshes deform cleanly at any scale.

## 4. Animations (timelines)
- `idle-breathe` — loop, ~4s: tiny scale/translate-Y on the **Body group** (+ a hair
  sway if you want). This is the ambient life.
- `blink` — ~140ms: `lid-upper` closes over the eye then opens. Add a 25%-chance
  double-blink variant if you like.
- `look` poses — keyed extremes (left/right/up/down) for the blend driven by
  `xAxis`/`yAxis`, OR rely on the Translation Constraint from §2.

## 5. State machine `Hero`
- **Inputs:** `xAxis` (Number 0–100), `yAxis` (Number 0–100), `blink` (Trigger).
- **Layers:**
  - Layer 1 *Look*: a **blend state** mixing the look poses by `xAxis`/`yAxis` (or just
    let the constraint do it and keep an idle here).
  - Layer 2 *Breathe*: `idle-breathe` always playing.
  - Layer 3 *Blink*: Any State → `blink` on the `blink` trigger → back to idle.
- **Self-firing blink (preferred):** inside the SM, loop idle → after a randomized
  delay fire the blink path → return. Self-contained motion pauses automatically with
  the runtime (better than a JS timer).

## 6. Export
- File → **Export → Runtime (.riv)**. Save to `public/hero/character.riv`.
- Keep the artboard name and state-machine name (`Hero`) — the code references them.

## 7. What the code already handles (my side)
`src/scripts/hero/character.ts` (I scaffold this) will:
- `new Rive({ src:"/hero/character.riv", canvas, stateMachines:"Hero", layout: Fit.Contain / BottomRight })`
- `resizeDrawingSurfaceToCanvas()` in `onLoad` + on `ResizeObserver` (hi-DPI crisp).
- Fetch `xAxis`/`yAxis` via `stateMachineInputs("Hero")` and feed them from the **same
  smoothed pointer** the coins use (one pointer source, rAF-throttled).
- IntersectionObserver play/pause, `prefers-reduced-motion` pause, `cleanup()` on
  `astro:before-swap`.
- The coin canvas (`z-index:5`) is untouched; the Rive `<canvas>` replaces the
  layered-webp character at `z-index:3`.

## 8. Gotchas checklist
- [ ] Mesh vertices actually **weighted** to bones (else no deformation).
- [ ] Pupils **clipped** to eye-whites.
- [ ] Neck drawn **full**, collar drawn **high** → no seam on tilt.
- [ ] Ship vector (resolution-independent) — but if any raster sneaks in, export 2×.
- [ ] Canvas display size set in **CSS only**; let Rive own the backing store.
- [ ] State machine + artboard names match what the code expects (`Hero`).
- [ ] Test reduced-motion (should pause on a tidy frame) and offscreen pause.

---

### Learning resources (do these 3 first, ~2–4h)
- Rive "Get Started" (editor basics)
- "Meshes" + "Bones" (help.rive.app) — for the head tilt
- "State Machine" + "Inputs" + "Listeners" — for look-at + blink

Then ping me: I wire the `.riv` into Astro and we tune the look-at feel together.
