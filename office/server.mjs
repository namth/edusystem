// Server văn phòng ảo: phục vụ trang và đẩy sự kiện mới trong events.jsonl qua SSE.
// Không phụ thuộc thư viện ngoài; chỉ đọc file khi fs.watch báo có thay đổi.
//
//   node office/server.mjs              chỉ máy này xem/gửi được (127.0.0.1)
//   OFFICE_LAN=1 node office/server.mjs mở cho máy khác trong mạng LAN, bắt buộc token
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS_FILE, ROLES, appendEvent, isEvent } from './events.mjs';
import { mainRepoRoot, watchHandoff } from './handoff-watch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.OFFICE_PORT || 4317);
const LAN = process.env.OFFICE_LAN === '1';
const INDEX = path.join(HERE, 'public', 'index.html');
const DATA_DIR = path.dirname(EVENTS_FILE);
const PRESENCE_FILE = path.join(DATA_DIR, 'presence.json');
const TOKEN_FILE = path.join(DATA_DIR, 'token');
const REPLAY_BYTES = 256 * 1024;
const REPLAY_LINES = 400;
const MAX_BYTES = 5 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, '');
if (fs.statSync(EVENTS_FILE).size > MAX_BYTES) {
  fs.writeFileSync(EVENTS_FILE, readTail().map((e) => JSON.stringify(e) + '\n').join(''));
}

const TOKEN = process.env.OFFICE_TOKEN || loadToken();
const clients = new Set();
const taskInfo = new Map(); // task id → { owner, last }
const presence = loadPresence(); // nhân sự máy khác → { host, ip, platform, lastSeen }
let offset = fs.statSync(EVENTS_FILE).size;
let partial = '';
let pending = null;

function loadToken() {
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  } catch {
    const token = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(TOKEN_FILE, token + '\n', { mode: 0o600 });
    return token;
  }
}

function loadPresence() {
  try {
    return JSON.parse(fs.readFileSync(PRESENCE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

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

// Ghi nhớ ai đang giữ task nào, để sự kiện từ handoff gán đúng người và không bị báo trùng.
function track(e) {
  if (!e.task) return;
  const info = taskInfo.get(e.task) ?? {};
  if (e.who.startsWith('agy')) info.owner = e.who;
  else if (e.to?.startsWith('agy')) info.owner = e.to;
  if (e.type !== 'work') info.last = e.type;
  taskInfo.set(e.task, info);
}
readTail().forEach(track);

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
    if (!e) continue;
    track(e);
    broadcast(e);
  }
}

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}

const schedule = () => {
  pending ??= setTimeout(readNew, 30);
};
fs.watch(DATA_DIR, (_, name) => {
  if (!name || name === path.basename(EVENTS_FILE)) schedule();
});
setInterval(schedule, 3000); // phòng khi fs.watch bỏ sót
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n');
}, 25000);

const mainRoot = process.env.OFFICE_REPO || mainRepoRoot(HERE);
watchHandoff({
  mainRoot,
  worktreeDir: process.env.AGY_WT_DIR || path.join(path.dirname(mainRoot), 'agy-worktrees'),
  agent: process.env.OFFICE_LOCAL_AGENT || 'agy1',
  taskInfo: (id) => taskInfo.get(id),
  emit: appendEvent,
});

// ---------- HTTP ----------
const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const clientIp = (req) => String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');

function authorized(req, url) {
  if (isLocal(req)) return true;
  const given = req.headers['x-office-token'] || url.searchParams.get('token') || '';
  return given.length === TOKEN.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(TOKEN));
}

function readJson(req, cb) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 8192) req.destroy();
  });
  req.on('end', () => {
    try {
      cb(JSON.parse(body));
    } catch {
      cb(null);
    }
  });
}

const presenceMessage = () => ({ presence, now: Date.now() });

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!authorized(req, url)) return res.writeHead(401).end('Sai hoặc thiếu token');

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      fs.createReadStream(INDEX).pipe(res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      });
      res.write('retry: 2000\n\n');
      res.write(`data: ${JSON.stringify({ replay: readTail(), ...presenceMessage() })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/emit') {
      readJson(req, (e) => {
        if (!isEvent(e)) return res.writeHead(400).end();
        appendEvent({ who: e.who, type: e.type, to: e.to, task: e.task, text: e.text });
        res.writeHead(204).end();
      });
      return;
    }

    // Máy của nhân sự từ xa báo có mặt định kỳ (remote_agent.py).
    if (req.method === 'POST' && url.pathname === '/presence') {
      readJson(req, (p) => {
        if (!p || !ROLES.includes(p.who)) return res.writeHead(400).end();
        presence[p.who] = {
          host: String(p.host || '?').slice(0, 64),
          ip: clientIp(req),
          lanIp: p.ip ? String(p.ip).slice(0, 64) : undefined,
          platform: p.platform ? String(p.platform).slice(0, 64) : undefined,
          lastSeen: Date.now(),
        };
        fs.writeFile(PRESENCE_FILE, JSON.stringify(presence), () => {});
        broadcast(presenceMessage());
        res.writeHead(204).end();
      });
      return;
    }

    res.writeHead(404).end();
  })
  .listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Văn phòng ảo: http://localhost:${PORT}`);
    console.log(`Sự kiện: ${EVENTS_FILE}`);
    console.log(`Theo dõi handoff: ${mainRoot}`);
    if (!LAN) {
      console.log('Chỉ nhận kết nối từ máy này. Cho máy khác kết nối: OFFICE_LAN=1 npm run office');
      return;
    }
    const ips = Object.values(os.networkInterfaces())
      .flat()
      .filter((i) => i && i.family === 'IPv4' && !i.internal)
      .map((i) => i.address);
    console.log('Đang mở cho mạng LAN. Trên máy từ xa chạy:');
    for (const ip of ips) {
      console.log(`  python3 office/remote_agent.py --server http://${ip}:${PORT} --token ${TOKEN} --as agy2 --root <repo>`);
    }
  });
