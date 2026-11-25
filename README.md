# Reaction Time

Static single-page trainer for reaction speed and memory, ten tests. English only, no build step, no backend, no network requests beyond its own files. Works offline after the first load.

Copied from `github.com/nickburser122/reaction-time-lite`. Not deployed yet; there is no public URL.

## Version 3

- Offline: `sw.js` caches the page, both stylesheets, the script and all five fonts on the first visit. Later visits are served from that cache and refreshed in the background, so an update shows on the second load after it ships. Needs HTTPS or localhost.
- Timing (new): a dot sweeps along a track at a random speed; press as it crosses the line. Five trials, score is the mean error in ms. Letting the dot run off the end is retried.
- Order (new): numbers appear on a 5x5 board; tap them in ascending order. They hide after the first tap. Starts at 4, grows by one, one mistake ends the run. Score is the longest set cleared.
- No sound test: audio output latency differs too much between devices to compare results.
- Stored records are untouched; the two new tests use the ids `timing` and `order` in the same object.

## Version 2

Same eight tests, same look, same stored records. This version changes how it feels and where its assets come from.

- Fonts are local files in `fonts/`; nothing is loaded from a CDN or any other host. The active skin's fonts are preloaded before first paint.
- Index rows slide with a transform instead of animating padding, so hovering no longer re-lays out the list.
- Aim targets move with a transform and restart their pulse without forcing a layout on every hit; the same applies to the miss flash and the Sequence tap flash.
- Reaction trial pips are kept between trials, so they fade in instead of being rebuilt.
- The index cascade plays in full once per visit; returning to the index uses a much shorter one.
- The page no longer shifts sideways when the scrollbar appears or disappears between views.
- On touch screens: no grey tap flash on links and buttons, no sticky hover border on tiles, no page drag or pull-to-refresh while aiming or during a run.
- No new test was added.

## Themes

Two skins share one layout, one script and one set of sizes.

| Skin | Look | Files |
| --- | --- | --- |
| Bold (default) | Instrument Serif and JetBrains Mono, lime on ink, grain, square stage with corner brackets; paper light mode | `css/bold.css`, scoped under `:root[data-skin=bold]` on top of the Calm base |
| Calm | Geist and Geist Mono, mint on slate, rounded stage | `css/style.css` |

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
| `#/choice` | Choice: 20 arrows, left or right, mean ms of correct answers, runs under 80% accuracy are not recorded |
| `#/stroop` | Stroop: 20 colour words (8 matching, 12 clashing), answer the ink colour, mean ms of correct answers, interference shown per run, runs under 80% accuracy are not recorded |
| `#/aim` | Aim: 20 targets, mean ms per target, misses counted |
| `#/timing` | Timing: five sweeps, press on the line, mean error in ms, overruns are retried |
| `#/sequence` | Sequence: 3x3 pattern that grows by one, score is the longest sequence repeated |
| `#/digits` | Digits: number span starting at 3 digits, score is the longest number recalled |
| `#/grid` | Grid: tile pattern recall, three lives, score is the highest level cleared |
| `#/order` | Order: numbers on a 5x5 board tapped in ascending order, hidden after the first tap, score is the longest set cleared |

## Controls

- Space or Enter starts a test and responds in Reaction, Go / No-Go and Timing; pointer and touch work everywhere.
- Choice: Left and Right arrow keys, or tap that half of the stage.
- Stroop: R, G, B, Y keys, or the four buttons under the word.
- In Choice and Stroop a wrong answer or no answer within 2.5 s counts as an error; presses before the cue are ignored.
- Esc or Stop aborts a run; Esc outside a run returns to the index.
- Each test page shows best, mean, run count and a trend line of the last 24 runs.

## Storage

- `localStorage` key `reaction-time.v1`: `{ [testId]: [{ s: score, t: timestamp }] }`, last 200 runs per test. Unchanged from version 1, so existing records carry over on the same origin.
- Records stay in the browser they were made in. "Erase records" on the index removes them after a second confirming click.
- Export (index footer, shown once there are records) downloads `reaction-time-YYYY-MM-DD.json`: `{ app, version, exported, records }`, where `records` has the same shape as the stored object.
- Import (index footer) reads such a file, or a raw copy of the stored object, and merges it: existing runs are kept, runs with the same score and timestamp are skipped, each test keeps its latest 200. Files over 2 MB or without any known test are rejected. When a test goes past 200, its oldest runs drop off, which can include runs already in this browser; malformed entries in a merged test are dropped too.

## Files

- `index.html` shell, theme and skin controls
- `css/style.css` font faces, Calm visuals and shared layout
- `css/bold.css` Bold skin and header tools
- `js/app.js` router, tests, records
- `sw.js` offline cache; add any new file to its `ASSETS` list
- `fonts/` Geist, Geist Mono, JetBrains Mono (variable weight) and Instrument Serif regular and italic, WOFF2, Latin subset

## Fonts

The font files are Latin subsets. Arrows and the life dots in Grid are not in them and are drawn by the system font. All four families are published under the SIL Open Font License.
