#!/bin/bash
# Hook PostToolUse (Edit/Write/MultiEdit): chạy eslint trên đúng file Claude vừa sửa.
# Có lỗi → exit 2 để Claude thấy lỗi và tự sửa; không có lỗi hoặc không phải file JS/TS → im lặng.

file=$(jq -r '.tool_input.file_path // empty')
[ -z "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac
case "$file" in
  */node_modules/*|*/.next/*) exit 0 ;;
esac
[ -f "$file" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
eslint=node_modules/.bin/eslint
[ -x "$eslint" ] || exit 0

if ! out=$("$eslint" --no-warn-ignored "$file" 2>&1); then
  echo "eslint báo lỗi ở $file:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
