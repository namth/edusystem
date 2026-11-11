#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-049 — file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

npx vitest run tests/reset-password.test.ts
npx vitest run tests/docs-sync.test.ts
npx tsc --noEmit
