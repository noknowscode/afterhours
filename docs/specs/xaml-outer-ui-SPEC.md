# Spec: Afterhours UI in Uno XAML around a JavaScript room

Status: **draft v2; waves 0–4 done on the Skia renderer, wave 5 next.** Rewritten 2026-10-23 after the migration-scope review.
No app code changed yet.

## Settled inputs

| Input | Answer | Source |
|---|---|---|
| Targets | **Web only** (`net10.0-browserwasm`) | user, 2026-10-23 |
| Solo play | **Keep.** Browser-saved game, simulated residents, no server, standalone `Afterhours.html` | user, 2026-10-23 |
| Room renderer | **Stays JavaScript.** A SkiaSharp port pays off only with desktop/Android | scope review + user |
| Synth | **Stays JavaScript** (`music.js`, WebAudio). Uno has no synthesis or scheduling API | scope review |
| Game server | **JS Worker stays.** Staged order: Phase A over JS state, Phase B ports rules to C# with shared test cases (scope review's Option 1), ASP.NET Core later if the playtest outgrows five players | recommendation; confirm in Unresolved Questions |

## Goal and phases

The Uno app owns every screen the player reads or types into: menus, HUD, chat, panels, and the room-editor
toolbar. The isometric room canvas, the arcade rounds, the synth and the account widgets stay JavaScript.
They run as **DOM islands** inside the Uno page, with no iframe.

| Phase | Delivers | Game state owner | This spec |
|---|---|---|---|
| **A** | `BrowserHtmlElement` room host, XAML shell, every panel in XAML + MVUX | JS `Game` (`game-core.js`), read through C# interfaces | **full detail** |
| **B** | `Afterhours.Core` C# rules + shared test cases; C# solo store; C# shared-world client | C# for the client; JS Worker on the server | outline only; own spec before build |
| C | ASP.NET Core server sharing `Afterhours.Core` | C# everywhere | out of scope |

The panels bind to interfaces (`IGameStore`, `ISharedWorld`, `IRoomView`, `IMusic`). Phase A implements the
first two over JS. Phase B swaps in C# implementations without touching XAML.

Evidence: `dist/*.js` (every panel, inventoried below), `session-core.mjs` (imports `game-core.js` and
`furniture.js`), `service/scripts/build.mjs` (also bundles `wardrobe.js`), `online.js` (`W.game.dispatch`
override: dispatches on the client, then the server re-runs it), Uno docs (`interop/wasm-javascript-1`,
`features/using-skia-hosting-native-controls`, `controls/SKCanvasElement`, `controls/WebView`), Uno 6.7.135 package source.

---

## Architecture Brief

### Targets, SDK and features

- `net10.0-browserwasm`, **native (DOM) renderer**: `SkiaRenderer` stays off. XAML and the JS islands share
  one DOM, so XAML flyouts stack over the room in normal z-order, with alpha blending.
- Uno.Sdk **6.7.30**, pinned in `uno/global.json`.
- `UnoFeatures`: `Hosting; MVUX; Navigation; Toolkit` (all new). The WebView is removed; `AfterhoursInterop.js`
  and its Node test are deleted.

### Decisions

**D1. Host the game DOM with `BrowserHtmlElement` instead of `WebView2`.**
Reason: the Uno docs document `Uno.UI.NativeElementHosting.BrowserHtmlElement` for WebAssembly. Same-page
hosting removes the iframe, the Uno 6.7/.NET 10 `unoExports` shim, iframe user-activation limits on audio,
and iframe focus handoff. C# and JS call each other through `[JSImport]`/`[JSExport]`.
Tradeoff: game CSS and globals share the page with Uno. CSS gets scoped under `.ah-root` (D5), and window key
handlers must ignore events from XAML (D6).

**D2. Phase A keeps the JS `Game` as the single writer of game state.**
Reason: `online.js` dispatches each action on the client and then sends it to the server, which runs it again.
A C# client copy has to match the JS server exactly or shared players see changes snap back. That port deserves
its own phase with shared test cases (Phase B). The panels gain nothing from waiting for it.
Tradeoff: in Phase A, C# reads state the game pushes, and every write is a call into JS.

**D3. The panels bind to four C# interfaces.**
Reason: they are the seam Phase B swaps. `IGameStore` (solo rules state and the 22 actions) and `ISharedWorld`
(connection and shared snapshot) get C# implementations later. `IRoomView` (renderer) and `IMusic` (synth)
stay JS-backed permanently.
Tradeoff: about 30 C# records mirror the JS state shape, which `validate()` in `game-core.js` defines.

**D4. MVUX models, Navigation `!` routes, one persistent `MainPage`.**
Reason: the store pushes async state with real Progress/Error cases. Each panel has one editable draft (an
`IState`). The room host must never be navigated away, because that would drop the live room, audio and
online session. Panels open as flyouts or dialogs over `MainPage`.
Tradeoff: Uno.Extensions + Toolkit add download size and build time (R7).

**D5. Scope game CSS under `.ah-root` at build time.**
`scripts/scope-css.mjs` (no dependency, built in wave 0) prefixes every selector with `.ah-root`, turns
`:root`, `html` and `body` into the root itself, recurses into `@media`/`@supports`, and hoists `@import`,
`@font-face` and `@keyframes`. `scripts/build-uno.mjs` writes the result to `game/scoped.css`. The JS writes its `body` classes (`is-playing`, `chat-history-open`, `music-panel-open`) to the root
element instead. `npm start` keeps loading the unscoped files.
Tradeoff: a build transform to test. Unscoped `*{box-sizing}`, `button{}`, `input{}` and `dialog{}` rules
would otherwise restyle Uno's own DOM.

**D6. DOM islands for JS-only surfaces.**
Each JS surface mounts into its own `BrowserHtmlElement`: the room canvas (`RoomHost`), an arcade round
(`ArcadeHost`, using `AfterhoursArcade.start(kind, host, done)`), and the Turnstile check (`CaptchaHost`, R9).
Window key handlers in `app.js`/`arcade.js` act only while focus is inside `.ah-root` or the arcade host.

**D7. The room asks the XAML to open panels.**
Canvas interactions that open panels today (furniture use, residents, players, jukebox, portals, message
board, set complete, the doorbell) send `open {route, data}` through `IRoomView.Requests`. `MainModel` navigates.

### Shell and regions

```
App.xaml.cs  UseToolkitNavigation · RegisterRoutes · NavigateAsync<Shell>
Shell (UserControl, plain ContentControl host; no ExtendedSplashScreen, see wave 0; no Region.Attached)
└─ MainPage   Grid[Region.Attached]        rows: TopBar | Body ; Body columns: Rail | Stage | Social
   ├─ TopBar     brand · Music · Furniture shop · coins · profile MenuFlyout
   ├─ Rail       nav · room hopping · resident card          Wide+: 220 px · Normal: 72 px icons · Narrow: hidden
   ├─ Stage      RoomHeading · RoomHost (BrowserHtmlElement) · EditorBar | ActionBar · NowPlaying
   ├─ Social     ChatPanel (Room chat / Friends tabs)       Wide+: column · below: !Chat flyout
   ├─ BottomBar  utu:TabBar                                   Narrow only
   └─ BootPanel  covers Stage until IRoomView reports Ready
```

### Services (DI)

