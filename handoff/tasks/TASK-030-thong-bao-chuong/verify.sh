#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-030 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
# TASK-029 chạy song song ở worktree khác → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/exam-attempts-api.test.ts --exclude tests/attempt-summary.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-030-thong-bao-chuong/tsconfig.verify.json
