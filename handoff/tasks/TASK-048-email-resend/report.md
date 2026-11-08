# Báo cáo TASK-048 — Gửi email qua Resend

## Đã làm
- [x] `verify.sh` exit 0; `tests/forgot-password-security.test.ts` và `tests/docs-sync.test.ts` vẫn xanh.
- [x] Không có `RESEND_API_KEY` → `sendEmail` không gọi `fetch`, trả `skipped: true`.
- [x] Có cấu hình → `fetch` được gọi đúng URL, header `Authorization: Bearer <key>`, body có `from/to/subject/html/text`.
- [x] Resend trả 500 hoặc fetch ném lỗi → `sendEmail` trả `ok:false`, không ném lỗi.
- [x] Email đuôi `@kito.io.vn` không được gửi (`skipped: true`).
- [x] `forgot-password` với email thật + có cấu hình → gửi đúng 1 email tới đúng địa chỉ, html chứa link reset password kèm token trong DB; response không chứa token.
- [x] `forgot-password` với email không tồn tại → không gửi email; response giống hệt ca có email (chống dò tài khoản).
- [x] `createNotification` type `ORDER_APPROVED` → gửi email tới email người nhận; type `EXAM_GRADED` → không gửi.
- [x] Tên hoặc nội dung chứa ký tự đặc biệt/HTML (`<script>`) được escape an toàn trong html.
- [x] Gọi `createNotification` khi Resend lỗi vẫn resolve bình thường, không gây sập luồng chính.

## File đã tạo/sửa
- `lib/mailer.ts`: Module gửi email giao dịch qua Resend bằng fetch native, timeout 10s, bỏ qua email placeholder `@kito.io.vn`, helper `appBaseUrl()`.
- `lib/email-templates.ts`: Các hàm thuần dựng mẫu email (`resetPasswordEmail`, `notificationEmail`), escape HTML an toàn, kèm thông tin thương hiệu & hotline.
- `lib/notifications.ts`: Tích hợp gửi email trong `createNotification` cho 5 loại sự kiện (`TEACHER_SIGNUP`, `ORDER_PAID_REPORTED`, `ORDER_APPROVED`, `ORDER_REJECTED`, `TEACHER_VERIFIED`) khi thực sự tạo dòng mới (`RETURNING (xmax = 0)`).
- `app/api/auth/forgot-password/route.ts`: Tích hợp gửi email link đặt lại mật khẩu khi email hợp lệ, giữ nguyên response `GENERIC_MESSAGE` và không log token.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-048-email-resend/verify.sh
… 44 dòng, log đầy đủ: /var/folders/38/_wzbbc7n3nb375zpmvlkr8100000gp/T/handoff-verify/TASK-048-TASK-048-email-resend.log
      Tests  46 passed (46)
   Start at  12:31:36
   Duration  16.13s (transform 403ms, setup 0ms, collect 540ms, tests 31.80s, environment 1ms, prepare 335ms)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không. Dòng test 361 trong `mailer.test.ts` đã được đồng bộ kiểm tra title theo brief; 46/46 test pass và TypeScript check đạt chuẩn.
