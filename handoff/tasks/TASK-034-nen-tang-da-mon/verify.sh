#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-034 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-033: loại test của task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/landing.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-034-nen-tang-da-mon/tsconfig.verify.json
