#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-054 — hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

ls tests/slot-wallet-ui.test.ts >/dev/null
npx vitest run tests/slot-wallet-ui.test.ts tests/docs-sync.test.ts tests/design-rules.test.ts tests/client-bundle-safety.test.ts --maxWorkers=4
npx tsc --noEmit
npx next build
