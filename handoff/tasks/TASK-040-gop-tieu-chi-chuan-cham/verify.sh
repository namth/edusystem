#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-040 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-038 (token AI) và TASK-039 (slot): loại test của các task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/ai-usage.test.ts --exclude tests/student-slots.test.ts --exclude tests/exam-attempts-api.test.ts --exclude tests/student-lessons-api.test.ts --exclude tests/notifications-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-040-gop-tieu-chi-chuan-cham/tsconfig.verify.json
