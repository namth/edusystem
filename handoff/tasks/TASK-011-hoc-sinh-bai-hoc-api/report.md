# Báo cáo TASK-011

## Đã làm
- Hiện thực toàn bộ API phía học sinh và module nội bộ cho bài học theo đặc tả FEAT-010:
  - `lib/lesson-access.ts`: Kiểm tra quyền truy cập lớp, kiểm tra ghi danh, tính trạng thái lộ trình (`loadStudentRoadmap`), kiểm tra điều kiện mở bài học (`checkLessonAccess`).
  - `lib/lesson-ai-grading.ts`: Hàm chấm câu trả lời mở `gradeOpenAnswer` tích hợp AI engine chấm điểm band 0–9.
  - `GET /api/student/classes/[classId]/roadmap`: Trả thông tin lớp, tiến độ học tập (`progress_percent`), danh sách mục lộ trình kèm trạng thái (`LOCKED`/`OPEN`/`COMPLETED`) và điểm cao nhất `best_percent` của học sinh.
  - `GET /api/student/lessons/[lessonId]?classId=`: Lấy nội dung bài học, ẩn toàn bộ đáp án (câu hỏi qua `sanitizeQuestionForStudent`, flashcards qua `sanitizeFlashcardForStudent`).
  - `POST /api/student/lessons/[lessonId]/attempts`: Nộp bài và chấm khách quan ngay lập tức; câu tự luận trừ 1 slot AI của giáo viên nguyên tử và chuyển trạng thái `GRADING` kèm phát sự kiện Redis Stream `LESSON_GRADING_REQUESTED` (hoặc `AI_SKIPPED` nếu hết slot).
  - `GET /api/student/lessons/[lessonId]/attempts?classId=`: Lịch sử các lần làm bài của chính học sinh tại lớp này theo thứ tự mới nhất trước.
  - `GET /api/student/attempts/[id]`: Chi tiết kết quả lần làm bài của học sinh (kiểm tra quyền sở hữu).
  - `POST /api/lessons/grade-async`: API nội bộ xác thực bằng `x-internal-token`, xử lý chấm AI nền theo cơ chế retry tối đa 3 lần, cập nhật điểm và trạng thái `GRADED`.
  - `worker/grading-worker.js`: Bổ sung nhánh xử lý sự kiện `LESSON_GRADING_REQUESTED` gọi `/api/lessons/grade-async` kèm `x-internal-token`.
- Đảm bảo an toàn bảo mật: Route học sinh kiểm tra `requireRole(["STUDENT"])` đầu tiên trước `await params`, định danh học sinh chỉ lấy từ token, tuyệt đối không trả đáp án trước khi nộp.
- Tự kiểm hoàn tất: `verify.sh` exit 0 (toàn bộ 15 test files / 350 tests Vitest pass và TypeScript typecheck `tsc` không có lỗi).

## File đã tạo/sửa
- `lib/lesson-access.ts`: Kiểm tra quyền truy cập bài học và tải trạng thái lộ trình của học sinh.
- `lib/lesson-ai-grading.ts`: Wrapper gọi AI đánh giá câu trả lời tự luận và trả điểm band.
- `app/api/student/classes/[classId]/roadmap/route.ts`: API học sinh xem lộ trình lớp và tiến độ.
- `app/api/student/lessons/[lessonId]/route.ts`: API học sinh lấy nội dung bài học đã ẩn toàn bộ đáp án.
- `app/api/student/lessons/[lessonId]/attempts/route.ts`: API học sinh nộp bài và xem lịch sử các lần làm bài.
- `app/api/student/attempts/[id]/route.ts`: API học sinh xem chi tiết một lần làm bài.
- `app/api/lessons/grade-async/route.ts`: API nội bộ dành cho worker chấm AI nền cho bài học.
- `worker/grading-worker.js`: Bổ sung xử lý sự kiện `LESSON_GRADING_REQUESTED`.

## Kết quả tự kiểm
```
 Test Files  15 passed (15)
      Tests  350 passed (350)
   Start at  12:38:12
   Duration  30.69s (transform 1.43s, setup 0ms, collect 1.43s, tests 188.22s, environment 2ms, prepare 1.31s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
