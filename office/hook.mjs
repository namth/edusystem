// Hook của Claude Code → sự kiện văn phòng. Luôn thoát 0, không in gì,
// để không bao giờ chặn hay đổi hành vi của Claude.
import path from 'node:path';
import { appendEvent } from './events.mjs';

const MAX = 60;
const cut = (s) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > MAX ? s.slice(0, MAX - 1) + '…' : s;
};
const base = (p) => (p ? path.basename(String(p)) : '');

function describeTool(name, input = {}) {
  if (name.startsWith('mcp__ccd_')) return null; // công cụ nội bộ của app, chỉ gây nhiễu
  switch (name) {
    case 'Read':
      return `Đọc ${base(input.file_path)}`;
    case 'Edit':
    case 'MultiEdit':
      return `Sửa ${base(input.file_path)}`;
    case 'Write':
      return `Viết ${base(input.file_path)}`;
    case 'Bash':
      return `$ ${input.description || input.command}`;
    case 'Grep':
    case 'Glob':
      return `Tìm "${input.pattern}"`;
    case 'Agent':
    case 'Task':
      return `Gọi trợ lý: ${input.description || ''}`;
    case 'WebFetch':
    case 'WebSearch':
      return 'Tra cứu web';
    case 'Skill':
      return `Dùng skill ${input.skill}`;
  }
  if (name.includes('Browser') || name.includes('chrome')) return 'Xem trình duyệt';
  return name.split('__').pop();
}

function toEvent(h) {
  switch (h.hook_event_name) {
    case 'UserPromptSubmit':
      return { who: 'giamdoc', type: 'assign', to: 'truongphong', text: cut(h.prompt) };
    case 'PreToolUse': {
      const text = describeTool(h.tool_name || '', h.tool_input);
      return text && { who: 'truongphong', type: 'work', text: cut(text) };
    }
    case 'Notification':
      return { who: 'truongphong', type: 'wait', text: cut(h.message || 'Cần giám đốc xem') };
    case 'Stop':
      return { who: 'truongphong', type: 'idle' };
  }
  return null;
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const ev = toEvent(JSON.parse(raw));
    if (ev) appendEvent(ev);
  } catch {
    // bỏ qua: văn phòng ảo không được làm hỏng phiên làm việc
  }
  process.exit(0);
});
setTimeout(() => process.exit(0), 1500).unref();
