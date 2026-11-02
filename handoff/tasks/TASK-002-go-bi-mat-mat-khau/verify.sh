#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-002 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

npx vitest run tests/secrets-password.test.ts tests/api-auth.test.ts
npx tsc --noEmit -p tsconfig.json
node --check lib/db-init.js
