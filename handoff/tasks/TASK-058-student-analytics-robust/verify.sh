#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-058 — do kỹ sư kiểm thử viết.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

echo "=== TASK-058: Analytics học sinh — chịu lỗi API, nhận xét AI, nhãn đề đã xoá ==="

echo "--- Chạy test nghiệm thu TASK-058 ---"
npx vitest run tests/student-analytics-robust.test.ts --reporter=verbose

echo "--- TypeScript type-check file phạm vi ---"
npx tsc --noEmit --pretty app/student/analytics/page.tsx 2>&1 || {
  echo "FAIL: TypeScript type-check thất bại"
  exit 1
}

echo "=== TASK-058: TẤT CẢ ĐẠT ==="
exit 0
