#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-043 — do trưởng phòng viết, file này bị khoá.
# Song song với TASK-042 (giao diện đơn hàng): loại test của task kia khỏi vitest và tsc.
set -euo pipefail

npx vitest run --maxWorkers=4 --exclude tests/orders-ui.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-043-tong-quan-admin/tsconfig.verify.json
