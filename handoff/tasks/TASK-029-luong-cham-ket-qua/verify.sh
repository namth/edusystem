#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-029 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
# TASK-030 chạy song song ở worktree khác → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/notifications-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-029-luong-cham-ket-qua/tsconfig.verify.json
