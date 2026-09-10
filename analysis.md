# Tvashta Labs — Design & Responsiveness Audit

**Scope:** `Longshot Lab.dc.html` (home page), its logic in `hero-animation-controller.js`, `forge-canvas.js`, `image-slot.js`.
**Method:** live render in Chrome at 1470×836 (desktop) — full scroll, hover states, and hamburger menu exercised — plus a source-level pass over every `@media` rule, grid definition, and event listener, since window-resize emulation was unavailable in this session. Findings below are code-verified, not guessed.
**Reviewed against:** `CHECKPOINT.md` v-live 06 Sep 2026 (Digital Material palette, hover-overlay spec, constraints).

---

## 1. Responsiveness

### 1.1 Zero layout breakpoints — the page is single-viewport (Critical)
`grep -n "@media" "Longshot Lab.dc.html"` returns nothing. Every layout rule (grids, hero, menu, nav) runs off `clamp()` fluid sizing only — there is no breakpoint that changes *structure* (columns → stack, font-size steps, hiding/showing elements) between phone, tablet and desktop. `clamp()` gives you fluid scaling within a shape; it can't turn a 6-column grid into 1 column. Everything downstream in this section is a direct consequence of this gap.

### 1.2 Hero tile grid never reflows (Critical)
`Longshot Lab.dc.html:51`
```
grid-template-columns: repeat(6, 1fr);
```
Fixed at 6 columns regardless of viewport. On a 390px phone (container ≈ 354px after padding), each tile column becomes roughly 54px — below any legible tap target, and the tile images/captions become unusable. There is no `auto-fit`/`auto-fill` fallback here even though every *other* grid on the page (`process`, `station-01..04`, footer sections) correctly uses `repeat(auto-fit, minmax(...))` and stacks cleanly. The hero grid is the one section that was missed.

### 1.3 Hover-reveal interaction has no touch equivalent (Critical)
`hero-animation-controller.js:142-143`
```js
t.el.addEventListener("mouseenter", () => this.openOverlay(label, i + 1, t.el));
t.el.addEventListener("mouseleave", () => this.closeOverlay(t.el));
```
Only `mouseenter`/`mouseleave` — no `click`, `pointerdown`, or `touchstart` fallback. The full-screen grey-clone + 6-colour-block + title-reveal overlay (the site's signature interaction, per `CHECKPOINT.md` pt. 6) simply never fires on a touch device. Mobile/tablet visitors get plain static colour tiles with a small caption link underneath — a materially different, less impressive product than what desktop visitors see, with no equivalent path to the same content.

### 1.4 Overlay's colour blocks silently vanish on narrow viewports (High)
`hero-animation-controller.js:173-203` (`scatterBlocks`) places 6 blocks, each sized to the hovered tile's own width (≈180px per checkpoint), inside `padding: { l:40, r:40 }`, retrying 200 times to avoid overlap; blocks that can't find a spot get `display:none`:
```js
if (!chosen) { b.style.display = "none"; return; }
```
Fitting six 180×180 non-overlapping blocks (plus 22px clearance) needs several hundred px of width. Any viewport under roughly 700–800px simply can't seat most of them — even on a *desktop* window that isn't maximized. The result degrades silently (blocks disappear, no resize/shrink logic) rather than adapting block size to viewport.

### 1.5 Full-screen menu doesn't stack on mobile (High)
`Longshot Lab.dc.html:94`
```
grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
```
Two fixed columns, no stacking rule. Nav links are set to a flat `font-size: 76px` (not `clamp()`, unlike nearly everything else on the page) — on a 390px-wide screen "Founders' Roundtable" at 76px is far wider than the available column, forcing awkward wrapping or overflow against the project-index column sitting right next to it.

### 1.6 Fixed-px controls inside fluid containers (Medium)
- Email input, `Longshot Lab.dc.html:142`: `width: 260px` — doesn't shrink with its flex-wrap row on narrow screens.
- Overlay blocks: fixed `180px` (see 1.4).
- Menu index-card icon column: fixed `64px`; footer link rows: fixed `160px 1fr auto` (`:111, :498` etc.) — narrower than the 6-col grid problem, but same pattern of a hard px track inside a fluid grid, so text truncates or the row overflows below ~450px.

### 1.7 Base assembly animation doesn't recompute on resize/orientation change (Medium)
Confirmed no `resize` listener in `hero-animation-controller.js` (only `image-slot.js:769` and `forge-canvas.js:228` handle their own resize, unrelated to tile placement). The scroll-driven tile trajectory is derived once from `window.innerWidth/innerHeight` at mount (`hero-animation-controller.js:177`). Rotate a tablet, or resize a desktop browser window after load, and tiles stay pinned to stale coordinates until a full reload.

### 1.8 Small tap target on hamburger (Low)
`Longshot Lab.dc.html:33-35`: button is `width: 30px`, two 1.6px bars with a 6px gap — visible glyph height ~14px, well under the 44×44px touch-target guideline (WCAG 2.5.5 / Apple & Material HIG).

---

## 2. Design consistency

### 2.1 Menu wordmark is unreadable on its own background (Critical — contrast)
`Longshot Lab.dc.html:27` swaps to `wordmark-dark.png` inside the navy full-screen menu, but the *hover-overlay* clone of the top-left mark keeps the light nav's dark-ink wordmark sitting directly on the deep navy overlay ground. Measured contrast: **navy text (#0F3473) on navy overlay ground (#0B285A) ≈ 1.2:1** — effectively invisible. Confirmed live: screenshot of the hover state shows "TVASHTA LABS" at top-left nearly disappearing into the background. WCAG AA needs 4.5:1 for text.

### 2.2 Hover-clone caption text duplicates and clashes with the reveal title (High)
Live-tested: hovering the teal "Projects" tile produces the big centered reveal title **"a finished project, in use"** while the greyed clone of that same tile, sitting lower-right, still shows its own internal caption **"a finished project, in use"** a second time, in low-contrast grey-on-grey (measured **3.57:1**, fails AA for normal text), directly overlapping the "PROJECTS" category label underneath it. Two copies of the same string competing for attention at different contrast levels reads as a bug, not a deliberate layered composition.

### 2.3 "Prototype" step card breaks the 4-step pattern (Medium)
`Longshot Lab.dc.html:192-208`, the "One process language" row: Capture/Imagine/Make use solid brand fills (navy, teal, near-black) with light text; **Prototype** alone uses a pale grey card (`#E8EBF0`) with dark text. Contrast is fine in isolation (6.4:1 / 14.8:1), but visually it reads as a disabled/placeholder state sitting inside a 4-item sequence that's otherwise uniform — breaks rhythm without an apparent reason tied to the copy ("Make. Test. Change. Repeat." isn't a lesser step than the other three).

