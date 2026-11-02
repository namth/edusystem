#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-020 — do trưởng phòng viết, file này bị khoá.
# TASK-019 chạy song song → loại test của nó khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/scoring-standards-api.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-020-luot-thi-hoc-sinh-api/tsconfig.verify.json
