# Báo cáo TASK-057

## Đã làm
- Bỏ hoàn toàn `alert()` và `confirm()` ở cả 2 trang (`app/student/lesson/[lessonId]/page.tsx` và `app/student/exam/[examId]/page.tsx`), thay bằng khung thông báo `role="alert"` trên trang và modal xác nhận khi chưa làm hết câu hỏi.
- Xử lý phản hồi `code: "CLASS_LOCKED"`: hiển thị khung cảnh báo "Lớp học đang bị khoá — liên hệ giáo viên để biết thêm chi tiết." kèm liên kết dẫn về `/student/dashboard`, không để lộ mã HTTP.
- Xử lý các phản hồi 403 khác (chưa ghi danh / chưa mở) và 409 (hết lượt) với thông báo tiếng Việt riêng biệt, loại bỏ toàn bộ các chuỗi mã lỗi HTTP thô `(403)`, `(409)`, `(400)`.
- Xử lý lỗi tạo lượt làm bài ở `checkInitialStatus` trong trang đề thi: khi POST `/attempts` thất bại (403 lớp khoá, 403 chưa ghi danh, 409 hết lượt...), lập tức gán `errorMessage` và chuyển `phase = "error"`, không nuốt lỗi để rơi xuống màn "start".
- Đảm bảo giữ đủ 4 trạng thái giao diện: loading, empty/start, error, running/data.
- Toàn bộ 43/43 test hợp đồng nghiệm thu trong `tests/student-error-ux.test.ts` đã đạt (PASS 100%).

## File đã tạo/sửa
- `app/student/lesson/[lessonId]/page.tsx`: Xử lý lỗi nộp bài inline với `role="alert"`, thông báo `CLASS_LOCKED` có link về `/student/dashboard`, modal xác nhận nộp bài thay cho `window.confirm()`, phân biệt 403 lớp khoá và 403 khác.
- `app/student/exam/[examId]/page.tsx`: Xử lý lỗi tạo lượt thi trong `checkInitialStatus` ngay tại bước khởi tạo, xử lý 403 `CLASS_LOCKED` và 409 không lộ mã HTTP thô, thêm `role="alert"`, link về Dashboard khi lớp khoá.

## Kết quả tự kiểm
- Test hợp đồng `tests/student-error-ux.test.ts`:
```
 ✓ tests/student-error-ux.test.ts (43 tests) 14ms

 Test Files  1 passed (1)
      Tests  43 passed (43)
```

- Kiểm tra TypeScript toàn dự án (`npx tsc --noEmit -p tsconfig.json`): Exit code 0, không có lỗi.
- Kiểm tra phạm vi (`python3 scripts/handoff.py scope TASK-057`): `PHẠM VI: OK`.

- Output từ `bash handoff/tasks/TASK-057-student-error-ux/verify.sh`:
```
=== TASK-057: Trang làm bài học sinh — bỏ alert, thông báo lớp khoá và lỗi thân thiện ===
--- Chạy test hợp đồng ---

 ✓ tests/student-error-ux.test.ts (43 tests) 14ms

 Test Files  1 passed (1)
      Tests  43 passed (43)

--- Kiểm tra TypeScript ---
Found 334 errors in 7 files.
Errors  Files
     1  ../../learningsystem/node_modules/next/dist/client/components/segment-cache/cache.d.ts:104
     1  ../../learningsystem/node_modules/next/dist/client/link.d.ts:1
     1  ../../learningsystem/node_modules/next/dist/shared/lib/app-router-context.shared-runtime.d.ts:4
     1  ../../learningsystem/node_modules/next/dist/shared/lib/app-router-types.d.ts:7
     1  ../../learningsystem/node_modules/next/dist/shared/lib/server-inserted-html.shared-runtime.d.ts:1
   209  app/student/exam/[examId]/page.tsx:6
   120  app/student/lesson/[lessonId]/page.tsx:6
```

## Điểm lệch / câu hỏi cho trưởng phòng
- Lệnh type-check trong `verify.sh` do kỹ sư kiểm thử viết gặp lỗi cấu hình TypeScript CLI:
  Dòng 14 của `verify.sh`:
  ```bash
  npx tsc --noEmit --pretty \
    app/student/lesson/\[lessonId\]/page.tsx \
    app/student/exam/\[examId\]/page.tsx
  ```
  Theo tài liệu chính thức của TypeScript: khi truyền tên file trực tiếp trên dòng lệnh, `tsc` sẽ bỏ qua `tsconfig.json` (*"Ignoring tsconfig.json, compiles the specified files with default compiler options"*). Khi đó `tsc` không có cấu hình `--jsx react-jsx`, không có cấu hình `@/*` path alias, không có `esModuleInterop` và `skipLibCheck`, dẫn đến việc báo 334 lỗi cú pháp JSX và import (ngay cả code gốc tại `HEAD` trước khi sửa cũng bị 312 lỗi tương tự khi chạy lệnh này).
- Khi chạy type-check kèm cấu hình của dự án (`npx tsc --noEmit -p tsconfig.json`), code hai file đều đạt 0 lỗi.
- Tuân thủ Quy tắc 2 và Quy tắc 11: File `verify.sh` đã bị khoá trong `tests.lock` nên người code không tự ý chỉnh sửa test hay lách test, dừng lại báo cáo và đề xuất trưởng phòng cập nhật lệnh type-check trong `verify.sh` thành `npx tsc --noEmit -p tsconfig.json` (tương tự như các task TASK-001..010, TASK-013, TASK-046..047).
