# 04 — Luồng người dùng

> Cập nhật: 2026-11-03 · Chi tiết từng bước và các nhánh lỗi nằm trong `docs/features/*`; file này tóm luồng chính theo code hiện tại.

## UF-01 Học sinh đăng ký & vào lớp (FEAT-012)
1. `/register`: phỏng vấn từng câu (email trùng được báo ngay khi gõ qua `GET /api/auth/email-available`; nháp lưu ở máy để tải lại không mất) (tên → có email không? → email hoặc tên đăng nhập → mật khẩu → cấp học / mục tiêu → mã lớp, có thể bỏ qua) → `POST /api/auth/register`.
2. Không có email thì hệ thống tạo `username` và email tạm `<username>@kito.io.vn` (`email_is_placeholder = true`).
3. Có mã lớp thì ghi danh luôn (`enrollStudentByCode`). Mã sai hoặc lớp đầy thì vẫn tạo tài khoản, trả `enrolled = null` kèm `enrollError`.
4. Cookie `auth_token` được đặt, chuyển tới `/student/dashboard`.

**Vào lớp sau:** nhập mã ở dashboard (`POST /api/student/enroll`) hoặc mở link mời `/join/[classId]` (xem trước qua `GET /api/classes/lookup/[ref]`).

**Thứ tự kiểm khi ghi danh:**
1. Giới hạn dùng thử: giáo viên dùng thử tối đa 3 học sinh.
2. Slot học sinh của giáo viên (DEC-031).
3. Sĩ số lớp (`max_slots`).

Mỗi bước không đạt đều trả 409.

## UF-02 Giáo viên tự đăng ký → dùng thử → được xác minh (FEAT-012)
1. `/register/teacher`: phỏng vấn kèm khảo sát → `POST /api/auth/register/teacher`. Tạo user `TEACHER` với `teacher_status = 'TRIAL'`, `slot_limit` = giới hạn dùng thử, lưu `teacher_profiles.answers`, gửi thông báo `TEACHER_SIGNUP` cho mọi admin.
2. Trong thời gian dùng thử, banner hiện tiến độ (`GET /api/teacher/trial-usage`); mọi thao tác vượt giới hạn trả 403 `TRIAL_LIMIT`.
3. Admin mở `/admin/teachers?status=TRIAL` → chi tiết → **Xác minh** hoặc **Từ chối** (`POST /api/admin/teachers/[id]/verify`).
   - Xác minh: `VERIFIED`, `slot_limit = GREATEST(slot_limit, 250)`.
   - Từ chối: giữ giới hạn dùng thử.
   - Cả hai trường hợp đều gửi thông báo `TEACHER_VERIFIED`.

## UF-03 Giáo viên dựng khoá học & lớp (FEAT-010)
1. `/teacher/tests`: tạo khoá học, dựng cây giáo trình (UNIT → LESSON / EXAM), kéo-thả.
2. `/teacher/lessons`: soạn bài học từ các khối câu hỏi (15 dạng dùng chung với đề thi).
3. `/teacher/tests/create` hoặc `/teacher/library`: soạn đề, hoặc **AI nhập đề** (UF-08). Chọn chuẩn chấm cho đề; không chọn thì đề dùng chuẩn của khoá học.
4. `/teacher/classes`: tạo lớp, gắn khoá học, chọn `unlock_mode` (MANUAL / SEQUENTIAL / ALL_OPEN) và `pass_percent`.
5. Thêm học viên: theo email, tạo mới, hoặc gửi mã / link mời. Giao đề cho lớp với `max_attempts` và hạn nộp.

## UF-04 Học sinh học theo lộ trình (FEAT-010)
1. `/student/class/[classId]`, tab Lộ trình: `GET /api/student/classes/[classId]/roadmap` trả trạng thái từng mục (khoá / mở / hoàn thành) theo `unlock_mode`.
2. Mở bài học (`/student/lesson/[lessonId]`) rồi nộp (`POST /api/student/lessons/[lessonId]/attempts`).
   - Câu khách quan được chấm ngay.
   - Có tự luận / trả lời ngắn thì bài ở trạng thái `GRADING` và đẩy sự kiện `LESSON_GRADING_REQUESTED`. Worker gọi `POST /api/lessons/grade-async` để chấm.
3. Làm lại không giới hạn; tiến độ tính theo điểm cao nhất. Ở chế độ SEQUENTIAL, mục sau mở khi mục trước đạt `pass_percent`.

