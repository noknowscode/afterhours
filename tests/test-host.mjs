import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromeFrom, commands, diffSlices, hudFrom} from '../dist/host.mjs';

const require = createRequire(import.meta.url);
const G = require('../dist/game-core.js'), F = require('../dist/furniture.js');
const fresh = () => new G.Game(null, {coins: 240, decor: F.starter()});

test('state slices are sent whole once, then only when their JSON changes', () => {
  const sent = {}, g = fresh();
  const first = diffSlices(g.state, sent);
  assert.deepEqual(Object.keys(first).sort(), Object.keys(g.state).sort());
  assert.equal(diffSlices(g.state, sent), null);
  g.dispatch('checkin', {}, Date.UTC(2026, 9, 20));
  const next = diffSlices(g.state, sent);
  assert.ok(next.coins === 275 && !('items' in next) && !('songs' in next));
});

test('the HUD uses the game rules for level, XP band, quests and the daily gift', () => {
  const g = fresh(), now = Date.now();
  let hud = hudFrom(g.state, G);
  assert.equal(hud.coins, 240);
  assert.equal(hud.level, G.level(g.state));
  assert.equal(hud.xpLower, (hud.level - 1) ** 2 * 100);
  assert.equal(hud.xpUpper, hud.level ** 2 * 100);
  assert.equal(hud.nextQuest, G.quests.find(q => !g.state.claimed.includes(q.id)).name);
  assert.equal(hud.dailyClaimed, false);
  g.dispatch('checkin', {}, now);
  hud = hudFrom(g.state, G);
  assert.equal(hud.coins, 275);
  assert.equal(hud.dailyClaimed, true);
});

test('every XAML command maps to an element the game creates', async () => {
  const sources = (await Promise.all(['index.html', 'app.js', 'game.js', 'online.js'].map(f => readFile(new URL('../dist/' + f, import.meta.url), 'utf8')))).join('\n');
  for (const [name, selector] of Object.entries(commands)) {
    const id = selector.match(/^#([\w-]+)$/)?.[1], view = selector.match(/data-view="(\w+)"/)?.[1];
    const found = id ? new RegExp(`id=["']${id}["']|\\.id=['"]${id}['"]`).test(sources) : sources.includes(`data-view="${view}"`);
    assert.ok(found, `${name} -> ${selector} is not created by the game`);
  }
});

test('hosted mode hides every piece of chrome the XAML replaces', async () => {
  const css = await readFile(new URL('../dist/hosted.css', import.meta.url), 'utf8');
  const hidden = css.match(/([^{}]*)\{display:none!important\}/)[1];
  for (const part of ['.topbar', '.rail', '.room-heading', '.room-journey', '.action-bar', '.room-composer', '.now-playing', '.social', 'footer', '#roomEditor'])
    assert.ok(hidden.includes('.ah-root.ah-hosted ' + part), part + ' is not hidden');
});

// tests/fixtures/host-events.json is also parsed by the C# tests (Afterhours.Uno.Tests), so it must match
// what host.mjs really sends. Compare shapes (keys and value types), not values.
const shape = v => Array.isArray(v) ? [v.length ? shape(v[0]) : null] : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, shape(v[k])])) : typeof v;

test('the shared event fixture matches what host.mjs produces', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/host-events.json', import.meta.url), 'utf8'));
  const of = type => fixture.find(e => e.type === type);
  assert.deepEqual(shape(of('hud').hud), shape(hudFrom(fresh().state, G)));
  const el = {textContent: '1', disabled: false, hidden: false, classList: {contains: () => false}, style: {width: '0%'}};
  globalThis.window = {AfterhoursOnline: {connected: () => false}};
  const chrome = chromeFrom({querySelector: () => el}, {getScene: () => ({personal: false, roomIndex: 0}), roomKey: () => 'public:0'}, {classList: {contains: () => false}});
  delete globalThis.window;
  assert.deepEqual(shape(of('chrome').chrome), shape(chrome));
  // The inventory slices are raw save data; check them against a game that bought a piece and saved a blueprint.
  const g = fresh(), t = Date.UTC(2026, 9, 20);
  g.dispatch('buy', {type: 'sofa'}, t);
  g.dispatch('blueprint', {room: 'home', name: 'Your afterhours'}, t);
  const inventory = fixture.find(e => e.type === 'slices' && 'items' in e.slices).slices;
  assert.deepEqual(shape(inventory.items), shape(g.state.items));
  assert.deepEqual(shape(inventory.rooms), shape(g.state.rooms));
  assert.deepEqual(shape(inventory.blueprints), shape(g.state.blueprints));
  // Songs as the studio saves them.
  g.dispatch('song', G.song({pattern: G.starterPattern, title: 'Side B sketch'}), t);
  const songs = fixture.find(e => e.type === 'slices' && 'songs' in e.slices).slices.songs;
  assert.deepEqual(shape(songs), shape(g.state.songs));
});

