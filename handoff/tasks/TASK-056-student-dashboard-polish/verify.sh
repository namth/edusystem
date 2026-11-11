#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-056 — do kỹ sư kiểm thử viết.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

echo "=== TASK-056: Dashboard học sinh — bỏ dữ liệu giả, lỗi từng khối, lượt đang làm dở, huy hiệu lớp ==="

# 1. Chạy test nghiệm thu chéo
echo "--- Chạy test nghiệm thu ---"
npx vitest run tests/student-dashboard-polish.test.ts --reporter=verbose

# 2. Chạy test hiện có liên quan (student-home) để đảm bảo không phá
echo "--- Chạy test student-home cũ ---"
npx vitest run tests/student-home.test.ts --reporter=verbose

# 3. Kiểm tra design rules (brand token, gradient, nút)
echo "--- Chạy test design rules ---"
npx vitest run tests/design-rules.test.ts tests/brand-tokens.test.ts --reporter=verbose

echo "=== TASK-056 verify: TẤT CẢ ĐẠT ==="
