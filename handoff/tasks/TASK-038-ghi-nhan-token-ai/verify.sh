#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-038 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-039 (slot) và TASK-040 (rubric): loại test của các task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/student-slots.test.ts --exclude tests/exam-attempts-api.test.ts --exclude tests/student-lessons-api.test.ts --exclude tests/notifications-api.test.ts --exclude tests/scoring-rubrics-merge.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-038-ghi-nhan-token-ai/tsconfig.verify.json
