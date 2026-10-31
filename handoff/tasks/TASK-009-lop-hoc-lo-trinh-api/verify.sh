#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-009 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
# TASK-008 chạy song song ở worktree khác → loại test của nó (tests/lessons-api.test.ts) khỏi lần chạy này.
set -euo pipefail

npx vitest run --exclude tests/lessons-api.test.ts
npx tsc --noEmit -p tsconfig.json
