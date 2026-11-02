#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-036 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-037: loại test của task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/teacher-trial.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-036-dang-ky-giao-dien/tsconfig.verify.json
# E2E luồng thật (build production + Postgres/Redis riêng qua docker)
npm run e2e:db
npx playwright test e2e/onboarding.spec.ts e2e/auth.spec.ts --project=desktop
