# UI component research (PinehurstPortalUI)

Goal: cleaner, more intuitive, better-looking, cheap. Vanilla CSS/JS only, `--ppui-*` tokens.
Already in styles.css (skip): popover + `::backdrop`, `interpolate-size`, `::details-content` height anim, `:has()` grid, skeleton shimmer, view-transition theme circle, scroll-timeline progress bar, `color-mix`, `text-wrap: balance`, `overscroll-behavior`, `accent-color`, reduced-motion gating, global `:focus-visible` 2px sky outline.
Gaps found: no `content-visibility: auto`, no `@starting-style` on popovers, no anchor positioning, no toast, no segmented control, no press feedback, flat single-layer shadows, no `forced-colors`/`prefers-contrast`, no `@container`, no `field-sizing`.

Sources read: shadcn skeleton docs (code behind "View Code" not extractable; used known patterns), open-props (easings + shadows CSS fetched), picocss.com/docs/button, radix-ui.com/colors scale guide, developer.chrome.com (animate-to-height-auto, popover API), MDN `@starting-style`, uiverse.io/switches (gallery only, code gated, skipped extraction; community snippets, write our own). Not visited: inclusive-components, anchor-positioning page (used from knowledge; verify).

## Ranked top 10 (impact / effort)

1. `content-visibility: auto` on long lists (news, inbox rows, assignments). 3 lines, big paint win.
2. `@starting-style` entry anim for popover/Apps launcher + exit via `allow-discrete`. CSS only.
3. Layered shadow tokens (Open Props style) for card/pop/raised. Softer, richer depth.
4. Press feedback + hover/active state ramp via `color-mix` (Radix steps 3/4/5 idea). One rule set.
5. Focus ring upgrade: ring + offset gap, `:focus-visible` only, `forced-colors` fallback.
6. Segmented control (Pico `role="group"` idea + shadcn tabs) for Today/Week, Inbox filter, Apps categories.
7. Toast (sonner-like) for "marked read", "copied", errors. Popover-based, ~25 lines JS.
8. Anchor positioning for Apps/menu popovers with JS fallback (kills placement code in Chrome).
9. Row hit-area + `:has()` states (unread, selected, checked) without JS class toggles.
10. Skeleton upgrade: transform-based shimmer (GPU, no background-position repaint) + `prefers-reduced-motion` static.

Extras after the top 10: `@container` for list+detail inbox, `field-sizing: content` for compose box, `scrollbar-gutter`, `light-dark()`, `::selection`, `prefers-contrast`.

---

## 1. content-visibility on long lists
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility (web.dev "content-visibility").
- Fits: `.ppui-inbox-row`, news rows, `.ppui-room-story`, assignment lists.
- Skips layout/paint of offscreen rows. Intrinsic size reserves space, so no scrollbar jump.
```css
.ppui-inbox-row,
.ppui-room-story,
.ppui-news .ppui-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 64px; /* `auto` remembers real height after first render */
}
```
- Perf: pure win. Caveat: find-in-page still works; skip on rows with focus-trapped children or sticky inside. Check `position: sticky` descendants and `scrollIntoView` targets (works).

## 2. @starting-style popover enter/exit
- Source: https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style ; popover API https://developer.chrome.com/blog/introducing-popover-api (baseline: Chrome 114, FF 125, Safari 17).
- Fits: `.ppui-popover` (Apps launcher, menus). Lines 5062+ already touch `:popover-open`; merge there.
- Transform/opacity only; `overlay` + `display` with `allow-discrete` keep exit animating in top layer.
```css
@media (prefers-reduced-motion: no-preference) {
  .ppui-popover {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
    transform-origin: top center;
    transition:
      opacity 0.18s var(--ppui-ease),
      transform 0.22s var(--ppui-ease),
      overlay 0.22s allow-discrete,
      display 0.22s allow-discrete;
  }
  .ppui-popover:popover-open {
    opacity: 1;
    transform: none;
    @starting-style { opacity: 0; transform: translateY(-6px) scale(0.98); }
  }
}
@media (max-width: 640px) { /* bottom sheet slides instead */
  .ppui-popover { transform: translateY(24px); }
  .ppui-popover:popover-open { @starting-style { transform: translateY(24px); } }
}
```
- Perf: compositor-only. Firefox: no `interpolate-size`, but `@starting-style` ok in FF 129+. Degrades to instant show.

