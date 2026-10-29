// Wave 0 spike check: drives the published Uno app in Chromium and records each risk's result.
// It targets the spike build (commit 9456eaa) and its test controls; scripts/verify-xaml.mjs checks the current app.
// Usage: node scripts/spike-wave0.mjs [baseUrl] [outDir]
import {createRequire} from 'node:module';
const {chromium} = createRequire(import.meta.url)('playwright');
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

const base = process.argv[2] || 'http://127.0.0.1:4177/';
const out = process.argv[3] || 'docs/spikes/wave0';
await mkdir(out, {recursive: true});
const results = {}, logs = [], errors = [];
const record = (key, pass, detail) => { results[key] = {pass, ...detail}; console.log(pass ? 'PASS' : 'FAIL', key, JSON.stringify(detail)); };

const browser = await chromium.launch({args: ['--autoplay-policy=user-gesture-required']});
const page = await browser.newPage({viewport: {width: 1440, height: 900}});
await page.addInitScript(() => {
  const Native = window.AudioContext;
  window.__contexts = [];
  window.AudioContext = class extends Native { constructor(...a) { super(...a); window.__contexts.push(this); } };
});
page.on('console', m => logs.push(m.text()));
page.on('pageerror', e => errors.push(e.message));
const failed = [];
page.on('requestfailed', r => failed.push(r.url() + ' ' + r.failure()?.errorText));
page.on('response', r => { if (r.status() >= 400) failed.push(r.url() + ' ' + r.status()); });

const started = Date.now();
await page.goto(base);
await page.waitForFunction(() => window.AfterhoursWorld && document.querySelector('.ah-root canvas#room'), null, {timeout: 120000});
await page.waitForTimeout(1500);
const ready = logs.find(l => l.startsWith('AH_SPIKE ready'));
record('R1 hosting', !!ready && !errors.length, {ready, msToReady: Date.now() - started, pageErrors: errors.slice(0, 5)});
await page.screenshot({path: path.join(out, '01-hosted.png')});

// Round trip: C# button -> JS dispatch -> JS state event -> C# TextBlock.
const coinsText = () => page.evaluate(() => [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^✦ \d+$/.test(e.textContent))?.textContent);
const before = await coinsText(), gameBefore = await page.evaluate(() => AfterhoursWorld.game.state.coins);
await page.getByText('Daily gift', {exact: true}).click();
await page.waitForTimeout(600);
const after = await coinsText(), gameAfter = await page.evaluate(() => AfterhoursWorld.game.state.coins);
const stateLogs = logs.filter(l => l.startsWith('AH_SPIKE state'));
record('R1 round trip', gameAfter === gameBefore + 35 && after === '✦ ' + gameAfter, {before, after, gameBefore, gameAfter, lastStateLog: stateLogs.at(-1)});

// R3: no scoped rule may match an element outside the hosted root.
const leaks = await page.evaluate(() => {
  const sheet = [...document.styleSheets].find(s => s.href?.endsWith('/game/scoped.css'));
  if (!sheet) return ['scoped.css missing'];
  const found = [];
  const walk = rules => { for (const r of rules) {
    if (r.cssRules && !(r instanceof CSSStyleRule)) { walk(r.cssRules); continue; }
    if (!(r instanceof CSSStyleRule)) continue;
    let hits = []; try { hits = [...document.querySelectorAll(r.selectorText)]; } catch {}
    const outside = hits.filter(e => !e.closest('.ah-root'));
    if (outside.length) found.push(r.selectorText + ' -> ' + outside[0].tagName);
  } };
  walk(sheet.cssRules);
  return found;
});
record('R3 css scope', leaks.length === 0, {leaks: leaks.slice(0, 10)});

// R6: the XAML font and letter spacing.
const font = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && e.textContent === 'afterhours xaml');
  const cs = getComputedStyle(el);
  const faces = [...document.fonts].map(f => f.family + ':' + f.status);
  const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
  const loaded = [...document.fonts].some(f => f.family.replace(/["']/g, '') === family && f.status === 'loaded');
  return {fontFamily: cs.fontFamily, loaded, letterSpacing: cs.letterSpacing, faces: [...new Set(faces)].slice(0, 12)};
});
// Uno registers an ms-appx font under a generated family name, so check that the element's face is loaded.
record('R6 font + spacing', font.loaded && font.letterSpacing === '2.7px', font);

// R4: typing into a XAML TextBox must not walk the avatar; the room must still take keys when focused.
const pos = () => page.evaluate(() => ({x: AfterhoursWorld.player.x, y: AfterhoursWorld.player.y}));
const input = page.locator('input[type=text], input:not([type]), textarea').first();
await input.click();
const p0 = await pos();
await page.keyboard.type('wasd wasd');
for (const k of ['ArrowUp', 'ArrowRight', 'ArrowDown']) { await page.keyboard.down(k); await page.waitForTimeout(250); await page.keyboard.up(k); }
await page.waitForTimeout(400);
const p1 = await pos(), typed = await input.inputValue();
await page.locator('.ah-root canvas#room').click({position: {x: 40, y: 40}});
await page.waitForTimeout(800);
const p2 = await pos();
await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
await page.waitForTimeout(500);
const p3 = await pos();
const moved = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) > 0.2;
record('R4 keys', !moved(p0, p1) && typed === 'wasd wasd' && moved(p2, p3), {p0, p1, typed, p2, p3});

