# Báo cáo TASK-020

## Đã làm
- [x] `verify.sh` chạy exit 0: 24/24 test files passed (483/483 tests), TypeScript kiểm tra qua `tsconfig.verify.json` sạch 100%.
- [x] Không route nào nhận điểm do trình duyệt gửi:
  - Khóa đường nộp bài cũ có kèm điểm tự chấm `POST /api/submissions` (`auto_graded_score`) trả về `410 Gone`.
  - Mọi điểm số, kết quả khách quan và kết quả AI đều do server tính toán và chấm độc lập khi nộp qua `POST /api/student/exam-attempts/[id]/submit`.
- [x] Không trả đáp án trước khi nộp:
  - `GET /api/student/exams/[examId]/content` yêu cầu học sinh có lượt thi `IN_PROGRESS` hợp lệ, dữ liệu câu hỏi và flashcard được ẩn toàn bộ đáp án bằng `sanitizeQuestionForStudent` và `sanitizeFlashcardForStudent`.
  - `GET /app/api/exams/[id]/content` kiểm tra nếu caller là `STUDENT` cũng tự động ẩn toàn bộ đáp án qua hàm sanitize.
- [x] Triển khai toàn bộ các tính năng theo đặc tả FEAT-011:
  - Quản lý lượt thi phía server: ghi nhận thời gian bắt đầu, tính deadline, chụp snapshot chuẩn chấm thi (`resolveStandardForExam`), giới hạn số lượt thi theo lớp hoặc luyện tập tự do (`checkExamAccess`).
  - Hỗ trợ lưu tạm đáp án định kỳ (`PUT /api/student/exam-attempts/[id]/answers`), từ chối khi nộp quá hạn quá 2 phút.
  - Tự động chấm khách quan và trừ slot giáo viên chấm AI Speaking/Writing theo giao dịch nguyên tử, chuyển trạng thái `GRADING` đẩy hàng đợi Redis hoặc `NEEDS_REVIEW` nếu hết slot.
  - Viết lại `POST /api/exam/grade-async` và `PUT /api/exam/grade-override` bằng `queryPg`, loại bỏ hoàn toàn phụ thuộc vào Supabase client.

## File đã tạo/sửa
- `lib/exam-attempts.ts`: Chọn chuẩn chấm thi (`resolveStandardForExam`), kiểm tra quyền làm bài & số lượt còn lại (`checkExamAccess`), chấm và tổng hợp điểm theo phần (`tallyAndScoreSections`), format attempt response.
- `lib/exam-ai-grading.ts`: Hàm `gradeExamOpenAnswer` gọi module chấm điểm AI nền (Speaking/Writing) qua rubric và chuẩn phần thi.
- `app/api/student/exams/[examId]/attempts/route.ts`: API bắt đầu lượt thi mới hoặc tiếp tục lượt `IN_PROGRESS` cũ cho học sinh.
- `app/api/student/exams/[examId]/content/route.ts`: API lấy nội dung đề thi đã ẩn đáp án cho lượt thi `IN_PROGRESS`.
- `app/api/student/exam-attempts/[id]/answers/route.ts`: API lưu tạm bài làm của học sinh trong thời gian thi.
- `app/api/student/exam-attempts/[id]/submit/route.ts`: API nộp bài thi, server tự chấm câu hỏi trắc nghiệm/khách quan, trừ slot giáo viên và kích hoạt chấm AI nền.
- `app/api/exam/grade-async/route.ts`: Route chạy ngầm xử lý chấm AI cho bài thi bằng `queryPg` (hỗ trợ xác thực qua internal token và quyền Admin/Teacher).
- `app/api/exam/grade-override/route.ts`: Route cho phép giáo viên phụ trách lớp/người tạo đề ghi đè điểm phần Speaking/Writing bằng `queryPg`.
- `app/api/exams/[id]/content/route.ts`: Cập nhật route nội dung đề thi chung, tự động sanitize đáp án nếu người gọi là `STUDENT`.
- `app/api/submissions/route.ts`: Chặn đường nộp bài cũ có điểm do client tự tính (`auto_graded_score`), trả về `410 Gone`.

## Kết quả tự kiểm
```
 Test Files 24 passed (24)
      Tests 483 passed (483)
   Start at 15:01:06
   Duration 296.82s

 Test Files  24 passed (24)
      Tests  483 passed (483)
   Start at  15:01:06
   Duration  297.02s (transform 24.21s, setup 0ms, collect 22.47s, tests 1815.98s, environment 8ms, prepare 12.57s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
