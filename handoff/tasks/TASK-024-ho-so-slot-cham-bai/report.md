# Báo cáo TASK-024

## Đã làm
- **Xoá lỗ hổng bảo mật nghiêm trọng trong hồ sơ**: Loại bỏ hoàn toàn thao tác ghi thẳng vào `users` từ trình duyệt tại `app/profile/page.tsx`, đặc biệt là ghi mật khẩu thô và email. Chuyển sang route `/api/profile` (chỉ cho phép cập nhật `name`, `phone`, `target_band`) và tách biệt phần đổi mật khẩu qua route có sẵn `POST /api/auth/change-password` (tuân thủ mã hóa scrypt và tiêu chuẩn OWASP). Email chỉ hiển thị.
- **Tạo API `/api/profile` (GET, PUT)**: Cho phép mọi người dùng đã đăng nhập xem hồ sơ cá nhân và tự cập nhật họ tên (trim không rỗng, trả lỗi 400 nếu rỗng), số điện thoại, mục tiêu band điểm; loại bỏ/bỏ qua mọi trường khác (password, email, role, slot_limit).
- **Tạo API `/api/teacher/slot-requests` (GET, POST)**: Dành cho ADMIN và TEACHER. Cho phép xem lịch sử đơn mua slot của chính mình (sắp xếp mới nhất trước) và tạo đơn yêu cầu mở rộng slot sĩ số (`requested_slots` nguyên từ 1 đến 10.000, trả lỗi 400 nếu sai). Giá và thông tin giáo viên được xác định và tính hoàn toàn ở server từ biến môi trường `SLOT_UNIT_PRICE_VND` và bảng `users`.
- **Cập nhật trang mua slot `app/teacher/slots/page.tsx`**: Tải danh sách đơn mua qua `GET /api/teacher/slot-requests`, tạo đơn qua `POST /api/teacher/slot-requests` (không tự chèn giá hay giáo viên từ client), hiển thị tổng chi phí và trạng thái đơn do server trả về.
- **Tạo API `GET /api/teacher/submissions`**: Dành cho ADMIN và TEACHER. Giáo viên chỉ thấy các bài nộp của đề do mình tạo hoặc lớp do mình giảng dạy; Admin thấy toàn bộ bài nộp; hỗ trợ lọc theo tham số `status`; trả về danh sách có tên đề và tên học sinh kết nối từ bảng `exams` và `users`.
- **Cập nhật trang chấm bài `app/teacher/grading/page.tsx`**: Tải danh sách bài nộp từ `GET /api/teacher/submissions` kèm các bộ lọc trạng thái ("Chờ chấm" / `NEEDS_REVIEW`, "Đang chấm AI" / `GRADING`, "Đã chấm" / `GRADED`). Hiển thị chi tiết `section_scores` từng kỹ năng, hỗ trợ nhập điểm điều chỉnh (ưu tiên Writing, Speaking) và nhận xét của giáo viên, gửi qua `PUT /api/exam/grade-override { submissionId, section_scores, feedback }`. Xử lý hiển thị lỗi 400 (điểm ngoài thang chuẩn chấm) từ API. Loại bỏ toàn bộ logic cũ (`questionId`, `overriddenScore`, `teacher_01`).
- **Xoá import `@/lib/supabase` thừa**: Đã loại bỏ hoàn toàn `@/lib/supabase` và các lời gọi `supabase.` khỏi cả 4 trang client (`app/profile/page.tsx`, `app/teacher/slots/page.tsx`, `app/teacher/grading/page.tsx`, `app/teacher/tests/page.tsx`).
- Tự kiểm tra với `python3 scripts/handoff.py verify TASK-024`: pass toàn bộ 29 test files (570 tests) và TypeScript check exit 0.

