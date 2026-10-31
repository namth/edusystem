// Định dạng sự kiện chung của văn phòng ảo: mỗi dòng của events.jsonl là một JSON
// { ts, who, type, to?, task?, text? }. Mọi nguồn (hook Claude, handoff.py, demo) chỉ cần append.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EVENTS_FILE =
  process.env.OFFICE_EVENTS || path.join(os.homedir(), '.office-sim', 'events.jsonl');

export const ROLES = ['giamdoc', 'truongphong', 'agy1', 'agy2'];

export const TYPES = [
  'assign', // who giao việc cho `to` (task, text)
  'accept', // who nhận task
  'work', // who đang làm (text: đang làm gì)
  'submit', // who nộp task cho `to`
  'review', // who đang nghiệm thu task
  'approve', // who duyệt đạt task của `to`
  'reject', // who trả task về cho `to` (text: lý do)
  'wait', // who đang chờ người khác (text)
  'idle', // who rảnh
  'error', // who gặp lỗi (text)
];

export function isEvent(e) {
  return !!e && ROLES.includes(e.who) && TYPES.includes(e.type);
}

export function appendEvent(ev) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...ev }) + '\n';
  fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true });
  fs.appendFileSync(EVENTS_FILE, line);
}
