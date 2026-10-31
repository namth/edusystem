// Theo dõi bộ phối hợp handoff, không cần sửa handoff.py (mọi lần đổi trạng thái đều ghi vào state.json):
// - máy này: repo chính và các worktree agy (../agy-worktrees/TASK-xxx);
// - máy thợ qua SSH (chế độ AGY_HOST của agy-worktree.sh), cấu hình ở office/remotes.json;
// - tiến trình Claude đang chạy verify/accept/reject → trưởng phòng đi kiểm tra bài.
import { execFile, execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const RECENT_MS = 10 * 60 * 1000;
const IGNORED = /^(\.git|node_modules|handoff|\.next|coverage)(\/|$)|\.DS_Store$/;

// Ánh xạ trạng thái handoff → sự kiện văn phòng (remote_agent.py có bản Python tương ứng).
export function statusEvent(status, agent, state, reviewText) {
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
      return { who: 'truongphong', type: 'reject', to: agent, task, text: firstLine(reviewText) };
  }
  return null;
}

function firstLine(text) {
  const line = (text || '')
    .split('\n')
    .map((l) => l.replace(/^[-*#>\s\d.]+/, '').trim())
    .find((l) => l.length > 3);
  return line && (line.length > 60 ? line.slice(0, 59) + '…' : line);
}

const readReview = (taskDir) => {
  try {
    return fs.readFileSync(path.join(taskDir, 'review.md'), 'utf8');
  } catch {
    return undefined;
  }
};

// Lần đầu thấy một task (server vừa bật, worktree mới xuất hiện): chỉ báo nếu vừa đổi trạng thái gần đây,
// để không phát lại cả lịch sử.
function isRecent(state) {
  const at = Date.parse(state.history?.at(-1)?.at ?? '');
  return Number.isFinite(at) && Date.now() - at < RECENT_MS;
}

function createTracker({ taskInfo, emit }) {
  const lastStatus = new Map();
  return (state, owner, reviewText) => {
    if (!state?.id) return;
    const prev = lastStatus.get(state.id);
    if (prev === state.status) return;
    lastStatus.set(state.id, state.status);
    if (prev === undefined && !isRecent(state)) return;
    const ev = statusEvent(state.status, owner, state, reviewText);
    if (ev && taskInfo(state.id)?.last !== ev.type) emit(ev); // nguồn khác đã báo cùng bước này thì bỏ qua
  };
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

// Worktree agy chỉ tin state.json của chính task nó (các task khác trong đó là bản chép cũ từ nhánh gốc).
const ownTask = (dir) => (n) => /^TASK-\d+$/i.test(path.basename(dir)) ? n.toUpperCase().startsWith(path.basename(dir).toUpperCase() + '-') : true;

/** Máy này: repo chính + worktree agy. */
export function watchLocal({ mainRoot, worktreeDir, agent, taskInfo, emit }) {
  const see = createTracker({ taskInfo, emit });
  const mtimes = new Map();
  const fileWatchers = new Map();

  const worktrees = () => {
    try {
      return fs
        .readdirSync(worktreeDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(worktreeDir, d.name));
    } catch {
      return [];
    }
  };

  function scan() {
    for (const root of [mainRoot, ...worktrees()]) {
      const tasksDir = path.join(root, 'handoff', 'tasks');
      let names;
      try {
        names = fs.readdirSync(tasksDir).filter(root === mainRoot ? () => true : ownTask(root));
      } catch {
        continue;
      }
      for (const name of names) {
        const file = path.join(tasksDir, name, 'state.json');
        try {
          const mtime = fs.statSync(file).mtimeMs;
          if (mtimes.get(file) === mtime) continue;
          mtimes.set(file, mtime);
          const state = JSON.parse(fs.readFileSync(file, 'utf8'));
          see(state, taskInfo(state.id)?.owner || agent, readReview(path.dirname(file)));
        } catch {
          // file đang được ghi dở hoặc vừa bị xoá
        }
      }
    }
  }

  function syncFileWatchers() {
    const current = new Set(worktrees());
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
          emit({ who: taskInfo(task)?.owner || agent, type: 'work', task, text: `Sửa ${path.basename(name)}` });
        });
        fileWatchers.set(wt, entry);
      } catch {
        // worktree vừa bị xoá
      }
    }
  }

  scan();
  syncFileWatchers();
  setInterval(scan, 2000);
  setInterval(syncFileWatchers, 10000);
}

