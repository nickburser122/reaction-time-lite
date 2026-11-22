# Reaction Time

Static single-page trainer for reaction speed and memory. English only, no build step, no backend.

## Themes

Two skins share one layout, one script and one set of sizes.

| Skin | Look | Files |
| --- | --- | --- |
| Bold (default) | Instrument Serif and JetBrains Mono, lime on ink, grain, square stage with corner brackets; paper light mode | `css/bold.css`, scoped under `:root[data-skin=bold]` on top of the Calm base |
| Calm | Geist and Geist Mono, mint on slate, rounded stage | `css/style.css`, unchanged |

- Header has two controls: skin (Bold / Calm) and mode (Auto / Light / Dark). Every skin works in every mode.
- Switching crossfades through the View Transitions API; browsers without it, runs in progress and reduced-motion settings switch instantly.
- The other skin's fonts are warmed after load so the first switch does not flash fallback type.
- Browser bar colour and favicon follow the active skin and mode.
- Preferences live in `localStorage`: `reaction-time.skin` (`bold` or `calm`) and `reaction-time.theme` (`light` or `dark`, absent for auto). Scores stay in `reaction-time.v1`, untouched.

## Entry paths

| Path | View |
| --- | --- |
| `index.html` or `#/` | Index of all tests with personal bests |
| `#/reaction` | Reaction: five trials, mean in ms, false starts are retried |
| `#/inhibit` | Go / No-Go: 24 stimuli (17 go, 7 no-go), mean go time in ms, runs under 80% accuracy are not recorded |
| `#/aim` | Aim: 20 targets, mean ms per target, misses counted |
| `#/sequence` | Sequence: 3x3 pattern that grows by one, score is the longest sequence repeated |
| `#/digits` | Digits: number span starting at 3 digits, score is the longest number recalled |
| `#/grid` | Grid: tile pattern recall, three lives, score is the highest level cleared |

## Controls

- Space or Enter starts a test and responds in Reaction and Go / No-Go; pointer and touch work everywhere.
- Esc or Stop aborts a run; Esc outside a run returns to the index.
- Each test page shows best, mean, run count and a trend line of the last 24 runs.

## Storage

- `localStorage` key `reaction-time.v1`: `{ [testId]: [{ s: score, t: timestamp }] }`, last 200 runs per test.
- Records stay in the browser they were made in. "Erase records" on the index removes them after a second confirming click.

## Files

- `index.html` shell
- `css/style.css` visuals
- `js/app.js` router, tests, records

## Status

- Not yet browser-tested; verification is pending.
- Not deployed.
- The original `datakid/reaction-time` repository was not read; this is a fresh build around the same idea.

## Possible next steps

- Choice-reaction and Stroop tests
- Export and import of records
