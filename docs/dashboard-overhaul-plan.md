# Home dashboard overhaul

Goal: the home page answers four questions at a glance, with one tap to the detail.

1. What's on now, and what's next?
2. What's due?
3. Do I have unread messages?
4. Which classes have updates?

Sources: `ui-component-research.md`, `ui-repo-research.md`, `ux-article-lessons.md` (NN/g and Laws of UX).

## Layout

```
header: greeting, date, tool pill (unchanged)
+----------------------------+------------------------------------------+
| NOW TILE (crest blue)      | Due soon   |  Unread    | Class updates |
| Now until 10:40 [25 min]   | 3          |  5         | 0             |
| Mathematics                | Essay, today| in Messages| All caught up|
| Room 101 . Then English    |            |            |               |
| [day progress bar]         |            |            |               |
+----------------------------+------------------------------------------+
| Today (timetable)  | Classes           | News                         |
+--------------------+-------------------+------------------------------+
```

- **Desktop** (wider than 1000px): the glance strip is split 5/7, then three equal cards (4/4/4). With no class list, Today and News split 6/6.
- **Tablet** (1000px and narrower): the now tile and the counts strip stack. Today and Classes are 6/6, and News spans the full width.
- **Phone** (680px and narrower): the now tile comes first, then the three counts in one row. They show icon, number and label, without the sub-line. The cards stack below, and popovers stay bottom sheets.

## Decisions, and the research behind them

| Change | Why |
| --- | --- |
| The now tile is the only solid crest-blue block | Von Restorff and selective attention: one dominant element. NN/g visual hierarchy. |
| Now/Next follows the clock and re-renders every minute without a fetch | Before, "Now" could be up to 5 minutes stale between fetches. Doherty threshold. |
| Time-left chip, plus a "Then X at time" line | Answers now and next in one look, so nothing has to be held in memory (working memory, cognitive load). |
| Day progress moves into the now tile, as a bar | NN/g: length encoding beats gauges. It sits with the thing it describes (proximity). |
| Three counts share one card, split by hairlines | Fewer boxes to scan above the fold (chunking, common region). Recommended by both sources. |
| The Due tile names the nearest note ("Essay draft, today") | The tile answers "what", not only "how many". |
| Zero counts stay in place, muted rather than faded | NN/g: never lower contrast to de-emphasize. The layout never jumps. |
| Overdue shows as red text, plus a word | Colour only for urgency, never colour alone. |
| Counts are capped at 99+ | Keeps the tile width stable. |
| Class updates opens a menu of classes with counts | One tap to the right class. Reuses the existing popover and arrow-key nav. |
| Cards are 4/4/4 instead of 5/4/3 | The now tile left Today, so Today is shorter. News gets room for its lead photo. |
| Flat design, no shadows, `--ppui-*` tokens, both themes | Project constraints. Elevation comes from surface lightness and hairlines. |
| Hover effects only under `(hover: hover)`, motion behind `prefers-reduced-motion` | Already the house rule (polish pass). |

## Done (branch `ui-overhaul-ioj3ae`)

- `content.js`:
  - `buildGlance()` and `statTile()` are new.
  - `renderFeatured()` was rewritten. It has time left, a countdown, a Then line, and an off state ("School's out" / "No classes today" / "Schedule unavailable").
  - `nowIndexOf()` and `markRows()` are new and clock-based.
  - `buildTodayPanel(glance)` now runs a one-minute tick.
  - `build()` wires the class updates into the glance strip.
- `styles.css`:
  - The glance strip, now tile, stats strip and updates menu are new.
  - The grid moved to 4/4/4.
  - There are tablet and phone breakpoints, plus the entry animation and the reduced-motion rule.

## Later (not done; worth a decision)

- **Shorter hero on home.** NN/g flags that the greeting hero adds height but no task value. Cutting it about 40px would lift the cards. It's a brand call, so I'm leaving it to you.
- **Fewer header pill controls.** Hick's law argues for moving theme into the account menu (6 controls down to 5).
- **Past timetable rows.** They sit at 0.45 opacity, which is below NN/g's contrast floor. Consider collapsing them behind "Earlier (3)" instead.
- **Classes card duplicates the update badges.** Once the glance tile has proven itself, consider ordering the card by updates first.
- **Next school day after hours.** After school, show the first class of the next school day. This needs the schedule for another date, which the portal's page may not give.

## How to check it in the browser

1. Pull the branch. In `chrome://extensions` (or `about:debugging` in Firefox), click Reload on Pinehurst Dashboard.
2. Open the portal home and check:
   - Light and dark themes.
   - A window narrower than 1000px, and one narrower than 680px (phone).
   - With OS "reduce motion" turned on.
3. Check the states:
   - Class on now: blue tile with a "min left" chip.
   - Before the first class: the quiet tile with "in N min".
   - After school: "School's out".
   - A note dated today: the Due tile shows its text.
   - Overdue note: red line.
