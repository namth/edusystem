#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-033 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-034: loại test của task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/subjects.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-033-landing-kitokit/tsconfig.verify.json
