#!/usr/bin/env node
// Cài hook văn phòng ảo cho MỌI phiên Claude Code trên máy này (không phụ thuộc nhánh/worktree):
// chép hook.mjs + events.mjs sang ~/.office-sim/bin/, khai báo dự án được theo dõi ở ~/.office-sim/config.json,
// rồi gắn hook vào ~/.claude/settings.json. Chạy lại để cập nhật; `--uninstall` để gỡ.
//   node office/install-hooks.mjs [--project <thư mục>]... [--uninstall]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS_FILE } from './events.mjs';
import { mainRepoRoot } from './handoff-watch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.dirname(EVENTS_FILE);
const BIN = path.join(DATA_DIR, 'bin');
const CONFIG = path.join(DATA_DIR, 'config.json');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const MARK = path.join(BIN, 'hook.mjs');

const args = process.argv.slice(2);
const uninstall = args.includes('--uninstall');
const extra = args.flatMap((a, i) => (args[i - 1] === '--project' ? [path.resolve(a)] : []));

const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

// Bỏ mọi hook văn phòng ảo cũ khỏi settings, giữ nguyên hook khác của người dùng.
function stripOffice(hooks = {}) {
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
      .filter((g) => g.hooks.length);
    if (kept.length) hooks[event] = kept;
    else delete hooks[event];
  }
  return hooks;
}

const settings = readJson(SETTINGS, {});
if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, SETTINGS + '.bak-office');
settings.hooks = stripOffice(settings.hooks);

if (uninstall) {
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
  console.log(`Đã gỡ hook văn phòng ảo khỏi ${SETTINGS}`);
  process.exit(0);
}

fs.mkdirSync(BIN, { recursive: true });
for (const f of ['hook.mjs', 'events.mjs']) fs.copyFileSync(path.join(HERE, f), path.join(BIN, f));

const main = mainRepoRoot(HERE);
const config = readJson(CONFIG, {});
config.projects = [...new Set([...(config.projects || []), main, path.join(path.dirname(main), 'agy-worktrees'), ...extra])];
fs.writeFileSync(CONFIG, JSON.stringify(config, null, 2) + '\n');

// Dùng đường dẫn node tuyệt đối: hook của app Claude không chắc có PATH của Homebrew.
const command = `"${process.execPath}" "${MARK}"`;
const hook = (matcher) => ({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command, timeout: 5 }] });
const wanted = {
  UserPromptSubmit: hook(),
  PreToolUse: hook('*'),
  PostToolUse: hook('AskUserQuestion'),
  Notification: hook(),
  Stop: hook(),
};
for (const [event, group] of Object.entries(wanted)) (settings.hooks[event] ??= []).push(group);
fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');

console.log(`Đã cài hook vào ${SETTINGS} (bản cũ: settings.json.bak-office)`);
console.log(`Theo dõi các dự án: ${config.projects.join(', ')}`);
console.log('Phiên Claude mở từ bây giờ sẽ hiện lên văn phòng ảo; phiên đang mở cần mở lại.');