## 3. Layered shadow tokens
- Source: https://open-props.style (shadows.css; multiple soft stacked shadows, low-opacity tinted by color). Adapted, own values.
- Fits: cards (`--ppui-radius-card`), popovers, raised hover state. Tint shadow with ink navy not black.
```css
:root {
  --ppui-shadow-color: 222 70% 15%;            /* ink navy as hsl triplet */
  --ppui-shadow-1: 0 1px 2px hsl(var(--ppui-shadow-color) / 0.08);
  --ppui-shadow-2: 0 1px 2px hsl(var(--ppui-shadow-color) / 0.06),
                   0 4px 10px -2px hsl(var(--ppui-shadow-color) / 0.08);
  --ppui-shadow-pop: 0 2px 4px hsl(var(--ppui-shadow-color) / 0.06),
                     0 10px 20px -4px hsl(var(--ppui-shadow-color) / 0.12),
                     0 24px 40px -12px hsl(var(--ppui-shadow-color) / 0.16);
}
:root[data-ppui-theme="dark"] {
  --ppui-shadow-color: 225 60% 2%;
  --ppui-shadow-1: 0 0 0 1px rgb(255 255 255 / 0.04), 0 1px 2px hsl(var(--ppui-shadow-color) / 0.5);
  --ppui-shadow-pop: 0 0 0 1px rgb(255 255 255 / 0.06), 0 16px 40px -8px hsl(var(--ppui-shadow-color) / 0.7);
}
.ppui-popover { box-shadow: var(--ppui-shadow-pop); }
```
- Perf: static box-shadow, fine. Do NOT animate box-shadow; animate opacity of a `::after` shadow layer if hover lift wanted.
- Note: styles.css line 152/160 has `box-shadow: none !important` in some native-page resets; scope tokens to `.ppui-*`.

## 4. Hover/active ramp + press feedback
- Source: Radix Colors step roles https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale (3 normal, 4 hover, 5 active/selected, 6 subtle border, 7 interactive border/focus, 8 hover border, 9 solid, 10 solid hover, 11 low-contrast text, 12 high-contrast text). Map: `hover` = step 4, `accent-soft` = 3/5, `hairline` = 6.
- Fits: all buttons, rows, `.ppui-menu-item`, `.ppui-bar-button`, app tiles.
```css
:root {
  --ppui-hover-2: color-mix(in srgb, var(--ppui-text) 9%, transparent);   /* active/pressed */
  --ppui-accent-hover: color-mix(in srgb, var(--ppui-accent) 88%, #000);  /* solid hover (step 10) */
  --ppui-border-strong: color-mix(in srgb, var(--ppui-text) 22%, transparent); /* interactive border (step 7/8) */
}
.ppui-bar-button, .ppui-menu-item, .ppui-app, .ppui-inbox-row {
  transition: background-color 0.15s var(--ppui-ease), transform 0.15s var(--ppui-ease);
}
@media (hover: hover) {
  .ppui-menu-item:hover { background: var(--ppui-hover); }
}
.ppui-menu-item:active { background: var(--ppui-hover-2); }
.ppui-bar-button:active, .ppui-app:active { transform: scale(0.97); }
```
- Perf: transform/bg only. `@media (hover: hover)` stops sticky hover on touch. Dark theme: same rules work since `--ppui-text` flips.

## 5. Focus ring
- Source: shadcn "ring" pattern (ring-2 + ring-offset) ; Radix step 7/8 for focus rings.
- Fits: replace/extend line 164 global `:focus-visible`; inputs (line 589 already ring).
```css
html :focus-visible {
  outline: 2px solid var(--ppui-sky);
  outline-offset: 2px;
  border-radius: max(inherit, var(--ppui-radius-sm)); /* outline follows radius in modern browsers anyway; drop if it fights */
}
/* input: ring replaces outline */
.ppui-apps-search:focus-visible {
  outline: none;
  border-color: var(--ppui-accent);
  box-shadow: 0 0 0 3px var(--ppui-accent-soft);
}
@media (forced-colors: active) {
  html :focus-visible { outline: 2px solid Highlight; }
  .ppui-apps-search:focus-visible { outline: 2px solid Highlight; }  /* box-shadow vanishes in forced colors */
}
```
- Perf: nil. a11y gain: forced-colors users keep a ring. Remove the `border-radius: max(inherit...)` line if unsure; it is optional.

