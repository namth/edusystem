#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-045 — do trưởng phòng viết, file này bị khoá.
# Test của tài khoản kiểm chéo: tests/teacher-grading-api*.test.ts (+ ca cũ được cập nhật theo đặc tả)
set -euo pipefail

ls tests/teacher-grading-api*.test.ts >/dev/null
test ! -e app/api/teacher/submissions/route.ts
test ! -e app/api/exam/grade-override/route.ts
npx vitest run --maxWorkers=4
npx tsc --noEmit