test('panels that moved to XAML are requests to the host, not game markup', async () => {
  const game = await readFile(new URL('../dist/game.js', import.meta.url), 'utf8');
  for (const title of ['THE FURNITURE SHOP', 'THE AFTERHOURS COLLECTION', 'BLUEPRINTS', 'WRAP A GIFT'])
    assert.ok(!game.includes(`'${title}'`), title + ' is still built by the game');
  assert.match(game, /function catalog\(tab='shop'\)\{openPanel\('Catalog',\{tab\}\);\}/);
  assert.match(game, /function blueprints\(\)\{openPanel\('Blueprints'\);\}/);
  assert.match(game, /openPanel\('WrapGift',\{itemId:item\.id\}\)/);
  for (const title of ['THE AFTERHOURS STUDIO', 'ROOM JUKEBOX'])
    assert.ok(!game.includes(`'${title}'`), title + ' is still built by the game');
  assert.match(game, /studio=function\(tab='editor'\)\{openPanel\('Studio',\{tab\}\);\};/);
  assert.match(game, /function playlistPanel\(\)\{openPanel\('Jukebox'\);\}/);
  const online = await readFile(new URL('../dist/online.js', import.meta.url), 'utf8');
  for (const title of ['THE LISTENING STAGE', 'SET COMPLETE'])
    assert.ok(!game.includes(`'${title}'`), title + ' is still built by the game');
  assert.ok(!online.includes("'SHARED MUSIC STAGE'"), 'the shared stage is still built by the online client');
  assert.match(game, /function stagePanel\(\)\{openPanel\('Stage'\);\}/);
  assert.match(online, /function chartPanel\(\)\{W\.openPanel\('Chart'\);\}/);
  for (const title of ['RESIDENT JOURNAL', 'RESIDENT PROFILE', 'THE WARDROBE', 'HOW TO PLAY'])
    assert.ok(!game.includes(`'${title}'`), title + ' is still built by the game');
  assert.match(game, /function journal\(tab='quests'\)\{openPanel\('Journal',\{tab\}\);\}/);
  assert.match(game, /function profile\(\)\{openPanel\('Profile'\);\}/);
  assert.match(game, /look=function\(\)\{openPanel\('Wardrobe'\);\};/);
  assert.match(game, /button\('help',\(\)=>openPanel\('Help'\)\);/);
  for (const title of ['ROOM NAVIGATOR', 'CREATE A ROOM', 'ROOM SETTINGS', 'ROOM TOOLS', 'MESSAGE BOARD', 'ROOM LOGIC', 'HOST AN EVENT',
    'ADOPT A COMPANION', 'YOUR COMPANION', 'ROOM INTERACTION', 'LINK A PORTAL'])
    assert.ok(!game.includes(`'${title}'`), title + ' is still built by the game');
  assert.ok(!online.includes("'SHARED NAVIGATOR'"), 'the shared navigator is still built by the online client');
  assert.match(game, /function directory\(filter='all'\)\{openPanel\('Rooms',\{filter\}\);\}/);
  assert.match(online, /function roomDirectory\(\)\{W\.openPanel\('Rooms',\{filter:'all'\}\);\}/);
  for (const [fn, route] of [['notesPanel', 'MessageBoard'], ['rulesPanel', 'RoomLogic'], ['eventPanel', 'RoomEvent'], ['arcade', 'Arcade'], ['petPanel', 'Companion']])
    assert.match(game, new RegExp(`function ${fn}\\(\\)\\{openPanel\\('${route}'\\);\\}`), fn + ' does not open ' + route);
  assert.match(game, /openPanel\('RoomTools'\)/);
  assert.match(game, /openPanel\('RoomObject',\{itemId:item\.id\}\)/);
  assert.match(game, /openPanel\('Portal',\{itemId:item\.id\}\)/);
  for (const title of ['CHAT PREFERENCES', 'RESIDENT CHARACTER', 'YOUR CIRCLE'])
    assert.ok(!game.includes(`'${title}'`), title + ' is still built by the game');
  for (const title of ['SHARED SESSIONS', 'SHARED WORLD', 'CONNECTED PLAYER', 'COMMUNITY', 'SINCE YOUR LAST VISIT', 'FRIENDS & REQUESTS', 'FURNITURE TRADING'])
    assert.ok(!online.includes(`,'${title}'`), title + ' is still built by the online client');
  assert.match(game, /button\('friendsTab',\(\)=>openPanel\('Friends'\)\);/);
  assert.match(game, /button\('socialSettings',\(\)=>openPanel\('ChatPrefs'\)\);/);
  assert.match(game, /openPanel\('Resident',\{name:person\.name\}\)/);
  assert.match(online, /function playerPanel\(id\)\{select\('peer',id\);W\.openPanel\('Player',\{id\}\);\}/);
  assert.match(online, /function friendsPanel\(\)\{W\.openPanel\('Friends'\);\}/);
  assert.match(online, /W\.openPanel\('Trade',\{id:trade\.id\}\)/);
  assert.match(online, /W\.openPanel\('Away'\)/);
  assert.match(online, /function panel\(\)\{W\.openPanel\(!ready\|\|online\?'SharedWorld':'Join'\);\}/);
  for (const title of ['JOIN THE SHARED WORLD', 'SIGN OUT', 'RESTORE YOUR CHARACTER'])
    assert.ok(!online.includes(`'${title}'`), title + ' is still built by the online client');
  assert.ok(!online.includes('W.panel('), 'the online client still builds a panel');
  assert.match(online, /document\.querySelector\('\[data-account-challenge\]'\)/);
});

