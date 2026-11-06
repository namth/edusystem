#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-046 — do trưởng phòng viết, file này bị khoá.
# Chạy song song với task UI còn lại: loại test của task kia (tests/student-gradebook-ui*.test.ts).
set -euo pipefail

ls tests/teacher-grading-ui*.test.ts >/dev/null
npx vitest run --maxWorkers=4 --exclude "tests/student-gradebook-ui*.test.ts"
npx tsc --noEmit
npx next build
