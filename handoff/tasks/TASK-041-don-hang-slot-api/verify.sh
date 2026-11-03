#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-041 — do trưởng phòng viết, file này bị khoá.
# Chạy trên máy thợ song song với TASK-038/039/040: loại test của các task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/ai-usage.test.ts --exclude tests/student-slots.test.ts --exclude tests/exam-attempts-api.test.ts --exclude tests/student-lessons-api.test.ts --exclude tests/notifications-api.test.ts --exclude tests/scoring-rubrics-merge.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-041-don-hang-slot-api/tsconfig.verify.json
