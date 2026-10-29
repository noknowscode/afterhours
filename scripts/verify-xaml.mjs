// Runtime check for the XAML app: drives the published Uno app in Chromium at four widths and with two
// shared-world players, covering every wave so far. Usage:
//   node scripts/verify-xaml.mjs [baseUrl] [outDir]
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const {chromium} = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://127.0.0.1:4177/';
const out = process.argv[3] || 'docs/screenshots/xaml';
await mkdir(out, {recursive: true});
const results = [];
const record = (key, pass, detail = {}) => { results.push({key, pass, ...detail}); console.log(pass ? 'PASS' : 'FAIL', key, JSON.stringify(detail)); };

// Software GL keeps the Skia renderer drawing in headless Chromium.
const browser = await chromium.launch({args: ['--autoplay-policy=user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});

async function open(width, height) {
  const context = await browser.newContext({viewport: {width, height}});
  const page = await context.newPage();
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    window.__contexts = [];
    window.AudioContext = class extends Native { constructor(...a) { super(...a); window.__contexts.push(this); } };
  });
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base)) failed.push(r.url() + ' ' + r.status()); });
  await page.goto(base);
  await page.waitForFunction(() => window.AfterhoursWorld && document.querySelector('.ah-root canvas#room'), null, {timeout: 120000});
  await page.waitForFunction(() => globalThis.getDotnetRuntime, null, {timeout: 30000});
  for (const start = Date.now(); Date.now() - start < 30000; await page.waitForTimeout(300))
    if (!(await visible(page, 'Opening your world…')) && await visible(page, 'Furniture shop')) break;
  await page.waitForTimeout(1500);
  return {context, page, errors, failed};
}

// Skia draws the XAML on one canvas, so there is no DOM to inspect. The app's UiProbe (Interop/UiProbe.cs) lists
// every visible XAML element with a name or text, its window bounds, enabled state and value; clicks go to those
// coordinates with the real mouse. Popups come last, so the last match is the topmost.
const snapshot = page => page.evaluate(async () => {
  const runtime = await globalThis.getDotnetRuntime(0);
  const exports = await runtime.getAssemblyExports('Afterhours.Uno.dll');
  return JSON.parse(exports.Afterhours.Uno.Interop.UiProbe.Snapshot());
});
const matches = pattern => typeof pattern === 'string' ? text => text === pattern : text => pattern.test(text);
const nodes = async (page, pattern) => (await snapshot(page)).filter(n => n.w > 0 && n.h > 0 && matches(pattern)(n.text));
const xamlText = async (page, pattern) => [...new Set((await nodes(page, pattern)).map(n => n.text))];
const visible = async (page, text) => (await nodes(page, text)).length > 0;
// Waits up to 5 s for an enabled element (panels load) and returns the topmost match.
const find = async (page, text, ms = 5000) => {
  for (const start = Date.now(); Date.now() - start < ms; await page.waitForTimeout(150)) {
    const found = (await nodes(page, text)).filter(n => n.enabled);
    if (found.length) return found.at(-1);
  }
  const shown = (await snapshot(page)).slice(-25).map(n => `${n.type}:${n.text}`).join(' | ');
  throw Error('No visible XAML element with text ' + JSON.stringify(String(text)) + '. Last shown: ' + shown);
};
// Like a person: move there, then press and release with a short hold (Uno's Skia input can drop an instant click).
const press = async (page, x, y) => {
  // Approach from a few pixels away so the element sees the pointer enter before the press.
  await page.mouse.move(x - 4, y - 4); await page.waitForTimeout(40);
  await page.mouse.move(x, y); await page.waitForTimeout(80);
  await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up();
};
const xamlClick = async (page, text) => { const n = await find(page, text); await press(page, n.x + n.w / 2, n.y + n.h / 2); };
// Real keystrokes into a TextBox found by its accessible name (Uno's TextBox ignores fill()).
const typeInto = async (page, name, text, {end = false} = {}) => {
  const n = (await nodes(page, name)).filter(n => n.type === 'TextBox').at(-1) ?? await find(page, name);
  await press(page, n.x + n.w - 12, n.y + n.h / 2);
  await page.waitForTimeout(300); // focus lands a frame later on Skia
  if (end) await page.keyboard.press('End');
  await page.keyboard.type(text, {delay: 15});
};
// Drags a slider's thumb (placed from its value) by dx pixels.
const dragSlider = async (page, name, min, max, dx) => {
  const n = (await nodes(page, name)).filter(n => n.type === 'Slider').at(-1);
  const x = n.x + 10 + (n.w - 20) * (Number(n.value) - min) / (max - min), y = n.y + n.h / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y);
  await page.mouse.up();
  await page.waitForTimeout(500);
};
// Waits up to `ms` for XAML text matching `pattern` (a string means an exact match).
const waitText = async (page, pattern, ms = 5000) => {
  for (const start = Date.now(); Date.now() - start < ms; await page.waitForTimeout(150))
    if ((await nodes(page, pattern)).length) return true;
  return false;
};
// Waits up to `ms` for XAML text to disappear (a sheet closing).
const waitGone = async (page, pattern, ms = 4000) => {
  for (const start = Date.now(); Date.now() - start < ms; await page.waitForTimeout(150))
    if (!(await nodes(page, pattern)).length) return true;
  return false;
};
// How many distinct colours (4 bits a channel) a region of the screen shows: art against a flat fill.
const colours = async (page, r) => {
  const png = await page.screenshot({clip: {x: r.x, y: r.y, width: r.w, height: r.h}});
  return page.evaluate(async b64 => {
    const image = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const canvas = new OffscreenCanvas(image.width, image.height), g = canvas.getContext('2d');
    g.drawImage(image, 0, 0);
    const d = g.getImageData(0, 0, image.width, image.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4));
    return seen.size;
  }, png.toString('base64'));
};
// Uno builds the screen-reader mirror (#uno-semantics-root) once accessibility is switched on.
const enableScreenReader = page => page.evaluate(() => document.getElementById('uno-enable-accessibility')?.click());
const unspokenNames = (page, names) => page.evaluate(names => {
  const all = new Set([...document.querySelectorAll('#uno-semantics-root [aria-label]')].map(e => e.getAttribute('aria-label')));
  return names.filter(n => !all.has(n));
}, names);
const waitSpoken = async (page, names, ms = 10000) => {
  let missing = names;
  for (const start = Date.now(); missing.length && Date.now() - start < ms; await page.waitForTimeout(300)) missing = await unspokenNames(page, names);
  return missing;
};
// Clicks a sheet's button that opens the next sheet; a click right after a sheet opens can be dropped, so once more.
const clickThrough = async (page, button, heading) => {
  await xamlClick(page, button);
  if (!(await waitText(page, heading, 2500)) && await visible(page, button)) await xamlClick(page, button);
  const open = await waitText(page, heading, 5000);
  await page.waitForTimeout(400);
  return open;
};
// Opens a sheet and lets its layout settle before anything types into it.
const openSheet = async (page, button, heading) => {
  await xamlClick(page, button);
  const open = await waitText(page, heading, 5000);
  await page.waitForTimeout(400);
  return open;
};
const closeGameDialog = page => page.evaluate(() => { const d = document.querySelector('.ah-root #modal'); if (d?.open) d.close(); });
const game = (page, fn) => page.evaluate(fn);

