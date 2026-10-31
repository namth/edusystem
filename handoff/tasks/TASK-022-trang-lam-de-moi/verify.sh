#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-022 — do trưởng phòng viết, file này bị khoá.
# TASK-020, TASK-021 chạy song song → loại test của chúng khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/exam-attempts-api.test.ts --exclude tests/standard-selection.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-022-trang-lam-de-moi/tsconfig.verify.json
