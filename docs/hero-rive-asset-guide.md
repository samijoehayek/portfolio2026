# Hero character — asset & rig guide (Rive)

Master reference for building the homepage hero: an interactive cartoon "Samijoe" (eyes follow cursor, blink, idle, head-tilt) floating in sky + clouds with an Ethereum coin, alongside a frosted-glass bio panel. Mimics daveholloway.uk (which uses Rive). The character is one `.riv` file rendered on a transparent canvas; DOM text layers over it.

**Division of labor:** Samijoe produces `public/samijoe-hero.riv` + `public/hero-poster.webp` (Stages 2–4). Claude writes the Astro integration (Stage 5). The two halves meet at the Interaction Contract.

---

## Interaction Contract (rig ⇄ code — names must match exactly)
- **Artboard:** `Hero`
- **State Machine:** `Hero`
- **Number inputs** (range **−100 … 100**, default 0): `look_x`, `look_y` — drive pupils (most), head tilt (small), cloud/coin parallax (least). All mapping happens inside the rig.
- **Autonomous loops (no input):** blink (random-ish timer), idle breathing/head-bob, cloud drift, coin spin.
- **Optional boolean** `reduced_motion` — freezes blink/idle when true (else code shows the static poster).

Code feeds `look_x`/`look_y` from the global pointer (smoothed via lerp) so the eyes track across the whole hero, including over the glass panel.

---

## Stage 1 — LOCKED composition + layer manifest

**Composition:** playful-fun cartoon **bust** (head + shoulders) of Samijoe (likeness from his reference photos), floating in **sky + clouds**, with one **Ethereum coin**.

**Layer manifest** (back → front; also the Photoshop stacking order):

| # | Layer | Moves how | Driver | Pivot |
|---|---|---|---|---|
| — | sky | — | site `#2b47ff` via CSS (no PNG) | — |
| 1 | `clouds-back` | slow drift + tiny parallax | autonomous + small `look_x/y` | translate |
| 2 | `body` (shoulders/neck) | breathing | autonomous idle | bottom-center |
| 3 | `head-base` (face/nose/mouth/brows) | tilt to cursor + idle bob | `look_x/y` small + idle | base of neck |
| 4 | `eye-whites` | with head | child of head | — |
| 5 | `pupils` | **track cursor** (clamped) | `look_x/y` largest | eye center |
| 6 | `eyelids` (+ painted-behind skin) | blink | autonomous timer | top edge of eye |
| 7 | `hair` | with head + optional sway | child of head | — |
| 8 | `coin` (ETH) | float bob + slow spin + parallax | autonomous + `look_x/y` | coin center |
| 9 | `clouds-front` | faster drift + most parallax | autonomous + `look_x/y` | translate |

Layers 4–7 nest under `head-base` so they inherit the tilt; pupils get extra motion on top.

**Paint-behind checklist (Photoshop Generative Fill):** skin behind the open eyes (blink reveal), shoulders behind the head, character behind `clouds-front`.

**Framing/safe-zone:** artboard ~1440×900; bust in the right ~50%, left ~40% kept clear (glass panel); keep face/eyes away from edges (Fit.Cover crops); clouds bleed past edges.

---

## Stage 2 — Generate in Higgsfield (3 separate images)

Generate three images, **same flat style + palette + lighting**, each on a **plain solid background** for clean cutting. Use the same model/style preset/seed family across all three so they match. Feed Samijoe's reference photos for likeness on the bust.

### Generation 1 — The bust (cut into layers 2–7)
```
Flat vector cartoon illustration, sticker style, bold clean outlines, flat colors,
minimal shading. Friendly PLAYFUL cartoon portrait of a man — head and shoulders
bust, front-facing, perfectly symmetrical, looking straight at the viewer. Big
expressive eyes WIDE OPEN with pupils centered looking straight ahead, visible
eyebrows, cheerful open grin. Clean modern style. Plain solid flat background,
subject centered, full head and shoulders in frame with margin around the head.
```
Avoid: `realistic rendering, heavy gradients/3D, busy background, closed/squinting eyes, side profile, sunglasses, hands covering face, cropped head`.
Tips: straight-ahead eyes are essential (pupils must sit centered to rig). Generate several, keep the flattest, most symmetrical, clearest-eyes result. Highest resolution.

### Generation 2 — Clouds (cut into `clouds-back` + `clouds-front`)
```
Flat vector cartoon clouds, several fluffy stylized clouds of different sizes,
bold clean outlines, flat white with subtle soft shading, sticker style.
Plain solid contrasting background, clouds isolated and well separated for cutout,
no sky gradient.
```
Tip: a plain background that contrasts with white (e.g. mid-blue/grey) makes white clouds easy to mask.

