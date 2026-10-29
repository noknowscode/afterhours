# Free, limited Afterhours playtest

Status (20 October 2026): ready for a small, supervised friends playtest at
https://afterhours-playtest.matthewtmattei.workers.dev/ . The compiled Uno app,
Cloudflare Workers/Durable Objects/D1 and Supabase Auth stay on Free plans.
No billing, upgrade, paid plan or trial was enabled.

The interface around the room is now the Uno app's XAML (29 October 2026). The
steps below are unchanged; the acceptance checks further down need a fresh run on
this build before the next session. Screen-reader users press Tab and choose
**Enable accessibility** once per visit.

## Joining with friends

1. Open the link on a desktop browser and choose **Join shared world**.
2. Choose **Play as a guest**, complete the security check, and meet in Side B.
3. Use the same browser and **Continue my character** when returning. Shared
   progress is saved on the server; solo progress is separate.
4. Google linking/recovery is invite-only while Google's app is in Testing.
   The owner is currently the only test user. Friends' emails were deferred at
   the owner's request. Add each friend's Google email to the test audience
   before they choose **Link Google account**. Keep browser data until linked.
5. Linked players can use **Sign out on this device**, then **Restore account
   with Google**. Unlinked guests cannot sign out through that control.

Verified live: protected guest signup, reward and furniture purchase/placement,
song saving, reload continuity, Google guest linking, and restoration after a
full app sign-out and reload. The sign-out cleared the remembered game identity
and session; the entry screen returned to **Play as a guest**. Google restoration
then loaded the original character. A private database comparison confirmed the
complete game and account mapping were unchanged: 245 credits, nine furniture
items, one room and one song. This used the same browser after sign-out; separate
physical devices/browser engines remain untested.

A private D1 export was restored into both an isolated local database and a
separate remote D1 database. Revision and complete world data matched exactly.
The live database was never overwritten. This is a game-data restore rehearsal;
it does not back up or restore Supabase identities.

The remote acceptance run used a disposable copy of the exact service with
100 synthetic characters and five simultaneous clients. Purchases, exclusive
seats, private whispers, friends, two-party trades, trade replay rejection and
performance rewards passed. A 60-second motion/state run completed 346 requests
with no failed responses or connection resets (387 requests including checks).
Median latency was 817 ms; p95 was 1,193 ms. Five-player and 100-character caps
rejected excess admissions; forcing the test daily counter to its cap returned
429 without changing the world, then the same character resumed after reset.
See [the redacted test report](validation/free-playtest-2026-10-20.json).

The first load run found save contention. A single SQLite-backed Durable Object
now coordinates the bounded world while D1 remains authoritative. Each save is
acknowledged only after D1 commits. The coordinator has no independent player
state to migrate or restore. The edge Worker CPU sample for the final version
was p50 0.87 ms / p90 1.35 ms / p99 2.10 ms with no CPU-limit errors; coordinator
metrics also showed no errors. Provider charts lag and these are short-run
samples, not a sustained capacity guarantee. A dropped local test connection
interrupted an earlier run; the final run completed without resets.

Fifty-one automated Node test cases pass. Cancellation, mismatched-account and
transient-failure paths have automated coverage; live cancellation and different
physical devices still need human acceptance. Test credentials and database
snapshots remain private and ignored by Git. Disposable cloud test resources
are removed after verification. Published v0.5.0 downloads predate this playtest.

## Scope and limits

- Five connected players, 100 total characters, and a 1.7 MB world snapshot.
- At most 12,000 API requests per UTC day. One active player uses roughly
  0.25 requests/second when alone and idle, roughly 0.67 when idle with peers,
  and up to four while moving, constrained by response time. Allow around
  10–20 minutes for a first group session; this is not all-day hosting.
- Exhaustion pauses play; it does not erase characters. Static solo play remains
  available while the shared service is paused.
- Guest progress belongs to a stable, signed account ID. Linking Google retains
  that ID. Returning from another device loads its existing saved character.
- Unlinked guests cannot recover after their browser credentials are lost.
  Local/legacy guest characters and managed playtest characters are separate.
  Existing Google characters are not merged with another guest.
- The single world document deliberately keeps purchases and trades atomic.
  It needs room-level storage and longer, geographically distributed load
  testing before a broad social launch.
- Free platform quotas, CPU limits, outages, and abuse can stop service before
  the application cap does. These limits are not a capacity guarantee.

## Accounts the owner needs to create

1. Create a **Cloudflare Free** account. Enable Workers, choose a workers.dev
   subdomain, and create a D1 database named `afterhours-playtest`.
   The app address will be `https://afterhours-playtest.YOUR-SUBDOMAIN.workers.dev`.
2. Create a **Supabase Free** project. Enable anonymous sign-ins and manual
   identity linking. Use an asymmetric JWT signing key (ES256 or RS256).
   Copy the project URL and its **publishable** key.
3. In Google Cloud, configure an OAuth web client for this playtest. Set its
   redirect URI to the callback shown in Supabase's Google-provider settings.
   Enable that provider in Supabase using the client ID and secret. Keep
   Google's consent screen in Testing and explicitly add the test players.
4. In Supabase URL Configuration, set the site URL to the app's HTTPS origin.
   Add the exact redirect URL
   `https://afterhours-playtest.YOUR-SUBDOMAIN.workers.dev/game/account-callback.html`.
   Do not add a wildcard. The sign-in leaves the Uno iframe, completes in the
   main browser page, then returns to the Uno app.