| Interface | Phase A implementation | Phase B | Members (abridged) |
|---|---|---|---|
| `IGameStore` | `JsGameStore` | `CoreGameStore` (C#, `localStorage` via JSImport) | `IFeed<GameState> State`; `ValueTask<ActionResult> Dispatch(GameAction, ct)` for the 22 actions; `SaveDraft(SongDraft)`; `Export()`/`Restore(GameState)`/`RestoreBackup()` |
| `ISharedWorld` | `JsSharedWorld` (wraps `online.js`) | `HttpSharedWorld` | `IFeed<SharedState> State` (None when solo); `Connect(JoinRequest)`, `Leave`, `JoinRoom(key)`, `Say`, `Whisper`, `Friend`, `Trade*`, `Vote`, `Queue`, `Report`, `AwaySeen` |
| `IRoomView` | `JsRoomView` | same | `Mount(elementId)`, `IFeed<RoomInfo> Room`, `IFeed<EditorState> Editor`, `IListFeed<ChatLine> Chat`, `IAsyncEnumerable<OpenRequest> Requests`; `Enter(RoomKey)`, `Wave`, `Dance`, `Stand`, `StartEditing`/`Rotate`/`Store`/`Undo`/`Finish`/`Select(itemId)`, `Zoom(in/out/fit/follow)`, `Say(text, mode)`, `Focus()` |
| `IMusic` | `JsMusic` | same | `IFeed<Playback> Playback` (running, songId, step); `Play(SongDraft)`, `Stop`, `ExportWav(SongDraft)` (download handled in JS) |
| `GameHost` (static partial) | — | — | the only `[JSImport]`/`[JSExport]` surface; module `game/host.mjs` via `JSHost.ImportAsync` |

`game/host.mjs` (ES module, prototyped in wave 0) loads the classic game scripts in today's `index.html` order,
builds the room markup inside the mounted element, sets `window.AfterhoursBase` so game art resolves under
`game/`, and exposes the JS half of the four interfaces. It pushes **state slices** (`profile`, `wallet`,
`items`, `rooms`, `songs`, `draft`, `pet`, `progress`, …: the top-level keys of `game.state`), sending only the
slices whose JSON changed, at most 10/s. It also pushes `shared`, `room`, `editor`, `chat`, `playback` and
`open`. Wave 0 measured a full 212 KB save at 20–42 ms per C# parse, which is too slow to send whole (R8). The `world` facade it calls is today's `window.AfterhoursWorld`, extended where needed.
`BridgeJsonContext` (`System.Text.Json` source generation) keeps parsing trimming-safe.

### Routes

```csharp
views.Register(
    new ViewMap(ViewModel: typeof(ShellModel)),
    new ViewMap<MainPage, MainModel>(),
    // one ViewMap or DataViewMap per panel in the table below
);
routes.Register(new RouteMap("", View: views.FindByViewModel<ShellModel>(), Nested:
[
    new RouteMap("Main", View: views.FindByViewModel<MainModel>(), IsDefault: true),
    // one RouteMap per panel, all opened from Main with "!"
]));
```

### Panel inventory (Phase A)

Each row is a `!` route opened over `MainPage`, shown as a right flyout (F) or a dialog (D). Since wave 2 every
`!` route opens in the same right drawer (`Views/PanelFlyout.xaml`); D rows are drawers too. The source column
names the JS function it replaces; that JS is deleted when the row ships.

| Wave | Route | Kind | Model data | Replaces |
|---|---|---|---|---|
| 2 ✓ | `Catalog` | F | `CatalogRequest(Tab)` | `catalog` "THE FURNITURE SHOP", `showInventory`, item detail "THE AFTERHOURS COLLECTION" |
| 2 ✓ | `Blueprints` | F | — | `blueprints` |
| 2 ✓ | `WrapGift` | D | `WrapGiftRequest(ItemId)` | gift panel "WRAP A GIFT" |
| 3 ✓ | `Studio` | F | `StudioRequest(Tab)` | `studio` (Editor / Library tabs) |
| 3 ✓ | (inline in `Studio`) | — | — | "Delete this track?" |
| 3 ✓ | `Stage` | F | — | `stagePanel` (solo) and shared stage "SHARED MUSIC STAGE" |
| 3 ✓ | (inline in `Stage`) | — | — | "SET COMPLETE" |
| 3 ✓ | `Jukebox` | F | — (the current room) | `playlistPanel` |
| 3 ✓ | `Chart` | F | — | `chartPanel` |
| 4 ✓ | `Wardrobe` | F | — | `look` (`classicLook` stays a game panel) |
| 4 ✓ | `Profile` | F | — | `profile` |
| 4 ✓ | (inline in `Profile`) | — | — | "Restore this world?" / "Recover your last backup" |
| 4 ✓ | `Journal` | F | `JournalRequest(Tab)` | `journal` (quests, badges, wallet) |
| 4 ✓ | `Help` | F | — | "HOW TO PLAY" |
| 5 ✓ | `Rooms` | F | `RoomsRequest(Filter)` | `directory` + shared `roomDirectory` |
| 5 ✓ | (inline in `Rooms`) | — | — | "CREATE A ROOM" |
| 5 ✓ | `RoomTools` | F | — (the current room) | `roomTools` + "ROOM SETTINGS" |
| 5 ✓ | `RoomLogic` | F | — | `rulesPanel` |
| 5 ✓ | `RoomEvent` | D | — | `eventPanel` |
| 5 ✓ | `MessageBoard` | F | — | `notesPanel` |
| 5 ✓ | `Portal` | D | `ItemRequest(ItemId)` | "LINK A PORTAL" |
| 5 ✓ | `RoomObject` | D | `ItemRequest(ItemId)` | `openObject` "ROOM INTERACTION" |
| 5 ✓ | `Companion` | F | — | `petPanel` + "ADOPT A COMPANION" |
| 5 ✓ | `Arcade` | F | — | `arcade` (picker in XAML; a round and its results stay game panels) |
| 6 ✓ | `Friends` | F | — | "YOUR CIRCLE" + shared `friendsPanel` "FRIENDS & REQUESTS" |
| 6 ✓ | `Resident` | D | `ResidentRequest(Name)` | `residentProfile` |
| 6 ✓ | `Player` | D | `PlayerRequest(Id)` | `playerPanel` "CONNECTED PLAYER" |
| 6 ✓ | (inline in `Player`) | — | — | "Report a player" |
| 6 ✓ | `Trade` | F | `TradeRequest(Id)` | `tradePanel` |
| 6 ✓ | `Away` | D | — | `awayPanel` |
| 6 ✓ | `SharedWorld` | F | — | "SHARED WORLD" / "SHARED SESSIONS" info (joining stays a game panel until wave 7) |
| 6 ✓ | `ChatPrefs` | D | — | "CHAT PREFERENCES" |
| 1 ✓ | `Chat` | F | — | chat column on narrow widths (`ChatPanel`, shipped in wave 1) |
| 7 | `Join` / `Restore` / `SignOut` | D | — | account panels (Turnstile in `CaptchaHost`, Supabase JS unchanged) — **R9 gated** |

Wave 1 has no routes: it builds `MainPage` (top bar, rail, room heading, action bar, editor bar, now playing,
chat column) and the four interfaces.

### Models (pattern; one per route)

- **Read side:** derived feeds from the store, e.g. `ShopModel.Items = Store.State.Select(Catalog.ForSale)`.
  A record with `Id` gets key equality for free.
- **Write side:** public methods call `Store.Dispatch(new BuyAction(type))` and show the returned error
  inline. They never edit state locally.
- **Drafts:** `IState<T>` local to the panel (wardrobe outfit, studio song, profile form, room form, trade offer).
  Seeded once from the store when the panel opens, and committed by one command.
- `StudioModel.Draft` also saves through `Store.SaveDraft` (debounced 300 ms). The playhead comes from
  `IMusic.Playback` and moves one overlay element, so step cells never rebuild per tick.
- `WardrobeModel.Preview` = Combine(Draft, Pose).SelectAsync(`IRoomView.RenderAvatar`) → PNG data URL.
  `avatar-renderer.js` keeps the pixel tinting (scope review question 3: yes, through the bridge).

### Phase B outline (own spec before building)

1. **Shared test cases:** `tests/vectors/*.json` hold `{state, action, now, expect: {state | error}}` for all
   22 actions, `validate`, and day/ISO-week rollovers. `node --test` runs them against `game-core.js` today.
2. **`Afterhours.Core`:** C# records + a reducer + `Validate` + furniture catalog + wardrobe tables. An xUnit
   project runs the same vectors, and CI fails if either side diverges.
3. **`CoreGameStore`** for solo, reading and writing the same `afterhours-v5` save. Existing players keep
   their worlds.
4. **`HttpSharedWorld`:** the C# client for the Worker API (`/api/*`), with the optimistic dispatch done by
   `Afterhours.Core`.
5. `movement.js` and `seating.js` stay with the JS renderer; the server only checks movement distance.
   Delete the JS client copies of `game-core`/`furniture`/`wardrobe` only once they leave the server too (Phase C).

### Platform constraints

- `localStorage` keys stay as they are (`afterhours`, `afterhours-v5`, `-backup`, `-online-cache`,
  `afterhours-account-resume`). Phase A changes no save format.
- Downloads (save export, WAV) stay JS `a.download`. File import uses the XAML `FileOpenPicker` on WASM (R10),
  then calls `IGameStore.Restore`.
- OAuth redirect stays on `account-callback.html`.
- `npm start` and `Afterhours.html` keep the full JS UI until the end of Phase A. After that, whether to keep
  the JS panels for the standalone build is an Unresolved Question.

### Testing and validation

- `npm test` stays green after every wave. New tests:
  - `tests/test-host.cjs`: host.mjs script order, mount into a given element, event throttling, `open` requests.
  - `tests/test-scope-css.mjs`: no unscoped selector in the scoped output; keyframes and font-face hoisted
    (wave 0 proved it in the browser: no rule in `scoped.css` matches any Uno element).
- **C# tests:** a new `uno/Afterhours.Uno.Tests` (xUnit, `net10.0`) for record parsing (`BridgeJsonContext`
  against a captured `game.state`), model filtering (rooms, shop) and the studio undo stack. Phase B adds
  the vector runner here.
- **Runtime:** Playwright (Chromium, `/opt/pw-browsers`) against `npm run start:uno` at 1440, 1000, 800 and
  390 px, one script per wave. Each script covers every route in that wave: open, change, commit, reload,
  confirm persisted. Solo and shared both run, using the two-tab check from `PLAYTEST-SETUP.md`. Screenshots
  go to `docs/screenshots/`.
- `verify-uno.mjs` checks `game/host.mjs` and the scoped CSS in the publish output, and that no WebView
  remains in the publish output.

### Capability inventory

