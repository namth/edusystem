#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-019 — do trưởng phòng viết, file này bị khoá.
# TASK-018 chạy song song → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/exam-scoring.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-019-chuan-cham-api-admin/tsconfig.verify.json
