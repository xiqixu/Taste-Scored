// A dependency-free local server. Run `node preview.mjs`, or double-click
// START-PRE-MODE.cmd on Windows. GitHub Pages does not need this file.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.webp':'image/webp','.woff2':'font/woff2','.mp4':'video/mp4','.txt':'text/plain; charset=utf-8'};
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Invalid URL'); return; }
  let file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    let stat = fs.statSync(file);
    if (stat.isDirectory()) { file = path.join(file, 'index.html'); stat = fs.statSync(file); }
    if (!stat.isFile()) throw new Error('Not a file');
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Content-Length': stat.size, 'Cache-Control':'no-cache'});
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  } catch { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('File not found'); }
});
server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/${process.argv.includes('--pre') ? '?pre=1#act-wheel' : ''}`;
  console.log(`Taste, scored — Original website + Pre overlay\n\n${url}\n\nKeep this window open. Press Ctrl+C to stop.`);
  if (process.platform === 'win32') {
    execFile('powershell.exe', ['-NoProfile','-Command',`Start-Process '${url}'`], {windowsHide:true});
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  }
});

