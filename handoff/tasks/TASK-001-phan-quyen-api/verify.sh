#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-001 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

npx vitest run tests/api-auth.test.ts
npx tsc --noEmit -p tsconfig.json