| Capability | Status | Choice |
|---|---|---|
| Menus, HUD, rail, room hopping, resident card | implemented | XAML (wave 1) |
| Room heading, action bar (wave, dance, stand, dock), now playing | implemented | XAML (wave 1) |
| Room-editor toolbar | implemented | XAML → `IRoomView` (wave 1) |
| Zoom/fit/follow, sound toggle, seat status, toasts | **omitted** (stay JS) | scene overlays drawn over the canvas |
| Chat column: room chat, shout/whisper modes, history | implemented | XAML ← `IRoomView.Chat` (wave 1) |
| Speech bubbles, arrival cues, room intro card | **omitted** (stay JS) | drawn on the canvas |
| The 35 panels in waves 2–6 of the inventory | implemented | XAML routes |
| Account panels with Turnstile + Google | **substituted** | XAML dialogs; Turnstile in `CaptchaHost` island; Supabase JS unchanged (wave 7, R9) |
| Wardrobe preview tinting | **substituted** | rendered by `avatar-renderer.js` |
| Synth, playhead timing, WAV export | **substituted** | JS behind `IMusic` |
| Arcade rounds (Tile Rush, Snow Jam, Pop Quiz) | **substituted** | JS in `ArcadeHost` island; picker and results in XAML |
| Room renderer, movement, seating, furniture placement | **omitted** (stay JS) | `RoomHost` island |
| Solo play, browser saves, backups | implemented | unchanged; `IGameStore` |
| C# rules, C# shared client | **deferred** | Phase B |
| Desktop/Android heads, SkiaSharp renderer | **omitted** | web only |

---

## Design Brief

- **Direction:** keep today's look: midnight surfaces, one acid accent, a condensed display face. XAML
  should be indistinguishable from the current CSS at a glance. Refinements come later through
  `gold-standard-pass`.