### Generation 3 — Ethereum coin (layer 8)
```
Flat vector cartoon Ethereum ETH coin, front view, the Ethereum diamond logo
centered, glossy-but-flat sticker style, bold clean outline, single coin centered
on a plain solid background.
```
Tip: front view is easiest to rig (the spin/flip can be faked with scaleX). Match the bust's outline weight + palette.

**Stage 2 output:** 3 raw images (bust, clouds, coin).

---

## Stage 3 — Cut the character into layers (Photopea, free, in-browser)

> Coins + clouds are already prepped in `assets/layers/` (`coin.png`, `clouds-sky.png`). The only hands-on work is splitting the CHARACTER into 5 layers: `body · head-base · eye-whites · pupils · eyelids`.

**Golden rule:** export every layer on the SAME full canvas (1792×2400) — never crop, or they won't align in Rive. Use `Ctrl+Shift+J` (Layer via Cut — keeps position); never Cut→Paste (Photopea re-centers).

1. **Open** `assets/layers/character-nobg.png` at photopea.com (bg already transparent).
2. **Head from body:** Lasso (`L`) the head down to mid-neck → `Ctrl+Shift+J` → rename `head`. On the leftover `body`, fill the neck gap: `Edit → Fill` (`Shift+F5`) → Content Aware (or Clone Stamp `S`). Rename `body`.
3. **Pupils:** on `head`, Magic Wand (`W`) the colored irises (Shift+click both) → `Ctrl+Shift+J` → `pupils`.
4. **Eye-whites:** on `head`, `W` the whites (Shift+click both) → `Ctrl+Shift+J` → `eye-whites`.
5. **head-base:** `head` now has eye-holes → Lasso around eyes → `Edit → Fill` → Content Aware to paint skin. Rename `head-base`.
6. **Eyelids:** on `head-base`, Lasso the skin strip just above each eye → `Ctrl+J` (copy) → `eyelids`; Move (`V`) to rest over the eyes, big enough to fully cover when it drops.
7. **Export each:** hide all but one layer → `File → Export As → PNG` → save to `assets/layers/`. Do all 5. `File → Save as PSD` to keep editing.
8. **Check:** stack body→head-base→eye-whites→pupils→eyelids = identical to original.

**Stage 3 output (in `assets/layers/`):** `body.png` `head-base.png` `eye-whites.png` `pupils.png` `eyelids.png` (+ existing `coin.png`, `clouds-sky.png`). Poster fallback = `assets/generated/hero-preview-v2.png`.

### Note on the cloud pivot
Clouds are NOT white cut-outs. Final approach = `clouds-sky.png` (tone-on-tone blue translucent sky, original art) used as 2–3 big semi-transparent drifting layers over the `#2b47ff` base; translucency via layer opacity (~65–75%). Coins = reuse `coin.png` at 3 sizes (constellation).

---

## Stage 4 — Rig in Rive (rive.app, free)
Shortcut for first-timers: clone the community file **"Eyes following cursor"** and a Codrops Rive tutorial to see the wiring, then build:
1. New file → artboard ~1440×900. Import PNGs, stack in manifest z-order, character in right ~50%, left ~40% clear.
2. Set pivots (table above). Nest layers 4–7 under `head-base`.
3. State Machine `Hero`: add Number inputs `look_x`, `look_y` (−100..100); optional bool `reduced_motion`.
4. **Eyes:** a 2D Blend State maps `look_x`/`look_y` to pupil position (clamped in sockets).
5. **Head tilt:** small additive rotation on `head-base` from the same inputs.
6. **Blink + idle:** a looping idle timeline (~8–12s) with 1–2 baked blinks (eyelids down/up ~120ms) + gentle breathing; always playing.
7. **Clouds + coin:** looping drift/spin; feed a small share of `look_x/y` for parallax.
8. Preview, drag the input sliders to test, then **Export → Runtime (.riv)** as `samijoe-hero.riv`.

**Stage 4 output:** `public/samijoe-hero.riv` + `public/hero-poster.webp`, built to the Contract.

---

## Stage 5 — Astro integration (Claude builds)
`@rive-app/canvas` → `HeroRiveAnimation.astro` (canvas + poster fallback, pointer→inputs with lerp, ResizeObserver, IntersectionObserver pause, reduced-motion) + `HeroSection.astro` (full-bleed Rive behind a left frosted-glass bio panel: **Samijoe Hayek — Full-Stack / Blockchain Developer & Consultant — Dubai, UAE**). Wired in `src/pages/index.astro`. See `~/.claude/plans/jazzy-munching-avalanche.md` Part B for detail.

---

## Optional: Higgsfield via MCP
If the Higgsfield MCP server is connected to Claude Code, Claude can drive Stage 2 generation directly (issue prompts, iterate on results) instead of manual UI work. MCP only helps generation — cutting (Stage 3) and rigging (Stage 4) remain manual. Keep API keys in env/secrets, never commit them; review every generated asset against the manifest.
