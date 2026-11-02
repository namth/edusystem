#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-012 — do trưởng phòng viết, file này bị khoá.
# TASK-010, TASK-011 chạy song song → loại test của chúng khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/exams-api.test.ts --exclude tests/student-lessons-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-012-lo-trinh-lop-ui/tsconfig.verify.json
