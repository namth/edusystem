#!/usr/bin/env bash
# Lệnh xác minh tự động cho TASK-015 — do trưởng phòng viết, file này bị khoá.
# TASK-013, TASK-014 chạy song song → loại test của chúng khỏi Vitest và tsc.
set -euo pipefail

npx vitest run --exclude tests/lesson-library-ui.test.ts --exclude tests/lesson-player.test.ts
npx tsc --noEmit -p handoff/tasks/TASK-015-flashcard-upload-api/tsconfig.verify.json
