#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-026 — do trưởng phòng viết, file này bị khoá.
# TASK-025 chạy song song (máy thợ) → loại test của nó.
set -euo pipefail

npx vitest run --exclude tests/student-home.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-026-rubrics-pg-don-dep/tsconfig.verify.json
