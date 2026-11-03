#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-039 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-038 (token AI) và TASK-040 (rubric): loại test của các task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/ai-usage.test.ts --exclude tests/scoring-rubrics-merge.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-039-slot-la-hoc-sinh/tsconfig.verify.json
