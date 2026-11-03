#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-037 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-036: loại test của task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/onboarding-ui.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-037-gioi-han-dung-thu/tsconfig.verify.json
