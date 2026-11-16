# UI / dashboard repo + resource research

Date 2026-11-17. Stats via `gh api` (stars | last push | license). Scope: vanilla MV3 ext, plain CSS, no build, no runtime deps, flat, `--ppui-*` tokens. Native-CSS features already in `ui-component-research.md` - not repeated.

Reality check: almost no repo is installable here. Value = IDEAS, not code. Frameworks (React/Bootstrap/Tailwind) = skip. Biggest wins = UX principles + token/scale discipline.

## Best 10 for us (ranked)

1. **Laws of UX** (lawsofux.com) - BORROW. Hick/Miller/Chunking/Von Restorff/Serial Position/Zeigarnik map straight to "what shows first". Rule: max ~5-7 items per card, urgent item gets the only strong accent, first + last slots = most important.
2. **NN/g "Dashboards: preattentive"** - BORROW. Glanceable, single task, no pies/donuts/gauges, never color alone (pair with icon/border/text), sort by value. Grades/assignments: bars or plain numbers, not rings.
3. **NN/g empty-state guidance + Primer Blankslate** - BORROW. Never show "none" while loading. Empty = title + 1 line why + 1 action. Audit every card (no classes today, no news, empty inbox, no assignments).
4. **Radix Colors 12-step scale** (radix-ui/colors, 1738*, 2025-12, MIT) - BORROW. Step roles: 1-2 bg, 3-5 component bg/hover/active, 6-8 borders/focus, 9-10 solid, 11-12 text. Rename/check `--ppui-*` against these roles; guarantees dark theme parity. Don't import (needs build/hundreds of vars).
5. **NN/g progressive disclosure** - BORROW. Two levels max: glance card -> expand/open. Matches "Open full" pattern. Don't add third level.
6. **Open Props** (argyleink/open-props, 5577*, 2026-10, MIT) - BORROW. Copy ~10 values only: easing curves, duration scale (180-420ms), z-index layer names, aspect ratios, fluid type idea. Full bundle 4kB but not needed; inline literal tokens instead.
7. **Utopia fluid type/space** (utopia.fyi) - BORROW. Generate one `clamp()` type scale + space scale as tokens (no dep). Gives consistent typography scale at any viewport/popup width. Calculator only, copy output.
8. **Every Layout primitives** (every-layout.dev) - BORROW. Stack, Cluster, Sidebar, Switcher, Reel, Grid as ~6 tiny utility rules (`gap`+flex-wrap; `flex-basis` switcher). Cuts media queries; fits bento rows. Idea only (paid book; primitives are public).
9. **Lucide / Tabler Icons** (lucide 25795*, 2026-11-16, ISC-ish NOASSERTION; tabler-icons 22698*, MIT) - USE (selectively). Copy individual SVG paths inline (2px stroke, 24 grid) for nav/apps/empty states. Pick ONE set for consistency. Tabler = clean MIT; Lucide license is ISC + MIT parts, check per icon.
10. **Pico CSS** (picocss/pico, 16811*, 2026-10, MIT) - BORROW. Semantic-HTML-first styling, CSS vars theming, `light`/`dark` via `data-theme`. Idea: style by element/attribute not class soup; tiny focus-ring/form defaults. Don't ship it (conflicts with portal).

Runners-up: oat (knadh, ultra-light, 10kB), Primer css, uPlot/frappe-charts if a sparkline is ever wanted.

## Full list

Format: name | stars / last push / license | verdict | take.

