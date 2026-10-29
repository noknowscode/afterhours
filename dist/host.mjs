// Mounts the game inside an element owned by the Uno app, in the same page.
// The C# side imports this module with JSHost.ImportAsync and passes a callback for events.
// The game keeps every rule and every write; this module reports what it shows and forwards
// XAML commands to the game's own buttons, so no game logic is repeated here.
const base = new URL('./', import.meta.url);

// XAML command name -> the game element whose click handler performs it.
export const commands = Object.freeze({
  wave: '#wave', dance: '#dance', stand: '#standUp', decorate: '#decorate',
  rotate: '#rotateFurniture', store: '#storeFurniture', undo: '#undoFurniture', inventory: '#openInventory', finish: '#finishEditing',
  play: '#play', studio: '#studioOpen', look: '[data-view="look"]', home: '#travelHome',
  profile: '#profile', help: '#help', rooms: '#allRooms', favorite: '#saveRoom',
  journal: '#questsOpen', arcade: '#arcadeOpen', stage: '#stageOpen', myRooms: '#myRoomsOpen',
  companion: '#petOpen', roomTools: '#roomTools', daily: '#dailyClaim', friends: '#friendsTab', chatPrefs: '#socialSettings',
  shared: '#connectionLabel'
});

// Top-level save keys whose JSON changed since the last push.
export function diffSlices(state, sent) {
  const changed = {};
  for (const [key, value] of Object.entries(state)) {
    const json = JSON.stringify(value);
    if (sent[key] !== json) { sent[key] = json; changed[key] = value; }
  }
  return Object.keys(changed).length ? changed : null;
}

// The numbers the old top bar and resident card showed, computed with the game's own rules.
export function hudFrom(s, G) {
  const level = G.level(s), next = G.quests.find(q => !s.claimed.includes(q.id));
  return {
    coins: s.coins, name: s.profile.name, level, xp: s.profile.xp,
    xpLower: (level - 1) ** 2 * 100, xpUpper: level * level * 100,
    questsReady: G.quests.filter(q => !s.claimed.includes(q.id) && G.progress(s, q) >= q.target).length,
    nextQuest: next ? next.name : 'The night is yours',
    nextQuestDetail: next ? `${Math.min(next.target, G.progress(s, next))} / ${next.target} · ${next.reward} credits`
      : 'Make a track. Build a room. Meet someone.',
    dailyClaimed: s.lastCheckin === G.day(), dailyLabel: s.lastCheckin === G.day() ? 'Checked in ✓' : 'Daily gift · 35 ✦',
    chatColor: s.profile.chatColor
  };
}

export function chromeFrom(root, world, body) {
  const q = sel => root.querySelector(sel), text = sel => q(sel)?.textContent.trim() ?? '';
  const enabled = sel => !!q(sel) && !q(sel).disabled, scene = world.getScene();
  return {
    room: {
      key: world.roomKey(), title: text('#roomTitle').replace(/\.$/, ''), eyebrow: text('.room-heading .eyebrow'),
      meta: text('#roomMeta'), guests: Number(text('#guestCount')) || 0, saved: !!q('#saveRoom')?.classList.contains('is-saved'),
      personal: !!scene.personal, index: scene.roomIndex
    },
    editor: {
      active: !!q('#roomEditor') && !q('#roomEditor').hidden, title: text('#selectedFurniture'), hint: text('#editorHint'),
      canRotate: enabled('#rotateFurniture'), canStore: enabled('#storeFurniture'), canUndo: enabled('#undoFurniture')
    },
    actions: { dancing: /stop/i.test(text('#dance')), seated: !!q('#standUp') && !q('#standUp').hidden },
    nowPlaying: {
      title: text('#trackTitle'), subtitle: text('.track p'), playing: !!body?.classList.contains('is-playing'),
      progress: parseFloat(q('.progress i')?.style.width) || 0, time: text('#playTime')
    },
    connection: { label: text('#connectionLabel'), connected: !!window.AfterhoursOnline?.connected?.() }
  };
}

