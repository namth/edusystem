# Báo cáo TASK-038

## Đã làm
- Tạo file migration `docs/db-migration-014-ai-usage.sql` và cập nhật `ensureSchema()` trong `lib/db-pg.ts` với DDL chạy lặp an toàn (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, seed `ai_pricing`).
- Hiện thực thư viện thuần `lib/ai-pricing.ts` chứa `DEFAULT_AI_PRICING`, `findModelPrice` (khớp chính xác / phần sau dấu "/" cuối / không phân biệt hoa thường), `costUsd`, `usdToVnd`, và `validateAiPricing` (thông báo lỗi tiếng Việt).
- Hiện thực thư viện server `lib/ai-usage.ts` sử dụng `node:async_hooks` (`AsyncLocalStorage`) gồm `withAiUsageContext`, `getAiUsageContext`, `getAiPricing`, và `recordAiUsage` (là nơi duy nhất trong app/lib/worker thực hiện `INSERT INTO ai_usage_logs`, bọc try/catch không ném lỗi ra ngoài).
- Gắn `recordAiUsage` vào `lib/ai-engine.ts` (các lệnh gọi Portkey, OpenAI thành công) và `lib/document-parser.ts` (cả 6 nhánh: Gemini REST đọc `usageMetadata`, Portkey, OpenAI).
- Dọn dẹp `lib/portkey.ts` (bỏ token bịa 850/320, bỏ chi phí 0.002, bỏ `CREATE TABLE` và `INSERT`, chuyển sang dùng `recordAiUsage`).
- Dọn dẹp `app/api/teacher/exams/ai-import/route.ts` (xoá hoàn toàn đoạn SAVEPOINT và INSERT log bịa).
- Bọc ngữ cảnh `withAiUsageContext`:
  - `app/api/exam/grade-async/route.ts`: bọc ngữ cảnh `EXAM_GRADING` kèm `submissionId`, `studentId`, `teacherId` (giáo viên lớp `class_ref`, nếu không có lấy người tạo đề).
  - `app/api/lessons/grade-async/route.ts`: bọc ngữ cảnh `LESSON_GRADING` kèm `lessonAttemptId`, `studentId`, `teacherId` (giáo viên của lớp).
  - `app/api/teacher/exams/ai-parse/route.ts` và `app/api/admin/parse-exam-text/route.ts`: bọc ngữ cảnh `EXAM_IMPORT` với `teacherId` là người gọi.
- Tạo API route `app/api/admin/settings/ai-pricing/route.ts` (chỉ ADMIN) hỗ trợ `GET` (trả `pricing` và `unpriced_models` sắp xếp theo chữ cái) và `PUT` (xác thực dữ liệu, upsert `system_settings`).
- Cập nhật giao diện `app/admin/settings/page.tsx` thêm khối "Bảng giá model AI & Tỷ giá" đáp ứng chuẩn DEC-022 và DEC-035.

## File đã tạo/sửa
- `docs/db-migration-014-ai-usage.sql`: Migration tạo bảng `ai_usage_logs`, thêm cột, index và seed `ai_pricing`.
- `lib/db-pg.ts`: Bổ sung DDL migration 014 vào `ensureSchema()`.
- `lib/ai-pricing.ts`: Module thuần tính toán chi phí token và xác thực cấu hình bảng giá.
- `lib/ai-usage.ts`: Module server quản lý ngữ cảnh gọi AI và ghi nhận log usage.
- `lib/ai-engine.ts`: Ghi nhận token usage thật từ response sau mỗi lần gọi model.
- `lib/document-parser.ts`: Ghi nhận token usage thật cho tất cả các nhánh phân tích tài liệu và cấu trúc đề.
- `lib/portkey.ts`: Dọn dẹp token bịa, sử dụng hàm `recordAiUsage`.
- `app/api/exam/grade-async/route.ts`: Bọc ngữ cảnh `EXAM_GRADING` cho lượt chấm thi.
- `app/api/lessons/grade-async/route.ts`: Bọc ngữ cảnh `LESSON_GRADING` cho lượt chấm bài học.
- `app/api/teacher/exams/ai-parse/route.ts`: Bọc ngữ cảnh `EXAM_IMPORT` cho bước parse file đề.
- `app/api/admin/parse-exam-text/route.ts`: Bọc ngữ cảnh `EXAM_IMPORT` cho bước bóc tách text đề.
- `app/api/teacher/exams/ai-import/route.ts`: Xoá bỏ đoạn ghi log bịa cũ.
- `app/api/admin/settings/ai-pricing/route.ts`: API GET/PUT quản lý cấu hình bảng giá và tỷ giá cho ADMIN.
- `app/admin/settings/page.tsx`: Giao diện cấu hình bảng giá model AI và tỷ giá USD→VND.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-038-ghi-nhan-token-ai/verify.sh

 Test Files  48 passed (48)
      Tests  846 passed (846)
   Start at  23:16:38
   Duration  359.84s (transform 29.45s, setup 0ms, collect 17.19s, tests 1369.91s, environment 16ms, prepare 9.59s)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