// Chạy trên máy thợ qua `ssh … python3 -`: in một JSON gồm tên máy, state.json của từng worktree và file vừa sửa.
const REMOTE_SCRIPT = `
import glob, json, os, platform, socket, subprocess, sys
base = os.path.expanduser(sys.argv[1])
out = {"host": socket.gethostname(), "platform": platform.system() + " " + platform.machine(), "tasks": [], "files": {}}
for wt in sorted(glob.glob(os.path.join(base, "*"))):
    name = os.path.basename(wt)
    for f in glob.glob(os.path.join(wt, "handoff", "tasks", name + "-*", "state.json")):
        try:
            s = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        review = None
        rv = os.path.join(os.path.dirname(f), "review.md")
        if s.get("status") == "changes_requested" and os.path.exists(rv):
            review = open(rv, encoding="utf-8").read()[:2000]
        out["tasks"].append({"id": s.get("id"), "title": s.get("title"), "status": s.get("status"),
                             "history": (s.get("history") or [])[-1:], "review": review})
    try:
        st = subprocess.run(["git", "-C", wt, "status", "--porcelain", "-uall"], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        continue
    best = None
    for line in st.splitlines():
        rel = line[3:].split(" -> ")[-1].strip('"')
        if rel.startswith(("handoff/", "node_modules", ".next/")):
            continue
        try:
            m = os.stat(os.path.join(wt, rel)).st_mtime
        except OSError:
            continue
        if best is None or m > best[1]:
            best = [rel, m]
    if best:
        out["files"][name] = best
print(json.dumps(out, ensure_ascii=False))
`;

const expandHome = (p) => (p?.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p);

function sshPoll(r) {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', expandHome(r.key),
      '-o', 'BatchMode=yes',
      '-o', 'ConnectTimeout=5',
      '-o', 'ControlMaster=auto', // giữ một kết nối SSH, mỗi lần quét không phải bắt tay lại
      '-o', `ControlPath=${path.join(os.homedir(), '.ssh', 'office-%C')}`, // đường dẫn socket phải ngắn
      '-o', 'ControlPersist=120',
      r.ssh,
      `export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"; python3 - ${JSON.stringify(r.worktrees)}`,
    ];
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => child.kill(), 20000);
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        if (code !== 0) throw new Error(`ssh exit ${code}`);
        resolve(JSON.parse(out));
      } catch (err) {
        reject(err);
      }
    });
    child.stdin.end(REMOTE_SCRIPT);
  });
}

/** Máy thợ qua SSH: trạng thái task, file đang sửa, và có mặt (tên máy + IP). */
export function watchRemote(r, { taskInfo, emit, onPresence, log }) {
  const see = createTracker({ taskInfo, emit });
  const fileSeen = new Map(); // worktree (= mã task) → mtime file mới sửa nhất đã thấy
  const ip = r.ssh.split('@').pop();
  let busy = false;
  let failing = false;
  let first = true;

  async function poll() {
    if (busy) return;
    busy = true;
    try {
      const data = await sshPoll(r);
      if (failing) log(`Đã nối lại máy thợ ${r.ssh}`);
      failing = false;
      onPresence(r.agent, { host: data.host, ip, platform: data.platform, via: 'ssh' });
      for (const t of data.tasks) see(t, r.agent, t.review);
      // Worktree chưa sửa gì vẫn có mốc 0, để lần sửa đầu tiên của task cũng được báo.
      // Lần quét đầu khi server vừa bật chỉ lấy mốc, không báo lại việc cũ.
      const names = new Set([...data.tasks.map((t) => t.id), ...Object.keys(data.files)]);
      for (const task of names) {
        const [rel, mtime] = data.files[task] || [null, 0];
        const prev = fileSeen.get(task) ?? 0;
        fileSeen.set(task, Math.max(prev, mtime));
        if (!first && rel && mtime > prev) emit({ who: r.agent, type: 'work', task, text: `Sửa ${path.basename(rel)}` });
      }
      first = false;
    } catch (err) {
      if (!failing) log(`Không đọc được máy thợ ${r.ssh}: ${err.message}`);
      failing = true;
    } finally {
      busy = false;
    }
  }

  poll();
  setInterval(poll, r.every || 5000);
}

// Claude chạy nghiệm thu (verify qua agy-worktree.sh, hoặc accept/reject) → đi kiểm tra tại bàn người làm.
// Agent tự chạy `handoff.py verify` thì không tính: đó là nhân sự tự kiểm.
const REVIEW_PROC = /(?:agy-worktree\.sh\s+(verify)|handoff\.py\s+(accept|reject))\s+(TASK-\d+|\d+)/i;

export function watchReviews({ emit }) {
  const seen = new Set();
  function scan() {
    execFile('ps', ['-ax', '-o', 'pid=,command='], { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      if (err) return;
      const alive = new Set();
      for (const line of stdout.split('\n')) {
        const m = REVIEW_PROC.exec(line);
        if (!m) continue;
        const task = /^\d+$/.test(m[3]) ? `TASK-${m[3].padStart(3, '0')}` : m[3].toUpperCase();
        alive.add(task);
        if (seen.has(task)) continue; // cùng một lượt kiểm tra (nhiều tiến trình con) chỉ báo một lần
        seen.add(task);
        emit({ who: 'truongphong', type: 'review', task, text: `$ ${m[1] || m[2]} ${task}` });
      }
      for (const task of seen) if (!alive.has(task)) seen.delete(task);
    });
  }
  setInterval(scan, 3000);
}
