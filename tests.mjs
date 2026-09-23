import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = path.dirname(fileURLToPath(import.meta.url));
const html = await readFile(path.join(root, 'index.html'), 'utf8');
const css = await readFile(path.join(root, 'styles.css'), 'utf8');
const js = await readFile(path.join(root, 'app.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'HTML IDs must be unique');
for (const [, href] of html.matchAll(/href="#([^"]*)"/g)) {
  if (href) assert(ids.includes(href), `Missing anchor: ${href}`);
}
for (const [, id] of js.matchAll(/\$\('#([\w-]+)'\)/g)) assert(ids.includes(id), `Missing JS target: ${id}`);
for (const [, target] of html.matchAll(/(?:src|href)="([^"#:]+\.(?:css|js|svg))"/g)) await access(path.join(root, target));
assert.equal((html.match(/data-request=/g) || []).length, 4, 'Four request buttons');
assert.equal((html.match(/data-category="digital"/g) || []).length, 3, 'Three digital cards');
assert.equal((html.match(/data-category="dev"/g) || []).length, 1, 'One development card');
assert.equal((html.match(/<details>/g) || []).length, 4, 'Four FAQ entries');
assert(html.includes('lang="ru"'), 'Russian page language');
assert(html.includes('aria-live="polite"'), 'Accessible status messages');
assert(css.includes('prefers-reduced-motion:reduce'), 'Reduced-motion support');
assert(css.includes('@media(max-width:480px)'), 'Phone layout');
assert(!/https?:\/\//.test(css), 'No external styles/assets');
assert(!/fetch\(|XMLHttpRequest|localStorage|sessionStorage/.test(js), 'Brief does not leave the client or persist');
for (const [, link] of html.matchAll(/href="(https?:[^\"]+)"/g)) assert.equal(link, 'https://t.me/no_i_lord', 'Only approved external contact');
assert.equal((html.match(/class="material-button/g) || []).length, 3, 'Three sculpture materials');
assert.equal((html.match(/data-terminal-command=/g) || []).length, 7, 'Terminal command shortcuts');
assert(html.includes('id="command-dialog"'), 'Command palette');
assert(html.includes('id="terminal-form"'), 'Local terminal');
assert(html.includes('id="quick-dock"'), 'Quick dock');
assert(html.includes('id="brief-download"'), 'Brief export');
assert(!/\beval\s*\(|new Function\s*\(|\.innerHTML\s*=/.test(js), 'No dynamic execution or unsafe HTML insertion');
assert(js.includes("event.code === 'KeyK'"), 'Layout-independent command keyboard shortcut');
assert(js.includes('effectschange'), 'Global effect control');
new vm.Script(js, { filename: 'app.js' });
const full = await readFile(path.join(root, 'roman-standalone.html'), 'utf8');
assert(!full.includes('src="app.js"'), 'Standalone has inline JavaScript');
assert(!full.includes('href="styles.css"'), 'Standalone has inline CSS');
assert(full.includes('data:image/svg+xml,'), 'Standalone favicon embedded');
assert(full.includes(js), 'Standalone contains latest script');
assert(full.includes(css), 'Standalone contains latest styles');
for (const file of ['index.html', 'styles.css', 'app.js', 'favicon.svg']) {
  assert.deepEqual(await readFile(path.join(root, 'dist', file)), await readFile(path.join(root, file)), `dist is current: ${file}`);
}
const zip = await readFile(path.join(root, 'roman-digital-site.zip'));
const archiveNames = [];
let offset = 0;
while (zip.readUInt32LE(offset) === 0x04034b50) {
  assert.equal(zip.readUInt16LE(offset + 8), 0, 'Archive uses stored entries');
  assert.equal(zip.readUInt16LE(offset + 6), 0x0800, 'UTF-8 archive filenames');
  const size = zip.readUInt32LE(offset + 18);
  const nameLength = zip.readUInt16LE(offset + 26);
  const extraLength = zip.readUInt16LE(offset + 28);
  const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
  assert(!name.includes('..') && !path.isAbsolute(name), 'Safe archive entry');
  const start = offset + 30 + nameLength + extraLength;
  assert.deepEqual(zip.subarray(start, start + size), await readFile(path.join(root, name)), `Archive is current: ${name}`);
  archiveNames.push(name);
  offset = start + size;
}
const expectedFiles = ['index.html', 'styles.css', 'app.js', 'favicon.svg', 'package.json', 'server.mjs', 'build.mjs', 'tests.mjs', 'Промпт.txt', 'Запуск.txt', 'roman-standalone.html', 'dist/index.html', 'dist/styles.css', 'dist/app.js', 'dist/favicon.svg'];
assert.deepEqual(archiveNames.sort(), expectedFiles.sort(), 'Complete source and deployment archive');
assert.equal(zip.readUInt32LE(offset), 0x02014b50, 'ZIP central directory');
assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50, 'ZIP end record');
console.log(`PASS: ${ids.length} unique IDs, anchors, JS syntax, UI hooks, self-contained HTML, matching dist, and ${archiveNames.length} current ZIP entries.`);
