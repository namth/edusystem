#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-050 — kiểm thử chéo, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

ls tests/ai-usage-report.test.ts >/dev/null
npx vitest run tests/ai-usage-report.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-050-ai-usage-report/tsconfig.verify.json
