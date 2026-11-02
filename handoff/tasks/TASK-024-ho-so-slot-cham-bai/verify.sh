#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-024 — do trưởng phòng viết, file này bị khoá.
# TASK-023 chạy song song (máy thợ) → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/teacher-classes-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-024-ho-so-slot-cham-bai/tsconfig.verify.json
