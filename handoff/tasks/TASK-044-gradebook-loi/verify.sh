#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-044 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt. Test của tài khoản kiểm chéo: tests/gradebook*.test.ts
set -euo pipefail

ls tests/gradebook*.test.ts >/dev/null   # bắt buộc có test lõi bảng điểm
npx vitest run --maxWorkers=4
npx tsc --noEmit