## 6. Segmented control
- Source: Pico `role="group"` button groups https://picocss.com/docs/button ; shadcn Tabs look (muted track, raised active pill).
- Fits: timetable Today/Week, inbox All/Unread, Apps categories, news filter. Use real `<button role="tab" aria-selected>` or radio inputs. Radios = zero JS state:
```html
<div class="ppui-seg" role="radiogroup" aria-label="Show">
  <label><input type="radio" name="f" checked><span>All</span></label>
  <label><input type="radio" name="f"><span>Unread</span></label>
</div>
```
```css
.ppui-seg {
  display: inline-flex; padding: 3px; gap: 2px;
  background: var(--ppui-hover);
  border-radius: calc(var(--ppui-radius-row) + 3px);
}
.ppui-seg input { position: absolute; opacity: 0; pointer-events: none; }
.ppui-seg label { position: relative; }
.ppui-seg span {
  display: block; padding: 6px 14px; border-radius: var(--ppui-radius-row);
  font: 600 13px/1 var(--ppui-font); color: var(--ppui-muted);
  cursor: pointer; transition: background-color .15s var(--ppui-ease), color .15s;
}
.ppui-seg input:checked + span {
  background: var(--ppui-surface); color: var(--ppui-text);
  box-shadow: var(--ppui-shadow-1);
}
.ppui-seg input:focus-visible + span { outline: 2px solid var(--ppui-sky); outline-offset: 2px; }
```
- Perf: CSS-only. Arrow-key nav free from radios. Optional sliding pill: one absolutely placed `::before` moved by `translate` using `:has(input:nth-of-type(2):checked)`; skip unless wanted.

## 7. Toast (sonner-like)
- Source: https://ui.shadcn.com/docs/components/sonner (stacked bottom toasts, subtle border, auto-dismiss). Adapted using popover="manual" so it sits in top layer, no z-index.
- Fits: "Marked read", "Copied", "Couldn't load" feedback; replaces silent failures.
```js
function ppuiToast(msg, ms = 3200) {
  const t = document.createElement('div');
  t.className = 'ppui-toast';
  t.setAttribute('role', 'status');
  t.popover = 'manual';
  t.textContent = msg;
  document.body.append(t);
  t.showPopover();
  setTimeout(() => { t.hidePopover(); setTimeout(() => t.remove(), 300); }, ms);
}
```
```css
.ppui-toast {
  position: fixed; inset: auto 16px 20px auto; margin: 0;
  max-width: min(360px, calc(100vw - 32px));
  padding: 11px 16px; border: 1px solid var(--ppui-hairline);
  border-radius: var(--ppui-radius-row);
  background: var(--ppui-surface); color: var(--ppui-text);
  font: 600 13px/1.35 var(--ppui-font); box-shadow: var(--ppui-shadow-pop);
  opacity: 0; transform: translateY(8px);
  transition: opacity .2s var(--ppui-ease), transform .25s var(--ppui-ease), overlay .25s allow-discrete, display .25s allow-discrete;
}
.ppui-toast:popover-open { opacity: 1; transform: none; @starting-style { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: reduce) { .ppui-toast { transition: none; } }
```
- Perf: nothing idle. Multiple toasts overlap (one fixed slot); keep to single-slot (replace previous) for simplicity: `document.querySelector('.ppui-toast')?.remove()` first.

## 8. Anchor positioning for popovers
- Source: https://developer.chrome.com/docs/css-ui/anchor-positioning (not fetched; from knowledge, verify). Chrome 125+, Firefox 147+? Safari 26. Check caniuse; keep existing JS placement as fallback.
- Fits: Apps launcher button -> `.ppui-apps`, menus.
```css
@supports (position-anchor: --a) {
  .ppui-apps-btn { anchor-name: --apps; }
  .ppui-apps {
    position-anchor: --apps;
    inset: auto;
    top: calc(anchor(bottom) + 8px);
    right: anchor(right);
    position-try-fallbacks: flip-block, flip-inline;
  }
}
```
- JS: `if (!CSS.supports('position-anchor','--a')) placeWithJs(pop, btn);`
- Perf: removes resize/scroll listeners + layout reads. Desktop only; keep bottom-sheet media query (it sets `inset` with !important, so wins).

