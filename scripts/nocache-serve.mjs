import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = process.argv[2] ?? 'dist';
const port = Number(process.argv[3] ?? 8080);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = normalize(join(root, urlPath === '/' ? 'index.html' : urlPath));
  if (!filePath.startsWith(normalize(root))) filePath = join(root, 'index.html');
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(root, 'index.html');

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', mime[extname(filePath)] ?? 'application/octet-stream');
  createReadStream(filePath).pipe(res);
});

server.listen(port, () => console.log(`no-cache static server on http://localhost:${port} (root: ${root})`));