### 2.4 Huge, unbalanced negative space in the hero (Medium)
Live render at 1470px: hero copy occupies the left ~40% of the viewport; the 4-tile grid is pinned bottom-right via `margin-left: auto`, leaving a large dead zone across the entire middle of the screen with nothing in it (see first screenshot). Reads as unfinished rather than intentionally minimal, especially since the "What we do" section directly below has the same left-heavy/right-empty imbalance.

### 2.5 Secondary body colour is borderline on AA (Low)
`#667085` on the page ground `#F5F3EE` measures **4.49:1** — just under the 4.5:1 AA threshold for normal text. It's used for the 12–13px monospace eyebrow/meta labels throughout the page (`Longshot Lab.dc.html:43,47,178,190`), which is exactly where a marginal ratio matters most (small text has no size-based exemption).

### 2.6 Mixed interaction affordance for "hover cards" (Low)
Process cards, station "drag to turn" canvases, and hero tiles all use different interaction languages (static card / drag-rotate 3D / hover-to-reveal-overlay) with no shared visual cue for "this is interactive" (no cursor affordance, icon, or label consistently signals it) — a first-time visitor has to discover each pattern by trial.

---

## 3. What's working well

- Fluid type/spacing via `clamp()` is used consistently and correctly almost everywhere outside the hero grid and menu — this is good practice, not boilerplate.
- `prefers-reduced-motion` is respected (`forge-canvas.js:8`, `image-slot.js:382`).
- Content grids (`process`, `station-01..04`, footer link rows, index cards) all use `repeat(auto-fit, minmax(...))` correctly and do stack/reflow cleanly — the hero grid is the outlier, not the norm.
- Self-healing animation boot (`root.__heroCtl`, 900ms watchdog) is a solid resilience pattern per `CHECKPOINT.md`.
- Palette discipline (navy = identity, teal = interaction, one-off accents) is legible and mostly held to.

---

## 4. Suggested improvements, prioritized

1. **Add real breakpoints for the hero grid.** Below ~768px, switch `grid-template-columns: repeat(6,1fr)` to `repeat(2,1fr)` (or stack to 1 column under ~480px) via a media query keyed off `data-hero-fit`. This is the single highest-impact fix.
2. **Give the hover-reveal a touch/click path.** Add a `click`/`pointerup` handler alongside `mouseenter`/`mouseleave` that opens the same overlay and closes on a second tap or an explicit close affordance, so touch users get the flagship interaction instead of a degraded fallback.
3. **Make `scatterBlocks` viewport-aware.** Scale block size down (or drop to fewer blocks) when `vw` can't fit 6× tile-sized squares with clearance, instead of letting the retry loop silently hide them.
4. **Fix the menu-overlay wordmark contrast** — use the light wordmark (or a dedicated on-navy variant) whenever the hover overlay is open, not the nav's context-dependent mark.
5. **Remove the duplicate caption in the hover clone**, or drop its opacity further / hide it entirely while the big reveal title is showing, so there's one title, not two competing copies.
6. **Stack the full-screen menu to one column below ~640px** and switch nav links from a flat `76px` to a `clamp()` (e.g. `clamp(40px, 10vw, 76px)`).
7. **Reconsider the "Prototype" card fill** — give it a solid brand colour consistent with its siblings, or justify the grey visually (e.g., all four go pale-on-hover) so it doesn't read as disabled.
8. **Rebalance hero composition** — either give the tile grid more presence on wide viewports (larger, more centered) or add a supporting element in the dead middle space; the current bottom-right pin reads unintentional.
9. **Bump `#667085` to something ≥4.5:1** (e.g. `#5C6779`) or reserve it for large/bold text only, since it's currently used at small mono sizes.
10. **Recompute or clamp the base tile-assembly trajectory on resize/orientation change**, or at minimum reset to `setFinalState()` on `resize`, so a rotated tablet or resized window doesn't strand tiles off their intended position.
11. **Grow the hamburger's hit area** to at least 44×44px (padding, not just the visible glyph).