## 9. Row hit-area + :has() state styling
- Source: general; `:has()` baseline 2023 (already used line 714).
- Fits: news tick-to-read rows, inbox selected/unread.
```css
.ppui-inbox-row { position: relative; }
.ppui-inbox-row:has(input:checked) { opacity: .62; }                 /* read via tick, no JS class */
.ppui-inbox-row:has(:focus-visible) { background: var(--ppui-hover); }
.ppui-inbox-row:has(.ppui-unread-dot) .ppui-inbox-subject { font-weight: 700; }
/* whole row clickable, link stretched */
.ppui-inbox-row a.ppui-inbox-link::after { content: ""; position: absolute; inset: 0; }
```
- Perf: `:has()` is cheap with simple relative selectors; avoid `:has()` on `body`/`html` ancestors with deep subtree. Min touch target 44px: `min-block-size: 44px` on rows.

## 10. Skeleton shimmer, GPU version
- Source: shadcn Skeleton (`animate-pulse`, rounded bar, muted bg) https://ui.shadcn.com/docs/components/skeleton ; ours animates `background-position` (repaint).
- Fits: replace `.ppui-skel-a/.ppui-skel-b` animation (line ~3078, 5068).
```css
.ppui-skel-a, .ppui-skel-b {
  position: relative; overflow: hidden;
  background: var(--ppui-hover);
}
.ppui-skel-a::after, .ppui-skel-b::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, var(--ppui-accent-soft), transparent);
  transform: translateX(-100%);
}
@media (prefers-reduced-motion: no-preference) {
  .ppui-skel-a::after, .ppui-skel-b::after { animation: ppui-sweep 1.4s var(--ppui-ease) infinite; will-change: transform; }
}
@keyframes ppui-sweep { to { transform: translateX(100%); } }
```
- Perf: transform-only, compositor. Reduced motion: static bar. Stop animation when not loading (remove node).

---

## Extras (short)

### A. Easing + duration tokens (Open Props)
Source https://open-props.style/#easing. Our `--ppui-ease` (0.32,0.72,0,1) is an ease-out-expo-ish; add a few siblings so timings stay consistent.
```css
:root {
  --ppui-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ppui-ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1); /* slight overshoot, toggles/checks only */
  --ppui-t-fast: 0.12s; --ppui-t: 0.2s; --ppui-t-slow: 0.4s;
}
```

### B. Container queries for inbox list+detail
Fit: collapse inbox to single column by pane width, not viewport (extension content can be narrow in embeds).
```css
.ppui-inbox { container: inbox / inline-size; }
@container inbox (max-width: 720px) {
  .ppui-inbox-detail { position: absolute; inset: 0; }   /* detail overlays list */
}
```
Perf: cheap; baseline 2023.

### C. `field-sizing: content` for message/compose textarea
Chrome 123+; ignored elsewhere (harmless).
```css
textarea.ppui-compose { field-sizing: content; min-block-size: 3lh; max-block-size: 12lh; }
```

### D. `scrollbar-gutter: stable` on scrollable panes
Stops layout shift when the pane starts overflowing (reader, inbox list).
```css
.ppui-inbox-list, .ppui-reader-body { scrollbar-gutter: stable; }
```

### E. `light-dark()` to shrink theme blocks
Needs `color-scheme: light dark` and our attribute theme mapped (`:root[data-ppui-theme="dark"]{color-scheme:dark}`). Only worth it for one-off colours; tokens already handle the theme. Low priority.

### F. `::selection` brand touch
```css
.ppui-home ::selection { background: var(--ppui-accent-soft); color: var(--ppui-text); }
```

### G. `prefers-contrast: more`
```css
@media (prefers-contrast: more) {
  :root { --ppui-hairline: rgba(11,30,69,.4); --ppui-muted: #3b475c; }
  :root[data-ppui-theme="dark"] { --ppui-hairline: rgba(255,255,255,.4); }
}
```

### H. View Transition for list -> reader
Already using VT for theme. Same API gives a shared-element morph from inbox row to detail pane: set `view-transition-name` on the clicked row only (unique names required), wrap DOM swap in `document.startViewTransition`. Guard `if (!document.startViewTransition)`. Cost: one snapshot; fine for single user click. Chrome 111+, FF 144+? Verify.

### I. Pico-style form defaults worth stealing
`appearance: none` on inputs + consistent `min-block-size: 40px`, `:user-invalid` (not `:invalid`) so error styling appears only after interaction:
```css
.ppui-field:user-invalid { border-color: #c0392b; }
```

## Not worth it
- uiverse snippets: heavy gradients/animations, per-element keyframes, unclear provenance. Use own tokens.
- Any JS lib (sonner, cmdk, floating-ui): extra weight; native popover + anchor + the 25-line toast covers it.
- Animating `box-shadow`/`filter: blur` on hover: repaints; use opacity on pseudo-element.
