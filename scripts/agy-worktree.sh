#!/usr/bin/env bash
# Chạy nhiều task Antigravity song song: mỗi task một git worktree + nhánh riêng,
# tuỳ chọn tài khoản agy khác qua AGY_ACCOUNT (tài khoản N>1 dùng HOME=$HOME/.agy-accountN).
#
#   scripts/agy-worktree.sh new      TASK-008            # tạo worktree từ HEAD (cây làm việc phải sạch)
#   AGY_ACCOUNT=2 scripts/agy-worktree.sh dispatch TASK-008 --agy-model <slug>
#   AGY_ACCOUNT=2 scripts/agy-worktree.sh resume   TASK-008 --note "..."
#   scripts/agy-worktree.sh verify   TASK-008
#   scripts/agy-worktree.sh merge    TASK-008            # commit trong worktree, merge --no-ff về nhánh hiện tại, dọn worktree
#   scripts/agy-worktree.sh list
set -euo pipefail

die() { echo "LỖI: $*" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel)"
BASE_DIR="${AGY_WT_DIR:-$(dirname "$(git rev-parse --git-common-dir)")/../agy-worktrees}"
cmd="${1:-}"
id="${2:-}"

account_home() {
  local n="${AGY_ACCOUNT:-1}"
  if [ "$n" = "1" ]; then echo "$HOME"; else echo "$HOME/.agy-account$n"; fi
}

need_id() { [ -n "$id" ] || die "thiếu mã task (vd TASK-008)"; }
wt_path() { echo "$BASE_DIR/$id"; }
branch() { echo "agy/$id"; }

case "$cmd" in
  new)
    need_id
    [ -z "$(git -C "$ROOT" status --porcelain)" ] || die "cây làm việc chưa sạch — commit trước (worktree tạo từ HEAD)"
    ls -d "$ROOT"/handoff/tasks/"$id"-* >/dev/null 2>&1 || die "chưa có handoff/tasks/$id-* trong HEAD"
    mkdir -p "$BASE_DIR"
    git -C "$ROOT" worktree add -b "$(branch)" "$(wt_path)" HEAD
    ln -s "$ROOT/node_modules" "$(wt_path)/node_modules"
    echo "Worktree: $(wt_path)  (nhánh $(branch))"
    ;;
  dispatch|resume)
    need_id; shift 2
    [ -d "$(wt_path)" ] || die "chưa có worktree cho $id — chạy: $0 new $id"
    h="$(account_home)"
    [ -d "$h/.gemini/antigravity-cli" ] || die "tài khoản agy ${AGY_ACCOUNT:-1} chưa đăng nhập ($h/.gemini/antigravity-cli không có)"
    echo "Tài khoản agy ${AGY_ACCOUNT:-1} (HOME=$h) — worktree $(wt_path)"
    cd "$(wt_path)" && HOME="$h" python3 scripts/handoff.py "$cmd" "$id" "$@"
    ;;
  verify)
    need_id
    cd "$(wt_path)" && python3 scripts/handoff.py verify "$id"
    ;;
  merge)
    need_id
    wt="$(wt_path)"
    [ -d "$wt" ] || die "không có worktree $wt"
    status="$(python3 -c "import json,glob,sys; print(json.load(open(glob.glob('$wt/handoff/tasks/$id-*/state.json')[0]))['status'])")"
    [ "$status" = "accepted" ] || die "$id chưa được nghiệm thu (status=$status) — chạy accept trong worktree trước"
    title="$(python3 -c "import json,glob; print(json.load(open(glob.glob('$wt/handoff/tasks/$id-*/state.json')[0]))['title'])")"
    rm -f "$wt/node_modules"
    git -C "$wt" add -A
    git -C "$wt" diff --cached --quiet || git -C "$wt" commit -q -m "feat: $title ($id)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
    git -C "$ROOT" merge --no-ff "$(branch)" -m "merge: $id — $title

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
    git -C "$ROOT" worktree remove "$wt"
    git -C "$ROOT" branch -d "$(branch)"
    echo "Đã merge $id vào $(git -C "$ROOT" branch --show-current)"
    ;;
  list)
    git -C "$ROOT" worktree list
    ;;
  *)
    sed -n '2,12p' "$0"; exit 1
    ;;
esac
