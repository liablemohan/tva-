# Checkpoint — Portfolio site design (Orbital / Longshot Lab)

Canonical reference for this project's history. Visual graph: `Chat Checkpoint.dc.html`.

## Files
- `index.html` — the design (only DC; template + logic).
- `hero-animation-controller.js` — all hero animation + hover-overlay logic.
- `image-slot.js` — starter component, user-fillable image placeholders.
- `uploads/` — user reference screenshots.

## Current state (v-live · 06 Sep 2026)
- **Palette: "Digital Material"** (from `uploads/color_pallete.md`). Page ground warm off-white #F5F3EE, body ink #111827, secondary slate #667085. Navy #0F3473 = identity only; teal #18A6A0 = interaction/hover only; terracotta #D95D39 + lime #C6F36B = one-off accents. Deep navy #0B285A = menu ground, #123B80 = menu thumbs, #1C4386 = menu hairlines, #A9B7CE/#C3CBDA = menu secondary ink.
- Brand marks: `nav_icon.png` (32px tall) + `wordmark.png` (17px tall) — both trimmed from the user's 2000² uploads to their artwork with transparent grounds. Same lockup in bar and menu header.
- Navy sticky top bar (#0F3473) with off-white 2-line hamburger → full-screen deep-navy menu (pattern from COLLINS refs, own type/palette — never copy their branding).
- Menu content: Home / Work / Founders' Roundtable / The Digital Forge (76px links); outlined WORK WITH US pill + TEAM · PROJECTS · ARCHIVE; three bordered index rows (017 Kashi Model, 024 Dhara Vessel, 04 Four founders); KEEP UP TO DATE + email + SUBSCRIBE; INSTAGRAM · LINKEDIN · X.
- Hero copy: eyebrow "Tvashta Labs · The Digital Forge", headline "We give form / **to ideas.**" (68px, bold second line), forge lede, small TVASHTA LABS / THE DIGITAL FORGE line.
- Section below grid: "What we do" → "We provide "Products", "Services" & Experiences" + subline.
- **4 tiles** in the hero grid (`tile-01`…`tile-04`, cut down from 16), every tile an `<image-slot>`; 6 hover-layer slots (`hover-01`…`hover-06`). Each slot carries an explicit `color` picked from its tile's luminance (slot chrome inherits it).
- Tile assembly is **scroll-driven** by default (`assemblyMode: scroll | timeline`).
- Lead tile (top-right) drops from just below the nav: y offset measured from nav bottom, scale 0.55→1, opacity 0→1, smooth in-out.
- All other tiles: same smooth curve, long overlapping scroll windows, fade leads movement.
- Hover: hovered tile greys; full-screen overlay shows a greyscale clone pinned at the tile's exact box + 6 colourful tile-sized blocks placed in px with 22px clearance (no overlap with each other or the clone); centered project title mask-reveals from below.
- Title contrast: white base copy + identical near-black copy clipped via multi-rect `clip-path` to exactly the light-luminance regions it crosses (WCAG relative luminance, greyscale+0.55 brightness accounted for).
- Boot is self-healing: controller owned by `root.__heroCtl`, remount destroys the stale instance, 900ms watchdog calls `setFinalState()` if nothing is running.
- `setFinalState()` must NOT use `clearProps: "all"` — it wiped tile colour/radius/placement. Sets rest values and clears only `willChange`.
- Props: `accent` (color, default #0F3473, options = 4 palette roles), `assemblyMode` (enum), `animate` (bool), `animationSpeed` (range), `showEyebrow`, `showFooterNote`.

## Decision log
1. Two reference images → one page: dark hero + tile grid.
2. Animation spec (independent per-tile x/y/scale/opacity/rotation, GSAP timeline generated from tile data, `HeroAnimationController`, stable nav/copy) → built.
3. "Like x.company" → assembly became scroll-linked; `timeline` kept as a mode.
4. Milestone rebuild (12 tiles T01–T12, firstTile→hold labels) → **reverted** at user request. The 16-tile scroll version is canonical; that milestone build is not.
5. Lead-tile drop refined twice (from top → from below nav, smooth + fade).
6. Hover overlay refined across five passes: gaps + rounded edges matching base layer → reserved rectangular text band → grey clone at exact position, base-tile dimensions, no overlap, colourful others → blocks must clear the text line → per-region computed contrast (replaced `mix-blend-mode: difference` and the earlier averaged single colour).
7. All tiles hold images (dummy = per-tile colour tint + placeholder caption).
8. Light nav bar + dark full-screen menu.
9. Checkpoint created (this file + `Chat Checkpoint.dc.html` + `CLAUDE.md` pointer).
10. Rebrand: Tvashta Labs marks + new hero/what-we-do copy.
11. Palette 01 "Digital Material" applied across page, tiles, overlay and menu; caption contrast fixed per tile.
12. Nav bar → icon navy; wordmark image replaces the text; both marks trimmed.
13. Hero grid cut to the top 4 tiles; menu content taken from the reference image (our navy kept, not the reference's lighter blue).

## Constraints to respect
- Only transform + opacity animate; never left/top/width/height.
- Copy and nav stay stable during the tile build.
- No random rotation; ±2° max, most tiles 0.
- Keep the 22px clearance rule and the reserved text band in the overlay.
- Timing/trajectory data stays data-driven in the controller, not hand-written tweens.
