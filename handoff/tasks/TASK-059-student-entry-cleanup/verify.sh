#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-059 — hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

ls tests/student-entry-cleanup.test.ts >/dev/null
npx vitest run tests/student-entry-cleanup.test.ts tests/design-rules.test.ts tests/client-bundle-safety.test.ts
npx tsc --noEmit
