#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-035 — do trưởng phòng viết, file này bị khoá.
# Chạy từ thư mục gốc repo. Exit 0 = đạt.
set -euo pipefail

# Máy hay quá tải (nhiều phiên song song) → giới hạn worker để PGlite không timeout.
npx vitest run --maxWorkers=4
npx tsc --noEmit