for (const [width, height, band] of [[1440, 900, 'wide'], [1000, 800, 'normal'], [800, 900, 'narrow'], [390, 844, 'phone']]) {
  const {context, page, errors, failed} = await open(width, height);
  const tag = `${band} ${width}px`;
  await page.screenshot({path: path.join(out, `${band}-${width}.png`)});

  const coins = await game(page, () => AfterhoursWorld.game.state.coins);
  record(`${tag}: boot panel gone, coins shown`, !(await visible(page, 'Opening your world…')) && await visible(page, String(coins)), {coins});

  const title = (await game(page, () => document.querySelector('.ah-root #roomTitle').textContent.replace(/\.$/, ''))).toUpperCase();
  record(`${tag}: room heading mirrors the game`, await visible(page, title), {title});

  const rail = await visible(page, 'Explore'), railIcons = await visible(page, '\uE774');
  // The chat column's header (the phone bar's chat button carries the same name).
  const chatColumn = (await nodes(page, 'Room chat')).some(n => n.type === 'TextBlock');
  const expected = {wide: {rail: true, chat: true}, normal: {rail: false, chat: false}, narrow: {rail: false, chat: false}, phone: {rail: false, chat: false}}[band];
  record(`${tag}: rail labels and chat column follow the breakpoints`, rail === expected.rail && chatColumn === expected.chat, {rail, railIcons, chatColumn});

  if (band === 'wide') {
    // Daily gift through the XAML resident card: the game pays 35 and opens its journal.
    // The game then opens its journal (a XAML sheet since wave 4).
    await xamlClick(page, 'Daily gift · 35 ✦');
    const journal = await waitText(page, 'Your night, your story', 6000);
    const after = await game(page, () => AfterhoursWorld.game.state.coins);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    record(`${tag}: daily gift pays, the HUD follows and the journal opens`, journal && after === coins + 35 && await waitText(page, String(after)) && await visible(page, 'Checked in ✓'), {after, journal});

    // Travel from the XAML room list.
    await xamlClick(page, 'Midnight Diner');
    let travelled = false;
    for (const start = Date.now(); !travelled && Date.now() - start < 6000; await page.waitForTimeout(200))
      travelled = await game(page, () => AfterhoursWorld.roomKey()) === 'public:1';
    record(`${tag}: room list travels`, travelled && await waitText(page, 'MIDNIGHT DINER'), {travelled});

    // Dance toggles and its label follows the game.
    await xamlClick(page, 'Dance');
    record(`${tag}: dance runs and relabels`, await waitText(page, 'Stop dancing', 3000));
    await xamlClick(page, 'Stop dancing');
    if (!(await waitText(page, 'Dance', 2500))) await xamlClick(page, 'Stop dancing');
    await waitText(page, 'Dance', 3000);

    // Room keys stay with the room: '1'/'2' typed while a XAML button has focus must not act (on Skia the browser's
    // focus stays on the body, so the app reports XAML focus to the game).
    const before = await game(page, () => document.querySelector('.ah-root #dance').textContent);
    await page.keyboard.press('2');
    await page.waitForTimeout(300);
    const danceAfter = await game(page, () => document.querySelector('.ah-root #dance').textContent);
    // Back in the room (a click on it), the same key dances.
    const room = await game(page, () => { const r = document.querySelector('.ah-root canvas#room').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height * 0.75}; });
    await press(page, room.x, room.y);
    await page.waitForTimeout(300);
    await page.keyboard.press('2');
    await page.waitForTimeout(300);
    const danceInRoom = await game(page, () => document.querySelector('.ah-root #dance').textContent);
    if (danceInRoom !== before) await page.keyboard.press('2');
    record(`${tag}: room shortcuts ignore XAML focus and work in the room`, danceAfter === before && danceInRoom !== before, {before, danceAfter, danceInRoom});

    // Chat from the XAML composer reaches the game's chat and comes back as a line.
    await typeInto(page, 'Room message', 'hello from xaml');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const inGame = await game(page, () => [...document.querySelectorAll('.ah-root #messages .message p')].some(p => p.textContent === 'hello from xaml'));
    record(`${tag}: chat sends through the game and lists the line`, inGame && await waitText(page, /hello from xaml/), {inGame});

    // My room, decorate, editor bar, done.
    await xamlClick(page, 'My room');
    await page.waitForTimeout(900);
    await xamlClick(page, 'Decorate');
    await page.waitForTimeout(600);
    const editing = await visible(page, 'Done');
    await page.screenshot({path: path.join(out, `${band}-editor.png`)});
    await xamlClick(page, 'Done');
    await page.waitForTimeout(700);
    const closed = await game(page, () => document.querySelector('.ah-root #roomEditor').hidden);
    await page.screenshot({path: path.join(out, `${band}-after-done.png`)});
    record(`${tag}: decorate shows the XAML editor bar and Done closes it`, editing && closed && !(await visible(page, 'Done')), {editing, closed});

    // Music from the XAML now-playing bar starts the game's audio.
    await xamlClick(page, '▶');
    await page.waitForTimeout(1200);
    const audio = await game(page, () => window.__contexts.map(c => c.state));
    record(`${tag}: play starts audio and shows pause`, audio.includes('running') && await visible(page, 'Ⅱ'), {audio});
    await xamlClick(page, 'Ⅱ');

    // A game panel opened from XAML (joining the shared world stays a game panel until wave 7).
    await xamlClick(page, 'JOIN SHARED WORLD');
    await page.waitForTimeout(500);
    record(`${tag}: dock opens a game panel`, await game(page, () => document.querySelector('.ah-root #modal').open));
    await page.screenshot({path: path.join(out, `${band}-game-panel.png`)});
    await closeGameDialog(page);

    const profile = await find(page, 'Your profile');
    const portrait = await colours(page, {x: profile.x, y: profile.y, w: 40, h: profile.h});
    record(`${tag}: portrait renders`, portrait > 20, {portrait});

    // Screen readers (R11): with accessibility on, Uno mirrors the XAML as labelled DOM elements.
    await enableScreenReader(page);
    const unspoken = await waitSpoken(page, ['Furniture shop', 'Explore rooms', 'Room message', 'How to play', 'Public rooms']);
    record(`${tag}: screen readers get the chrome's names`, !unspoken.length, {unspoken});

    // Wave 2: the furniture shop.
    const coinsBefore = await game(page, () => AfterhoursWorld.game.state.coins);
    await xamlClick(page, 'Furniture shop');
    const shopOpen = await waitText(page, 'Room for imagination');
    await waitText(page, /^\d+ ✦( · \d+ seats?)?$/, 8000);
    await page.waitForTimeout(500);
    await page.waitForTimeout(1500);
    const cardsShown = (await nodes(page, /^\d+ ✦( · \d+ seats?)?$/)).length;
    const firstCard = (await nodes(page, 'Mint daybed sofa')).at(-1);
    const art = firstCard ? await colours(page, {x: firstCard.x, y: firstCard.y + 8, w: firstCard.w, h: 118}) : 0;
    await page.screenshot({path: path.join(out, `${band}-shop.png`)});
    // The grid virtualizes, so only the cards in view exist.
    record(`${tag}: shop opens with cards and furniture art`, shopOpen && cardsShown >= 9 && art > 40, {cardsShown, art});

    await typeInto(page, 'Search furniture', 'velvet');
    await page.waitForTimeout(800);
    const filtered = (await nodes(page, /^\d+ ✦( · \d+ seats?)?$/)).length;
    record(`${tag}: search filters the cards`, filtered > 0 && filtered < 9 && await waitText(page, 'Blue velvet sofa'), {filtered});

    await xamlClick(page, 'Blue velvet sofa');
    await page.waitForTimeout(600);
    const detail = await visible(page, 'Buy for 80 ✦');
    await page.screenshot({path: path.join(out, `${band}-shop-detail.png`)});
    // The preview clips the atlas to its sprite: beside the 320 × 250 preview (above the title) the panel stays flat.
    const detailTitle = (await nodes(page, 'Blue velvet sofa')).filter(n => n.type === 'TextBlock').at(-1);
    const beside = await colours(page, {x: detailTitle.x + 340, y: detailTitle.y - 262, w: 200, h: 240});
    record(`${tag}: shop art is clipped to its sprite in the detail`, beside <= 4, {beside});
    await xamlClick(page, 'Buy for 80 ✦');
    await page.waitForTimeout(1500);
    const coinsAfter = await game(page, () => AfterhoursWorld.game.state.coins);
    const placing = await visible(page, 'Done') && !(await visible(page, 'Room for imagination'));
    record(`${tag}: buying from XAML pays, closes the shop and starts placing`, detail && coinsAfter === coinsBefore - 80 && placing, {coinsBefore, coinsAfter, placing});
    await xamlClick(page, 'Done');
    await page.waitForTimeout(500);

    await xamlClick(page, 'Catalog');
    await page.waitForTimeout(1200);
    await xamlClick(page, 'My inventory');
    await page.waitForTimeout(800);
    record(`${tag}: inventory lists the new piece`, await waitText(page, 'Blue velvet sofa'));
    await xamlClick(page, 'Records');
    await page.waitForTimeout(500);
    record(`${tag}: records tab shows its empty state`, await waitText(page, /^Your record shelf is empty/));

    // A game error shown inline: not enough credits.
    await game(page, () => { AfterhoursWorld.game.state.coins = 5; AfterhoursWorld.sync(); });
    await xamlClick(page, 'Shop furniture');
    await page.waitForTimeout(800);
    // A reopened shop starts unfiltered and the grid only creates cards in view, so search again.
    await typeInto(page, 'Search furniture', 'velvet');
    await xamlClick(page, 'Blue velvet sofa');
    await page.waitForTimeout(500);
    await xamlClick(page, 'Buy for 80 ✦');
    await page.waitForTimeout(800);
    const shopError = (await xamlText(page, /credit|✦/i)).filter(t => !/^\d+ ✦/.test(t) && !/^Buy for/.test(t) && !/to spend/.test(t));
    await page.screenshot({path: path.join(out, `${band}-shop-error.png`)});
    record(`${tag}: a failed purchase shows the game's message and keeps credits`, shopError.length > 0 && await game(page, () => AfterhoursWorld.game.state.coins) === 5, {shopError});
    await game(page, () => { AfterhoursWorld.game.state.coins = 500; AfterhoursWorld.sync(); });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // Blueprints, opened by the game's own Room tools panel (in your room).
    await xamlClick(page, 'My room');
    await page.waitForTimeout(900);
    await openSheet(page, 'Room tools', 'ROOM SETTINGS');
    await clickThrough(page, 'Blueprints', 'Keep a room in your pocket');
    const blueprintsOpen = await waitText(page, 'Keep a room in your pocket') && !(await game(page, () => document.querySelector('.ah-root #modal').open));
    await xamlClick(page, 'Save current layout');
    await page.waitForTimeout(800);
    const saved = await game(page, () => AfterhoursWorld.game.state.blueprints.length);
    await page.screenshot({path: path.join(out, `${band}-blueprints.png`)});
    await xamlClick(page, 'Restore');
    await page.waitForTimeout(1000);
    record(`${tag}: the game opens XAML blueprints; save and restore work`, blueprintsOpen && saved === 1 && !(await visible(page, 'Keep a room in your pocket')), {blueprintsOpen, saved});

    // Gift wrap, opened by the game for a gift box.
    const ids = await game(page, () => {
      const buy = type => AfterhoursWorld.act('buy', {type}).result.id;
      const gift = buy('gift'), plant = buy('plant');
      // The game wraps only a box standing in a room (it opens this panel from a placed box).
      Object.assign(AfterhoursWorld.game.state.items.find(i => i.id === gift), {placed: true, roomId: 'home', x: 2, y: 2});
      AfterhoursWorld.sync();
      window.AfterhoursHost.open('WrapGift', {itemId: gift});
      return {gift, plant};
    });
    await page.waitForTimeout(1200);
    const wrapOpen = await waitText(page, 'A small surprise');
    // The plant is the only piece the box can hold. The list sometimes ignores the first click, so open it again if needed.
    const plantName = await game(page, () => AfterhoursFurniture.catalog.plant.name);
    for (let attempt = 0; attempt < 3 && !(await waitText(page, plantName, 1500)); attempt++) await xamlClick(page, 'Piece to wrap');
    await xamlClick(page, plantName);
    await page.waitForTimeout(400);
    await xamlClick(page, 'Wrap gift');
    await page.waitForTimeout(1000);
    const wrapped = await page.evaluate(id => AfterhoursWorld.game.state.items.find(i => i.id === id)?.contents, ids.gift);
    record(`${tag}: gift wrap opens from the game and wraps the chosen piece`, wrapOpen && wrapped === ids.plant && !(await visible(page, 'A small surprise')), {wrapOpen, wrapped, expected: ids.plant});

    // Wave 3a: the studio, the song library and the room jukebox (its own block, so names stay local).
    {
    const draft = () => game(page, () => { const d = AfterhoursWorld.game.state.draft; return {kick: d.pattern[0].join(''), muted: d.muted.join(), bpm: d.bpm, volume: d.volumes[0], title: d.title}; });
    const before = await draft();
    await xamlClick(page, 'Beat studio');
    const studioOpen = await waitText(page, 'Find your sound', 8000);
    await page.waitForTimeout(800);
    // Steps, lanes and sliders are found by their accessible names ("KICK step 2, off", "Mute KICK").
    await xamlClick(page, /^KICK step 2, /);
    await page.waitForTimeout(500);
    const toggled = (await draft()).kick;
    await xamlClick(page, 'Undo');
    await page.waitForTimeout(500);
    const undone = (await draft()).kick;
    record(`${tag}: studio opens from the rail; a step toggles and Undo restores it`, studioOpen && toggled[1] !== before.kick[1] && undone === before.kick, {toggled, undone});

    await xamlClick(page, 'Mute KICK');
    await page.waitForTimeout(400);
    const muted = (await draft()).muted;
    await xamlClick(page, 'Solo SNARE');
    await page.waitForTimeout(400);
    const soloed = (await draft()).muted;
    record(`${tag}: M mutes a lane and S solos one`, muted === 'true,false,false,false' && soloed === 'true,false,true,true', {muted, soloed});

    await dragSlider(page, 'Tempo', 60, 160, 80);
    await dragSlider(page, 'KICK volume', 0, 100, -40);
    const slid = await draft();
    record(`${tag}: tempo and volume apply while their sliders move`, slid.bpm > 100 && slid.volume < before.volume, {bpm: slid.bpm, volume: slid.volume});

    await xamlClick(page, '▶ Play');
    await page.waitForTimeout(1500);
    const audio = await page.evaluate(() => window.__contexts.map(c => c.state));
    const pausing = await visible(page, 'Ⅱ Pause');
    await page.screenshot({path: path.join(out, `${band}-studio.png`)});
    await xamlClick(page, 'Ⅱ Pause');
    await page.waitForTimeout(500);
    record(`${tag}: Play runs the draft and the button follows playback`, audio.includes('running') && pausing && await visible(page, '▶ Play'), {audio, pausing});

    await typeInto(page, 'Track name', ' B-side', {end: true});
    await page.waitForTimeout(400);
    await xamlClick(page, 'Save track');
    // Wait for the library first: the TextBox's own text element also shows the title.
    const listed = await waitText(page, 'Your discography', 5000) && await waitText(page, 'Untitled afterhours B-side', 3000);
    const songs = await game(page, () => AfterhoursWorld.game.state.songs.map(s => s.title));
    await page.screenshot({path: path.join(out, `${band}-library.png`)});
    record(`${tag}: Save track adds it to the XAML library`, listed && songs.join() === 'Untitled afterhours B-side', {songs});

    const coinsBeforeDisc = await game(page, () => AfterhoursWorld.game.state.coins);
    await xamlClick(page, 'Press disc · 10 ✦');
    await page.waitForTimeout(600);
    const pressed = await game(page, () => ({coins: AfterhoursWorld.game.state.coins, discs: AfterhoursWorld.game.state.discs.length}));
    await xamlClick(page, 'Press disc · 10 ✦');
    const again = await waitText(page, 'You already pressed this version.', 3000);
    record(`${tag}: pressing a disc pays 10 and a repeat shows the game's message`, pressed.coins === coinsBeforeDisc - 10 && pressed.discs === 1 && again, {pressed, again});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // The jukebox, opened by the game's Room tools panel.
    await openSheet(page, 'Room tools', 'ROOM SETTINGS');
    const jukeboxOpen = await clickThrough(page, 'Playlist', 'The room has a soundtrack');
    await xamlClick(page, 'Untitled afterhours B-side');
    await page.waitForTimeout(300);
    await xamlClick(page, 'Save playlist');
    await page.waitForTimeout(800);
    const playlist = await game(page, () => { const w = AfterhoursWorld, r = w.game.state.rooms.find(r => r.id === w.game.state.activeRoom); return r.playlist.length === 1 && r.playlist[0] === w.game.state.songs[0].id; });
    record(`${tag}: the game opens the XAML jukebox and its playlist saves`, jukeboxOpen && playlist && !(await visible(page, 'The room has a soundtrack')), {jukeboxOpen, playlist});

    await xamlClick(page, 'Beat studio');
    await waitText(page, 'Find your sound', 5000);
    await xamlClick(page, 'Song library');
    await page.waitForTimeout(500);
    await xamlClick(page, 'Delete');
    const asked = await waitText(page, 'Delete this track?', 4000);
    await xamlClick(page, 'Delete track');
    await page.waitForTimeout(800);
    const left = await game(page, () => ({songs: AfterhoursWorld.game.state.songs.length, playlist: AfterhoursWorld.game.state.rooms.every(r => !r.playlist.length)}));
    const empty = await waitText(page, 'Your first record starts here.', 4000);
    record(`${tag}: Delete asks first, then removes the track from the library and playlists`, asked && left.songs === 0 && left.playlist && empty, {asked, left, empty});
    // The studio as a screen reader hears it.
    await xamlClick(page, 'Studio');
    const studioUnspoken = await waitSpoken(page, ['KICK step 1, on', 'Mute KICK', 'KICK volume', 'Tempo', 'Track name', 'Save track']);
    record(`${tag}: screen readers get the studio's names`, !studioUnspoken.length, {studioUnspoken});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    }

    // Wave 3b: the solo stage from the dock, through a whole set to its reward.
    {
    await game(page, () => AfterhoursWorld.act('song', {...AfterhoursWorld.game.state.draft, id: '', title: 'Stage sketch'}));
    await xamlClick(page, 'Stage');
    const stageOpen = await waitText(page, 'Your moment on Side B', 6000) && await waitText(page, 'Open mic · your slot is ready');
    const coinsBefore = await game(page, () => AfterhoursWorld.game.state.coins);
    await xamlClick(page, 'Stage sketch');
    const next = await waitText(page, 'YOU’RE NEXT', 4000);
    const onStage = await waitText(page, 'ON STAGE', 8000) && await waitText(page, /^\d+s remaining$/, 3000);
    const audio = await page.evaluate(() => window.__contexts.map(c => c.state));
    await page.screenshot({path: path.join(out, `${band}-stage.png`)});
    record(`${tag}: the dock opens the XAML stage; a song queues, counts down and plays`, stageOpen && next && onStage && audio.includes('running'), {stageOpen, next, onStage, audio});

    const done = await waitText(page, 'You found your frequency', 26000);
    const reward = await waitText(page, '+40 credits', 3000);
    const coinsAfter = await game(page, () => AfterhoursWorld.game.state.coins);
    await page.screenshot({path: path.join(out, `${band}-set-complete.png`)});
    record(`${tag}: a finished set shows its reward in the stage panel`, done && reward && coinsAfter === coinsBefore + 40, {done, reward, coinsBefore, coinsAfter});

    await xamlClick(page, 'Back to the stage');
    // The now-playing bar shows the title too, so pick the song by its picker label.
    await xamlClick(page, 'Join stage ↗');
    await waitText(page, 'YOU’RE NEXT', 4000);
    await xamlClick(page, 'Leave queue / stage');
    const left = await waitText(page, 'Open mic · your slot is ready', 4000);
    record(`${tag}: Leave takes you off the stage`, left && !(await game(page, () => document.body.classList.contains('is-playing'))), {left});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    }

    // Wave 5: the room navigator, room tools and their sheets, the companion, the arcade, room objects and portals.
    {
    const roomTitle = () => game(page, () => document.querySelector('.ah-root #roomTitle').textContent);
    await xamlClick(page, 'Explore rooms');
    const navigatorOpen = await waitText(page, 'Find your people', 6000);
    await typeInto(page, 'Search rooms', 'jazz');
    // Cards are named "title, mood" (the rail lists the public rooms by title too).
    const searched = await waitText(page, 'Midnight Diner, late-night jazz', 3000) && !(await visible(page, /^The Greenhouse, /));
    await page.screenshot({path: path.join(out, `${band}-rooms.png`)});
    await xamlClick(page, 'Midnight Diner');
    await page.waitForTimeout(1200);
    const entered = (await roomTitle()).startsWith('Midnight Diner') && !(await visible(page, 'Find your people'));
    record(`${tag}: the navigator searches and enters a public room`, navigatorOpen && searched && entered, {navigatorOpen, searched, title: await roomTitle()});

    const roomsBefore = await game(page, () => AfterhoursWorld.game.state.rooms.length);
    await xamlClick(page, 'Explore rooms');
    await waitText(page, 'Find your people', 5000);
    const createOpen = await clickThrough(page, '+ Create a room', 'A room of your own');
    await typeInto(page, 'Room name', 'Wave five den');
    await xamlClick(page, 'Create room');
    await page.waitForTimeout(1200);
    const created = await game(page, () => AfterhoursWorld.game.state.rooms.map(r => r.name));
    record(`${tag}: a room is created in the navigator and you arrive in it`, createOpen && created.length === roomsBefore + 1 && created.includes('Wave five den') && (await roomTitle()).startsWith('Wave five den'), {created, title: await roomTitle()});

    const toolsOpen = await openSheet(page, 'Room tools', 'ROOM SETTINGS');
    await typeInto(page, 'Description', 'late records');
    await xamlClick(page, 'Save settings');
    await page.waitForTimeout(800);
    const described = await game(page, () => AfterhoursWorld.room().description);
    record(`${tag}: room tools save the room's settings`, toolsOpen && described === 'late records' && !(await visible(page, 'ROOM SETTINGS')), {described});

    await openSheet(page, 'Room tools', 'ROOM SETTINGS');
    const logicOpen = await clickThrough(page, 'Room logic', 'Give your room a little magic');
    await xamlClick(page, 'Add rule');
    const ruled = await waitText(page, 'When enter → lights', 3000) && await game(page, () => AfterhoursWorld.room().rules.length) === 1;
    await xamlClick(page, 'Remove rule');
    await page.waitForTimeout(600);
    const unruled = await game(page, () => AfterhoursWorld.room().rules.length) === 0 && !(await visible(page, 'When enter → lights'));
    record(`${tag}: room logic adds and removes a rule`, logicOpen && ruled && unruled, {logicOpen, ruled, unruled});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await openSheet(page, 'Room tools', 'ROOM SETTINGS');
    const boardOpen = await clickThrough(page, 'Message board', 'Leave a little something');
    await typeInto(page, 'Your note', 'see you at two');
    await xamlClick(page, 'Pin note');
    const pinned = await waitText(page, 'see you at two', 3000) && await game(page, () => AfterhoursWorld.room().notes[0]?.text) === 'see you at two';
    await page.screenshot({path: path.join(out, `${band}-message-board.png`)});
    record(`${tag}: the message board pins a note`, boardOpen && pinned, {boardOpen, pinned});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await openSheet(page, 'Room tools', 'ROOM SETTINGS');
    const eventOpen = await clickThrough(page, 'Host an event', 'Bring the room together');
    await xamlClick(page, 'Host event');
    await page.waitForTimeout(800);
    const hosting = await game(page, () => AfterhoursWorld.room().event?.name);
    record(`${tag}: an event is hosted from room tools`, eventOpen && hosting === 'Listening party' && !(await visible(page, 'Bring the room together')), {hosting});

    const coinsBeforePet = await game(page, () => AfterhoursWorld.game.state.coins);
    await xamlClick(page, 'Companion');
    const adoptOpen = await waitText(page, 'A little company', 5000);
    const portrait = (await nodes(page, 'Your companion')).at(-1);
    const portraitColours = portrait ? await colours(page, portrait) : 0;
    await xamlClick(page, 'Adopt · 50 ✦');
    const adopted = await waitText(page, 'YOUR COMPANION', 3000) && await waitText(page, 'Full belly', 2000);
    const coinsAfterPet = await game(page, () => AfterhoursWorld.game.state.coins);
    await xamlClick(page, 'Train');
    const trained = await waitText(page, /^Training XP: 15\./, 3000);
    await page.screenshot({path: path.join(out, `${band}-companion.png`)});
    record(`${tag}: a companion is adopted, drawn and trained`, adoptOpen && portraitColours > 20 && adopted && coinsAfterPet === coinsBeforePet - 50 && trained, {adoptOpen, portraitColours, adopted, coinsBeforePet, coinsAfterPet, trained});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await xamlClick(page, 'Arcade');
    const arcadeOpen = await waitText(page, 'Just one more round', 5000) && await waitText(page, /^BEST \d+$/, 1000);
    await xamlClick(page, 'Play Tile Rush');
    await page.waitForTimeout(800);
    const round = await game(page, () => !!document.querySelector('.ah-root #modal')?.open && !!document.querySelector('.ah-root #arcadeHost'));
    record(`${tag}: the arcade picker starts a round in the game`, arcadeOpen && round && !(await visible(page, 'Just one more round')), {arcadeOpen, round});
    await game(page, () => AfterhoursWorld.close());
    await page.waitForTimeout(500);

    // A lamp placed here opens its object sheet; its first action is the game's.
    const lamp = await game(page, () => {
      const out = AfterhoursWorld.act('buy', {type: 'lamp'});
      const item = AfterhoursWorld.game.state.items.find(i => i.id === out.result.id);
      Object.assign(item, {placed: true, roomId: AfterhoursWorld.game.state.activeRoom, x: 2, y: 2, rot: 0});
      AfterhoursWorld.sync();
      return item.id;
    });
    await page.evaluate(id => AfterhoursWorld.useItem(id), lamp);
    const objectOpen = await waitText(page, 'ROOM INTERACTION', 5000) && await waitText(page, 'Turn light off', 2000);
    await page.waitForTimeout(800);
    // The art sits under the piece's name.
    const name = (await nodes(page, await game(page, () => AfterhoursFurniture.catalog.lamp.name))).at(-1);
    const artColours = name ? await colours(page, {x: name.x, y: name.y + name.h + 12, w: 240, h: 188}) : 0;
    await page.screenshot({path: path.join(out, `${band}-room-object.png`)});
    await xamlClick(page, 'Turn light off');
    await page.waitForTimeout(800);
    record(`${tag}: a room object opens its sheet with art, and an action closes it`, objectOpen && artColours > 20 && !(await visible(page, 'ROOM INTERACTION')), {objectOpen, artColours});

    const portal = await game(page, () => {
      const out = AfterhoursWorld.act('buy', {type: 'portal'});
      const item = AfterhoursWorld.game.state.items.find(i => i.id === out.result.id);
      Object.assign(item, {placed: true, roomId: AfterhoursWorld.game.state.activeRoom, x: 4, y: 2, rot: 0});
      AfterhoursWorld.sync();
      window.AfterhoursHost.open('Portal', {itemId: item.id});
      return item.id;
    });
    const portalOpen = await waitText(page, 'Where does this lead?', 5000);
    await xamlClick(page, /^Your afterhours/);
    await page.waitForTimeout(800);
    const linked = await page.evaluate(id => { const s = AfterhoursWorld.game.state; return s.items.find(i => i.id === id).destination === s.rooms[0].id; }, portal);
    record(`${tag}: a portal links to another of your rooms`, portalOpen && linked && !(await visible(page, 'Where does this lead?')), {portalOpen, linked});
    }

    // Wave 6 (solo): a resident joins your circle, then is blocked and unblocked; chat preferences save.
    {
    await game(page, () => window.AfterhoursHost.open('Resident', {name: 'miso'}));
    const residentOpen = await waitText(page, 'RESIDENT CHARACTER', 5000) && await waitText(page, 'This resident is part of the solo world.', 1000);
    await page.waitForTimeout(400);
    await xamlClick(page, 'Add to my circle');
    const circled = await waitText(page, 'Remove from circle', 3000) && await game(page, () => AfterhoursWorld.game.state.friends.includes('miso'));
    await page.screenshot({path: path.join(out, `${band}-resident.png`)});
    record(`${tag}: a resident is added to your circle`, residentOpen && circled, {residentOpen, circled});
    await xamlClick(page, 'Block replies');
    await page.waitForTimeout(800);
    const blocked = await game(page, () => AfterhoursWorld.game.state.blocked.includes('miso')) && !(await visible(page, 'RESIDENT CHARACTER'));

    const friendsOpen = await openSheet(page, 'Friends', 'Good company');
    const listed = await waitText(page, 'miso', 3000);
    await page.screenshot({path: path.join(out, `${band}-friends.png`)});
    await clickThrough(page, 'miso', 'RESIDENT CHARACTER');
    const viewed = await visible(page, 'Remove from circle');
    record(`${tag}: your circle lists the resident and opens their card`, blocked && friendsOpen && listed && viewed, {blocked, friendsOpen, listed, viewed});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    const prefsOpen = await openSheet(page, 'Chat preferences', 'Make space for yourself');
    await xamlClick(page, 'Unblock miso');
    const unblocked = await waitText(page, 'Nobody is blocked.', 3000) && await game(page, () => !AfterhoursWorld.game.state.blocked.length);
    await xamlClick(page, 'Mute resident replies');
    await page.waitForTimeout(300);
    await xamlClick(page, 'Save preferences');
    await page.waitForTimeout(800);
    const muted = await game(page, () => AfterhoursWorld.game.state.settings.muteGuests);
    record(`${tag}: chat preferences unblock a resident and mute replies`, prefsOpen && unblocked && muted === true, {prefsOpen, unblocked, muted});
    await game(page, () => { AfterhoursWorld.game.state.settings.muteGuests = false; AfterhoursWorld.game.save(); });
    }

    // Wave 4: journal, help, wardrobe and profile (last: restoring a save replaces the world).
    {
    const ready = await game(page, () => AfterhoursWorld.journalState().quests.find(q => q.value === q.target && !q.claimed));
    const coinsBefore = await game(page, () => AfterhoursWorld.game.state.coins);
    await xamlClick(page, 'Journal');
    const journalOpen = await waitText(page, 'Your night, your story', 6000);
    await xamlClick(page, `${ready.reward} ✦`);
    const claimed = await waitText(page, 'Collected', 3000);
    const coinsAfter = await game(page, () => AfterhoursWorld.game.state.coins);
    await page.screenshot({path: path.join(out, `${band}-journal.png`)});
    record(`${tag}: the journal opens from the rail and a finished quest pays out`, journalOpen && claimed && coinsAfter === coinsBefore + ready.reward, {quest: ready.name, coinsBefore, coinsAfter});
    const journalUnspoken = await waitSpoken(page, ['Quests', 'Badges', 'Wallet']);
    await xamlClick(page, 'Badges');
    const badges = await waitText(page, 'Small keepsakes from nights well spent.', 3000);
    await xamlClick(page, 'Wallet');
    const wallet = await waitText(page, `${coinsAfter} ✦`, 3000) && await waitText(page, 'Your credits · earned through play', 1000);
    record(`${tag}: journal badges and wallet tabs show the game's data`, badges && wallet && !journalUnspoken.length, {badges, wallet, journalUnspoken});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await xamlClick(page, 'How to play');
    record(`${tag}: help opens in XAML`, await waitText(page, 'The night is yours', 5000) && await waitText(page, '01 · Make yourself at home', 2000));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await xamlClick(page, 'My look');
    const wardrobeOpen = await waitText(page, 'Who’s showing up tonight?', 6000);
    // The game renders the preview asynchronously.
    let drawn = 0;
    for (const start = Date.now(); drawn <= 20 && Date.now() - start < 8000; await page.waitForTimeout(500)) {
      const preview = (await nodes(page, 'Outfit preview')).at(-1);
      drawn = preview ? await colours(page, preview) : 0;
    }
    record(`${tag}: the wardrobe opens from the rail and the game draws its preview`, wardrobeOpen && drawn > 20, {drawn});
    await xamlClick(page, 'Blunt bob');
    await xamlClick(page, 'Silver');
    await page.waitForTimeout(500);
    await page.screenshot({path: path.join(out, `${band}-wardrobe.png`)});
    await xamlClick(page, 'Save look');
    await page.waitForTimeout(800);
    const outfit = await game(page, () => AfterhoursWorld.game.state.profile.outfit);
    record(`${tag}: wardrobe choices save as the outfit`, outfit?.hair === 'bob' && outfit?.hairColor === 'silver' && !(await visible(page, 'Who’s showing up tonight?')), {hair: outfit?.hair, hairColor: outfit?.hairColor});

    await xamlClick(page, 'Your profile');
    const profileOpen = await waitText(page, 'This is you', 6000);
    await typeInto(page, 'Display name', 'owl', {end: true});
    await xamlClick(page, 'Teal');
    await xamlClick(page, 'Save profile');
    await page.waitForTimeout(800);
    const saved = await game(page, () => ({name: AfterhoursWorld.game.state.profile.name, color: AfterhoursWorld.game.state.profile.chatColor}));
    await page.screenshot({path: path.join(out, `${band}-profile.png`)});
    record(`${tag}: the profile saves a new name and chat colour`, profileOpen && saved.name === 'daydreamowl' && saved.color === '#0f7a6c', {saved});

    const download = page.waitForEvent('download', {timeout: 5000}).catch(() => null);
    await xamlClick(page, 'Export save');
    const file = await download;
    await xamlClick(page, 'Use last backup');
    const backupAsked = await waitText(page, /^(Recover your last backup|No previous backup is available yet\.)$/, 3000);
    if (await visible(page, 'Keep my world')) await xamlClick(page, 'Keep my world');
    record(`${tag}: export downloads the save and a backup restore asks first`, file?.suggestedFilename() === 'afterhours-save.json' && backupAsked, {file: file?.suggestedFilename(), backupAsked});

    // Restore a save through the file picker (Uno's upload picker is a plain file input).
    const other = await game(page, () => JSON.stringify({...AfterhoursWorld.game.state, profile: {...AfterhoursWorld.game.state.profile, name: 'restored'}}));
    const chooser = page.waitForEvent('filechooser', {timeout: 5000}).catch(() => null);
    await xamlClick(page, 'Restore save');
    const picker = await chooser;
    await picker?.setFiles({name: 'afterhours-save.json', mimeType: 'application/json', buffer: Buffer.from(other)});
    const asked = await waitText(page, 'Restore this world?', 5000);
    if (asked) await xamlClick(page, 'Restore saved world');
    await page.waitForTimeout(1000);
    const restored = await game(page, () => AfterhoursWorld.game.state.profile.name);
    record(`${tag}: a save file is checked, confirmed and restored`, !!picker && asked && restored === 'restored', {picker: !!picker, asked, restored});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    }
  }

  if (band === 'phone') {
    await xamlClick(page, '\uE712');
    await page.waitForTimeout(500);
    await xamlClick(page, 'Furniture shop');
    await page.waitForTimeout(1500);
    await waitText(page, 'Room for imagination');
    const width = Math.max(...(await nodes(page, /^(Room for imagination|Search furniture)$/)).map(n => n.x + n.w));
    await page.screenshot({path: path.join(out, `${band}-shop.png`)});
    record(`${tag}: shop fits the phone`, await waitText(page, 'Room for imagination') && width <= 390, {width});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await game(page, () => window.AfterhoursHost.open('Wardrobe'));
    const wardrobePhone = await waitText(page, 'Who’s showing up tonight?', 6000);
    for (const start = Date.now(); Date.now() - start < 8000; await page.waitForTimeout(500)) {
      const preview = (await nodes(page, 'Outfit preview')).at(-1);
      if (preview && await colours(page, preview) > 20) break;
    }
    const wardrobeRight = Math.max(...(await nodes(page, /^(Save look|Who’s showing up tonight\?|Outfit preview)$/)).map(n => n.x + n.w));
    await page.screenshot({path: path.join(out, `${band}-wardrobe.png`)});
    record(`${tag}: the wardrobe fits the phone`, wardrobePhone && wardrobeRight <= 390, {wardrobeRight});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);

    await xamlClick(page, '\uE8D6');
    // A flyout that just closed can still swallow one click; try once more if needed.
    if (!(await waitText(page, 'Find your sound', 2500))) await xamlClick(page, '\uE8D6');
    const studioPhone = await waitText(page, 'Find your sound', 5000);
    const studioRight = Math.max(...(await nodes(page, /^(Save track|Find your sound|Track name)$/)).map(n => n.x + n.w));
    await page.screenshot({path: path.join(out, `${band}-studio.png`)});
    record(`${tag}: studio opens from the bottom bar and fits the phone`, studioPhone && studioRight <= 390, {studioRight});
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.waitForTimeout(800);
    await xamlClick(page, '\uE8BD');
    // A flyout that just closed can still swallow one click; try once more if needed.
    if (!(await waitText(page, 'Room chat', 2000))) await xamlClick(page, '\uE8BD');
    const chatOpen = await waitText(page, 'Room chat');
    await page.screenshot({path: path.join(out, `${band}-chat.png`)});
    record(`${tag}: chat opens from the bottom bar`, chatOpen);
  }

  record(`${tag}: no page errors or failed requests`, !errors.length && !failed.length, {errors: errors.slice(0, 3), failed: failed.slice(0, 3)});
  await context.close();
}

