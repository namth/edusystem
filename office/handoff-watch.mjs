// Theo dõi bộ phối hợp handoff trên máy này: trạng thái task (handoff/tasks/*/state.json)
// ở repo chính và các worktree của Antigravity, cùng file đang bị sửa trong worktree agy.
// Không cần sửa handoff.py: mọi lần đổi trạng thái đều ghi vào state.json.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Ánh xạ trạng thái handoff → sự kiện văn phòng. Dùng chung với remote_agent.py.
export function statusEvent(status, agent, state, taskDir) {
  const task = state.id;
  switch (status) {
    case 'assigned':
      return { who: 'truongphong', type: 'assign', to: agent, task, text: state.title };
    case 'in_progress':
      return { who: agent, type: 'accept', task };
    case 'submitted':
      return { who: agent, type: 'submit', to: 'truongphong', task };
    case 'accepted':
      return { who: 'truongphong', type: 'approve', to: agent, task };
    case 'changes_requested':
      return { who: 'truongphong', type: 'reject', to: agent, task, text: reviewSummary(taskDir) };
  }
  return null;
}

function reviewSummary(taskDir) {
  try {
    const line = fs
      .readFileSync(path.join(taskDir, 'review.md'), 'utf8')
      .split('\n')
      .map((l) => l.replace(/^[-*#>\s\d.]+/, '').trim())
      .find((l) => l.length > 3);
    return line && (line.length > 60 ? line.slice(0, 59) + '…' : line);
  } catch {
    return undefined;
  }
}

export function mainRepoRoot(fromDir) {
  try {
    const common = execFileSync('git', ['-C', fromDir, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
    }).trim();
    return path.dirname(common);
  } catch {
    return path.dirname(fromDir);
  }
}

const IGNORED = /^(\.git|node_modules|handoff|\.next|coverage)(\/|$)|\.DS_Store$/;

/**
 * @param {object} o
 * @param {string} o.mainRoot       repo chính (chứa handoff/tasks)
 * @param {string} o.worktreeDir    thư mục chứa worktree agy (mỗi thư mục con là một TASK-xxx)
 * @param {string} o.agent          nhân sự làm việc trên máy này (mặc định agy1)
 * @param {(id: string) => {owner?: string, last?: string} | undefined} o.taskInfo  thông tin task đã biết
 * @param {(ev: object) => void} o.emit
 */
export function watchHandoff({ mainRoot, worktreeDir, agent, taskInfo, emit }) {
  const seen = new Map(); // state.json → mtimeMs
  const lastStatus = new Map(); // task id → status
  const fileWatchers = new Map(); // worktree → { watcher, lastAt }
  let ready = false;

  const roots = () => {
    let wts = [];
    try {
      wts = fs
        .readdirSync(worktreeDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(worktreeDir, d.name));
    } catch {
      // chưa có thư mục worktree nào
    }
    return [mainRoot, ...wts];
  };

  function scanStates() {
    for (const root of roots()) {
      const tasksDir = path.join(root, 'handoff', 'tasks');
      let dirs;
      try {
        dirs = fs.readdirSync(tasksDir);
      } catch {
        continue;
      }
      for (const name of dirs) {
        const file = path.join(tasksDir, name, 'state.json');
        let mtime;
        try {
          mtime = fs.statSync(file).mtimeMs;
        } catch {
          continue;
        }
        if (seen.get(file) === mtime) continue;
        seen.set(file, mtime);
        let state;
        try {
          state = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch {
          continue;
        }
        if (!state.id || lastStatus.get(state.id) === state.status) continue;
        lastStatus.set(state.id, state.status);
        if (!ready) continue; // lần quét đầu chỉ ghi nhận, không phát lại quá khứ
        const info = taskInfo(state.id);
        const ev = statusEvent(state.status, info?.owner || agent, state, path.dirname(file));
        if (ev && info?.last !== ev.type) emit(ev); // máy khác đã báo cùng bước này thì bỏ qua
      }
    }
    ready = true;
  }

  function syncFileWatchers() {
    const current = new Set(roots().slice(1));
    for (const [wt, w] of fileWatchers) {
      if (!current.has(wt)) {
        w.watcher.close();
        fileWatchers.delete(wt);
      }
    }
    for (const wt of current) {
      if (fileWatchers.has(wt)) continue;
      const entry = { lastAt: 0, watcher: null };
      const task = path.basename(wt);
      try {
        entry.watcher = fs.watch(wt, { recursive: true }, (_, name) => {
          if (!name || IGNORED.test(name)) return;
          const t = Date.now();
          if (t - entry.lastAt < 4000) return; // tối đa một sự kiện / 4 giây / worktree
          entry.lastAt = t;
          const owner = taskInfo(task)?.owner || agent;
          emit({ who: owner, type: 'work', task, text: `Sửa ${path.basename(name)}` });
        });
        fileWatchers.set(wt, entry);
      } catch {
        // worktree vừa bị xoá
      }
    }
  }

  scanStates();
  syncFileWatchers();
  setInterval(scanStates, 2000);
  setInterval(syncFileWatchers, 10000);
}
