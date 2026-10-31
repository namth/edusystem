// Server văn phòng ảo: phục vụ trang và đẩy sự kiện mới trong events.jsonl qua SSE.
// Không phụ thuộc thư viện ngoài; chỉ đọc file khi fs.watch báo có thay đổi.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS_FILE, appendEvent, isEvent } from './events.mjs';

const PORT = Number(process.env.OFFICE_PORT || 4317);
const INDEX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public', 'index.html');
const REPLAY_BYTES = 256 * 1024;
const REPLAY_LINES = 400;
const MAX_BYTES = 5 * 1024 * 1024;

fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '');
if (fs.statSync(EVENTS_FILE).size > MAX_BYTES) {
  fs.writeFileSync(EVENTS_FILE, readTail().map((e) => JSON.stringify(e) + '\n').join(''));
}

const clients = new Set();
let offset = fs.statSync(EVENTS_FILE).size;
let partial = '';
let pending = null;

function parse(line) {
  try {
    const e = JSON.parse(line);
    return isEvent(e) ? e : null;
  } catch {
    return null;
  }
}

function readRange(start, end) {
  const buf = Buffer.alloc(end - start);
  const fd = fs.openSync(EVENTS_FILE, 'r');
  try {
    fs.readSync(fd, buf, 0, buf.length, start);
  } finally {
    fs.closeSync(fd);
  }
  return buf.toString('utf8');
}

function readTail() {
  const { size } = fs.statSync(EVENTS_FILE);
  const start = Math.max(0, size - REPLAY_BYTES);
  const lines = readRange(start, size).split('\n');
  if (start > 0) lines.shift(); // dòng đầu có thể bị cắt dở
  return lines.map(parse).filter(Boolean).slice(-REPLAY_LINES);
}

function readNew() {
  pending = null;
  let size;
  try {
    size = fs.statSync(EVENTS_FILE).size;
  } catch {
    return;
  }
  if (size < offset) {
    offset = 0; // file bị cắt ngắn / xoay vòng
    partial = '';
  }
  if (size === offset) return;
  const lines = (partial + readRange(offset, size)).split('\n');
  offset = size;
  partial = lines.pop();
  for (const line of lines) {
    const e = parse(line);
    if (e) broadcast(e);
  }
}

function broadcast(e) {
  const msg = `data: ${JSON.stringify(e)}\n\n`;
  for (const res of clients) res.write(msg);
}

const schedule = () => {
  pending ??= setTimeout(readNew, 30);
};
fs.watch(path.dirname(EVENTS_FILE), (_, name) => {
  if (!name || name === path.basename(EVENTS_FILE)) schedule();
});
setInterval(schedule, 3000); // phòng khi fs.watch bỏ sót
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000);

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      fs.createReadStream(INDEX).pipe(res);
      return;
    }

    if (req.method === 'GET' && pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write('retry: 2000\n\n');
      res.write(`data: ${JSON.stringify({ replay: readTail() })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (req.method === 'POST' && pathname === '/emit') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 8192) req.destroy();
      });
      req.on('end', () => {
        const e = parse(body);
        if (!e) return res.writeHead(400).end();
        appendEvent({ who: e.who, type: e.type, to: e.to, task: e.task, text: e.text });
        res.writeHead(204).end();
      });
      return;
    }

    res.writeHead(404).end();
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`Văn phòng ảo: http://localhost:${PORT}`);
    console.log(`Đọc sự kiện từ: ${EVENTS_FILE}`);
  });