5. Create a Turnstile widget for that exact hostname. Enable CAPTCHA protection
   in Supabase Auth and put the Turnstile **secret** there. Use only its public
   site key in the app configuration.

Do not paste Google secrets, Supabase secret/service-role keys, or Turnstile
secrets into this repository or chat. They belong in the providers' dashboards.
The Worker only needs the public Supabase URL to verify signatures.

## Build and prepare

From the repository root, with Node 22+, Python 3, .NET 10 and wasm-tools:

```sh
npm ci
npm test
npm run build:service
npm run build:uno
node scripts/prepare-playtest.mjs --origin=https://afterhours-playtest.YOUR-SUBDOMAIN.workers.dev --supabase-url=https://YOUR-PROJECT.supabase.co --publishable-key=sb_publishable_YOUR-KEY --turnstile-site-key=YOUR-PUBLIC-SITE-KEY --database-id=YOUR-D1-UUID
```

The preparation script verifies the compiled Uno bundle, copies it into a fresh
`release/playtest-*` folder, checks Cloudflare's asset size limit, and writes
ignored `service/wrangler.json`. It performs no deployment or purchase.
Public configuration is injected into that copy; local solo defaults stay usable.

Authenticate and deploy with the Cloudflare CLI (version checked for this setup):

```sh
npx wrangler@4.151.3 login
npx wrangler@4.151.3 d1 migrations apply afterhours-playtest --remote --config service/wrangler.json
npx wrangler@4.151.3 deploy --config service/wrangler.json
```

The generated configuration includes a Free-compatible SQLite Durable Object
namespace for the world coordinator. Its entry point is `service/worker/cloudflare.mjs`;
do not deploy the uncoordinated adapter directly for this shared playtest.
The API and compiled Uno client share one origin. Keep Workers and Supabase on
their Free plans. Do not enable paid upgrades as part of these steps.

## Repeatable acceptance checks

1. Open the actual HTTPS app in two browsers. Join as guests, buy furniture,
   edit a room, save a song, and trade a piece. Refresh both browsers.
2. Link one guest to Google. Verify its name, wallet, furniture IDs, room layout,
   songs and friend list remain intact. Sign in on a fresh browser and compare.
3. Cancel Google sign-in, try an already-linked Google account, and test a
   temporary network outage. No path should silently create a replacement guest.
4. Verify real CAPTCHA rejection and expired-token rejection. Local tests use
   signed test keys and a mocked OAuth provider; they cannot certify the
   production provider configuration.
5. Exercise the five-player/full-world/daily-limit messages. Measure actual
   Worker CPU and D1 reads/writes during a supervised session.
6. Export D1 and restore the export into a **separate test database**. Verify the
   same account ID still owns its room, song and furniture. Never use a restore
   rehearsal to overwrite the live database.

## Bounded remote load check

Create a disposable D1 database named `afterhours-check`. Run
`node scripts/check-free-playtest.mjs prepare --database-id=TEST-DATABASE-UUID`.
This writes a test-only issuer, coordinator configuration, synthetic seed and
short-lived test credentials into ignored `.build-cache/playtest-check`.
Deploy `issuer-wrangler.json`, import `seed.sql` into **only that test database**,
and deploy `wrangler.json` from that directory using Wrangler. Then run
`node scripts/check-free-playtest.mjs run --seconds=60`.
The harness refuses the production hostname and caps itself at 2,200 requests.
A rerun needs the synthetic database reseeded. Never import that seed into the
public database. Remove the test Worker, its coordinator namespace, the public-
key issuer Worker and test database afterward. Preserve only redacted reports.

The final acceptance run used 1,161 D1 row writes for 387 requests (three per
request on average). The 12,000-request daily application cap therefore budgets
about 36,000 D1 writes for this path, below D1 Free's 100,000/day quota. Indexed
inserts, other workloads and operator activity consume additional allowance.
The cap is deliberately not raised. It resets at midnight UTC (8 p.m. Eastern
on this test date). Client background tabs stop polling; successful movement
responses replace unnecessary state polls. Platform quotas are shared with
other apps on the account and may stop play sooner.

## Saves, moderation and operating the test

Keep regular private exports outside this repository:

```sh
npx wrangler@4.151.3 d1 export afterhours-playtest --remote --output=PRIVATE-BACKUP-PATH.sql --config service/wrangler.json
```

The database contains private player progress, chats, whispers and reports.
Restrict access to the operator. D1 backups do not back up Supabase identities;
preserve the Supabase project and use its supported export/recovery procedures.
Changing or deleting the auth project breaks the link to saved characters.

Host a supervised, invited test. Reports are recorded, but a full moderation
console and escalation process are still open work. Before public promotion,
add those operations, a privacy/retention policy, room-level storage, reliable
backup/restore drills, abuse controls, and measured load capacity.

## Provider references

- [Supabase guest accounts and linking](https://supabase.com/docs/guides/auth/auth-anonymous)
- [Google OAuth setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase CAPTCHA configuration](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare Workers free limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Supabase free-project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)

- [Cloudflare D1 free quotas](https://developers.cloudflare.com/d1/platform/pricing/)
- [Durable Objects free quotas](https://developers.cloudflare.com/durable-objects/platform/pricing/)