// Shared world: two players join through the XAML shared-world button and the game's join form,
// then a line typed in one player's XAML chat reaches the other player's XAML chat.
{
  const players = [];
  for (const name of ['xamlalpha', 'xamlbeta']) {
    const p = await open(1440, 900);
    await xamlClick(p.page, 'JOIN SHARED WORLD');
    await p.page.waitForTimeout(500);
    await p.page.evaluate(n => { document.querySelector('.ah-root #onlineName').value = n; document.querySelector('.ah-root #joinWorldForm').requestSubmit(); }, name);
    await p.page.waitForFunction(() => window.AfterhoursOnline?.connected(), null, {timeout: 20000});
    await closeGameDialog(p.page);
    await p.page.waitForTimeout(1500);
    players.push(p);
  }
  const [a, b] = players;
  record('shared: both players show SHARED WORLD in the XAML top bar', await waitText(a.page, 'SHARED WORLD') && await waitText(b.page, 'SHARED WORLD'));
  await typeInto(a.page, 'Room message', 'hi from the other tab');
  await a.page.keyboard.press('Enter');
  await b.page.waitForFunction(() => [...document.querySelectorAll('.ah-root #messages .message p')].some(p => p.textContent.includes('hi from the other tab')), null, {timeout: 20000}).catch(() => {});
  await b.page.waitForTimeout(600);
  await b.page.screenshot({path: path.join(out, 'shared-receiver.png')});
  record('shared: a XAML chat line reaches the other player\'s XAML chat', (await xamlText(b.page, /hi from the other tab/)).length > 0);

  // Wave 3b: the shared stage. One player queues a track, the other applauds it, and the chart ranks it.
  // The server may suffix a display name (xamlalpha-e0d2).
  await game(a.page, () => AfterhoursWorld.act('song', {...AfterhoursWorld.game.state.draft, id: '', title: 'Shared sketch'}));
  await a.page.waitForTimeout(1000);
  await xamlClick(a.page, 'Stage');
  const sharedOpen = await waitText(a.page, 'The room is listening', 10000);
  await xamlClick(a.page, 'Shared sketch');
  const queued = await waitText(a.page, /^(UP NEXT|ON STAGE)$/, 8000);
  await xamlClick(b.page, 'Stage');
  await waitText(b.page, 'The room is listening', 6000);
  const heard = await waitText(b.page, 'ON STAGE', 8000) && await waitText(b.page, /^by xamlalpha(-\w+)? · \d+s remaining$/, 3000);
  await xamlClick(b.page, '♡ Applaud');
  const applauded = await waitText(b.page, 'Applauded ✓', 5000);
  const counted = await waitText(a.page, '1 applause', 5000) && await visible(a.page, 'Your performance');
  await b.page.screenshot({path: path.join(out, 'shared-stage.png')});
  record('shared: the XAML stage queues a set, plays it to the room and takes applause', sharedOpen && queued && heard && applauded && counted, {sharedOpen, queued, heard, applauded, counted});

  const over = await waitText(b.page, 'The stage is open. Be the first to play tonight.', 26000);
  await xamlClick(b.page, 'Weekly chart ↗');
  const chartOpen = await waitText(b.page, 'This week’s chart', 5000);
  const ranked = await waitText(b.page, 'Shared sketch', 5000);
  await b.page.screenshot({path: path.join(out, 'shared-chart.png')});
  await xamlClick(b.page, 'Back to the stage');
  const back = await waitText(b.page, 'The room is listening', 3000) && !(await visible(b.page, 'This week’s chart'));
  record('shared: the weekly chart opens from the stage and ranks the applauded track', over && chartOpen && ranked && back, {over, chartOpen, ranked, back});
  // Wave 6: the shared world panel lists the other player; a friend request is accepted; a trade opens and is cancelled.
  {
  const alpha = await a.page.evaluate(() => AfterhoursOnline.socialState().name);
  await a.page.keyboard.press('Escape');
  await b.page.keyboard.press('Escape');
  await a.page.waitForTimeout(600);
  const worldOpen = await openSheet(a.page, 'SHARED WORLD', 'The world is better together') && await waitText(a.page, /^Connected as xamlalpha/, 2000);
  const beta = await waitText(a.page, /^xamlbeta(-\w+)?$/, 5000);
  await a.page.screenshot({path: path.join(out, 'shared-world.png')});
  record('shared: the XAML shared world lists the other player', worldOpen && beta, {worldOpen, beta});
  await clickThrough(a.page, /^xamlbeta(-\w+)?$/, 'CONNECTED PLAYER');
  await xamlClick(a.page, 'Add friend');
  await a.page.waitForTimeout(1500);
  await openSheet(b.page, 'Friends', 'Good company');
  const asked = await waitText(b.page, 'Wants to be friends', 8000);
  await xamlClick(b.page, 'Accept');
  const befriended = await waitText(b.page, alpha, 8000) && await waitText(b.page, /^(Here now|Seen .+)$/, 3000);
  await b.page.screenshot({path: path.join(out, 'shared-friends.png')});
  record('shared: a friend request from the player card is accepted in Friends', asked && befriended, {asked, befriended});
  await b.page.keyboard.press('Escape');
  await b.page.waitForTimeout(600);

  await xamlClick(a.page, 'Trade furniture');
  const waiting = await waitText(a.page, 'Waiting for the other player to accept…', 8000);
  await openSheet(b.page, 'SHARED WORLD', 'The world is better together');
  await clickThrough(b.page, /^Furniture trade · xamlalpha/, 'FURNITURE TRADING');
  await xamlClick(b.page, 'Accept trade invitation');
  const opened = await waitText(b.page, 'Choose up to eight pieces from your inventory:', 8000) && await waitText(a.page, 'Choose up to eight pieces from your inventory:', 8000);
  await a.page.screenshot({path: path.join(out, 'shared-trade.png')});
  await xamlClick(a.page, 'Cancel trade');
  const closed = await waitText(a.page, 'Trade closed', 8000) && await waitText(b.page, 'Trade closed', 8000);
  record('shared: a trade is offered, accepted and cancelled, and both sheets follow it', waiting && opened && closed, {waiting, opened, closed});
  await a.page.keyboard.press('Escape');
  await b.page.keyboard.press('Escape');
  await a.page.waitForTimeout(600);
  }

  // Wave 5: the shared navigator lists the public rooms and joins one.
  await a.page.keyboard.press('Escape');
  await a.page.waitForTimeout(600);
  const sharedNavigator = await openSheet(a.page, 'Explore rooms', 'Rooms with a heartbeat') && await waitText(a.page, 'SHARED NAVIGATOR', 1000);
  await a.page.screenshot({path: path.join(out, 'shared-rooms.png')});
  await xamlClick(a.page, 'Midnight Diner');
  await a.page.waitForTimeout(2000);
  const joined = await a.page.evaluate(() => document.querySelector('.ah-root #roomTitle').textContent);
  const navigatorClosed = await waitGone(a.page, 'Rooms with a heartbeat', 4000);
  record('shared: the XAML navigator joins a shared public room', sharedNavigator && joined.startsWith('Midnight Diner') && navigatorClosed, {sharedNavigator, joined, navigatorClosed});
  for (const p of players) {
    record('shared: no page errors', !p.errors.length, {errors: p.errors.slice(0, 3)});
    await p.context.close();
  }
}

await browser.close();
await writeFile(path.join(out, 'results.json'), JSON.stringify({base, date: new Date().toISOString(), results}, null, 2));
const failures = results.filter(r => !r.pass).length;
console.log(`${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