## UF-05 Làm đề thi → chấm → thông báo (FEAT-011)
1. `POST /api/student/exams/[examId]/attempts` (kèm `classId` nếu đề thuộc lớp): server tạo lượt thi `IN_PROGRESS` với `started_at` và `deadline_at`, chụp lại chuẩn chấm vào `standard_snapshot`, kiểm số lần làm.
2. `GET /api/student/exams/[examId]/content` trả nội dung đề **không kèm đáp án**. Trong khi làm, bài được lưu nháp bằng `PUT …/answers`.
3. Nộp bằng `POST /api/student/exam-attempts/[id]/submit`, chấm câu khách quan ngay. Nộp sau hạn quá 2 phút thì gắn `is_late`.
   - Không có mục AI: bài `GRADED`, báo điểm tại chỗ.
   - Có Writing / Speaking: bài `GRADING`, đẩy `GRADING_REQUESTED` vào `stream:learning:grading`.
4. Worker gọi `POST /api/exam/grade-async` để chấm từng mục AI theo tiêu chí của chuẩn, tính điểm tổng, chuyển bài sang `GRADED` và gửi thông báo `EXAM_GRADED` cho học sinh.
5. AI lỗi 3 lần, hoặc worker bỏ cuộc (`giveUp`), thì bài chuyển `NEEDS_REVIEW` và giáo viên nhận thông báo `EXAM_NEEDS_REVIEW`. Giáo viên chấm tay ở `/teacher/grading` (`PUT /api/exam/grade-override`); xong thì bài `GRADED` và học sinh nhận thông báo.
6. Chấm AI **không trừ slot** (DEC-031).

## UF-06 Giáo viên mua slot học sinh (FEAT-013)
1. `/teacher/slots`: xem "Đang dùng X / Y slot". Nhập số slot rồi `POST /api/teacher/slot-requests`; server tính tiền = số slot × `slot_pricing.unit_price_vnd` và sinh mã đơn `KK…`.
2. Chuyển sang `/teacher/orders/[id]`: hiện QR VietQR, thông tin chuyển khoản, nội dung chuyển khoản là mã đơn.
3. Giáo viên chuyển khoản rồi bấm **Tôi đã chuyển khoản** (`report-paid`). Mọi admin nhận thông báo `ORDER_PAID_REPORTED`.
4. Admin đối chiếu sao kê ở `/admin/orders`, rồi duyệt hoặc từ chối.
   - **Duyệt:** cộng `slot_limit`, giáo viên nhận `ORDER_APPROVED`.
   - **Từ chối:** bắt buộc nhập lý do, giáo viên nhận `ORDER_REJECTED`.

## UF-07 Admin tạo đơn cho giáo viên (FEAT-013)
1. Ở `/admin/teachers/[id]`, khối "Tạo đơn mua slot", nhập số slot. Giá mặc định là giá chuẩn; admin được sửa giá, nhưng giá khác giá chuẩn thì bắt buộc ghi chú. Tặng 0đ cũng hợp lệ.
2. Server tạo đơn `source = ADMIN` và gửi `ORDER_CREATED` cho giáo viên.
3. Admin có thể duyệt ngay (đã thu tiền ngoài app), hoặc để giáo viên tự thanh toán theo UF-06 bước 2–4.

## UF-08 AI nhập đề (FEAT-009)
1. `/teacher/library`: tải lên DOCX / PDF / ảnh, tối đa 15MB → `POST /api/teacher/exams/ai-parse`. Server trích văn bản (mammoth / pdf-parse / OCR bằng AI) rồi để AI cấu trúc thành nhóm câu hỏi (tối đa 50 nhóm). Token được ghi với `purpose = EXAM_IMPORT`.
2. Giáo viên xem và sửa bản xem trước, rồi `POST /api/teacher/exams/ai-import`. Server tạo câu hỏi và đề trong một giao dịch, có thể gắn luôn vào khoá học hoặc unit.

## UF-09 Admin theo dõi vận hành (FEAT-013)
1. Vào `/admin`, chọn tháng, gọi `GET /api/admin/dashboard?month=YYYY-MM`. Màn hình hiện số tổng, số trong tháng tính theo giờ VN, biểu đồ theo ngày và top giáo viên dùng AI.
2. Có lần gọi AI với model chưa có giá thì hiện cảnh báo, dẫn sang `/admin/settings` để thêm giá.
3. Menu "Đơn hàng" hiện số đơn đang chờ (`counts.PENDING`).

## UF-10 Quên mật khẩu / mật khẩu tạm
1. `/forgot-password` gọi `POST /api/auth/forgot-password`, có giới hạn tần suất; server tạo `reset_token`. Người dùng đặt mật khẩu mới ở `/reset-password`.
2. Tài khoản do admin hoặc giáo viên tạo có cờ `must_change_password`. Khi đăng nhập, token mang cờ `mcp`, middleware chuyển về `/change-password`; đổi xong được cấp cookie mới.
