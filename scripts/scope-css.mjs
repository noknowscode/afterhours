// Scopes the game's global stylesheets under one root class so they can share a page with Uno.
// :root, html and body become the root itself; every other selector is prefixed.
// @import, @font-face and @keyframes move to the top level unchanged.
export function scopeCss(css, root = '.ah-root') {
  const hoisted = [], out = [];
  let i = 0;
  const skipString = j => { const q = css[j]; j++; while (j < css.length && css[j] !== q) j += css[j] === '\\' ? 2 : 1; return j + 1; };
  const blockEnd = j => {
    let depth = 0;
    for (; j < css.length; j++) {
      const c = css[j];
      if (c === '"' || c === "'") { j = skipString(j) - 1; continue; }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return j + 1;
    }
    throw Error('Unbalanced CSS block');
  };
  const scopeSelector = s => {
    s = s.trim();
    const m = s.match(/^(:root|html|body)(?![\w-])/);
    return m ? root + s.slice(m[0].length) : root + ' ' + s;
  };
  const splitList = list => {
    const parts = []; let depth = 0, start = 0;
    for (let j = 0; j < list.length; j++) {
      const c = list[j];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === ',' && !depth) { parts.push(list.slice(start, j)); start = j + 1; }
    }
    parts.push(list.slice(start));
    return parts;
  };
  function rules(end, target) {
    while (i < end) {
      while (i < end && /\s/.test(css[i])) i++;
      if (i >= end || css[i] === '}') { i++; continue; }
      if (css.startsWith('/*', i)) { i = css.indexOf('*/', i) + 2; continue; }
      let j = i;
      while (j < end && css[j] !== '{' && css[j] !== ';') j = css[j] === '"' || css[j] === "'" ? skipString(j) : j + 1;
      const prelude = css.slice(i, j).trim();
      if (css[j] === ';') { hoisted.push(prelude + ';'); i = j + 1; continue; }
      const close = blockEnd(j);
      if (/^@(font-face|keyframes|-webkit-keyframes)/.test(prelude)) hoisted.push(css.slice(i, close));
      else if (/^@(media|supports|container|layer)/.test(prelude)) {
        const inner = [];
        i = j + 1; rules(close - 1, inner); target.push(prelude + '{' + inner.join('') + '}');
      } else target.push(splitList(prelude).map(scopeSelector).join(',') + css.slice(j, close));
      i = close;
    }
  }
  rules(css.length, out);
  return hoisted.join('') + out.join('');
}
