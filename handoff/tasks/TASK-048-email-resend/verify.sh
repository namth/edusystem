#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-048 — hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

ls tests/mailer.test.ts >/dev/null
npx vitest run tests/mailer.test.ts tests/forgot-password-security.test.ts tests/docs-sync.test.ts tests/notifications-lib.test.ts --maxWorkers=4
npx tsc --noEmit -p handoff/tasks/TASK-048-email-resend/tsconfig.verify.json