### Awesome lists / indexes
| Name | Stats | Verdict | Take |
|---|---|---|---|
| bradtraversy/design-resources-for-developers | 67414 / 2026-10-18 / MIT | BORROW | Link hub only (palettes, icons, fonts). Use as pointer to color/gradient tools, nothing to install. |
| alexpate/awesome-design-systems | 26381 / 2026-11-13 / Unlicense | BORROW | Read other systems' token naming + docs (Primer, Carbon, Polaris, GOV.UK) to sanity check ours. |
| obazoud/awesome-dashboard | 1198 / 2026-11-09 / n/a | SKIP | Mostly ops/BI (Grafana, Superset, Freeboard). Wrong domain, heavy. |
| omarkdev/awesome-dashboards | 437 / 2026-04-30 / n/a | SKIP | Templates list, framework-based. |
| awesome-css-group/awesome-css | 5667 / 2024-10-30 / CC-BY-SA | SKIP | Stale (2024), generic link dump. Native features already covered. |
| htmlstreamofficial/awesome-dashboard-ui-kit | 127 / 2019 / n/a | SKIP | Bootstrap 4, dead. |

### Dashboard templates / kits
| Name | Stats | Verdict | Take |
|---|---|---|---|
| tabler/tabler | 42071 / 2026-11-16 / MIT | BORROW-IDEAS | Best-looking free dashboard kit. Look at demo: stat card = small label + big number + tiny delta; card header with action; list-group rows with avatar+meta. Bootstrap-bound, don't import. |
| ColorlibHQ/AdminLTE | 45695 / 2026-11-16 / MIT | SKIP | Bootstrap 5 + jQuery-era admin chrome. Sidebar-heavy, not student-centric. |
| coreui/coreui-free-bootstrap-admin-template | 12268 / 2026-08-14 / MIT | SKIP | Same class as AdminLTE. |
| themesberg/flowbite-admin-dashboard | 2897 / 2025-03-20 / MIT | SKIP | Tailwind, stale-ish. |
| tremorlabs/tremor | 3701 / 2025-10-10 / Apache-2.0 | BORROW-IDEAS | KPI card anatomy (title, metric, delta badge, progress bar), bar-list (ranked horizontal bars w/ label) - good for grades by subject. React; copy visual pattern only. |
| shadcn-ui/ui | 128338 / 2026-11-13 / MIT | BORROW-IDEAS | Dashboard blocks (cards row + table + side panel), neutral token naming (`--card`, `--muted`, `--border`, `--ring`). Our token set already similar. React. |
| creativetimofficial/ui | 12130 / 2026-03-14 / MIT | SKIP | Component marketplace, framework. |
| mantinedev/mantine | 31950 / 2026-11-16 / MIT | SKIP | React. Spotlight/notifications patterns only conceptually. |
| primer/css | 13055 / 2026-11-15 / MIT | BORROW-IDEAS | Blankslate, Label, Counter, Timeline item patterns. Docs at primer.style are the best reference. |

### CSS frameworks / minimal libs
| Name | Stats | Verdict | Take |
|---|---|---|---|
| picocss/pico | 16811 / 2026-10-04 / MIT | BORROW-IDEAS | See #10. |
| knadh/oat | 5611 / 2026-11-01 / MIT | BORROW-IDEAS | ~10kB CSS+JS, semantic tags, web-component dynamics, zero deps. Closest in philosophy to us. Read for tiny dialog/tabs/tooltip implementations. |
| kevquirk/simple.css | 5031 / 2026-07-19 / MIT | SKIP | Blog styling. |
| oxalorg/sakura | 4394 / 2026-04-07 / MIT | SKIP | Typography reset only. |
| jgthms/bulma | 50034 / 2026-09-21 / MIT | SKIP | Class-heavy, big. |
| saadeghi/daisyui | 42863 / 2026-11-16 / MIT | BORROW-IDEAS | Semantic theme tokens (base-100/200/300, content, primary). Naming trick: surface ladder 100/200/300. Tailwind plugin, no import. |
| sindresorhus/modern-normalize | 7442 / 2026-09-18 / MIT | SKIP | We override portal CSS, not reset. |
| jensimmons/cssremedy | 2222 / 2022-07-07 / MPL-2.0 | SKIP | Stale reset. |
| argyleink/open-props | 5577 / 2026-10-11 / MIT | BORROW | See #6. |

