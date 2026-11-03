#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-042 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-043 (dashboard + menu): loại test của task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/admin-dashboard.test.ts --exclude tests/landing.test.ts --exclude tests/onboarding-ui.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-042-don-hang-giao-dien/tsconfig.verify.json
