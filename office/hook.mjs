// Hook của Claude Code → sự kiện văn phòng. Luôn thoát 0, không in gì,
// để không bao giờ chặn hay đổi hành vi của Claude.
// Được `install-hooks.mjs` chép cùng events.mjs sang ~/.office-sim/bin/ và gắn vào ~/.claude/settings.json,
// nên chạy cho mọi phiên Claude; chỉ ghi khi phiên làm việc trong các dự án khai báo ở ~/.office-sim/config.json.
import fs from 'node:fs';
import path from 'node:path';
import { EVENTS_FILE, appendEvent } from './events.mjs';

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

// Claude chạy verify/accept/reject của handoff = trưởng phòng đi kiểm tra bài của nhân sự.
// (Agent Antigravity tự chạy verify ở máy nó, không qua hook này.)
const REVIEW_CMD = /(?:handoff\.py|agy-worktree\.sh)\s+(verify|accept|reject)\s+(?:--\S+\s+)*(TASK-\d+|\d+)/i;
// Các skill phỏng vấn giám đốc trước khi làm.
const INTERVIEW = /^\/?(grill-master|grill-feature)\b/;

function taskId(raw) {
  return /^\d+$/.test(raw) ? `TASK-${raw.padStart(3, '0')}` : raw.toUpperCase();
}

// Câu trả lời của AskUserQuestion: lấy các giá trị chuỗi trong tool_response.answers (hoặc chính response).
function answerText(resp) {
  const src = resp?.answers ?? resp;
  if (typeof src === 'string') return src;
  if (src && typeof src === 'object') return Object.values(src).filter((v) => typeof v === 'string').join('; ');
  return '';
}

function toEvent(h) {
  const tool = h.tool_name || '';
  switch (h.hook_event_name) {
    case 'UserPromptSubmit': {
      // Lệnh `!` giám đốc tự chạy trong terminal (kèm output) không phải là giao việc.
      if (/^<(bash-input|bash-stdout|bash-stderr|local-command)/.test(String(h.prompt || '').trim())) return null;
      const m = INTERVIEW.exec(String(h.prompt || '').trim());
      if (m) return { who: 'truongphong', type: 'interview', to: 'giamdoc', text: cut(`Phỏng vấn: ${m[1]}`) };
      return { who: 'giamdoc', type: 'assign', to: 'truongphong', text: cut(h.prompt) };
    }
    case 'PreToolUse': {
      if (tool === 'AskUserQuestion') {
        const q = h.tool_input?.questions?.[0];
        return { who: 'truongphong', type: 'ask', to: 'giamdoc', text: cut(q?.question || 'Xin ý kiến giám đốc') };
      }
      if (tool === 'Skill' && INTERVIEW.test(String(h.tool_input?.skill || ''))) {
        return { who: 'truongphong', type: 'interview', to: 'giamdoc', text: cut(`Phỏng vấn: ${h.tool_input.skill}`) };
      }
      const m = tool === 'Bash' && REVIEW_CMD.exec(h.tool_input?.command || '');
      if (m) return { who: 'truongphong', type: 'review', task: taskId(m[2]), text: cut(`$ handoff ${m[1]}`) };
      const text = describeTool(tool, h.tool_input);
      return text && { who: 'truongphong', type: 'work', text: cut(text) };
    }
    case 'PostToolUse':
      if (tool !== 'AskUserQuestion') return null;
      return { who: 'giamdoc', type: 'answer', to: 'truongphong', text: cut(answerText(h.tool_response) || 'Đã trả lời') };
    case 'Notification':
      return { who: 'truongphong', type: 'wait', text: cut(h.message || 'Cần giám đốc xem') };
    case 'Stop':
      return { who: 'truongphong', type: 'idle' };
  }
  return null;
}

// Chỉ ghi cho các dự án đã khai báo (không có cấu hình thì ghi mọi dự án).
function inProject(cwd) {
  try {
    const { projects } = JSON.parse(fs.readFileSync(path.join(path.dirname(EVENTS_FILE), 'config.json'), 'utf8'));
    if (!Array.isArray(projects) || !projects.length) return true;
    const dir = path.resolve(String(cwd || process.cwd()));
    return projects.some((p) => dir === p || dir.startsWith(p + path.sep));
  } catch {
    return true;
  }
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    const h = JSON.parse(raw);
    const ev = inProject(h.cwd) && toEvent(h);
    if (ev) appendEvent(ev);
  } catch {
    // bỏ qua: văn phòng ảo không được làm hỏng phiên làm việc
  }
  process.exit(0);
});
setTimeout(() => process.exit(0), 1500).unref();