### Color / icons / motion / small libs
| Name | Stats | Verdict | Take |
|---|---|---|---|
| radix-ui/colors | 1738 / 2025-12-17 / MIT | BORROW | See #4. Also: alpha variants for overlays in dark mode. |
| lucide-icons/lucide | 25795 / 2026-11-16 / NOASSERTION (ISC) | USE (copy SVGs) | See #9. |
| tabler/tabler-icons | 22698 / 2026-11-16 / MIT | USE (copy SVGs) | 6500 icons, stroke consistent, cleaner license. Prefer for school-themed icons (backpack, notebook, school, calendar-event, bell). |
| phosphor-icons/core | 402 / 2026-01-06 / MIT | SKIP | Duplicate of above; pick one set. |
| motiondivision/motion | 35262 / 2026-11-16 / MIT | SKIP | WAAPI mini ~2kB exists, but native `@starting-style` + WAAPI cover us. Idea: spring easing values as `linear()` literals. |
| leeoniya/uFuzzy | 3045 / 2026-09-08 / MIT | SKIP (maybe later) | ~3kB fuzzy search. Only if Apps launcher / messages search needs typo-tolerance; substring filter enough today. |
| floating-ui/floating-ui | 32814 / 2026-11-12 / MIT | SKIP | Native popover + anchor positioning cover it. |
| atomiks/tippyjs | 12226 / 2024-05-27 / MIT | SKIP | Stale; native popover. |
| leeoniya/uPlot | 10644 / 2026-11-15 / MIT | SKIP (maybe later) | 45kB-ish canvas chart. Hand-made SVG sparkline is cheaper for grades trend. |
| frappe/charts | 15097 / 2026-10-19 / MIT | SKIP | Zero dep but ~20kB+; inline SVG bars suffice. |
| chartjs/Chart.js, apache/echarts | 67800, 67739 | SKIP | Way too heavy. |
| frappe/gantt | 6156 / 2026-06-18 / MIT | SKIP | Assignments timeline is a list, not Gantt. |

### UX references (non-repo)
| Name | Verdict | Take |
|---|---|---|
| lawsofux.com | BORROW | See #1. Maps: Zeigarnik -> show unfinished/unread; Goal-Gradient -> "3 of 5 done today" progress; Von Restorff -> single accent for due-today. |
| nngroup.com/articles/dashboards-preattentive | BORROW | See #2. |
| nngroup.com/articles/empty-state-interface-design | BORROW | See #3. |
| nngroup.com/articles/progressive-disclosure | BORROW | See #5. |
| refactoringui.com (palette preview) | BORROW | Define greys (8-10 shades) + primary (5-10) + accent for specific jobs only (red=destructive/overdue, yellow=warn, green=good). Predefine shades, no ad-hoc lighten/darken -> we already use tokens; check no `color-mix` drift beyond defined steps. |
| utopia.fyi | BORROW | See #7. |
| every-layout.dev | BORROW | See #8. |
| primer.style empty-states | BORROW | See #3. Graphic + title + 1 sentence + 1 action; border only when inside other content. |
| Smashing dashboard-design-research | SKIP (fetch 404) | URL stale; not verified. |
| Mobbin / HN / Reddit threads | NOT CHECKED | Mobbin sign-in walled; HN/Reddit skipped (low signal, no auth wanted). |

## Dashboard patterns worth stealing

Each: pattern -> how for us -> source.

