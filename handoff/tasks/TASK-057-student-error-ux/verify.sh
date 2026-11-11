#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-057 — do kỹ sư kiểm thử viết.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

echo "=== TASK-057: Trang làm bài học sinh — bỏ alert, thông báo lớp khoá và lỗi thân thiện ==="

# 1. Chạy test hợp đồng nghiệm thu
echo "--- Chạy test hợp đồng ---"
npx vitest run tests/student-error-ux.test.ts --reporter=verbose

# 2. TypeScript type-check hai file phạm vi
echo "--- Kiểm tra TypeScript ---"
npx tsc --noEmit -p tsconfig.json

echo "=== TASK-057: Tất cả kiểm tra đạt ==="
