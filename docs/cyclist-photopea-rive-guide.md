# Hand-vectorizing the cyclist in Photopea → Rive (drink + breathe + head + sway)

Goal: trace `buzz-v5` by hand into a **clean, flat, layered SVG** organized so it imports into Rive
and rigs for: **drinking gulp** (forearm + bottle), **head tilt**, **torso breathing**, and an optional
**idle sway**. Same approach you used for the hero, with a part hierarchy designed for these motions.

Reference image to trace: `public/work-assets/scene-src/cyclist-cut.png` (already bg-removed, neck
filled). Keep `public/work-assets/raw/cyclist-buzz-v5.png` open too — it still has the **spokes/chain
detail** for tracing the wheels.

---

## 1. Set up the document + reference layer

1. Photopea → **File ▸ Open** `cyclist-cut.png` (opens at 1298×1650, the working resolution).
2. In **Layers**, rename that layer `REF`.
3. **Lower its opacity to ~40%** (so your traced shapes read on top).
4. **Lock it**: select `REF` → click the **lock icon** (locks position + pixels). Keep it the
   **bottom** layer the whole time.
5. *(optional)* Duplicate `REF` once at 100% opacity on top, hidden — toggle it on to check colours/details, off while tracing.
6. **View ▸ 100%/200% zoom**, space-drag to pan. Trace zoomed in; precision matters more than speed.

> Everything you draw must be a **Shape layer** (vector), never a brush stroke. Raster layers export
> as embedded bitmaps and defeat the whole purpose.

---

## 2. Plan the layer/group hierarchy (this *is* the rig)

Build this folder tree in the Layers panel. **Render order = bottom→top = back→front.** Each top-level
folder is a thing that will move (or stay still) in Rive, so name them exactly:

```
cyclist                         (root group)
├─ cyclist-bike                 ← STATIC (bottom)
│   ├─ wheel-back   (tire, rim, spokes, hub)
│   ├─ wheel-front
│   ├─ frame
│   ├─ drivetrain  (crank, chainring, chain, cassette)
│   ├─ handlebar
│   └─ saddle
├─ cyclist-legs                 ← STATIC
│   ├─ leg-far
│   ├─ leg-near
│   ├─ shorts
│   └─ shoes        (socks + shoes)
├─ cyclist-arm-left             ← STATIC (hand gripping the bar)
├─ cyclist-torso                ← BREATHE  (origin = waist)
│   ├─ jersey
│   ├─ jersey-shadow
│   └─ collar-zip
├─ cyclist-arm-upper            ← mostly static (right sleeve, shoulder→elbow)
├─ cyclist-head                 ← TILT     (origin = neck)
│   ├─ neck
│   ├─ face
│   ├─ ear
│   ├─ hair
│   ├─ beard
│   └─ eye-brow
└─ cyclist-forearm              ← GULP     (origin = elbow; TOP layer)
    ├─ forearm
    ├─ hand
    ├─ bottle
    └─ bottle-cap
```

Create a folder: select layers → **Ctrl/Cmd+G**, double-click the folder to **rename**. Photopea
writes folder/layer names into the exported SVG as `id`s, so name them like the tree above.

### The one rule that makes rigging work: **draw what's hidden**
A part that moves reveals whatever was behind it. So each part must be a **complete shape even where
another part overlaps it**:
- `cyclist-torso` → draw the full jersey torso **behind** the right upper-arm and **behind the chin**
  (so head-tilt/breathe never opens a gap).
- `cyclist-head` → draw the full face/jaw/mouth **behind where the bottle & hand cover it** (so when
  the bottle lowers on the gulp, the mouth is actually there).
- `cyclist-forearm` → draw the forearm fully down **to the elbow**, the hand complete, the bottle complete.
- `cyclist-legs` → draw thighs fully **up under the shorts hem**.
- `cyclist-arm-upper` → draw the sleeve fully to the **shoulder socket** and **elbow**.

Trace these "hidden" extensions roughly — they're never seen until something moves, and then they save you.

---

## 3. Tracing workflow (back to front, lock as you go)

Work **bottom-up** the layer stack so nearer parts cover farther ones cleanly.

1. **Pen tool (P)** → in the top bar set mode to **Shape** (not "Path"). Turn the **stroke off**, set
   the **fill** to a colour sampled from the ref (Eyedropper **I**, or type the hex).
2. Click to place anchor points around a region; click-drag for curves. Close the path on the first point.
   Each closed path = one Shape layer → drag it into the right folder.
3. **Flat-cartoon shading:** per part use a **base fill** + at most **one or two shadow shapes** on top
   (a darker tone of the same colour). Keep it flat — no gradients. Match the scene's flat hills.
4. **Keep anchor counts low.** Fewer points = cleaner curves and a lighter, easier-to-rig SVG. Use the
   minimum points that capture the silhouette; adjust handles with **Direct Selection (A)**.