- **Theme:** keep Fluent `XamlControlsResources` (the project's theme). Dark only, because the CSS
  declares `color-scheme: dark` with no light palette. Controls are tuned with Fluent lightweight keys
  (`Button*`, `ToggleButton*`, `TextControl*`, `FlyoutPresenter*`, `ContentDialog*`, `Pivot*`).

### Tokens (`Themes/Tokens.xaml`, merged in App.xaml; values from `dist/style.css :root`)

| Key | Value | Use |
|---|---|---|
| `SurfaceBaseBrush` | `#14141B` | page, room backdrop |
| `SurfacePanelBrush` | `#1C1C25` | rail, chat, flyouts |
| `SurfaceRaisedBrush` | `? pending`, from `.directory-room` / `.furniture-card` CSS in wave 1 | cards, chips, step cells |
| `LineBrush` | `#FFFFFF0C` | dividers, strokes |
| `InkBrush` | `#F3F1E9` | primary text |
| `MutedBrush` | `#92929F` | secondary text (6.3:1 on base) |
| `AcidBrush` | `#DFED8C` | accent fill, active state, focus |
| `OnAcidBrush` | `#14141B` | text on acid |
| `ChatColor0..7` | `G.chatColors` | name blocks in chat |

- **Type ramp** (`Themes/Type.xaml`): `DisplayText` Barlow Condensed SemiBold 34 · `TitleText` DM Sans Bold 18 ·
  `BodyText` DM Sans 13 · `LabelText` DM Sans Bold 13 · `EyebrowText` Space Grotesk Medium 10 caps,
  CharacterSpacing 150 (R6) · `NumeralText` DM Sans Bold, tabular. No literal `FontSize` in pages.
- **Fonts:** `Assets/Fonts/DMSans_Regular.ttf`, `DMSans_Bold.ttf`, `BarlowCondensed_SemiBold.ttf`,
  `SpaceGrotesk_Medium.ttf`: static, underscore names, OFL. The game's Google Fonts `@import` stays for the
  JS islands.
- **Spacing/radii:** 4-pt steps; radii 8 (chips, cells), 12 (cards), 16 (flyouts).
- **Scopes:** tokens, type and control keys in App.xaml. Templates live in their page's resources. Templates
  shared by several panels (`ItemCardTemplate`, `SongCardTemplate`, `RoomCardTemplate`, `PersonRowTemplate`)
  live in `Themes/Templates.xaml`.
- **Art in XAML:** furniture, room and avatar art come from `game/assets/*.webp` by URL. Furniture cards
  crop atlas cells using the crop tables `host.mjs` exports (`furnitureCrops`, `newCrops`, collector JSON),
  in a clipped container with a `TranslateTransform`. Avatars and portraits use PNGs that
  `IRoomView.RenderAvatar` returns.
- **Adaptive** (`utu:ResponsiveLayout` app-wide: Narrow 700 / Normal 960 / Wide 1200 / Widest 1600, matching the CSS):
  - Wide+: rail 220 · chat column 300 · flyouts 480 (lists), 760 (wardrobe), 1040 (studio, capped at 92%).
  - Normal: rail 72 icons · chat as `!Chat` flyout.
  - Narrow: rail and chat hidden · bottom `utu:TabBar` (Explore, My room, Studio, Chat, More) · flyouts full-screen.
  - Responsive values sit on elements, with fixed columns, per the house rule.
- **Overlay note:** on the native renderer, translucent XAML over the room blends normally. On the Skia
  renderer, native elements do not alpha-blend (Uno docs), so translucent overlays over the room would need
  to become opaque. This matters only if the renderer ever switches.

## Interaction Brief

### Core flows (route sequences)

1. **Boot:** BootPanel → `GameHost.Load` → `IRoomView.Mount(RoomHost.Id)` → `Ready` → BootPanel hides.
   Over 15 s or on a script error → Error state with Retry, which reloads the page.
2. **Shop:** TopBar "Furniture shop" → `!Catalog` (shop tab) → card → inline detail → Buy → `IGameStore.Buy` →
   `IGameStore.Place(id)` → drawer closes, the game selects the piece (editor bar appears).
3. **Studio:** Rail "Beat studio" → `!Studio` (Editor) → steps, tempo, pack → Play (playhead) → Save → Library →
   Perform → `-` → `!Stage`.
4. **Look:** Rail "My look" → `!Wardrobe` → parts, colours, pose → Save → `Dispatch(Outfit)` → `-`.
5. **Explore:** Rail "Explore" / room hopping "All rooms" → `!Rooms` → filter, search → card →
   `IRoomView.Enter` (solo) or `ISharedWorld.JoinRoom` (shared; doorbell → "Ringing…", flyout stays) → `-`.
6. **Room-initiated:** click jukebox / resident / player / portal / board → `IRoomView.Requests` → `MainModel`
   navigates `!Jukebox`, `!Resident`, and so on, with the data.
7. **Chat:** type in the chat box → Enter → `IRoomView.Say(text, mode)` → bubble drawn on canvas + line in the list.

### Input and focus

- Tab order: TopBar → Rail → RoomHost → ActionBar → Chat. Room keys (arrows/WASD, 1/2, R, Space-drag) work
  while `RoomHost` has focus.
- When a flyout closes or a room is entered, focus returns through `IRoomView.Focus()`. Clicking the room
  focuses it, as today.
- Studio board: arrows move between cells, Enter/Space toggles, Ctrl+Z undoes, P plays.
- Esc closes the top flyout or dialog (Navigation default).

### Async states (applies to every panel)

| Node | Value | Progress | None | Error |
|---|---|---|---|---|
| `MainModel.Hud` | top bar + rail | coins "—", skeleton rail | n/a: a ready game always has state | BootPanel Error + Retry |
| list panels (Shop, Inventory, Rooms, Songs, Friends, Chart, Board, Blueprints) | items | skeleton cards ×4 | panel-specific copy from today's JS (e.g. "No rooms match this search.") | inline banner + Retry |
| `SharedState` consumers | shared UI | "Connecting…" | solo view (shared sections hidden) | "Shared world unavailable" + Retry; solo keeps working |
| `Wardrobe.Preview` | image | last image dimmed 40% | n/a | last good image + "Preview unavailable" |
| any `Dispatch` | close / refresh | command disabled + verb label ("Buying…") | n/a | `InfoBar` with the game's own message (`e.message`) |

### Visual states and colour cues

Nav item Selected: acid bar **plus** bold label. Step cell On: acid fill **plus** centre dot; Current:
outline ring. Swatch Selected: ring **plus** check glyph. Owned item: "Owned" text **plus** dim price.
Toggle (mute, solo, favourite): acid **plus** glyph swap. No state rides on colour alone.

### Motion

- Panels: a right-hand sheet with no transition (`PanelFlyout`, since the Skia switch); nothing to reduce (R5).
- Preview and portrait swap: 120 ms fade (`Motion.Fast`, EaseOut). Reduced: instant.
- Playhead: snaps per step with no tween. Coin change: no animation (numerals are tabular, so the width holds).

### Accessibility

- `AutomationProperties.Name` on every icon-only control. Step cells read "Kick step 5, on", swatches read
  their colour name, room cards read "Side B, public room, 6 people".
- Chat list is a live region (`AutomationProperties.LiveSetting="Polite"`), matching today's `aria-live`.
- Text contrast ≥ 4.5:1 for Ink/Muted on Base/Panel; OnAcid on Acid ≥ 12:1. Fluent focus visuals kept.

### Runtime verification (per wave)

Playwright on WASM at four widths. Per route: open, act, verify the store change (coins, item counts, saved
track, outfit after reload), Esc returns focus to the room. Shared: two tabs, chat round trip, applause pays,
doorbell. Screenshots per route in `docs/screenshots/xaml/`.

## Spec Graph Brief

### Route tree

```
Shell (no Region.Attached)
└─ Main   ViewMap<MainPage, MainModel>  IsDefault        ← all routes below open with "!" from Main
   ├─ wave 2  Catalog F(CatalogRequest) · Blueprints F · WrapGift D(WrapGiftRequest)   ✓ shipped
   ├─ wave 3  Studio F ─ DeleteSong D(SongId) · Stage F · SetComplete D(SetResult) · Jukebox F(RoomId) · Chart F
   ├─ wave 4  Wardrobe F · Profile F ─ RestoreSave D(GameState) · Journal F · Help F
   ├─ wave 5  Rooms F(RoomFilter) ─ CreateRoom D · RoomTools F(RoomId) ─ RoomLogic F · RoomEvent D · Portal D(ItemId)
   │          MessageBoard F(RoomId) · RoomObject D(ItemId) · Companion F · Arcade F(ArcadeKind?)
   ├─ wave 6  Friends F ─ Trade F(TradeId?) · Resident D · Player D ─ Report D · Away D · SharedWorld F · ChatPrefs D · Chat F
   └─ wave 7  Join D · Restore D · SignOut D
Back: "-" closes one level. Rooms→CreateRoom success closes both. Studio→Perform: "-" then "!Stage".
```

### Page trees (MainPage; panel trees are written per wave, under 15 nodes each)

```
MainPage
├─ TopBar     ← Hud {Progress}   MenuFlyout ⇒ Navigate(!Profile, !Journal, !Help, !SharedWorld, !Join/!SignOut)
├─ Rail       ← Hud, PublicRooms   → !Rooms · !Studio · !Wardrobe · !Journal · !Arcade · Enter(RoomKey)
├─ RoomHeading ← IRoomView.Room    ⇒ Dispatch(Favorite)
├─ RoomHost   BrowserHtmlElement (xaml-lint: allow codebehind - native element mount)
├─ EditorBar  ← IRoomView.Editor  [visible while editing] ⇒ Rotate/Store/Undo/Finish · → !Inventory
├─ ActionBar  ⇒ Wave/Dance/Stand/StartEditing · → !Stage !Shop !Rooms(Mine) !Companion !RoomTools
├─ NowPlaying ← IMusic.Playback, Room   ⇒ Play/Stop · → !Studio
├─ ChatPanel  ← IRoomView.Chat {None: welcome copy}  ⇒ Say(text, mode) · → !ChatPrefs !Friends
├─ BottomBar  [Narrow]
└─ BootPanel  ← FeedView(Status) {Progress, Error→Retry}
```

### Data-flow graph

```
JS Game (game-core) ── state ──▶ JsGameStore.State ──▶ every panel's read feeds
online.js ─────────── shared ──▶ JsSharedWorld.State ─▶ Rooms, Friends, Stage, Chart, Trade, Away, Player
app.js renderer ── room/editor/chat/open ─▶ JsRoomView ─▶ MainPage, Rooms, room-initiated routes
music.js ──────────── playback ──▶ JsMusic.Playback ──▶ NowPlaying, Studio playhead
Writers:
  game state      ⇐ JS Game only (inputs: XAML Dispatch + canvas actions, serialized on the JS thread)
  shared state    ⇐ server only (via online.js)
  panel drafts    ⇐ their own model's commands (seed once on open)
  studio draft    ⇐ StudioModel while open; Store.SaveDraft persists it
Phase B swaps: JsGameStore → CoreGameStore, JsSharedWorld → HttpSharedWorld (same interfaces, XAML unchanged)
```

### Design graph

```
App.xaml @App (dark only → StaticResource)
├─ Surface{Base,Panel,Raised?}Brush ── MainPage, Rail, Chat, FlyoutPresenter/ContentDialog keys, card templates
├─ LineBrush ── dividers, card strokes
├─ InkBrush · MutedBrush ── Type.xaml styles
├─ AcidBrush  cue: + bold label | + dot | + check | + glyph swap
│  └─ NavItem.Selected · StepCell.On · Swatch.Selected · Primary button · focus
├─ OnAcidBrush ── Primary text, StepCell dot
├─ ChatColor0..7 ── ChatLineTemplate name block (+ name text, so colour is never the only cue)
├─ Motion.Fast 0:0:0.12 ExponentialEase EaseOut  reduced: instant
└─ Fonts: BarlowCondensed_SemiBold · DMSans_Regular · DMSans_Bold · SpaceGrotesk_Medium (ms-appx, R6)
Themes/Templates.xaml @App: ItemCard · SongCard · RoomCard · PersonRow · ChatLine
<Panel>Page.Resources @route: panel-only templates
```

### Spec gate

| Check | Result | Nodes | Resolution |
|---|---|---|---|
| Registration | PASS | 38 routes + Main | each has a ViewMap/DataViewMap with the data type in the inventory |
| Region host | PASS | all `!` routes | no named regions needed; in-page tabs are inline Visibility regions |
| Shell safety | PASS | Shell | no Region.Attached |
| Cross-page links | PASS | room-initiated routes | `OpenRequest` carries route + data |
| Back stack | PASS | Rooms→CreateRoom, Studio→Stage | stated in the route tree |
| Sources | PASS | MainPage nodes | all in the data-flow graph; per-panel trees checked per wave |
| Feed vs state | PASS | drafts | editable → IState; everything else IFeed |
| Single writer | PASS | game state, studio draft | JS Game serializes; studio precedence stated |
| FeedView states | PASS | table above | applies to every panel; per-panel None copy taken from today's JS |
| Failure paths | PASS | every Dispatch | InfoBar with the game's message |
| Data shape | PASS | GameState records | mirror `validate()`; parsing tested against a captured save |
| Tokens | **FAIL** | SurfaceRaisedBrush | `? pending` → Unresolved Questions |
| Theme-awareness | PASS | all | dark only |
| Scope | PASS | templates | shared in Templates.xaml, others page-scoped |
| Color cue | PASS | nav, steps, swatches, chat names | second cue named |
| Contrast | PASS | Acid/OnAcid, Muted | text-safe |
| Encodings | PASS | XP meter | width = (xp − lower)/(upper − lower), clamped 0..1, computed in `Hud` |
| Motion | PASS | fades, drawer | reduced fallback named (drawer depends on R5) |
| Type assets | **FAIL** | four fonts | not in repo yet; WASM `ms-appx` fonts unverified (R6) → Unresolved Questions |
| UnoFeatures | PASS | Hosting, MVUX, Navigation, Toolkit | listed |
| Targets | PASS | islands | WASM only by decision |
| Pending | PASS | SurfaceRaisedBrush | marked |
| Capabilities | PASS | substituted/omitted/deferred rows | repeated in Unresolved Questions |

---

## Wave 0 results (2026-10-23)

**Verdict: go for wave 1.** Same-page hosting works on Uno 6.7.135's native WebAssembly renderer. The WebView
fallback is not needed. Evidence: `docs/spikes/wave0/` (screenshots, `results.json`, the 212 KB max save),
produced by `scripts/spike-wave0.mjs` in Chromium with `--autoplay-policy=user-gesture-required` against a
trimmed Release publish.

| Check | Result | Measured |
|---|---|---|
| R1 hosting | PASS | 15 classic game scripts load into a `BrowserHtmlElement` beside Uno's `require.js`; ready in ~5 s cold; no page errors |
| R1 round trip | PASS | XAML button → `[JSImport] dispatch('checkin')` → JS game → state event → `[JSImport]` callback → XAML text: 240 → 275 ✦ |
| R2 overlay | PASS | plain XAML `Flyout` and a Navigation `!SpikePanel` page both draw over the live canvas, take clicks, light-dismiss, Esc closes; translucent acrylic blends over the canvas |
| R2 JS dialogs | PASS | unmigrated `<dialog>` panels still open and close from the hosted game |
| R3 CSS scope | PASS | no rule in `game/scoped.css` matches any element outside `.ah-root` |
| R4 keys | PASS | typing `wasd` and arrows into a XAML `TextBox` leaves the avatar still; after clicking the room, arrows walk |
| Audio | PASS | a click on a XAML button starts the game's `AudioContext` (`running`) under the real autoplay policy |
| R6 fonts | PASS | `ms-appx:///Assets/Fonts/DMSans_Regular.ttf#DM Sans` loads (Uno registers it under a generated family name); `CharacterSpacing="150"` renders as `letter-spacing: 2.7px` at 18 px |
| R7 size | measured | `_framework` brotli 5.53 MB → **6.49 MB (+0.96 MB, +17%)** with `Hosting; Toolkit; MVUX; Navigation`; cold Release build 159 s (baseline 187 s on a colder cache); Windows `--in-process` path not checked here |
| R7 warnings | **new** | 17 × IL2026 + 3 × IL2104 trim warnings, from Uno.Extensions Navigation/Toolkit and MVUX-generated view models (hot-reload patching, `dynamic`). The trimmed app runs every check correctly |
| R8 state volume | **FAIL as designed** | fresh save 2.2 KB parses in 2.5–3.9 ms; the max save (212 KB) takes **20–42 ms** per `JsonDocument.Parse` on the UI thread → push changed slices instead (Services section updated) |
| Art | fixed in spike | game art loaded by relative path 404'd in the Uno page; `window.AfterhoursBase` now prefixes every JS asset path (standalone packager still embeds all 18 images) |

**Workarounds found** (each marked in code; candidates for the uno-scaffolding runtime gotchas):

- `WORKAROUND(BrowserHtmlElement inherits pointer-events none on the native renderer)`: Uno 6.7.135 sets
  `pointer-events: none` on the hosting `ContentControl`/`ContentPresenter`, which the hosted `<div>`
  inherits, so the canvas never receives clicks. `InputPolicy = NativeOnly` does not change this on the
  native renderer. Fix: `SetCssStyle(("pointer-events", "auto"))` on the element (`Interop/RoomHost.cs`).
- Toolkit `ExtendedSplashScreen` requests a lowercase `appmanifest.js` on WebAssembly. The project ships
  `AppManifest.js`, so case-sensitive hosts (the Node server, Cloudflare) return 404. The Shell uses a plain
  `ContentControl`, and `MainPage` keeps its own loading panel.
- Build: publishing over an existing `release/uno` kept the previous `dotnet.*.js` in the new package's
  `uno-config.js`, so a rebuilt app silently served the old assembly. `build-uno.mjs` now empties the folder
  first (commit `eafc1f9`).

## Wave 1 results (2026-10-23)

**Done: XAML chrome around the JavaScript room.** 30/30 runtime checks (`scripts/verify-wave1.mjs`, now `scripts/verify-xaml.mjs`;
screenshots in `docs/screenshots/xaml/wave1/`) at 1440/1000/800/390 px, solo and two-player shared;
72 Node tests and 9 xUnit tests pass; the publish passes the warning gate.

What shipped: top bar (brand, shared-world status, shop, credits, portrait), rail (nav, room hopping with a
current-room bar, resident card with XP and daily gift, help), room heading, the room in a `BrowserHtmlElement`,
editor bar, action bar and dock, now playing, chat column / chat flyout with Say/Shout/Whisper, phone bottom
bar, and a boot `FeedView` with reload on error. The WebView, `AfterhoursInterop.js` and its test are gone.

Decisions made while building (they amend the briefs above):

- **Strangler bridge.** `host.mjs` reports what the game's own chrome shows (HUD via game-core's rules, room,
  editor, actions, now playing, chat, portrait) and runs XAML commands by clicking the game's own buttons
  through an allowlist (`commands`). No game logic is repeated in C#. Later waves delete each JS piece as its
  XAML replacement lands. An xUnit test checks every XAML `CommandParameter` against the allowlist.
