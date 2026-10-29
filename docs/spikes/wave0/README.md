# Wave 0 spike evidence

Results and decisions live in `docs/specs/xaml-outer-ui-SPEC.md` under **Wave 0 results**.

| File | What it shows |
|---|---|
| `results.json` | Last run of `scripts/spike-wave0.mjs`: every check and its measurements |
| `01-hosted.png` | The game hosted in a `BrowserHtmlElement` under the XAML spike bar |
| `02-flyout-over-room.png` | A XAML flyout with acrylic over the live canvas |
| `03-js-dialog.png` | A JS `<dialog>` panel (not migrated yet) opening from the hosted game |
| `04-route-flyout.png` | A Navigation `!SpikePanel` route page over the canvas |
| `big-save.json` | The largest valid save (12 rooms, 1,000 items, 100 songs; 212 KB) used for the state-volume test |

Rerun (Linux or Windows, Node 22, .NET 10 with `wasm-tools`):

```sh
npm ci
npm run build:uno
PORT=4177 node scripts/start-uno.mjs   # in a second terminal
node scripts/spike-wave0.mjs http://127.0.0.1:4177/ docs/spikes/wave0
```

The script launches Chromium with `--autoplay-policy=user-gesture-required`, so the audio check uses the
same activation rule as a real browser.
