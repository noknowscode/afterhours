import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scopeCss} from '../scripts/scope-css.mjs';

// Splits top-level CSS into [prelude, body] pairs (enough for the minified game sheets).
function rules(css) {
  const out = [];
  for (let i = 0, depth = 0, start = 0, open = -1; i < css.length; i++) {
    if (css[i] === '{') { if (!depth) open = i; depth++; }
    else if (css[i] === '}' && --depth === 0) { out.push([css.slice(start, open).trim(), css.slice(open + 1, i)]); start = i + 1; }
  }
  return out;
}

function unscoped(css) {
  const bad = [];
  for (const [prelude, body] of rules(css)) {
    if (/^@(font-face|keyframes|-webkit-keyframes)/.test(prelude)) continue;
    if (/^@(media|supports|container|layer)/.test(prelude)) { bad.push(...unscoped(body)); continue; }
    if (prelude.startsWith('@')) continue;
    for (const selector of prelude.split(/,(?![^(]*\))/)) if (!selector.trim().startsWith('.ah-root')) bad.push(selector.trim());
  }
  return bad;
}

test('root, html and body become the host root; other selectors are prefixed', () => {
  assert.equal(scopeCss(':root{--a:1}body.x .y{a:b}*{c:d}'), '.ah-root{--a:1}.ah-root.x .y{a:b}.ah-root *{c:d}');
  assert.equal(scopeCss('a,b:not(.c,.d){e:f}'), '.ah-root a,.ah-root b:not(.c,.d){e:f}');
});

test('media queries recurse; imports, fonts and keyframes are hoisted unchanged', () => {
  const out = scopeCss('.a{x:y}@media(max-width:9px){body{z:1}}@keyframes s{to{o:1}}@import url("f.css");');
  assert.ok(out.startsWith('@keyframes s{to{o:1}}@import url("f.css");'));
  assert.ok(out.includes('@media(max-width:9px){.ah-root{z:1}}'));
});

test('every rule in the game stylesheets ends up under .ah-root', async () => {
  for (const name of ['style', 'game', 'room-view', 'wardrobe']) {
    const css = await readFile(new URL(`../dist/${name}.css`, import.meta.url), 'utf8');
    assert.deepEqual(unscoped(scopeCss(css)), [], name + '.css');
  }
});