- **Interfaces on demand.** Wave 1 needed `IGameStore` (HUD, portrait, slices) and `IRoomView` (status, chrome,
  chat, rooms, commands). `IMusic` arrives with the studio (wave 3) and `ISharedWorld` with rooms/social (waves 5–6).
- **Scene overlays stay in the room.** Zoom/fit/follow, the sound toggle, the room intro card, seat status and
  toasts are drawn over the canvas by the game and stay there (capability row updated).
- **Shared templates later.** No template is shared yet, so `Themes/Templates.xaml` waits for wave 2.
- **Fonts.** DM Sans Regular and Bold, Barlow Condensed ExtraBold (room titles, uppercase with an acid stop),
  Space Grotesk Bold (brand), matching the CSS weights.
- **Warning gate.** The approved "no warnings beyond the recorded set" is enforced by class, not count:
  `scripts/uno-warnings.mjs` allows IL2026 from MVUX-generated view models and Uno.Extensions APIs and IL2104
  from Uno assemblies (52 + 3 today; the count grows with each model). Any other warning fails `npm run build:uno`.
- **Chat command shape.** `Send(text, mode, whisperTarget)`: `text` is the command parameter (Enter passes
  `TextBox.Text`; the button passes it by `ElementName`), the other two resolve from MVUX states.

## Wave 2 results (2026-10-23)

**Done: shop, inventory, records, blueprints and gift wrap in XAML.** 40/40 runtime checks
(`scripts/verify-xaml.mjs`, screenshots in `docs/screenshots/xaml/wave2/`) at 1440/1000/800/390 px, solo and
two-player shared; 73 Node tests and 16 xUnit tests pass; the publish passes the warning gate.

What shipped: `!Catalog` with shop / inventory / records tabs, collections list (Normal and up), search,
category filter, balance line, a virtualized card grid with atlas art, and an inline detail with buy, place,
interact and play; `!Blueprints` (save, restore); `!WrapGift` (choose a piece, note, wrap). The game builds
none of these any more: `catalog()`, `blueprints()` and the gift action call `openPanel(route, data)`, which
reaches `MainModel` as an `open` event and becomes navigation.

Decisions made while building (they amend the briefs above):

- **Catalog absorbs Inventory and CollectionItem.** The game already showed them as tabs and an inline detail of
  one panel, so the routes are `Catalog(Tab)`, `Blueprints` and `WrapGift(ItemId)`.
- **Writes are named host functions.** `host.mjs` exports `buy`, `place`, `use`, `wrap`, `saveBlueprint`,
  `restoreBlueprint` and `playDisc`; each calls the game's own action and replies `{ok, error, result}`.
  Rule failures surface verbatim in an `InfoBar` (for example "You do not have enough credits.").
- **Read side:** `shop` is sent once with entries, collections, categories and atlas crops; the inventory is a
  projection of six save slices. `ShopRules` (filters, card text, gift options) is plain C# with xUnit tests
  against the shared fixture.
- **Panels open in a right drawer.** `PanelFlyout` (Toolkit `RightDrawerFlyoutPresenterStyle`,
  `DrawerLength=Auto`) replaces the centred `NavigationFlyout` through DI; each page sets its width
  (`{utu:Responsive}`). The Fluent flyout size caps are left at their defaults.
- **Grid:** `ItemsRepeater` + `UniformGridLayout` (`ItemsStretch=Fill`). `GridView` realized every card: 4.8 s
  to first cards against 2.4 s. First open: title 0.9 s, cards 2.4 s (atlas decode); reopen is instant.
- **Atlas art:** a `Canvas` with the atlas `Image` offset by the crop and clipped to it. MVUX wraps a record read
  through a state in a generated bindable proxy, so the clip binds to `ArtFrame.ClipRect`, a value type.
- **JS dialog first.** `openPanel` closes the game's `<dialog>` before asking for a XAML panel, because the
  browser top layer would cover the drawer (R2).
- **`Uno0001` is an error.** `ItemsStackPanel.ItemsUpdatingScrollMode` is not implemented on WASM and slipped
  past the gate's regex; the regex is fixed, `Uno0001` is in `WarningsAsErrors`, and chat scrolls in code-behind.

## Skia spike results (2026-10-29)

Approved 2026-10-29. Built the same commit with `SkiaRenderer` added to `UnoFeatures` (clean `bin`/`obj`) and
compared it with the native build in Chromium, 3 cold loads each on localhost. Screenshots in `docs/spikes/skia/`.

| Check | Native (today) | Skia |
|---|---|---|
| Screen readers | no `aria-*` output | **works**: Tab exposes "Enable accessibility"; then `#uno-semantics-root` carries 40+ elements with our `AutomationProperties.Name`, roles (button, listbox, progressbar, combobox, dialog) and text |
| Room hosting (`BrowserHtmlElement`) | works (pointer-events workaround) | works: pointermove/down/up reach the room canvas |
| Drawer over the room | scrim dims the room | room **blanks** under the translucent scrim (documented: native elements do not alpha-blend) |
| Symbols ✦ ✳ ✋ ☕ ☁ | browser fallback fonts | boxes; the default fallback fetches `NotoSansCJKsc-Regular.otf` (~16 MB) from GitHub |
| Framework download (brotli) | 6.41 MB | 10.76 MB (+4.35: `dotnet.native` 0.90 → 2.59 MB, app assembly 2.58 MB) |
| Room ready (cold, localhost) | 4.1–4.7 s | 5.6–5.7 s |
| JS heap at ready | 10 MB | 20–22 MB |
| Shop open (click → semantics) | 0.9 s (title) | 0.2 s |
| Atlas clip, fonts, layout | fine | fine |

Also found: list items are announced as record `ToString()` text (`RoomStop { Room = … }`), so list records need
an accessible name; the page behind an open drawer stays in the semantic tree.

**Verdict: go, with three fixes before switching.** (1) Ship a small OFL symbol font (Noto Sans Symbols 2 subset)
and set `FeatureConfiguration.Font.FallbackService` to a `CoverageTableFontFallbackService` that serves it from
the app package. (2) Make the drawer scrim transparent (or opaque) so the room never blanks. (3) Port
`verify-xaml.mjs` to find controls through the semantic DOM by role and name and click their bounds with the
real mouse (the semantic elements sit under the Skia canvas). The +4.35 MB and +1.3 s are the price; the app
assembly size on Skia is worth a look first.

## What else can move to C# or XAML (2026-10-29)

After wave 3, JavaScript still owns these. Sizes are of `dist/` today.

