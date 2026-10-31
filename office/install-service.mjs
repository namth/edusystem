#!/usr/bin/env node
// Cài văn phòng ảo thành dịch vụ nền của macOS (LaunchAgent): tự chạy khi đăng nhập, tự bật lại nếu tắt,
// chạy từ bản chép cố định trong ~/.office-sim/app nên không phụ thuộc worktree nào.
// Chạy lại để cập nhật mã mới.
//   node office/install-service.mjs [--lan] [--uninstall]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS_FILE } from './events.mjs';
import { mainRepoRoot } from './handoff-watch.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.dirname(EVENTS_FILE);
const APP = path.join(DATA_DIR, 'app');
const LABEL = 'com.office-sim.server';
const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const DOMAIN = `gui/${process.getuid()}`;
const FILES = ['server.mjs', 'events.mjs', 'handoff-watch.mjs', 'remotes.json', 'public/index.html'];

const args = process.argv.slice(2);
const launchctl = (...a) => {
  try {
    execFileSync('launchctl', a, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

launchctl('bootout', `${DOMAIN}/${LABEL}`); // gỡ bản đang chạy (nếu có) trước khi cài lại

if (args.includes('--uninstall')) {
  fs.rmSync(PLIST, { force: true });
  console.log('Đã gỡ dịch vụ văn phòng ảo (dữ liệu trong ~/.office-sim vẫn giữ nguyên).');
  process.exit(0);
}

for (const f of FILES) {
  fs.mkdirSync(path.dirname(path.join(APP, f)), { recursive: true });
  fs.copyFileSync(path.join(HERE, f), path.join(APP, f));
}

const env = {
  OFFICE_REPO: process.env.OFFICE_REPO || mainRepoRoot(HERE), // bản chép không nằm trong git nên phải chỉ rõ repo
  PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', // cần ssh, git, ps
  HOME: os.homedir(),
  ...(args.includes('--lan') ? { OFFICE_LAN: '1' } : {}),
  ...(process.env.OFFICE_PORT ? { OFFICE_PORT: process.env.OFFICE_PORT } : {}),
};
const xml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const log = path.join(DATA_DIR, 'server.log');
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array><string>${xml(process.execPath)}</string><string>${xml(path.join(APP, 'server.mjs'))}</string></array>
  <key>WorkingDirectory</key><string>${xml(APP)}</string>
  <key>EnvironmentVariables</key>
  <dict>
${Object.entries(env).map(([k, v]) => `    <key>${k}</key><string>${xml(v)}</string>`).join('\n')}
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`;
fs.mkdirSync(path.dirname(PLIST), { recursive: true });
fs.writeFileSync(PLIST, plist);

if (!launchctl('bootstrap', DOMAIN, PLIST)) {
  console.error(`Không nạp được dịch vụ. Thử: launchctl bootstrap ${DOMAIN} "${PLIST}"`);
  process.exit(1);
}
console.log(`Đã cài dịch vụ ${LABEL}: http://localhost:${env.OFFICE_PORT || 4317}${env.OFFICE_LAN ? ' (mở cho LAN)' : ''}`);
console.log(`Mã chạy từ ${APP}, nhật ký server: ${log}`);
console.log('Gỡ: node office/install-service.mjs --uninstall');
