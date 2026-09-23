import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const load = name => readFile(path.join(root, name), 'utf8');
const [html, css, js, favicon] = await Promise.all(['index.html', 'styles.css', 'app.js', 'favicon.svg'].map(load));
const standalone = html
  .replace('<link rel="icon" href="favicon.svg" type="image/svg+xml">', () => `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon.trim())}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="app.js" defer></script>', '')
  .replace('</body>', () => `<script>\n${js}\n</script>\n</body>`);
await writeFile(path.join(root, 'roman-standalone.html'), standalone, 'utf8');
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'favicon.svg']) {
  await copyFile(path.join(root, file), path.join(root, 'dist', file));
}
// Dependency-free ZIP (stored entries): rebuild the handoff alongside the HTML.
const archiveFiles = ['index.html', 'styles.css', 'app.js', 'favicon.svg', 'package.json',
  'server.mjs', 'build.mjs', 'tests.mjs', 'Промпт.txt', 'Запуск.txt', 'roman-standalone.html',
  'dist/index.html', 'dist/styles.css', 'dist/app.js', 'dist/favicon.svg'];
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const localParts = [], centralParts = [];
let offset = 0;
for (const file of archiveFiles) {
  const name = Buffer.from(file, 'utf8');
  const data = await readFile(path.join(root, file));
  const crc = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // UTF-8 filenames
  local.writeUInt16LE(33, 12); // ZIP baseline date, deterministic output
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  localParts.push(local, name, data);
  centralParts.push(central, name);
  offset += local.length + name.length + data.length;
}
const directory = Buffer.concat(centralParts);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(archiveFiles.length, 8);
end.writeUInt16LE(archiveFiles.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
await writeFile(path.join(root, 'roman-digital-site.zip'), Buffer.concat([...localParts, directory, end]));
console.log('Готово: dist/ — статический сайт; roman-standalone.html — автономная версия; roman-digital-site.zip — актуальный архив.');