| Part | JS today | Move to | How | Payoff | Effort |
|---|---|---|---|---|---|
| Panels, waves 4–7 | 17 game panels (journal, profile, save recovery, wardrobe, help, navigator, create room, room tools, message board, room logic, events, arcade menu, companion, portal, chat preferences, your circle) and 10 shared-world panels (sessions, join, sign out, restore, report, shared navigator, away, friends, trading, player) | XAML | the wave pattern: host requests and replies | every panel themed, accessible and tested the same way | waves 4–7, planned |
| Game rules | `game-core.js` (20 KB: actions, rewards, quests, validation) | C# | Phase B: port with shared test vectors, swap `JsGameStore` for `CoreGameStore` | no rule echo through JS; xUnit owns the rules | medium |
| Furniture catalog | `furniture.js` (22 KB of data) | C# | a JSON resource read by the catalog and the rules | one source for shop, rules and renderer | small, with Phase B |
| Shared-world client | `online.js` (32 KB: polling, snapshot apply, chat, trades, stage) | C# | `ISharedWorld` over `HttpClient` against the same TypeScript service | removes the second JS state owner | medium–high |
| Accounts | `accounts.js` (227 KB, Supabase + Turnstile) | C# + one hosted widget | a Supabase C# client (new dependency) and Turnstile kept in a `BrowserHtmlElement` | −200 KB of JS, auth in DI | medium; R9 spike first |
| Room renderer | `app.js` (43 KB), `room-view.js`, `avatar-renderer.js`, `movement.js`, `seating.js` | C# on Skia | `SKCanvasElement` draws the isometric room inside the XAML tree; movement and seating are plain logic | no hosted element: the room stays visible under panels, one renderer, one input system, no CSS scoping | high (Phase C) |
| Arcade rounds | `arcade.js` (8.5 KB) | C# | after the renderer, on the same canvas | consistent input | small–medium |
| Synth and WAV | `music.js` (5.5 KB) | stays JS | Web Audio has no C# API; C# would only call JS | none | — |
| Server | `service/` (TypeScript) | ASP.NET Core | only past the five-player cap (decided) | — | — |

**Recommendation:** finish the panels (waves 4–7) first, then Phase B (rules and catalog in C#), then the shared
client. The room renderer on `SKCanvasElement` is the step that makes the client fully C#/XAML and removes the
"room hides behind panels" limit; it deserves its own spec (Phase C) once Phase B lands, because it carries the
most risk (render loop, sprites, hit testing, camera). Accounts depend on the R9 spike.

## Skia switch (2026-10-29)

**Done: the WASM head runs on the Skia renderer.** Approved 2026-10-29 ("switch to skia"). 56/56 runtime checks
on Skia (`docs/screenshots/xaml/skia/`), including screen-reader names for the chrome and the studio; 74 Node and
26 xUnit tests pass; the publish passes the warning gate. Framework download 10.87 MB brotli (native: 6.51 MB);
room ready about 5.7 s on localhost (native about 4.3 s); JS heap 11–14 MB.

Decisions made while switching:

- **Fonts.** `SymbolFonts` sets DM Sans as the default text font (`UnoDefaultFont=None` drops the Open Sans
  package, which loaded 38 files at boot) and a `CoverageTableFontFallbackService` with two bundled fonts:
  Afterhours Symbols (300 KB: Noto Sans Symbols 2, Noto Sans Symbols and the block's emoji, merged; U+2100–2BFF)
  and Noto Emoji (719 KB, U+1F000 and up, fetched only when an emoji is drawn). The default fallback fetched a
  16 MB CJK font from GitHub. `ContentControlThemeFontFamily` is DM Sans too (TextBox fell back to monospace).
  OFL licences for all six fonts are in `Assets/Fonts/licenses/` (the four wave 1 fonts had none in the repo).
- **Panels are a plain right sheet** (`PanelFlyout` with its own presenter template, scrim tap closes it). The
  Toolkit drawer slid in with a render transform, and Uno's accessibility mirror kept the mid-slide positions
  (off by up to 900 px), which would misplace a screen reader's focus.
- **The room hides behind an open panel.** A full-window popup covers the hosted element by layout, whatever
  its colour (a transparent scrim also blanked it), so the dark scrim stays and an open panel reads as modal.
  Keeping the room visible would need panels docked inside `MainPage` (a region instead of a flyout).
- **The runtime check reads the XAML tree** through `Interop/UiProbe.cs` (`[JSExport] Snapshot()`: visible
  elements with name or text, window bounds, enabled, value) and clicks real coordinates. Uno's accessibility
  mirror is checked separately: it names controls correctly, but its positions are unreliable in panels and it
  can lag a bound title, so it is a check, not the driver.
- **List items have accessible names** (`ToString()` on the records lists show).

## Wave 6 (2026-10-29): your circle, residents, the shared world, players, trades

**Done.** 82/82 runtime checks on Skia (`docs/screenshots/xaml/wave6/`), 78 Node and 43 xUnit tests.

### Architecture Brief (wave 6)

- **Services.** A new `ISocial` (`JsGame` implements it). `WatchSocial` is reference-counted like the stage: the
  first watcher starts a 300 ms host poll (`emitIfChanged('social', world.socialState())`), so every open social
  sheet follows the shared world as `online.js` applies the service's snapshots (players arriving, a friend
  request, the other side of a trade). One `Act(op, id, text)` carries every shared-world action to
  `online.js`'s `socialAct`, which sends it to the service with the same payloads the old buttons used and toasts
  the same thanks. Opening the next panel (rooms, stage, friends, a player, a trade, the join form, sign out) goes
  through the game too, after the sheet closes.
- **Solo.** Your circle, residents and chat preferences stay in the game's save (`residentState`, `residentAct`,
  `chatPrefsState`, `saveChatPrefs`, `unblock`); edits reply with the new state.
- **Whisper.** A panel's Whisper button raises `IRoomView.WhisperTo(target)` in .NET; `MainModel` follows it and
  sets the chat box to whisper that player or resident. No game DOM is involved.
- **Stays in the game until wave 7:** the join form, restore and sign-out panels. `panel()` opens `!SharedWorld`
  when the service is down or you are connected, and the join form otherwise.
- **Testing.** `SocialRules` (world mode, banner, finding a player, live invites, picks, trade text) in xUnit; Node
  checks that every action the models and the shared-world page send exists in `socialAct`.

### Design Brief (wave 6)

- Friends: circle cards with ♡ and "View ↗", then connected requests (Accept / Decline) and friends (Follow when
  online, Remove), "Shared sessions" at the foot. Resident and Player: name, line or motto, a wrap of actions with
  the first primary; Player's report replaces the actions in place.
- Shared world: the banner on the accent tint, the account box on a raised surface, three destinations, the
  room's players with a LIVE tag, doorbell rows, trade invites, then the way back to solo.
- Trade: both sides as raised cards (✓ when confirmed), your inventory as check boxes in a wrap grid, Update my
  offer and Confirm; a closed trade offers the inventory.

### Interaction Brief (wave 6)

- The chat column's Friends and gear, a click on a resident or a player, the top bar's SHARED WORLD label and the
  shared world's own buttons open the sheets. Actions that end the conversation (block, report, kick, ban, follow,
  whisper) close the sheet; the rest update it in place.
- A trade sheet follows the service: the inviter waits, the invitee accepts, both see the offer, and a cancel on
  either side shows "Trade closed" on both.
- Errors from the service (a full offer, a player who left) show in the sheet's `InfoBar`; the service's own toasts
  stay.

## Wave 5 (2026-10-29): rooms, room tools, companion, arcade

**Done.** 76/76 runtime checks on Skia (`docs/screenshots/xaml/wave5/`), 77 Node and 37 xUnit tests.

### Architecture Brief (wave 5)

- **Services.** A new `IRooms` (navigator, current room, room tools edits, portals, room objects; `JsGame`
  implements it). `IResident` gains the companion and the arcade picker. Room edits reply with the room as it now
  stands (`HostReply<RoomState>`), so a sheet never waits on an event; the companion replies the same way.
- **Game side.** `game.js` keeps every rule: `roomsState`, `roomState`, `addRule` (ten at most, validated),
  `hostEvent`, `petState` / `petAction`, `objectState` / `objectAction` and `linkPortal`. A clicked piece stores
  its action list in the game (`objectPanel`); the sheet shows the labels and runs one by index, so actions that
  walk you over first (`approach`) stay in the game. Connected, `online.js` answers the navigator
  (`roomsState`, `joinRoomKey`; a doorbell counts as done).
- **Routes.** `Rooms` (data `RoomsRequest`), `RoomTools`, `RoomLogic`, `RoomEvent`, `MessageBoard`, `Portal` and
  `RoomObject` (data `ItemRequest`), `Companion`, `Arcade`. Room tools' buttons close the sheet and ask the game
  for the next panel (`roomPanel(name)`), so sheets replace each other.
- **Host names.** The navigator exports are `roomList` and `currentRoom`: a module export named `rooms` hid the
  page's global `rooms` (the public hangouts) that `mount` reads, and the world failed to open.
- **MVUX.** A record member named `Event` breaks the generated bindable proxy (CS0065 in
  `RoomState.Bindings.g.cs`); the room's event is `Hosting` with `[JsonPropertyName("event")]`.