test('every social action the app sends is one the online client knows', async () => {
  const online = await readFile(new URL('../dist/online.js', import.meta.url), 'utf8');
  const models = await Promise.all(['FriendsModel', 'PlayerModel', 'TradeModel', 'AwayModel', 'SharedWorldModel', 'JoinModel', 'RestoreModel', 'SignOutModel']
    .map(name => readFile(new URL(`../uno/Afterhours.Uno/Presentation/${name}.cs`, import.meta.url), 'utf8')));
  const page = await readFile(new URL('../uno/Afterhours.Uno/Views/SharedWorldPage.xaml', import.meta.url), 'utf8');
  const sent = new Set([...models.join('\n').matchAll(/Social\.Act\("(\w+)"/g), ...page.matchAll(/Command="\{Binding Open\}" CommandParameter="(\w+)"/g)].map(m => m[1]));
  const act = online.slice(online.indexOf('async function socialAct('), online.indexOf('  function stagePanel(){'));
  assert.ok(sent.size >= 15, 'expected the social models to send their actions');
  for (const op of sent) assert.match(act, new RegExp(`(case '${op}'|\\b${op}:\\[)`), op + ' is not a social action in online.js');
});

test('every function the app imports is exported by host.mjs', async () => {
  const bridge = await readFile(new URL('../uno/Afterhours.Uno/Interop/GameHost.cs', import.meta.url), 'utf8');
  const host = await import('../dist/host.mjs');
  const imported = new Set([...bridge.matchAll(/\[JSImport\("(\w+)", Module\)\]/g)].map(m => m[1]));
  assert.ok(imported.size > 40, 'expected the bridge to import the host functions');
  for (const name of imported) assert.equal(typeof host[name], 'function', name + ' is not exported by host.mjs');
});

test('every room panel room tools asks for exists in the game', async () => {
  const game = await readFile(new URL('../dist/game.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../uno/Afterhours.Uno/Views/RoomToolsPage.xaml', import.meta.url), 'utf8');
  const asked = new Set([...page.matchAll(/Command="\{Binding Open\}" CommandParameter="(\w+)"/g)].map(m => m[1]));
  const panels = game.slice(game.indexOf('const roomPanels={'), game.indexOf('function saveRoomSettings('));
  assert.equal(asked.size, 6);
  for (const name of asked) assert.match(panels, new RegExp(`\\b${name}:`), name + ' is not a room panel in game.js');
});

test('every outfit part the wardrobe offers is one the game knows', () => {
  const W = require('../dist/wardrobe.js');
  const outfit = W.normalize({version: 1, hair: 'bob', top: 'tee', bottom: 'jeans', hairColor: 'silver', topColor: 'teal', bottomColor: 'ink', skin: 'deep'});
  assert.deepEqual(Object.keys(outfit).sort(), ['bottom', 'bottomColor', 'hair', 'hairColor', 'skin', 'top', 'topColor', 'version']);
  assert.equal(outfit.hairColor, 'silver');
});

test('every studio edit the app sends exists in the game', async () => {
  const game = await readFile(new URL('../dist/game.js', import.meta.url), 'utf8');
  const model = await readFile(new URL('../uno/Afterhours.Uno/Presentation/StudioModel.cs', import.meta.url), 'utf8');
  const sent = new Set([...model.matchAll(/Store\.Studio(?:Text)?\("(\w+)"/g)].map(m => m[1]));
  const ops = game.slice(game.indexOf('const studioOps={'), game.indexOf('function studioEdit('));
  assert.ok(sent.size >= 12, 'expected the studio model to send its edits');
  for (const op of sent) assert.match(ops, new RegExp(`\\b${op}:`), op + ' is not a studio edit in game.js');
});
