#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-060 — do kỹ sư kiểm thử chéo viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

echo "=== TASK-060: Siết API lớp học sinh: vai trò, bỏ cột nội bộ, thứ tự kiểm quyền ==="

# 1. Chạy test nghiệm thu chéo siết API lớp học sinh
echo "--- 1. Chạy test nghiệm thu chéo (tests/student-classes-hardening.test.ts) ---"
npx vitest run tests/student-classes-hardening.test.ts

# 2. Đảm bảo không phá vỡ các test liên quan hiện có (student-lessons-api, slot-wallet-api)
echo "--- 2. Chạy regression tests (student-lessons-api, slot-wallet-api) ---"
npx vitest run tests/student-lessons-api.test.ts tests/slot-wallet-api.test.ts

# 3. Kiểm tra kiểu TypeScript toàn bộ dự án
echo "--- 3. Kiểm tra TypeScript ---"
npx tsc --noEmit

echo "=== TASK-060 verify: TẤT CẢ ĐẠT ==="