- **Testing.** `RoomRules` (tabs, search, recent order, door badges, rule text, object actions, companion
  needs) in xUnit; Node checks that every `[JSImport]` name is a `host.mjs` export and that every room-tools panel
  exists in `roomPanels`.

### Design Brief (wave 5)

- Navigator: four quiet tabs with the acid underline (solo only), a search box, room cards as full-width soft
  buttons with the game's right-hand badge (YOURS, PUBLIC, Enter, Ring), "+ Create a room" pinned below the
  list; the create form replaces the list in place.
- Room tools: the settings form (name, description, tags, lighting and door side by side), then the other tools as
  a wrap of soft buttons. In a public hangout it offers "Go to my room" instead.
- Room logic: When… / Then… side by side, phrase and message fields, rules as raised rows with a × button.
  Message board: notes as accent-tinted cards in a wrap grid. Event: name and "Starts in", End when one is set.
- Room object: the piece's atlas art (the shop's `ArtFrame`), its note or description, the first action primary.
  Companion: the game's portrait, needs as labelled bars, care buttons, tricks. Arcade: three cards with icon, best
  score and a Play button.

### Interaction Brief (wave 5)

- Rail "Explore rooms", the travel bar and "My rooms" open `!Rooms`; the shared session's rooms button opens it
  connected. Choosing a room enters it and closes the sheet; a doorbell shows the game's toast.
- "Room tools" opens `!RoomTools`; Save closes the sheet. Blueprints, Room logic, Message board, Playlist and Host
  an event close it and open their own sheet.
- Clicking a piece opens `!RoomObject`; an action closes the sheet (most walk you over first); "Link to a room"
  and "Wrap a piece" open `!Portal` and `!WrapGift`. Tricks and arcade rounds close the sheet because they play out
  in the room.
- Errors from the game (an empty note, the rule limit, not enough credits, a tired companion) show in the sheet's
  `InfoBar`.
- **Keys and focus (R4, found in this wave).** On Skia the browser's focus stays on the page body after a XAML
  click, so room shortcuts (1 wave, 2 dance, Space, R) fired while a XAML button had focus; the old check passed by
  a race. `MainPage` now reports XAML focus (`FocusManager.GotFocus`) and `app.js` leaves body-targeted keys alone
  while a XAML control holds it. The check now also proves the key still works after a click on the room.
- **Closing a sheet once.** A second click on a sheet button while the sheet closed ran `NavigateBackAsync` again:
  it closed the sheet that had just opened, and further backs walked the browser history out of the app (the
  runtime check saw the page reload). Every model now closes through `Sheets.CloseSheetAsync`, which navigates
  back once per model and tells the caller whether to run its follow-up. Open: a double-click about 150 ms apart
  on a room-tools button can still leave room tools showing instead of the next sheet (harmless; Escape closes it).

## Wave 4 (2026-10-29): journal, profile, wardrobe, help

**Done.** 65/65 runtime checks on Skia (`docs/screenshots/xaml/wave4/`), 75 Node and 30 xUnit tests.

- **Architecture.** A new `IResident` (journal, profile, saves, outfit; `JsGame` implements it). The host computes
  the journal with the game's own rules (`G.progress`, quests, achievements, ledger) and replies with it after a
  claim; profile saves run the game's `profile` action; restoring a save is inspected first (`inspectSave`,
  `inspectBackup`) and confirmed inline (`confirmRestore`), as the game did. The wardrobe keeps the outfit as local
  state and asks the game's avatar renderer for each preview (a PNG data URL); the classic sprite picker stays a
  game panel. Help is static XAML. Pure display rules live in `ResidentRules` (xUnit).
- **Design.** Journal: three tabs, quest rows with the game's marks (✓ collected, ✦ ready, ○ in progress), a
  progress bar and the reward button; badge cards fade until unlocked; the wallet total on the accent tint and
  the ledger with earned amounts in acid. Profile: portrait, name and motto, chat-colour swatches with a ring on
  the chosen one and a live name preview, keepsake chips, export / restore / backup. Wardrobe: preview with three
  poses beside the options (stacked on phones), named parts as chips, colours as round swatches.
- **Interaction.** Rail "Journal", the daily gift and stage rewards open `!Journal`; the top-bar portrait opens
  `!Profile`; rail "My look" and "Change outfit" open `!Wardrobe`; "New around here?" opens `!Help`. Errors from the
  game (a bad save file, no backup) show in the panel's `InfoBar`.
- **Restoring a save** uses Uno's upload picker (`WasmPickerConfiguration.DownloadUpload`): a plain file input
  in every browser, which the runtime check drives (R10 resolved).
- **The runtime check clicks like a person** (move, then press and release with a short hold): Uno's Skia input
  dropped some instant clicks under load, which made different checks fail on each run.

## Wave 3 results (2026-10-29)

**Done: studio, song library, jukebox, solo and shared stage, weekly chart in XAML.** 54/54 runtime checks
(`scripts/verify-xaml.mjs`, screenshots in `docs/screenshots/xaml/wave3/`) at 1440/1000/800/390 px, solo and
two-player shared; 74 Node tests and 26 xUnit tests pass; the publish passes the warning gate. Built on the
native renderer.

What shipped: `!Studio` (track name, sound pack, the 4-lane board with ruler, mute/solo/volume, tempo, length,
undo, clear, play with a moving playhead, save, new, WAV export) and its Song library tab (play, edit, perform,
press disc, delete with an inline confirm); `!Jukebox` for the current room; `!Stage` for the solo open mic
(queue, countdown, set, inline reward, leave) and the shared stage (listen together, applause, queue); `!Chart`.
The game builds none of these panels any more.

Decisions made while building (they amend the wave 3 plan):

- **Set complete and delete confirm are inline**, as in the game's single panels: a navigation message dialog
  closed the Studio drawer with it, and an extra route would stack drawers.
- **Stage state is pulled while watched.** `JsGame.WatchStage` counts watchers; the first starts the host's
  250 ms poll (sent only on change) and tells the game the panel is open, so a finished set opens `!Stage` only
  when it is closed. `IStage` (`WatchStage`, `Act`) covers solo and shared.
- **The chart replaces the stage** (and Back reopens it) instead of stacking a second drawer.
- **The board is not virtualized:** an `ItemsRepeater` realized only its first row inside the phone's
  horizontal scroller. Steps are buttons in `VariableSizedWrapGrid`s sized to exactly Length cells; the board
  has a fixed height (ruler plus four 32 px lanes). On phones the volume sliders hide and the lane column narrows.
- **Lanes are keyed by index** so a volume reply updates a lane in place and never interrupts a drag.
- **Sliders take the acid accent** (Fluent lightweight keys in `Controls.xaml`).

## Wave 3 plan (2026-10-29): studio, library, jukebox, stage, chart

Built on the native renderer (the renderer switch is pending; the XAML and models carry over unchanged).
Split into **3a** (Studio with the song library, the delete confirm, the room jukebox) and **3b** (solo and
shared stage, set complete, weekly chart), each committed and verified on its own.

### Architecture Brief (wave 3)

- **Routes:** `Studio(StudioRequest Tab)` F; `Jukebox` F (the current room); `Stage` F (solo or shared, one
  page over two sources); `SetComplete(SetResult)` F; `Chart` F. The delete confirm is inline in the library (as in the game), so `DeleteSong` needs no route.
  *Built:* a navigation message dialog (`ShowMessageDialogAsync`) closed the whole Studio drawer with it.
- **Draft edits reply with the draft.** `host.mjs` exports `studio(op, a, b)` for `step`, `mute`, `solo`,
  `volume`, `tempo`, `length`, `pack`, `title`, `undo`, `clear`, `new`, `edit`, `save`; each runs the game's
  own edit and replies `{ok, error, result: {draft, canUndo}}`. `StudioModel` holds the draft as a local
  `IState` and replaces it from each reply. Replies are synchronous and ordered, so a dragged slider or typed
  title is never overwritten by an older echo (the `draft` slice still flows for everything else).
- **`IMusic`** (new, `JsGame` implements it): `IFeed<Playback>` (running, title, step) from `playback` events
  sent on start, stop and each step; `Play(songId | draft)`, `Stop()`, `ExportWav()` (render and download stay
  in JS). The playhead moves one overlay element, so step cells never rebind per tick (≤ 11 steps/s at 160 BPM).
- **Library writes:** `playSong`, `pressDisc`, `deleteSong`, `perform` (queues for the stage, then the game
  asks for `!Stage`). **Jukebox:** `savePlaylist(ids)`, `playPlaylist(ids)`.
- **Stage (3b):** solo stage state lives in `game.js` (`stage`, countdown timer) and shared stage in
  `online.js`; both push one `stage` event shape (mode, current, queue, own, canApplaud, listening, songs) and
  expose `queue`, `leave`, `applaud`, `listen`. `SetComplete` arrives as an `open` request with its result.
  `Chart` reads the `chart` part of the shared snapshot.
- **Grid model:** a ruler list and one flat list of `StepCell(Key "row:col", Row, Col, On, BarStart)`, each in an
  `ItemsControl` whose `VariableSizedWrapGrid` (32 px items) is exactly Length cells wide; each step is a button.
  *Built:* an `ItemsRepeater` realized only the first row inside the phone's horizontal scroller, and the board
  is at most 128 steps, so it is not virtualized.