5. **Lock finished layers** (lock icon) and collapse the folder so you don't nudge them. Hide folders
   you're not working on to reduce clutter.
6. Suggested order: `bike` → `legs` → `arm-left` → `torso` → `arm-upper` → `head` → `forearm`.

### Wheels / spokes (do these as real vector, they're worth it)
- Tire + rim: two concentric **Ellipse** shapes (Ellipse tool, hold Shift for a circle) — dark tire ring,
  lighter rim inside.
- Spokes: draw **one** thin spoke (a 2–3px-wide rectangle or line from hub to rim), then **duplicate +
  rotate** around the hub centre (Edit ▸ Free Transform, set the transform **pivot to the hub**, rotate
  ~12°, then Ctrl/Cmd+Shift+T to repeat). ~24–30 spokes. Group them as `spokes` inside the wheel.
- Hub: small filled circle on top.

---

## 4. Naming + grouping conventions (for a clean SVG)

- Name **every** folder and shape (no "Layer 17"). Folders → `<g id="...">`, shapes → `<path id="...">`.
- Use the kebab-case names from the tree (`cyclist-forearm`, `bottle`, …). Rive shows these as node names.
- Don't merge/flatten/rasterize anything. Don't use layer effects (shadows/strokes via FX) — draw shadow
  shapes instead; FX rasterize on export.
- Keep the `cyclist` root group so the whole rider can be moved/scaled as one in Rive.

---

## 5. Pivot/anchor points (mark them, you'll need them in Rive)

These are where each moving part rotates/scales. Eyeball them on the ref; rough is fine:
- **`cyclist-forearm` → elbow** (where the bare forearm meets the blue sleeve). Gulp = rotate here.
- **`cyclist-head` → neck/throat** (just above the collar). Tilt back a few degrees on the sip.
- **`cyclist-torso` → waist centre** (jersey/shorts seam). Breathing = subtle scale from here.
- *(optional sway)* **whole `cyclist` → between the feet** on the ground. Tiny rotate/translate.

Tip: drop a tiny **guide dot** (a 4px circle on a throwaway `PIVOTS` layer) at each point so you can read
the coordinates in Rive later, then delete that layer before final export.

---

## 6. Export to SVG

1. **File ▸ Export As ▸ SVG.**
2. Keep it vector (no "rasterize"). Export the whole document.
3. Open the `.svg` once in a browser to sanity-check it looks right and the `id`s are there
   (View Source). Optionally run it through svgo later to shrink — *after* Rive, or keep the unminified
   one for Rive so names survive.

Save it as `public/work-assets/foreground-cyclist.svg` (or hand it straight to Rive).

---

## 7. Rig in Rive (mapping to the motions you want)

Import the SVG → Rive turns folders into **Groups/Nodes** keeping your names.

1. **Set origins**: select `cyclist-forearm`, move its **origin** to the elbow; `cyclist-head` origin →
   neck; `cyclist-torso` origin → waist.
2. **Drink gulp** (timeline `drink`, ~4–6s loop): rotate `cyclist-forearm` a few degrees to bring the
   bottle to the mouth, hold, lower, pause. Add a small `cyclist-head` tilt-back synced to the raise.
   For a softer bottle move, animate `bottle` slightly within the forearm group.
3. **Breathing** (timeline `breathe`, ~3–4s, ping-pong): scale `cyclist-torso` ~1.0→1.02 (mostly Y, a
   touch X) from the waist origin. For organic motion use a **bone + mesh** on the jersey instead of a
   hard scale.
4. **Idle sway** (optional): tiny rotate/translate on the root `cyclist` group, long ease.
5. **State machine `idle`**: one state that **plays all loops together** (drink + breathe + sway),
   autoplay on. (This is the same `idle` state machine the Astro side already expects — see
   `src/scripts/hero/index.ts` for the runtime pattern.)
6. Export **`.riv`** → `public/` for the SAM-20 web integration.

---

## 8. Pro tips

- Trace the **silhouette first** (one flat fill per part), get the whole figure blocked in, *then* add
  shadow shapes. Blocking first keeps proportions honest.
- Use **few colours** — sample 1 base + 1 shadow per material (skin, jersey, shorts, frame, tire). Flat
  and few-coloured = matches the scene and rigs clean.
- **Lock + hide aggressively.** Only the folder you're tracing should be unlocked/visible.
- Mirror-heavy bits (both shoes, both wheels): draw once, **duplicate**, reposition.
- Keep the bike on its own `cyclist-bike` folder and **don't** over-detail the chain/cassette — a few
  flat shapes read fine at display size and keep the file light (the auto-trace's 455-path bike is
  exactly what to avoid).
- Save the Photopea project (`.psd`) regularly so you can re-export the SVG after tweaks.
```
```