## File đã tạo/sửa
- `app/api/profile/route.ts`: API GET/PUT hồ sơ người dùng bảo mật qua `requireRole` và SQL tham số hoá.
- `app/api/teacher/slot-requests/route.ts`: API GET/POST đơn yêu cầu mua slot tính chi phí phía server.
- `app/api/teacher/submissions/route.ts`: API GET danh sách bài nộp có phân quyền giáo viên theo đề/lớp và lọc status.
- `app/profile/page.tsx`: Giao diện hồ sơ người dùng dùng `/api/profile`, đổi mật khẩu qua `/api/auth/change-password`, bỏ Supabase client.
- `app/teacher/slots/page.tsx`: Giao diện mua slot học viên qua API `/api/teacher/slot-requests`, bỏ Supabase client.
- `app/teacher/grading/page.tsx`: Giao diện chấm bài và override điểm kỹ năng qua `/api/teacher/submissions` và `PUT /api/exam/grade-override`, bỏ Supabase client.
- `app/teacher/tests/page.tsx`: Xoá import `@/lib/supabase` không dùng.

## Kết quả tự kiểm
```
 ✓ tests/standard-selection.test.ts (6 tests) 29626ms
   ✓ API đề thi nhận scoring_standard_id > POST với chuẩn hợp lệ → lưu; chuẩn không tồn tại → 400  15327ms
   ✓ API đề thi nhận scoring_standard_id > PUT đổi chuẩn và bỏ chuẩn (null); GET trả scoring_standard_id  6329ms
   ✓ API khóa học nhận default_scoring_standard_id > POST/PUT lưu chuẩn mặc định; chuẩn không tồn tại → 400; GET trả trường  5035ms
   ✓ Giao diện chọn chuẩn > QuestionSetEditor (mode EXAM) có select chuẩn chấm từ /api/scoring-standards và gửi scoring_standard_id  1251ms
   ✓ Giao diện chọn chuẩn > trang tạo đề truyền scoring_standard_id khi lưu/tải  902ms
   ✓ Giao diện chọn chuẩn > modal khóa học ở /teacher/tests có chuẩn mặc định  746ms

 ✓ tests/migration-006.test.ts (13 tests) 29793ms
   ✓ docs/db-migration-006-lessons.sql > chạy thành công và chạy lại lần 2 không lỗi  14254ms
   ✓ docs/db-migration-006-lessons.sql > tạo bảng lessons, class_unlocks, lesson_attempts và cột mới  6040ms
   ✓ docs/db-migration-006-lessons.sql > lớp cũ nhận mặc định unlock_mode = MANUAL, pass_percent = 70  6253ms
   ✓ docs/db-migration-006-lessons.sql > xoá nút LESSON chưa có lesson_id, giữ UNIT và EXAM (DEC-012)  1712ms
   ✓ docs/db-migration-006-lessons.sql > class_unlocks: không trùng (lớp, mục) cho cả lớp, nhưng cho phép thêm dòng mở riêng từng học sinh  863ms
   ✓ docs/db-migration-006-lessons.sql > lessons.question_ids và skills có mặc định rỗng; lesson_attempts.status mặc định GRADED  664ms

 ✓ tests/lesson-preview.test.ts (5 tests) 14061ms
   ✓ GET /api/teacher/lessons/[id]/preview — nội dung giống học sinh thấy > chưa đăng nhập 401; STUDENT 403; bài của GV khác 403; không có 404  9811ms
   ✓ GET /api/teacher/lessons/[id]/preview — nội dung giống học sinh thấy > câu hỏi đúng thứ tự, đã ẩn đáp án; flashcard đã ẩn từ đúng  1927ms
   ✓ POST /api/teacher/lessons/[id]/preview — chấm thử, KHÔNG lưu > trả kết quả từng câu kèm đáp án + điểm khách quan; câu AI chỉ đánh dấu; không ghi lesson_attempts  934ms
   ✓ POST /api/teacher/lessons/[id]/preview — chấm thử, KHÔNG lưu > answers không phải object → 400; bài của GV khác → 403  808ms
   ✓ Nút Xem trước trong trang soạn bài > app/teacher/lessons/[id]/page.tsx dùng LessonPlayer và gọi /preview  578ms

 Test Files  29 passed (29)
      Tests  570 passed (570)
   Start at  16:33:40
   Duration  500.89s (transform 63.85s, setup 0ms, collect 27.32s, tests 3380.29s, environment 24ms, prepare 14.84s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
