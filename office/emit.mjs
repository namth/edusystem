#!/usr/bin/env node
// Ghi một sự kiện từ dòng lệnh, ví dụ cho handoff.py hoặc script của Antigravity:
//   node office/emit.mjs agy1 accept --task TSK-21
//   node office/emit.mjs truongphong assign --to agy2 --task TSK-22 --text "Trang thống kê"
import { ROLES, TYPES, appendEvent } from './events.mjs';

const [who, type, ...rest] = process.argv.slice(2);
if (!ROLES.includes(who) || !TYPES.includes(type)) {
  console.error(`Cách dùng: emit.mjs <${ROLES.join('|')}> <${TYPES.join('|')}> [--to x] [--task id] [--text "..."]`);
  process.exit(1);
}

const ev = { who, type };
for (let i = 0; i < rest.length; i += 2) {
  const key = rest[i].replace(/^--/, '');
  if (['to', 'task', 'text'].includes(key)) ev[key] = rest[i + 1];
}
appendEvent(ev);