1. **Single task, glance in 5 sec.** Top of dashboard answers "what now / what next today". One hero "Now / Next class" strip, then rest. -> [NN/g dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)
2. **One accent for urgency (Von Restorff).** Only due-today / unread / current-period gets accent color; everything else neutral. Pair color with icon or text ("Due today"), not color alone. -> [Laws of UX](https://lawsofux.com/von-restorff-effect/), NN/g
3. **Cap list length (Miller/Chunking).** Each card shows 3-5 rows + "View all (N)". Group by day with sticky small-caps day label. -> [Chunking](https://lawsofux.com/chunking/), [Miller](https://lawsofux.com/millers-law/)
4. **Serial position.** Put most important card top-left, second most important last in the reading order; low-value (Apps launcher, shortcuts) middle/bottom. -> [Serial Position](https://lawsofux.com/serial-position-effect/)
5. **KPI row anatomy (Tabler/Tremor).** Label (small, muted) -> big number (display font) -> tiny delta/sub-label. Use for: classes today, due this week, unread messages, average grade. -> [tabler](https://github.com/tabler/tabler), [tremor](https://github.com/tremorlabs/tremor)
6. **Bento = uneven spans on one grid.** `grid-template-columns: repeat(auto-fit, minmax(16rem,1fr))` + a few `grid-column: span 2` hero cards (timetable). Switcher/Sidebar primitive for timeline+inbox pairing without media queries. -> [Every Layout](https://every-layout.dev/layouts/)
7. **Ranked bar list for grades.** Horizontal bars sorted by value, label left, number right; avoid donuts/gauges. -> NN/g, [tremor BarList](https://github.com/tremorlabs/tremor)
8. **Goal-gradient / Zeigarnik.** "2 of 4 assignments done", unread count chip, unfinished stuff pinned first. -> [Goal-Gradient](https://lawsofux.com/goal-gradient-effect/), [Zeigarnik](https://lawsofux.com/zeigarnik-effect/)
9. **Empty state recipe.** Icon (stroke, muted) + title ("No classes today") + one line (what appears here) + one action (open timetable). Never render during load; use skeleton/dim instead. Border only if card-in-card. -> [NN/g](https://www.nngroup.com/articles/empty-state-interface-design/), [Primer](https://primer.style/product/ui-patterns/empty-states/)
10. **Two-level disclosure.** Glance card -> detail panel/page. No third level. Keep "Open full" label explicit. -> [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
11. **12-step surface ladder.** bg / subtle bg / component / hover / active / border / strong border / solid / solid-hover / low-text / high-text. Makes flat design (no shadows) readable: separation via 1px border + tone, not elevation. -> [Radix scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale), [daisyUI](https://github.com/saadeghi/daisyui)
12. **Fluid type + space scale.** One `clamp()` scale for 6-7 sizes; KPI numbers on the top step in Playfair italic, labels at the smallest in Jakarta. -> [Utopia](https://utopia.fyi/), [Open Props](https://open-props.style/)
13. **Density control.** One `--ppui-density` multiplier on padding/row-gap (compact/cozy) rather than separate styles; students on small laptops get compact. Idea from fluid space scales; low cost.
14. **Motion tokens.** 3 durations (fast 120 / base 200 / slow 360ms), 2 easings, all wrapped in `prefers-reduced-motion`. -> [Open Props](https://open-props.style/)
15. **Icon discipline.** One stroke set, 1.75-2px, same optical size per context (nav 20, row 16, empty 32). -> [Tabler Icons](https://github.com/tabler/tabler-icons)
16. **Doherty 400ms.** Render cached shell instantly, hydrate lists after; don't block on portal fetches. -> [Doherty Threshold](https://lawsofux.com/doherty-threshold/)

## Do not do
- No chart library. SVG sparkline/bars by hand if needed.
- No framework CSS import (Pico/Oat/Bulma) - clashes with portal styles, adds bytes.
- No pies/donuts/radial gauges for grades or progress. Linear bars.
- No shadows to separate (project rule). Use border + surface step.

## Gaps / not verified
- Mobbin, Dribbble, HN/Reddit threads not read (sign-in walls / low signal).
- Smashing dashboard article URL 404.
- Lucide license shown as NOASSERTION by GitHub (ISC + MIT Feather portions); verify before copying many icons.
- Star counts approximate snapshot 2026-11-17.
