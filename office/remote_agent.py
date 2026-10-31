#!/usr/bin/env python3
"""Chạy trên máy của nhân sự làm việc từ xa (vd Agy 2) để nối vào văn phòng ảo.

- Báo có mặt mỗi 15 giây kèm tên máy và IP → hiện ở khu "Máy từ xa".
- Theo dõi handoff/tasks/*/state.json trong repo của máy đó → giao / nhận / nộp / duyệt / trả về.
- Theo dõi file đang bị sửa (git status) → "đang tự làm".

    python3 office/remote_agent.py --server http://192.168.1.10:4317 --token <token> --as agy2 --root ~/learningsystem

Token và lệnh đầy đủ được in ra khi chạy `OFFICE_LAN=1 npm run office` trên máy chính.
Chỉ dùng thư viện chuẩn của Python, chép riêng file này sang máy khác cũng chạy được.
"""
from __future__ import annotations

import argparse
import json
import platform
import socket
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HEARTBEAT_EVERY = 15
SCAN_EVERY = 2
WORK_EVERY = 5
IGNORED = ("handoff/", "node_modules/", ".next/", ".git/")


def status_event(status: str, agent: str, state: dict, task_dir: Path) -> dict | None:
    """Giống statusEvent trong handoff-watch.mjs."""
    task = state["id"]
    if status == "assigned":
        return {"who": "truongphong", "type": "assign", "to": agent, "task": task, "text": state.get("title")}
    if status == "in_progress":
        return {"who": agent, "type": "accept", "task": task}
    if status == "submitted":
        return {"who": agent, "type": "submit", "to": "truongphong", "task": task}
    if status == "accepted":
        return {"who": "truongphong", "type": "approve", "to": agent, "task": task}
    if status == "changes_requested":
        return {"who": "truongphong", "type": "reject", "to": agent, "task": task, "text": review_summary(task_dir)}
    return None


def review_summary(task_dir: Path) -> str | None:
    try:
        for line in (task_dir / "review.md").read_text(encoding="utf-8").splitlines():
            line = line.lstrip("-*#> 0123456789.").strip()
            if len(line) > 3:
                return line if len(line) <= 60 else line[:59] + "…"
    except OSError:
        pass
    return None


class Office:
    def __init__(self, server: str, token: str, agent: str):
        self.server = server.rstrip("/")
        self.token = token
        self.agent = agent
        self.online = None

    def post(self, path: str, data: dict) -> bool:
        req = urllib.request.Request(
            self.server + path,
            data=json.dumps({k: v for k, v in data.items() if v is not None}, ensure_ascii=False).encode(),
            headers={"content-type": "application/json", "x-office-token": self.token},
            method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=5).close()
            ok = True
        except urllib.error.HTTPError as e:
            ok = False
            if e.code == 401:
                raise SystemExit("Server từ chối token — kiểm tra lại --token") from e
        except OSError:
            ok = False
        if ok != self.online:
            print("Đã kết nối văn phòng ảo." if ok else f"Không kết nối được {self.server}, sẽ thử lại…", flush=True)
            self.online = ok
        return ok

    def emit(self, ev: dict) -> None:
        print(f"→ {ev['type']} {ev.get('task') or ''} {ev.get('text') or ''}".rstrip(), flush=True)
        self.post("/emit", ev)

    def heartbeat(self) -> None:
        self.post("/presence", {"who": self.agent, "host": socket.gethostname(), "ip": lan_ip(self.server),
                                "platform": f"{platform.system()} {platform.machine()}"})


def lan_ip(server: str) -> str | None:
    """IP của máy này trên đường mạng tới server (không gửi gói tin nào)."""
    host = urllib.parse.urlparse(server).hostname or "8.8.8.8"
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect((host, 80))
            return s.getsockname()[0]
    except OSError:
        return None


class Watcher:
    def __init__(self, root: Path, office: Office):
        self.root = root
        self.office = office
        self.mtimes: dict[Path, float] = {}
        self.status: dict[str, str] = {}
        self.current_task: str | None = None
        self.file_mtimes: dict[str, float] | None = None
        self.ready = False

    def scan_states(self) -> None:
        tasks = self.root / "handoff" / "tasks"
        for f in tasks.glob("*/state.json") if tasks.is_dir() else []:
            try:
                mtime = f.stat().st_mtime
                if self.mtimes.get(f) == mtime:
                    continue
                self.mtimes[f] = mtime
                state = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            task_id, status = state.get("id"), state.get("status")
            if not task_id or self.status.get(task_id) == status:
                continue
            self.status[task_id] = status
            if status in ("assigned", "in_progress", "changes_requested"):
                self.current_task = task_id
            if self.ready and (ev := status_event(status, self.office.agent, state, f.parent)):
                self.office.emit(ev)
        self.ready = True

    def scan_work(self) -> None:
        try:
            out = subprocess.run(["git", "-C", str(self.root), "status", "--porcelain", "-uall"],
                                 capture_output=True, text=True, timeout=20).stdout
        except (OSError, subprocess.SubprocessError):
            return
        files = {}
        for line in out.splitlines():
            rel = line[3:].split(" -> ")[-1].strip('"')
            if rel.startswith(IGNORED):
                continue
            try:
                files[rel] = (self.root / rel).stat().st_mtime
            except OSError:
                files[rel] = 0
        changed = [f for f, m in files.items() if self.file_mtimes is not None and self.file_mtimes.get(f) != m]
        self.file_mtimes = files
        if changed:
            latest = max(changed, key=lambda f: files[f])
            self.office.emit({"who": self.office.agent, "type": "work", "task": self.current_task,
                              "text": f"Sửa {Path(latest).name}"})


def main() -> None:
    p = argparse.ArgumentParser(description="Nối máy từ xa vào văn phòng ảo")
    p.add_argument("--server", required=True, help="vd http://192.168.1.10:4317")
    p.add_argument("--token", required=True)
    p.add_argument("--as", dest="agent", default="agy2", choices=["agy1", "agy2"])
    p.add_argument("--root", help="repo dự án trên máy này (để theo dõi handoff và file đang sửa)")
    a = p.parse_args()

    office = Office(a.server, a.token, a.agent)
    watcher = Watcher(Path(a.root).expanduser().resolve(), office) if a.root else None
    print(f"{a.agent} @ {socket.gethostname()} → {a.server}" + (f" (repo {watcher.root})" if watcher else ""), flush=True)

    last_beat = last_work = 0.0
    while True:
        now = time.monotonic()
        if now - last_beat >= HEARTBEAT_EVERY:
            office.heartbeat()
            last_beat = now
        if watcher:
            watcher.scan_states()
            if now - last_work >= WORK_EVERY:
                watcher.scan_work()
                last_work = now
        time.sleep(SCAN_EVERY)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
