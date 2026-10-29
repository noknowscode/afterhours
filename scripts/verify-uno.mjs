import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {scopeCss} from './scope-css.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

export async function verifyUnoRelease(publish) {
  let webroot = publish;
  try { await readFile(path.join(webroot, 'index.html')); }
  catch { webroot = path.join(publish, 'wwwroot'); }
  const html = await readFile(path.join(webroot, 'index.html'), 'utf8');
  const packageName = html.match(/(package_[a-f0-9]+)\/uno-bootstrap\.js/)?.[1];
  if (!packageName) throw Error('The published Uno bootstrap is missing.');
  const config = await readFile(path.join(webroot, packageName, 'uno-config.js'), 'utf8');
  if (config.includes('/AfterhoursInterop.js')) throw Error('The retired WebView compatibility script is still published.');
  // The game shares the page with Uno, so its CSS must be the scoped build of the current sources.
  const sheets = await Promise.all(['style', 'game', 'room-view', 'wardrobe'].map(n => readFile(path.join(root, 'dist', n + '.css'), 'utf8')));
  const scoped = await readFile(path.join(webroot, 'game', 'scoped.css'), 'utf8');
  if (scoped !== scopeCss(sheets.join('\n'))) throw Error('The published scoped game CSS is out of date.');
  const frameworkFiles = await readdir(path.join(webroot, '_framework'));
  if (!frameworkFiles.some(name => name.endsWith('.wasm'))) throw Error('The compiled WebAssembly runtime is missing.');
  let gameFiles = 0;
  for (const relative of await readdir(path.join(root, 'dist'), {recursive: true, withFileTypes: true})) {
    if (!relative.isFile()) continue;
    const source = path.join(relative.parentPath, relative.name);
    const target = path.join(webroot, 'game', path.relative(path.join(root, 'dist'), source));
    if (!(await readFile(source)).equals(await readFile(target))) {
      throw Error(`Published game asset is out of date: ${path.relative(root, source)}`);
    }
    gameFiles++;
  }
  console.log(`Uno release verified: compiled runtime, scoped game CSS and ${gameFiles} current game files.`);
  return {webroot, packageName};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await verifyUnoRelease(path.resolve(process.argv[2] || path.join(root, 'release/uno')));
}
