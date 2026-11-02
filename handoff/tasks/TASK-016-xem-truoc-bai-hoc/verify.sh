#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-016 — do trưởng phòng viết, file này bị khoá.
# TASK-015 chạy song song → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/flashcards-uploads-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-016-xem-truoc-bai-hoc/tsconfig.verify.json
