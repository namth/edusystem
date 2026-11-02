# Báo cáo TASK-022

## Đã làm
- Hiện thực `lib/exam-player.ts`: `emptyExamAnswerFor` (Speaking trả về `""`, các dạng khác dùng `emptyAnswerFor`), `groupQuestionsBySkill` (thứ tự Listening → Reading → Writing → Speaking → các kỹ năng khác, giữ nguyên thứ tự câu trong phần), `formatRemaining` (định dạng `mm:ss`, từ 1 giờ `h:mm:ss`, giá trị âm hoặc 0 trả về `00:00`).
- Tạo mới client component `components/lesson-player/SpeakingRecorder.tsx`: hiển thị văn bản đọc hoặc gợi ý chủ đề, đếm ngược thời gian chuẩn bị (`prepSeconds`), ghi âm bằng `MediaRecorder`, tự động dừng sau `speakingSeconds`, gửi FormData `kind = "speaking"` lên `/api/uploads`, lưu `url`, có nút nghe lại audio và thu âm lại.
- Cập nhật `components/lesson-player/LessonPlayer.tsx`: bổ sung prop `allowSpeaking?: boolean` (mặc định `false`), render `SpeakingRecorder` cho các câu hỏi dạng `SPEAKING_*`, ở chế độ kết quả hiển thị file audio đã nộp và điểm AI; giữ nguyên fallback "Dạng câu hỏi chưa hỗ trợ" cho bài học thông thường.
- Viết lại toàn bộ trang làm đề thi `app/student/exam/[examId]/page.tsx` (407 dòng, < 700 dòng), bọc layout học sinh `StudentLayout` và `Suspense` cho query search params; luồng lượt thi do server quản lý qua `/api/student/exams/[examId]/attempts`, `…/content`, `…/answers`, `…/submit`; đồng hồ theo `deadline_at` của server, tự động nộp bài khi hết giờ (autoSubmit), dọn dẹp toàn bộ timer khi rời trang; tự động lưu tạm câu trả lời định kỳ 30 giây và khi chuyển tab kỹ năng; hiển thị kết quả chấm điểm (`section_scores`, `total_score`, `passed`, `is_late`, `GRADING`, `NEEDS_REVIEW`); xử lý lỗi 403, 409 (hết lượt) và nút Thử lại; xoá bỏ toàn bộ tự chấm ở trình duyệt và Supabase client cũ.
- Cập nhật trang xem lại bài nộp `app/student/exam/review/[submissionId]/page.tsx`: hiển thị điểm chi tiết theo chuẩn chấm `section_scores`, `total_score`, `passed`, `is_late`, trạng thái bài thi; danh sách câu hỏi được làm sạch qua `sanitizeQuestionForStudent` và hiển thị đồng bộ qua `LessonPlayer` với `allowSpeaking`.
- Tự kiểm toàn bộ test suite với `python3 scripts/handoff.py verify TASK-022`: 26/26 test suites passed, 535/535 tests passed, TypeScript compiler check pass không lỗi, exit code 0.

## File đã tạo/sửa
- `lib/exam-player.ts`: Hàm tiện ích thuần hỗ trợ tạo đáp án mặc định, nhóm câu hỏi theo chuẩn kỹ năng và format thời gian đếm ngược.
- `components/lesson-player/SpeakingRecorder.tsx`: Component ghi âm câu hỏi Speaking client-side dùng MediaRecorder và upload lên server qua `/api/uploads`.
- `components/lesson-player/LessonPlayer.tsx`: Thêm prop `allowSpeaking` và hỗ trợ render tương tác / kết quả cho câu hỏi Speaking.
- `app/student/exam/[examId]/page.tsx`: Trang làm đề thi học sinh hoàn toàn mới theo luồng server attempts (< 700 dòng).
- `app/student/exam/review/[submissionId]/page.tsx`: Trang xem lại bài thi sử dụng LessonPlayer và sanitizeQuestionForStudent.

## Kết quả tự kiểm
```
 Test Files  26 passed (26)
      Tests  535 passed (535)
   Start at  15:08:13
   Duration  357.93s (transform 37.65s, setup 0ms, collect 16.18s, tests 2435.97s, environment 8ms, prepare 10.82s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
