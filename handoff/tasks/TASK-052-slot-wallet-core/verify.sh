#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-052 — hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

ls tests/slot-wallet.test.ts >/dev/null
npx vitest run tests/slot-wallet.test.ts
npx tsc --noEmit
