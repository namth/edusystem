#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-021 — do trưởng phòng viết, file này bị khoá.
# TASK-020 chạy song song → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/exam-attempts-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-021-chon-chuan-cham/tsconfig.verify.json