export function chatFrom(root, colourOf) {
  return [...root.querySelectorAll('#messages .message')].map(el => {
    const system = el.classList.contains('system'), name = system ? '' : el.querySelector('b')?.textContent ?? '';
    return { system, name, text: system ? el.textContent : el.querySelector('p')?.textContent ?? '', color: system ? '' : colourOf(name) };
  });
}

let sink = () => {}, world = null, root = null, frame = 0, saved = false;
const sent = { slices: {}, parts: {} };

function emit(event) {
  try { sink(JSON.stringify(event)); } catch (e) { console.error('Afterhours host event failed', e); }
}

function emitIfChanged(type, value) {
  const json = JSON.stringify(value);
  if (sent.parts[type] === json) return;
  sent.parts[type] = json;
  emit({ type, [type]: value });
}

function colourOf(name) {
  const s = world.game.state;
  if (name === s.profile.name) return s.profile.chatColor;
  const peer = window.AfterhoursOnline?.peers?.().find(p => p.name === name);
  if (peer?.chatColor) return peer.chatColor;
  return (typeof people !== 'undefined' ? people.find(p => p.name === name)?.chatColor : '') || '';
}

function portrait() {
  const s = world.game.state, key = JSON.stringify([s.profile.outfit, world.getScene().spriteIndex]);
  if (sent.parts.portraitKey === key) return;
  const art = root.querySelector('.topbar .profile-art'), custom = art?.querySelector('canvas');
  const out = document.createElement('canvas'); out.width = 68; out.height = 72;
  const ctx = out.getContext('2d');
  if (custom) { const w = 72 * custom.width / custom.height; ctx.drawImage(custom, (68 - w) / 2, 0, w, 72); }
  else {
    const img = world.spriteImage;
    if (!img.complete || !img.naturalWidth) return;
    const w = img.naturalWidth / 6, scale = img.naturalHeight / 70, i = world.getScene().spriteIndex;
    ctx.drawImage(img, i * w, 4 * scale, w * 34 / 35, 36 * scale, 0, 0, 68, 72);
  }
  sent.parts.portraitKey = key;
  emit({ type: 'portrait', png: out.toDataURL('image/png') });
}

function flush() {
  frame = 0;
  const s = world.game.state;
  if (saved) { saved = false; const slices = diffSlices(s, sent.slices); if (slices) emit({ type: 'slices', slices }); }
  emitIfChanged('hud', hudFrom(s, window.AfterhoursGame));
  emitIfChanged('chrome', chromeFrom(root, world, document.body));
  emitIfChanged('chat', { lines: chatFrom(root, colourOf), whisperTargets: [...root.querySelectorAll('#whisperTarget option')].map(o => ({ id: o.value, name: o.textContent })) });
  portrait();
}

function schedule() { if (!frame) frame = requestAnimationFrame(flush); }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(src, base).href;
    script.onload = resolve;
    script.onerror = () => reject(Error('Could not load ' + src));
    document.head.append(script);
  });
}

function loadStyle(name) {
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = new URL(name, base).href;
  const loaded = new Promise(resolve => { link.onload = resolve; link.onerror = resolve; });
  document.head.append(link);
  return loaded;
}

export async function mount(elementId, onEvent) {
  sink = onEvent;
  root = document.getElementById(elementId);
  if (!root) throw Error('Missing host element ' + elementId);
  root.classList.add('ah-root', 'ah-hosted');
  // Game scripts load art by relative path; resolve it against game/ instead of the Uno page.
  window.AfterhoursBase = base.href;
  // Game code asks for the XAML panels (shop, blueprints, gift wrap…) and reports live state (playback) here.
  window.AfterhoursHost = {
    open: (route, data = {}) => emit({ type: 'open', route, data }),
    notify: (type, data) => emit({ type, [type]: data }),
  };

  const styled = Promise.all([loadStyle('scoped.css'), loadStyle('hosted.css')]);
  const page = new DOMParser().parseFromString(await (await fetch(new URL('index.html', base))).text(), 'text/html');
  const scripts = [...page.querySelectorAll('script[src]')].map(s => s.getAttribute('src'));
  for (const node of [...page.body.childNodes]) if (node.nodeName !== 'SCRIPT') root.append(document.importNode(node, true));
  await styled;
  for (const src of scripts) await loadScript(src);

  world = window.AfterhoursWorld;
  const save = world.game.save.bind(world.game);
  world.game.save = (...args) => { const out = save(...args); saved = true; schedule(); return out; };
  new MutationObserver(schedule).observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  world.spriteImage.addEventListener('load', schedule);

  emit({ type: 'ready', scripts: scripts.length, publicRooms: rooms.map((r, index) => ({ index, title: r.title, owner: r.owner, mood: r.mood, count: r.count, icon: r.icon, tag: r.tag })) });

  saved = true; flush();
  // The shop sends atlas sizes, so it goes out once every furniture atlas has decoded.
  Promise.all(world.shopImages().map(img => img.decode().catch(() => {}))).then(() => emit({ type: 'shop', shop: world.shopData() }));
}

