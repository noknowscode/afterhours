# Build log — Afterhours XAML migration

Append only. Milestones, not edits. Decisions live in `docs/specs/xaml-outer-ui-SPEC.md`.

| Stat | Value |
|---|---|
| Sessions | 1 (single coordinator, no fleet threads) |
| Milestones logged | 11 |
| Brief → first recognizable XAML chrome | 2 h 35 min (14:35 first spec → 17:10 wave 1 runnable) |
| Runtime checks | wave 0: 13/13 · wave 1: 30/30 · wave 2: 40/40 · wave 3: 54/54 · Skia: 56/56 · wave 4: 65/65 · wave 5: 76/76 · wave 6: 82/82 · wave 7: 85/85 |
| WASM framework download (brotli) | 5.53 MB baseline → 6.49 MB wave 0 → 6.63 MB wave 1 → 6.41 MB wave 2 → 6.51 MB wave 3 → 10.87 MB on Skia → 11.01 MB wave 5 → 11.09 MB wave 6 → 11.10 MB wave 7 (sum of `_framework/*.br`) |

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

## 2026-10-29 02:45 — Switched to the Skia renderer

Brief (verbatim):
> "switch to skia, and conttinue with whats next. is there more that can be changed to c# or xaml?"

Came back: 1 session, 9 publishes, the runtime check ported to an in-app XAML probe.
Numbers: 56/56 checks on Skia · framework 10.87 MB brotli · room ready about 5.7 s (localhost) · JS heap 11–14 MB ·
fonts at boot: 5 of ours plus the Fluent icons (Open Sans's 38 files gone) · symbol font 300 KB, emoji 719 KB lazy
Shots: docs/screenshots/xaml/skia/
Surprises: the Toolkit drawer's slide left Uno's accessibility mirror with stale positions (off by up to
900 px); a transparent scrim still blanks the hosted room; Uno's default font is a 38-file family; an
`ItemsControl` reported zero size while its cells drew, so the probe walks into zero-size containers.
Threads: 0 (single session)

## 2026-10-29 03:18 — Wave 4: journal, profile, wardrobe and help in XAML

Brief (verbatim):
> "switch to skia, and conttinue with whats next. is there more that can be changed to c# or xaml?"

Came back: 1 session, 2 publishes, 5 runtime-check rounds to 65/65 (three of them flakiness in the check).
Numbers: 65/65 checks · 75 Node + 30 xUnit tests · four routes (Journal, Profile, Wardrobe, Help) · 4 game panels
and the JS help removed · save restore through a real file chooser
Shots: docs/screenshots/xaml/wave4/
Surprises: claiming the daily gift now opens a XAML sheet, so a wave 1 check clicked its scrim; Uno's Skia input
dropped instant clicks under load (fixed by a press-and-hold click in the check); the first keystroke after
focusing a TextBox could arrive before focus.
Threads: 0 (single session)

## 2026-10-29 04:59 — Wave 5: rooms, room tools, companion and arcade in XAML

Brief (verbatim):
> "continue through all waves"

Came back: 1 session, 3 publishes, 8 runtime-check rounds to 76/76 (one real bug, one shadowed global, the rest
timing in the check).
Numbers: 76/76 checks · 77 Node + 37 xUnit tests · nine routes (Rooms, RoomTools, RoomLogic, RoomEvent,
MessageBoard, Portal, RoomObject, Companion, Arcade) · 11 game panel titles and the shared navigator removed
Shots: docs/screenshots/xaml/wave5/
Runs: 76/76 on 3 of 4 full runs after the fixes; the other stopped on a dropped click in a wave 4 journal tab.
Surprises: a second click on a closing sheet navigated back twice and could leave the page; on Skia the browser's focus stays on the page body after a XAML click, so room shortcuts fired while a
XAML button had focus (the wave 1 check had passed by a race); a host export named `rooms` hid the page's global
list of public rooms and the world failed to open; a record member named `Event` breaks MVUX's generated proxy.
Threads: 0 (single session)

## 2026-10-29 05:53 — Wave 6: your circle, residents, the shared world, players and trades in XAML

Brief (verbatim):
> "continue through all waves"

Came back: 1 session, 2 publishes, 2 runtime-check rounds to 82/82 (the first failure was a wave 5 check that
read a closing sheet too early).
Numbers: 82/82 checks · 78 Node + 43 xUnit tests · seven routes (Friends, Resident, Player, Trade, Away,
SharedWorld, ChatPrefs) · 10 game panel titles removed · a two-player friend request and trade driven end to end
Shots: docs/screenshots/xaml/wave6/
Surprises: none new; the social sheets reuse the stage's watch pattern, and the whisper target moved to .NET
because the game's chat selects no longer drive the XAML chat box.
Threads: 0 (single session)

## 2026-10-29 06:38 — Wave 7: R9 spike passed; joining, restoring and signing out in XAML

Brief (verbatim):
> "continue through all waves"

Came back: 1 session, 4 publishes (one for the spike), 4 runtime-check rounds to 85/85.
Numbers: 85/85 checks · 78 Node + 43 xUnit tests · three routes (Join, Restore, SignOut) · `online.js` builds no
panel any more · the managed-world join covered with a stubbed service and a stand-in security widget
Shots: docs/screenshots/xaml/wave7/ · spike: docs/spikes/r9/
Surprises: Cloudflare is blocked from the container, so the spike proved hosting with a stand-in; a transparent
native element shows the hosted room through it; Playwright's request stub missed the health call because the
app's service worker answered it; a shared world that kept every test run's chat made joins slow enough to time
out, so the check server now starts on a fresh data folder.
Threads: 0 (single session)

## 2026-10-29 06:55 — Wave 8: docs; Phase A complete

Brief (verbatim):
> "continue through all waves"

Came back: 1 session, docs only (no new build).
Numbers: 30 panel routes in XAML · 0 game panels reachable from the chrome except an arcade round and its results ·
85/85 runtime checks · 78 Node + 44 xUnit tests · framework 11.10 MB brotli (10.87 MB at the Skia switch)
Shots: docs/screenshots/xaml/wave2 … wave7/
Surprises: none; the standalone packager and download are retired as approved on 2026-10-23.
Quote: "continue through all waves" took waves 5 to 8 in one session (about 4 h 10 min from 02:45 to 06:55 UTC).
Threads: 0 (single session)

