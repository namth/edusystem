# Báo cáo TASK-005

## Đã làm
- Tạo route `GET /api/exams/[id]/content`: kiểm tra phiên đăng nhập bằng `requireRole()`, trả `exam`, `questions` (đúng thứ tự `question_ids`, bỏ qua id không tồn tại), và `flashcards` được tham chiếu bởi các câu hỏi category FLASHCARD. Nếu không tìm thấy đề trả 404.
- Tạo route `GET /api/submissions/[id]`: kiểm tra quyền bằng `requireRole()`, chặn học sinh khác xem bài người khác (403), trả 404 nếu không tìm thấy bài nộp, trả `submission`, `exam` (hoặc null nếu đã xoá), và `questions` theo đúng thứ tự `exam.question_ids`. TEACHER và ADMIN xem được mọi bài.
- Tạo route công khai `GET /api/classes/lookup/[ref]`: tra cứu lớp theo id hoặc code (không phân biệt hoa thường), trả 404 nếu không tìm thấy. Chỉ trả đúng 8 trường dữ liệu an toàn (`id`, `name`, `code`, `schedule`, `max_slots`, `teacher_name`, `enrolled_count`, `is_enrolled`). `is_enrolled` tính từ cookie học sinh đang đăng nhập.
- Cập nhật `app/student/exam/[examId]/page.tsx`: chuyển sang tải đề qua `GET /api/exams/${examId}/content`, dựng `flashcards_resolved` từ `flashcards` trả về, xử lý 404 ("Không tìm thấy đề thi." + link về dashboard), xử lý lỗi và đề rỗng; bỏ trường `student_id` khi POST `/api/submissions`; bỏ import `@/lib/supabase` và các fallback giả.
- Cập nhật `app/student/exam/review/[submissionId]/page.tsx`: chuyển sang tải bài qua `GET /api/submissions/${submissionId}`, xử lý lỗi 403, 404 và các lỗi khác có nút "Thử lại"; giữ cơ chế polling 3 giây khi bài đang chấm; bỏ import `@/lib/supabase` và các fallback giả.
- Cập nhật `app/join/[classId]/page.tsx`: lấy thông tin lớp qua `GET /api/classes/lookup/${classId}`, xử lý 404; ẩn thông tin giáo viên nếu `teacher_name` null; thay logic ghi danh bằng gọi `POST /api/student/enroll` với `{ code }`; xử lý lỗi 409 (lớp đủ chỗ) và 403 (chỉ tài khoản học sinh); bỏ import `@/lib/supabase` và `@/lib/neo4j`.
- Tự kiểm bằng `python3 scripts/handoff.py verify TASK-005`: khoá test toàn vẹn, 176/176 tests qua, TypeScript check không lỗi, exit 0.

## File đã tạo/sửa
- `app/api/exams/[id]/content/route.ts`: API route trả nội dung đề thi, danh sách câu hỏi theo thứ tự và flashcards liên quan.
- `app/api/submissions/[id]/route.ts`: API route trả chi tiết bài nộp, đề thi và các câu hỏi, có kiểm soát quyền truy cập.
- `app/api/classes/lookup/[ref]/route.ts`: API route công khai tra cứu thông tin lớp và trạng thái ghi danh của học sinh.
- `app/student/exam/[examId]/page.tsx`: Trang làm bài thi dùng API pg nội dung đề, xử lý các trạng thái lỗi/rỗng và không gửi student_id client-side.
- `app/student/exam/review/[submissionId]/page.tsx`: Trang xem lại bài thi dùng API pg, xử lý 403/404 và polling khi đang chấm AI.
- `app/join/[classId]/page.tsx`: Trang tham gia lớp dùng API lookup và API ghi danh học sinh, xử lý 409/403 và bỏ Supabase/Neo4j client.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-005-lam-bai-xem-lai-pg/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/phoi-hop-antigravity-review-468cb6

 ✓ tests/api-auth.test.ts (87 tests) 1014ms
 ✓ tests/secrets-password.test.ts (16 tests) 2107ms
 ✓ tests/student-pages.test.ts (18 tests) 1528ms
 ✓ tests/exam-flow.test.ts (27 tests) 21690ms
 ✓ tests/student-api.test.ts (28 tests) 22210ms

 Test Files  5 passed (5)
      Tests  176 passed (176)
   Start at  08:48:03
   Duration  22.89s (transform 900ms, setup 0ms, collect 672ms, tests 63.63s, environment 1ms, prepare 502ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
