# Báo cáo TASK-014

## Đã làm
- [x] Hiện thực `lib/lesson-player.ts` gồm các hàm thuần: `emptyAnswerFor` (chuẩn hoá hình dạng khởi tạo câu trả lời cho các dạng câu hỏi đã ẩn đáp án), `setAnswerPart` (cập nhật bất biến theo key/chỉ số), `countAnswered` (đếm chính xác các câu đã được học sinh điền).
- [x] Hiện thực `components/lesson-player/LessonPlayer.tsx` là client component hỗ trợ đầy đủ 15 nhóm dạng câu hỏi (MC, Fill-in 3 kiểu, Ordering, Matching, Flashcard set, Free typing blanks, Sentence rewrite, Essay, Short answer...), hỗ trợ hiển thị prompt, stimulus text/audio, và chế độ xem kết quả hiển thị đúng/sai, đáp án đúng (`expected`), trạng thái `AI đang chấm…` / `Band x/9`.
- [x] Hiện thực trang `app/student/lesson/[lessonId]/page.tsx` (`/student/lesson/[lessonId]?classId=...`) bọc `StudentLayout` và `Suspense`, xử lý đầy đủ các trạng thái tải, 403, 404, lỗi kết nối ("Thử lại"), nộp bài (`POST /api/student/lessons/[lessonId]/attempts`), tự động polling khi trạng thái `GRADING` mỗi 3s (`GET /api/student/attempts/[id]`) và dọn dẹp timer, hiển thị lịch sử làm bài và cho phép bấm xem lại hoặc bấm "Làm lại".
- [x] Chạy `verify.sh` thông qua `python3 scripts/handoff.py verify TASK-014` vượt qua toàn bộ 18 test suite (395/395 test cases) và kiểm tra kiểu TypeScript không có lỗi, exit code 0.

## File đã tạo/sửa
- `lib/lesson-player.ts`: Hàm thuần `emptyAnswerFor`, `setAnswerPart`, `countAnswered` phục vụ trình làm bài học.
- `components/lesson-player/LessonPlayer.tsx`: Component client render 15 dạng bài tập và hiển thị kết quả chi tiết từng câu.
- `app/student/lesson/[lessonId]/page.tsx`: Màn hình SCR-L7 học sinh làm bài học, nộp bài, xem kết quả, polling AI và xem lịch sử.

## Kết quả tự kiểm
```
 Test Files  18 passed (18)
      Tests  395 passed (395)
   Start at  13:03:48
   Duration  285.68s (transform 21.14s, setup 0ms, collect 10.64s, tests 1910.31s, environment 18ms, prepare 9.21s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
