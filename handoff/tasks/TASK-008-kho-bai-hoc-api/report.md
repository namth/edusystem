# Báo cáo TASK-008: API câu hỏi dùng chung, Kho bài học, lộ trình nhận lesson_id

## Đã làm
- Hiện thực hóa API câu hỏi dùng chung (`/api/teacher/questions` POST, `/api/teacher/questions/[id]` PUT) kiểm tra phân quyền chặt chẽ (`ADMIN`, `TEACHER`), hỗ trợ 17 loại câu hỏi hợp lệ, chuẩn hóa content nhưng giữ nguyên đáp án trong DB, kiểm tra quyền sửa câu hỏi `canEditQuestion` với câu hỏi cũ `created_by IS NULL` qua `exams` / `lessons`.
- Hiện thực hóa API Kho bài học (`/api/teacher/lessons` GET/POST, `/api/teacher/lessons/[id]` GET/PUT/DELETE) đáp ứng DEC-004 và DEC-005: giáo viên chỉ quản lý bài học của mình, ADMIN xem/sửa tất cả; GET trả kèm danh sách câu hỏi giữ nguyên thứ tự và thẻ flashcard tham chiếu; PUT tự động tính lại danh sách kỹ năng `skills` theo thứ tự xuất hiện của câu hỏi và kiểm tra `canUseQuestion`; DELETE trả 409 kèm danh sách khóa học sử dụng nếu bài học đang được gắn trong lộ trình.
- Cập nhật API lộ trình `/api/teacher/curriculum`: GET trả trường `lesson_id`, POST bắt buộc `lesson_id` với mục `LESSON` (kiểm tra bài học tồn tại, quyền sở hữu của giáo viên, và bài học phải có ≥ 1 khối câu hỏi theo BR-L03), PUT hỗ trợ cập nhật `lesson_id` với ràng buộc tương tự.
- Bổ sung DDL migration 007 (`questions.created_by` và index `idx_questions_created_by`) vào hàm `ensureSchema()` trong `lib/db-pg.ts`.
- Bảo mật: Tất cả các route trên đều yêu cầu vai trò `ADMIN` hoặc `TEACHER`, trả 403 nếu `STUDENT` truy cập, không có nguy cơ lộ đáp án cho học sinh.
- Chạy `python3 scripts/handoff.py verify TASK-008` đạt exit 0 toàn bộ 12 test files (298 tests) và kiểm tra TypeScript `tsc --noEmit` không có lỗi.

## File đã tạo/sửa
- `lib/db-pg.ts`: Thêm DDL migration 007 (`ALTER TABLE questions ADD COLUMN IF NOT EXISTS created_by VARCHAR(50); CREATE INDEX IF NOT EXISTS idx_questions_created_by ON questions (created_by);`) vào `ensureSchema`.
- `app/api/teacher/questions/route.ts`: API POST tạo câu hỏi dùng chung mới.
- `app/api/teacher/questions/[id]/route.ts`: API PUT cập nhật câu hỏi có kiểm quyền `canEditQuestion`.
- `app/api/teacher/lessons/route.ts`: API GET (lọc `q`, `skill`, phân quyền, tính `block_count`, `usage_count`) và POST tạo bài học.
- `app/api/teacher/lessons/[id]/route.ts`: API GET (kèm câu hỏi theo thứ tự và flashcards tham chiếu), PUT (cập nhật thông tin, question_ids và tính lại skills), DELETE (kiểm tra liên kết lộ trình, trả 409 nếu đang dùng).
- `app/api/teacher/curriculum/route.ts`: Mở rộng API lộ trình nhận và trả `lesson_id` cho các mục `LESSON`.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-008-kho-bai-hoc-api/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-008

 ✓ tests/ai-import.test.ts (13 tests) 3788ms
 ✓ tests/api-auth.test.ts (11 tests) 2038ms
 ✓ tests/curriculum-api.test.ts (24 tests) 14354ms
 ✓ tests/curriculum-dnd.test.ts (23 tests) 211ms
 ✓ tests/exam-flow.test.ts (27 tests) 14757ms
 ✓ tests/grading-hardening.test.ts (28 tests) 420ms
 ✓ tests/grading.test.ts (69 tests) 798ms
 ✓ tests/lessons-api.test.ts (18 tests) 14856ms
 ✓ tests/migration-006.test.ts (13 tests) 2387ms
 ✓ tests/secrets-password.test.ts (26 tests) 1667ms
 ✓ tests/student-pages.test.ts (18 tests) 6667ms
 ✓ tests/student-api.test.ts (28 tests) 46233ms

 Test Files  12 passed (12)
      Tests  298 passed (298)
   Start at  12:03:42
   Duration  47.11s (transform 1.96s, setup 0ms, collect 2.18s, tests 263.65s, environment 3ms, prepare 2.76s)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
