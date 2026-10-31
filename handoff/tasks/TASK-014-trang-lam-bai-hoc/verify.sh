#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-014 — do trưởng phòng viết, file này bị khoá.
# TASK-013 chạy song song → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/lesson-library-ui.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-014-trang-lam-bai-hoc/tsconfig.verify.json
