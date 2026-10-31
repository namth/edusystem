#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-011 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
# TASK-010 chạy song song ở worktree khác → loại test của nó (tests/exams-api.test.ts) khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/exams-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-011-hoc-sinh-bai-hoc-api/tsconfig.verify.json