// Runs a game command by clicking the element the game wired for it. Returns false if it is unavailable.
export function invoke(name) {
  const selector = commands[name], el = selector && root.querySelector(selector);
  if (!el || el.disabled) return false;
  el.click();
  return true;
}

// Enters a public room through the game's own travel button, so shared-world behaviour applies too.
export function travel(index) {
  const stop = root.querySelector(`.room-journey [data-travel="${Number(index)}"]`);
  if (!stop || stop.disabled) return false;
  stop.click();
  return true;
}

export function say(text, mode, target) {
  const form = root.querySelector('#chatForm'), input = root.querySelector('#chatInput'), modes = root.querySelector('#chatMode');
  if (!form || !input || !text.trim()) return false;
  if (modes && mode && modes.value !== mode) { modes.value = mode; modes.dispatchEvent(new Event('change')); }
  const targets = root.querySelector('#whisperTarget');
  if (targets && target) targets.value = target;
  input.value = text;
  form.requestSubmit();
  return true;
}

export function focusRoom() { world.canvas.focus(); }

// Writes. Each runs the game's own action and replies with {ok, error, result} as JSON.
const reply = out => JSON.stringify({ ok: !!out?.ok, error: out?.error ?? null, result: out?.result ?? null });
export function buy(type) { const out = world.act('buy', { type }, 'Added to your collection.'); return reply({ ...out, result: out.ok ? { id: out.result.id } : null }); }
export async function place(id) { return reply({ ok: await world.placeItem(id) }); }
export function use(id) { return reply(world.useItem(id)); }
export function wrap(id, content, note) { return reply(world.wrapGift(id, content, note)); }
export function saveBlueprint() { return reply(world.saveBlueprint()); }
export function restoreBlueprint(id) { return reply(world.restoreBlueprint(id)); }
export function playDisc(id) { return reply({ ok: world.playDisc(id) }); }

// Studio and library. A studio edit replies with the whole draft and whether Undo is available.
export function studio(op, a, b) { return reply(world.studioEdit(op, a, b)); }
export function playTrack(id) { return reply({ ok: world.playTrack(id) }); }
export async function exportWav() { return reply(await world.exportWav()); }
export function pressDisc(id) { return reply(world.pressDisc(id)); }
export function deleteSong(id) { return reply(world.deleteSong(id)); }
export function perform(id) { world.perform(id); return reply({ ok: true }); }
export function savePlaylist(ids) { return reply(world.savePlaylist(JSON.parse(ids))); }
export function playPlaylist(ids) { world.savePlaylist(JSON.parse(ids)); world.startPlaylist(); return reply({ ok: true }); }

// The stage (solo or shared). While the app's stage panel watches, its state is sent when it changes (the
// countdown and progress move about four times a second); the game opens the panel itself only when it is closed.
let stageTimer = null;
export function stage(op, id) { return reply(world.stageAct(op, id)); }
export function stageWatch(on) {
  world.stageAct('watch', on);
  clearInterval(stageTimer);
  stageTimer = null;
  delete sent.parts.stage;
  if (on) {
    const push = () => emitIfChanged('stage', world.stageState());
    push();
    stageTimer = setInterval(push, 250);
  }
}
