#!/usr/bin/env python3
"""Kiểm thử công cụ điều phối: python3 scripts/test_orchestrate.py"""
import json, os, subprocess, sys, tempfile, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import orchestrate as O  # noqa: E402

GUARD = Path(__file__).resolve().parent / "agy_guard.py"


def git(cwd, *a):
    return subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, check=True).stdout


def task(status, diff="LOW", note="", hist_age_min=0, cross=0):
    import datetime as dt
    at = (dt.datetime.now() - dt.timedelta(minutes=hist_age_min)).isoformat(timespec="seconds")
    return {"state": {"id": "TASK-900", "title": "t", "status": status, "cross_rounds": cross,
                      "history": [{"at": at, "status": status, "note": note}], "agents": {}},
            "dir": None, "where": "worktree", "wt": None, "difficulty": diff}


class Classify(unittest.TestCase):
    def test_buckets(self):
        self.assertEqual(O.classify(task("review_passed", "HIGH"))[0], "claude")
        self.assertEqual(O.classify(task("draft"))[0], "auto")
        self.assertEqual(O.classify(task("in_progress"))[0], "running")
        self.assertEqual(O.classify(task("in_progress", hist_age_min=O.STALE_MIN + 5))[0], "hung")
        self.assertEqual(O.classify(task("in_progress", note="cần trưởng phòng hỗ trợ"))[0], "claude")
        self.assertEqual(O.classify(task("changes_requested", cross=3))[0], "claude")
        self.assertEqual(O.classify(task("changes_requested", cross=1))[0], "auto")
        self.assertEqual(O.classify(task("accepted", "LOW"))[0], "merge")
        self.assertEqual(O.classify(task("accepted", "HIGH"))[0], "claude")

    def test_digest_has_all_sections(self):
        text = O.build_digest({"TASK-900": task("review_passed", "HIGH")}, "x")
        for head in ("CẦN CLAUDE (1)", "ĐIỀU PHỐI LÀM TIẾP (0)", "NGHI TREO (0)", "ĐANG CHẠY (0)"):
            self.assertIn(head, text)
        self.assertLess(len(text.splitlines()), 30)


class Scan(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        git(self.d, "init", "-q"); git(self.d, "config", "user.email", "a@b"); git(self.d, "config", "user.name", "t")
        (Path(self.d) / "app").mkdir()
        (Path(self.d) / "tests").mkdir()
        self.route = Path(self.d) / "app" / "route.ts"
        self.route.write_text("const a = await requireRole('TEACHER');\nif (!ok) return NextResponse.json({e:1},{status: 403});\n")
        (Path(self.d) / "tests" / "a.test.ts").write_text("it('x', () => {});\nit('y', () => {});\n")
        git(self.d, "add", "-A"); git(self.d, "commit", "-qm", "init")

    def scan(self):
        return O.analyse(O.diff_lines(Path(self.d), "HEAD"))

    def test_removed_guard_is_high(self):
        self.route.write_text("const a = 1;\n")
        res = self.scan()
        self.assertTrue(any(l == "CAO" and "route.ts" in m for l, m in res), res)

    def test_moved_guard_is_ok(self):
        self.route.write_text("// refactor\nconst a = await requireRole('TEACHER');\nif (!ok) return NextResponse.json({e:1},{status: 403});\n")
        self.assertEqual([x for x in self.scan() if x[0] == "CAO"], [])

    def test_fewer_tests_is_high(self):
        (Path(self.d) / "tests" / "a.test.ts").write_text("it('x', () => {});\n")
        self.assertTrue(any("số ca test giảm" in m for _, m in self.scan()))

    def test_bypass_and_new_file(self):
        (Path(self.d) / "app" / "new.ts").write_text("// bypass auth for now\nexport const x = 1;\n")
        self.assertTrue(any("đường tắt" in m for _, m in self.scan()))


class GuardRole(unittest.TestCase):
    def run_guard(self, role, path, tool="write_to_file"):
        env = {**os.environ}
        env.pop("HANDOFF_ROLE", None)
        if role:
            env["HANDOFF_ROLE"] = role
        r = subprocess.run([sys.executable, str(GUARD)], input=json.dumps({"toolCall": {"name": tool, "args": {"path": path}}}),
                           capture_output=True, text=True, env=env)
        return json.loads(r.stdout)["decision"]

    def test_orchestrator_cannot_edit_product_code(self):
        self.assertEqual(self.run_guard("orchestrator", "app/page.tsx"), "deny")
        self.assertEqual(self.run_guard("orchestrator", "tests/x.test.ts"), "deny")
        self.assertEqual(self.run_guard("orchestrator", "handoff/tasks/TASK-001-x/state.json"), "deny")

    def test_orchestrator_can_write_digest(self):
        self.assertEqual(self.run_guard("orchestrator", "handoff/digest.md"), "ask")

    def test_engineer_unchanged(self):
        self.assertEqual(self.run_guard(None, "app/page.tsx"), "ask")
        self.assertEqual(self.run_guard(None, "scripts/orchestrate.py"), "deny")

    def test_orchestrator_shell_write_denied(self):
        env = {**os.environ, "HANDOFF_ROLE": "orchestrator"}
        r = subprocess.run([sys.executable, str(GUARD)], input=json.dumps({"toolCall": {"name": "run_command", "args": {"command": "echo x > app/a.ts"}}}),
                           capture_output=True, text=True, env=env)
        self.assertEqual(json.loads(r.stdout)["decision"], "deny")


if __name__ == "__main__":
    unittest.main(verbosity=1)
