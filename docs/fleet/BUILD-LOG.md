# Build log — Afterhours XAML migration

Append only. Milestones, not edits. Decisions live in `docs/specs/xaml-outer-ui-SPEC.md`.

| Stat | Value |
|---|---|
| Sessions | 1 (single coordinator, no fleet threads) |
| Milestones logged | 5 |
| Brief → first recognizable XAML chrome | 2 h 35 min (14:35 first spec → 17:10 wave 1 runnable) |
| Runtime checks | wave 0: 13/13 · wave 1: 30/30 · wave 2: 40/40 · wave 3: 54/54 |
| WASM framework download (brotli) | 5.53 MB baseline → 6.49 MB wave 0 → 6.63 MB wave 1 → 6.41 MB wave 2 → 6.51 MB wave 3 (sum of `_framework/*.br`; Skia spike build 10.76 MB) |

## 2026-10-23 15:35 — Wave 0: same-page hosting proven (go)

Brief (verbatim):
> "start wave 0"

Came back: 1 session, 8 publish/verify iterations, 44 min from first spike commit to verdict.
Numbers: 13/13 Chromium checks · max save 212 KB parses in 20–42 ms in C# (too slow to push whole) ·
+0.96 MB brotli for Hosting/Toolkit/MVUX/Navigation · cold Release build 159 s
Shots: docs/spikes/wave0/
Surprises: `BrowserHtmlElement` inherits `pointer-events: none` on the native renderer (CSS workaround);
Toolkit `ExtendedSplashScreen` requests a lowercase `appmanifest.js` that 404s on case-sensitive hosts;
publishing over an old `release/uno` silently served the previous assembly (fixed in `eafc1f9`).
Threads: 0 (single session)

## 2026-10-23 17:10 — Wave 1: XAML chrome around the JavaScript room (first runnable)

Brief (verbatim):
> "approve all four, start wave 1"

Came back: 1 session, 7 publish iterations, 1 h 35 min from approval to 30/30.
Numbers: 30/30 checks at 1440/1000/800/390 px, solo and two-player shared · 72 Node + 9 xUnit tests ·
1,216 lines across host.mjs, MainPage, ChatPanel, MainModel, services and themes ·
52 IL2026 + 3 IL2104 allowed trim warnings (all MVUX-generated or Uno.Extensions), 0 others
Shots: docs/screenshots/xaml/wave1/
Surprises: MVUX commands ignore Enter from `utu:CommandExtensions` unless the method takes the
TextBox text as its parameter; Playwright `fill()` does not update an Uno TextBox (real keystrokes do);
Uno keeps collapsed elements' boxes, so visibility checks need `checkVisibility()`;
`AutomationProperties.Name` emits no `aria-label` on the native WASM Release build (open, R11).
Threads: 0 (single session)

## 2026-10-23 18:13 — Wave 2: shop, inventory, blueprints and gift wrap in XAML

Brief (verbatim):
> "start wave 2'"

Came back: 1 session, about 1 h from the wave 1 push (17:12) to 40/40.
Numbers: 40/40 checks at 1440/1000/800/390 px, solo and two-player shared · 73 Node + 16 xUnit tests ·
683 new lines across the three panel models, shop records, views and converters · first shop open: title 0.9 s,
cards 2.4 s (`GridView` took 4.8 s, so the grid is an `ItemsRepeater`) · reopen instant ·
framework download 6.41 MB brotli (sum of `_framework/*.br`; earlier entries may have been measured differently)
Shots: docs/screenshots/xaml/wave2/
Surprises: MVUX hands a record read through a state to converters as a generated `Bindable…ViewModel` proxy,
so the detail art lost its clip until it bound a value-type `ClipRect`; `ItemsUpdatingScrollMode` (Uno0001)
slipped past the warning regex; the game's `<dialog>` top layer covered the XAML drawer until `openPanel`
closed it first; R11 confirmed: no aria output on the native WASM renderer, screen readers need Skia.
Threads: 0 (single session)

## 2026-10-29 00:50 — Skia renderer spike (go with three fixes; switch pending)

Brief (verbatim):
> "approve the Skia spike, then start wave 3"

Came back: 1 session, 2 clean publishes (Skia and a native baseline), 3 cold loads each on localhost.
Numbers: framework download 6.41 → 10.76 MB brotli · room ready 4.1–4.7 s native vs 5.6–5.7 s Skia ·
JS heap 10 → 20–22 MB · 40+ labelled elements in `#uno-semantics-root` once accessibility is enabled
Shots: docs/spikes/skia/
Surprises: the default Skia font fallback fetches a ~16 MB CJK font from GitHub to draw ✦; the hosted room
blanks under a translucent XAML scrim (no alpha blending over native elements); the Enter that enables
accessibility also presses the first button it focuses.
Threads: 0 (single session)

## 2026-10-29 01:50 — Wave 3: studio, library, jukebox, stage and chart in XAML

Brief (verbatim):
> "approve the Skia spike, then start wave 3"

Came back: 1 session, about 1 h from the spike record (00:50) to 54/54, in two halves (3a pushed first).
Numbers: 54/54 checks at 1440/1000/800/390 px, solo and two-player shared · 74 Node + 26 xUnit tests ·
1,005 new lines across the studio, jukebox, stage and chart models, records and pages · a step toggle round
trip (click → game edit → reply → cell) about 0.4 s in the probe · studio opens in 1.9 s
Shots: docs/screenshots/xaml/wave3/
Surprises: a navigation message dialog closed the drawer it was shown from; `ItemsRepeater` realized only the
first row inside a horizontal scroller on the phone; a soft button on a raised card is invisible (same fill);
a wave 1 test slept 50 ms and raced under build load.
Threads: 0 (single session)