- **Tests:** xUnit for the grid projection, lane state (mute/solo) and the event parsing; Node tests for the
  host operations (each op changes the draft the way the old buttons did); runtime checks per route.

### Design Brief (wave 3)

- Studio drawer: `Width` Narrowest 360 / Narrow 640 / Normal 900. Header: eyebrow "THE AFTERHOURS STUDIO",
  title "Find your sound" / "Your discography", tabs Studio / Song library (acid underline, as in Catalog).
- Editor: track name and sound pack row; the board scrolls horizontally inside the drawer. Lane column (label,
  M, S, volume) at 168 px; step cells 28 × 28 with 4 px gaps, `SurfaceRaised` off, `Acid` on, a brighter left
  edge on bar starts; beat ruler above; the playhead is a 2 px acid bar plus a 12 % acid wash on its column.
- Controls row: tempo slider with numeral readout (`NumeralText`), length combo, Undo, Clear. Transport: Play /
  Pause (primary), Save track (primary), New track, Export WAV (soft).
- Library: record cards (sleeve tile with the pack colour, title, "88 BPM · velvet · 16 steps", actions Play,
  Edit, Perform, Press disc · 10 ✦, Delete as a quiet text button). Empty state copy from the game.
- Jukebox: checklist of songs ("title" + "88 BPM · velvet"), Save playlist (primary), Play playlist (soft).
- Stage: now-playing block (disc glyph, eyebrow ON STAGE / UP NEXT / YOU'RE NEXT, title, countdown, progress),
  lineup, song picker; shared adds Listen together and ♡ Applaud. Chart: ranked rows, own row tinted.

### Interaction Brief (wave 3)

- Rail "Beat studio", the now-playing "Make a beat", `game.studio()` and the shared stage's "Make your first
  track" all open `!Studio`. Room tools "Playlist" and jukebox/speaker item actions open `!Jukebox`. The dock
  "Stage", stage furniture and Perform open `!Stage`.
- Step click toggles at once (the reply re-renders one cell); Undo enables after the first edit. M toggles a
  lane mute, S solos (again un-solos). Tempo and volume apply while dragging. The track name commits on Enter
  and on Save. Length change resizes the pattern (the game's rule).
- Play/Pause mirrors `IMusic.Playback`; the now-playing bar follows too. Save with an empty pattern shows the
  game's error ("Add a few notes before saving.") in an `InfoBar`; success switches to the library tab.
- Delete asks "Delete this track?" (Delete track / Keep it). Press disc failures ("You already pressed this
  version.", credits) show in the `InfoBar`.
- Empty states: library and jukebox use the game's copy; stage with no songs offers "Make my first track".
- Keyboard: Tab order lanes → cells → controls; Space/Enter toggle a focused cell; room keys stay ignored while
  focus is in XAML (wave 1 guard).
- Runtime checks (3a): open studio from the rail, toggle steps and see the draft change, undo, tempo, play shows
  the playhead moving and audio running, save → library lists it, press disc pays 10, delete confirm removes
  it, jukebox saves a playlist; phone width fits; no page errors.

### Wave 3 unresolved questions

- Stage audience reactions and countdown stay timed in JS (they drive chat lines and rewards). OK?
- The WAV export stays a JS download; a XAML save picker can come with Phase B. OK?

## Implementation Plan

**Wave 0: prototype and spikes. Done 2026-10-23, verdict go** (see Wave 0 results). The spike code
(`MainPage` spike bar, `SpikePanel` route) is replaced in wave 1; `host.mjs`, `scope-css.mjs`, `RoomHost`,
`GameHost` and the asset base carry forward.

**Wave 1: foundation.** UnoFeatures, hosting, navigation, `GameHost` + `host.mjs`, the four `Js*`
implementations, tokens, fonts, templates, and the full MainPage (top bar, rail, heading, action bar, editor
bar, now playing, chat). Delete the WebView, `AfterhoursInterop.js` and `test-uno-bridge.cjs`. Add
`Afterhours.Uno.Tests`.

**Waves 2–7:** one wave per row group in the panel inventory. Each wave: XAML routes + models, delete the
replaced JS panel code, forward its JS entry points to `open` requests, then tests + Playwright + commit.

**Wave 8: docs.** README Uno section, RELEASE-NOTES, PLAYTEST-SETUP (re-run the five-player acceptance on the
XAML build), screenshots. Then write the Phase B spec.

Each wave is one or more conventional commits on its own branch, merged only with CI green.

## Quality Gates

| Phase | Gate (skill) | Done when |
|---|---|---|
| every wave | Build + tests | `npm test` green; `npm run build:uno` with no warnings beyond the 20 recorded Extensions/MVUX trim warnings; xUnit green; CI green |
| waves 1–7 | `uno-verify` (Playwright on WASM; App MCP n/a for this head) | every touched route exercised at 4 widths, solo and shared |
| waves 2–7 | `uno-component-states` | Progress/None/Error per the table; Retry proven by failing the store |
| waves 1–7 | `uno-build-log` | entry per wave in `docs/fleet/BUILD-LOG.md` |
| end of each wave | `uno-completeness-audit` scoped to that wave's routes | gaps listed with evidence |
| wave 8 | `uno-break-it`, then `gold-standard-pass`, then `uno-audit` | findings fixed or listed here |
| any "ready to demo" claim | full `uno-completeness-audit` → `docs/COMPLETENESS.md` | report saved |
| wave 8 | playtest acceptance (`PLAYTEST-SETUP.md`) | five-player session passes on the XAML build |

## Risks

- **R1 Hosting:** resolved in wave 0 (pointer-events workaround).
- **R2 Overlay:** resolved in wave 0. Open item: a JS `<dialog>` uses the browser top layer, so while one is
  open it covers the XAML too. Acceptable while panels migrate.
- **R3 CSS scope:** resolved in wave 0. Wave 1 adds `tests/test-scope-css.mjs` to keep it that way.
- **R4 Keys and focus:** resolved for `TextBox` in wave 0, and for buttons and lists on Skia in wave 5 (the app
  reports XAML focus to the game; see Wave 5).
- **R5 Motion:** resolved by the Skia switch: panels open without a transition.
- **R6 Fonts/text:** resolved in wave 0 for DM Sans; repeat the check for the other three files in wave 1.
- **R7 Size/build:** measured (+0.96 MB brotli, build time flat). Open: 20 trim warnings from Uno.Extensions/MVUX
  (see Unresolved Questions) and the Windows `--in-process` path.
- **R8 State volume:** full-state push measured too slow at max save size. Wave 1 pushes changed slices and
  re-measures the max save; target under 8 ms per push on the UI thread.
- **R9 Accounts:** the Turnstile widget inside a XAML dialog's `BrowserHtmlElement`, and Supabase
  session/redirect flows driven from C#. Wave 7 is gated on a 15-min spike; if it fails, the account panels
  stay JS dialogs.
- **R11 Screen readers: resolved by the Skia switch** (2026-10-29). Open: Uno's mirror reports wrong positions
  for some panel elements and can miss a bound title; report upstream with a repro. Wave 2 spike: `AutomationProperties.Name`
  produces no `aria-label` in the native (DOM) renderer of Uno 6.7.135, and setting
  `AutomationConfiguration.IsAccessibilityEnabled` changes nothing (0 aria labels outside the room, logged by
  `verify-xaml.mjs`). The documented screen-reader support (semantic DOM overlay, "Enable accessibility") is
  for the Skia renderer, so this is a renderer choice, not configuration. The names stay set in XAML so a
  renderer switch picks them up. See Unresolved Questions.
- **R10 File import:** resolved in wave 4: `FileOpenPicker` with Uno's upload picker.

## Unresolved Questions

- ~~R11 renderer~~ **Switched to Skia 2026-10-29.** Open: dock panels in `MainPage` so the room stays visible?

- ~~Server path, new dependencies, trim warnings, standalone build~~ **Approved 2026-10-23:** staged server
  order; `Hosting; MVUX; Navigation; Toolkit` + four OFL fonts + xUnit project; gate on no warnings beyond
  the 20 recorded Extensions/MVUX trim warnings; retire the standalone `Afterhours.html` (the Uno app becomes
  the only client, solo play stays inside it). The packager and README mentions go in wave 8.
- **Substituted:** wardrobe preview tinting, synth/playhead/WAV export and arcade rounds stay JS behind
  interfaces. OK?
- **Omitted:** speech bubbles, arrival cues and the room intro card stay drawn on the canvas. OK?
- **Account panels** (wave 7) depend on R9; they stay JS dialogs if the spike fails. OK?
- **SurfaceRaisedBrush:** take it from the current card CSS in wave 1 (default)?
- **Phone layout:** bottom tab bar and full-screen flyouts below 700 px. Is the phone a playtest target?
- **Wave order:** catalog/inventory → studio/stage → wardrobe/profile/journal → rooms/room tools/companion/arcade →
  social → accounts. Change anything?
- **Spec location:** the root `SPEC.md` holds the shipped applause spec, so this one stays in `docs/specs/`. OK?
