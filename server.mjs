import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || '127.0.0.1';
const publicFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']],
  ['/roman-standalone.html', ['roman-standalone.html', 'text/html; charset=utf-8']]
]);
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let pathname;
  try { pathname = new URL(req.url, `http://${host}:${port}`).pathname; }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  const entry = publicFiles.get(pathname);
  if (!entry) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Страница не найдена'); return; }
  try {
    const contents = await readFile(path.join(root, entry[0]));
    res.writeHead(200, {
      'Content-Type': entry[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin', 'Content-Length': contents.length
    });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch { res.writeHead(500); res.end('Не удалось загрузить файл'); }
});
server.listen(port, host, () => console.log(`Сайт Романа запущен: http://${host}:${port}`));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