// R2: a XAML flyout over the canvas takes pointer input, light-dismisses, and returns focus to the room.
await page.getByText('Open panel', {exact: true}).click();
await page.waitForTimeout(500);
const action = page.getByText('Count a click', {exact: true});
const box = await action.boundingBox(), canvasBox = await page.locator('.ah-root canvas#room').boundingBox();
const overCanvas = box && canvasBox && box.y > canvasBox.y && box.y < canvasBox.y + canvasBox.height;
const topElement = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return {tag: e.tagName, inRoom: !!e.closest('.ah-root')}; }, [box.x + box.width / 2, box.y + box.height / 2]);
await page.screenshot({path: path.join(out, '02-flyout-over-room.png')});
await action.click();
await page.waitForTimeout(300);
const status = await page.evaluate(() => [...document.querySelectorAll('*')].find(e => e.childElementCount === 0 && /^Flyout clicks/.test(e.textContent))?.textContent);
await page.mouse.click(canvasBox.x + canvasBox.width - 60, canvasBox.y + canvasBox.height - 60);
await page.waitForTimeout(600);
const dismissed = !(await action.isVisible().catch(() => false));
const focusInRoom = await page.evaluate(() => !!document.activeElement?.closest('.ah-root'));
record('R2 overlay', overCanvas && !topElement.inRoom && status === 'Flyout clicks 1' && dismissed && focusInRoom, {overCanvas, topElement, status, dismissed, focusInRoom});

// JS dialogs that are not migrated yet still open and close (top layer).
await page.locator('.ah-root #help').click();
await page.waitForTimeout(400);
const dialogOpen = await page.evaluate(() => document.querySelector('.ah-root #modal')?.open);
await page.screenshot({path: path.join(out, '03-js-dialog.png')});
await page.locator('.ah-root #closeModal').click();
const dialogClosed = await page.evaluate(() => !document.querySelector('.ah-root #modal')?.open);
record('R2 js dialog', dialogOpen && dialogClosed, {dialogOpen, dialogClosed});

// Navigation "!" route: a Page opens as a flyout over the room and its MVUX command works.
const route = page.getByText('Open route panel', {exact: true});
if (await route.count()) {
  await route.click();
  await page.waitForTimeout(800);
  const title = page.getByText('A route panel over the room', {exact: true});
  const shown = await title.isVisible().catch(() => false);
  const routeBox = await page.getByText('Count with MVUX', {exact: true}).boundingBox().catch(() => null);
  const roomBox = await page.locator('.ah-root canvas#room').boundingBox();
  const routeOverCanvas = !!routeBox && routeBox.y > roomBox.y && routeBox.y < roomBox.y + roomBox.height;
  await page.screenshot({path: path.join(out, '04-route-flyout.png')});
  await page.getByText('Count with MVUX', {exact: true}).click();
  await page.waitForTimeout(500);
  const counted = await page.evaluate(() => [...document.querySelectorAll('*')].some(e => e.childElementCount === 0 && e.textContent === '1' && !e.closest('.ah-root')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);
  const closed = !(await title.isVisible().catch(() => false));
  record('Navigation ! route', shown && routeOverCanvas && counted && closed, {shown, routeOverCanvas, counted, closed});
}

// Audio: a click on a XAML button starts the game's AudioContext under the real autoplay policy.
await page.getByText('Play beat', {exact: true}).click();
await page.waitForTimeout(1200);
const audio = await page.evaluate(() => window.__contexts.map(c => c.state));
record('Audio from XAML', audio.includes('running'), {contexts: audio});
await page.evaluate(() => AfterhoursWorld.stopMusic());

// R8: state size and C# parse time.
const sizes = logs.filter(l => l.startsWith('AH_SPIKE state')).map(l => Object.fromEntries(l.split(' ').slice(2).map(p => p.split('='))));
record('R8 state volume', true, {events: sizes.length, last: sizes.at(-1)});

record('No page errors', errors.length === 0, {errors: errors.slice(0, 5)});
const local = failed.filter(f => f.startsWith(base));
record('No failed local requests', local.length === 0, {local: local.slice(0, 10), external: failed.filter(f => !f.startsWith(base)).slice(0, 5)});
const art = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/game/assets/')).map(e => e.name.split('/').pop() + ':' + e.responseStatus));
record('Room art loads from game/assets', art.length >= 8 && art.every(a => a.endsWith(':200')), {art});
await writeFile(path.join(out, 'results.json'), JSON.stringify({base, date: new Date().toISOString(), results}, null, 2));
await browser.close();
