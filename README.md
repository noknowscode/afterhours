# Afterhours

A social music world inspired by the rituals of Habbo Hotel and Coke Music:
walk in, take a seat, meet someone, make a track, perform it, collect furniture,
and make a room your own.

**Playable development build — not historical feature parity or a finished public service.**
Original generated artwork and synthesized music; no original game assets are included.

The [limited free playtest](https://afterhours-playtest.matthewtmattei.workers.dev/)
runs the compiled Uno app with server saves, verified Google recovery after
sign-out, and a tested five-player limit. Friends can enter as guests now;
Google linking needs their email added to the private test audience first.
The daily allowance pauses shared play safely when exhausted. Start with a
supervised 10–20 minute group session. See [joining and test results](PLAYTEST-SETUP.md).

## Play locally

Install Node.js 22 or newer, then:

```sh
npm ci
npm start
```

Open **http://127.0.0.1:4176**. Solo progress stays in the browser.
Choose **Join shared world** for a separate persistent online character.
Open **http://localhost:4176** in a second browser tab to test another character.
The local service binds only to this computer. Shared progress is stored in
`local-data/world.json`; protect that file and keep backups.

The standalone `Afterhours.html` download supports solo play without a server.

## What you can play

- Four public rooms, smooth tile walking, directional avatars, chairs and sofas.
- Up to twelve personal rooms, search, favorites, history, lighting and doors.
- Fifteen furniture types; purchase, move, rotate, pick up, undo and blueprints.
- Usable lights, vending machine, dice, message board, portals and jukebox.
- Four-lane 16/32-step sequencer, three synthesized sound packs, mute/solo,
  volume, tempo, undo, named library, collectible discs and WAV export.
- Stage queue, performances, daily reward caps, quests, XP, badges and wallet.
- Adoptable tabby with needs, feeding, play, training, tricks and following.
- Tile Rush, Snow Jam and Pop Quiz against resident opponents.
- Real shared presence, local speech, shouts, private whispers, friend requests,
  room doorbells, owner controls, seat reservations, shared listening and
  two-party furniture trades.

Resident characters are NPCs. Real connected players are identified separately.
Shared progress is owned by the service; the client cannot import a solo wallet.
Room scripts, minigames, companion presentation and most object interactions
remain client-side. See [the detailed roadmap](REMAKE-ROADMAP.txt) for limits.

## Uno Platform WebAssembly

`uno/` is a real Uno Platform / WinUI application targeting .NET 10 Browser
WebAssembly with the Skia renderer. Its XAML (MVUX) draws the menus, HUD, room
heading, actions, chat, shop, studio and stage, and hosts the JavaScript room in the
same page through a `BrowserHtmlElement`. Screen readers work once a user presses Tab
and activates "Enable accessibility". The room renderer, synth and the remaining
panels are JavaScript; the migration plan is in
[docs/specs/xaml-outer-ui-SPEC.md](docs/specs/xaml-outer-ui-SPEC.md).

`node scripts/verify-xaml.mjs [url] [outDir]` drives a published build in Chromium at
four widths and with two shared-world players. It reads the XAML tree through the
app's `UiProbe` export and clicks real coordinates.

Install .NET 10 and the Uno prerequisites, then run:

```sh
npm run build:uno
```

The build copies the game into Uno's web assets and publishes the application
to `release/uno`. Serve that directory over HTTP; WebAssembly does not run from
a `file:` URL. `npm run start:uno` serves it with the local shared-world API.

The build fails on any warning outside the known Uno.Extensions/MVUX trim set, and
verifies the compiled runtime, the scoped game CSS and every bundled game file.
`dotnet test uno/Afterhours.Uno.Tests` runs the C# tests. To create a portable ZIP after publishing, run
`python scripts/package-wasm.py` (Python 3 required for packaging).
The ZIP includes `PLAY.txt` and a Node launcher; players do not need .NET.

On this Windows build host, MSBuild's separate task host cannot connect. The
build script offers `--in-process` to run the same packaged tasks inside
MSBuild. It preserves linking, trimming, resources and native compilation.
This compatibility option is pinned to the checked-in SDK/package versions.

## Shared service and deployment

`server.mjs` is the dependency-free local Node service. `session-core.mjs`
contains ownership, wallet, trade, seats, friendship and performance rules.
`service/` builds a portable Worker with a D1 migration and atomic revision
checks. This is a bounded playtest backend, capped at five connected players,
100 characters, 12,000 API requests per UTC day and a 1.7 MB world snapshot. It needs room-level storage and operational
moderation before a large public launch.

```sh
npm test
npm run build:service
```

The free playtest setup serves the compiled Uno app and API together on
Cloudflare Workers, with D1 saves and Supabase guest accounts. Guests can link
Google and restore the same character on another device. A failed connection
never silently replaces a remembered character.

Follow [PLAYTEST-SETUP.md](PLAYTEST-SETUP.md) for the free accounts, build,
configuration, deployment, backup rehearsal and supervised acceptance test.
Live guest signup, CAPTCHA rejection, saved purchases and room placement have
been checked. A D1 export restored exactly into an isolated local D1 database.
Google sign-in is enabled for named test users. Linking and the separate Restore
account flow both retained the same character and complete server-saved game
state in the current browser. Recovery from another browser/device is unverified.

[Download v0.5.0](https://github.com/mtmattei/afterhours/releases/tag/v0.5.0) for
the standalone HTML and compiled Uno ZIP. That published preview predates the
managed-account work now on main; its contents have not been silently replaced.

## Layout

| Folder/file | Purpose |
| --- | --- |
| `dist/` | Editable game client, original art and styles |
| `uno/` | Uno XAML/C# application and build configuration |
| `service/` | Worker adapter, schema and portable service build |
| `tests/` | Game, movement, seating, service and database checks |
| `scripts/` | Repeatable build and packaging tools |
| `ART-PROMPTS.txt` / `GAME-OBJECTS-PROMPT.txt` | Art provenance and prompts |

## Release gates still open

Full avatar customization, four-facing/stacked/wall furniture, beds and pools,
groups, direct messages, marketplace, collaborative building/music, complete
classic minigames, live account-recovery acceptance testing, moderation operations,
accessibility audit, load testing, security review and historical parity audit.
