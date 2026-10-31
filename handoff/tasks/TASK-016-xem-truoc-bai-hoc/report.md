# Báo cáo TASK-016

## Đã làm
- Hiện thực API `GET /api/teacher/lessons/[id]/preview`: kiểm tra quyền `ADMIN`/`TEACHER`, chỉ cho phép giáo viên sở hữu bài học xem nội dung, trả về thông tin bài học cùng danh sách câu hỏi và flashcard đã được ẩn đáp án (`sanitizeQuestionForStudent`, `sanitizeFlashcardForStudent`).
- Hiện thực API `POST /api/teacher/lessons/[id]/preview`: kiểm tra quyền và cấu trúc `answers`, chấm thử từng câu bằng `gradeQuestion` với map flashcards đầy đủ và `summarizeResults`, tính `score_percent` khách quan, hoàn toàn không ghi cơ sở dữ liệu, không trừ slot và không gọi AI.
- Cập nhật trang `/teacher/lessons/[id]/page.tsx`:
  - Thêm nút "Xem trước như học sinh" khi bài học đã có ID (không phải bài mới `new`).
  - Mở modal toàn màn hình hiển thị đầy đủ 4 trạng thái UI (đang tải, lỗi tải kèm nút "Thử lại", rỗng khi bài học chưa có câu hỏi, và có dữ liệu).
  - Sử dụng trình làm bài `LessonPlayer` với bộ câu trả lời khởi tạo bằng `emptyAnswerFor`.
  - Hỗ trợ nút "Chấm thử" gọi `POST /preview` để chấm điểm, hiển thị `score_percent`, điểm số khách quan, ghi chú "Phần tự luận chỉ được AI chấm khi học sinh làm bài", nút "Làm lại" và nút "Đóng".
- Chạy kiểm thử tự động với `python3 scripts/handoff.py verify TASK-016` đạt 100% (20/20 test suites, 413/413 tests passed, tsc pass, exit 0).

## File đã tạo/sửa
- `app/api/teacher/lessons/[id]/preview/route.ts`: API endpoint GET (lấy dữ liệu đã ẩn đáp án) và POST (chấm thử không lưu).
- `app/teacher/lessons/[id]/page.tsx`: Giao diện trang soạn bài học, thêm nút và modal xem trước toàn màn hình với `LessonPlayer`.

## Kết quả tự kiểm
```text
 Test Files  20 passed (20)
      Tests  413 passed (413)
   Start at  13:23:29
   Duration  131.52s (transform 4.12s, setup 0ms, collect 4.56s, tests 852.77s, environment 10ms, prepare 5.02s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
