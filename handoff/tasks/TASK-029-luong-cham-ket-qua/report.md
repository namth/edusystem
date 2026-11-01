# Báo cáo TASK-029

## Đã làm
- [x] `submit` (`POST /api/student/exam-attempts/[id]/submit`): bài có câu AI + giáo viên còn slot sẽ lưu trạng thái `GRADING` (kèm `answers`, `results`, `section_scores`) vào DB **trước khi** gọi `pushGradingEvent`. Nếu `pushGradingEvent` lỗi thì cập nhật về `NEEDS_REVIEW`, hoàn đúng 1 slot cho giáo viên đã bị trừ, gọi `notifyNeedsReview` và vẫn trả `200`. Khi hết slot chuyển `NEEDS_REVIEW` + `notifyNeedsReview`. Bài toàn khách quan giữ nguyên (`GRADED` ngay, không tạo thông báo).
- [x] `gradeExamOpenAnswer` (`lib/exam-ai-grading.ts`): trả `{ score: number, feedback: string | null }` với `feedback` lấy từ kết quả đánh giá AI và giới hạn `≤ 2000` ký tự.
- [x] `grade-async` (`POST /api/exam/grade-async`): lưu `r.score` và `r.feedback` vào từng mục AI trong `results`. Nếu câu AI lỗi sau 3 lần thử: không gán điểm tối thiểu (giữ `score` chưa có), lưu `last_grading_error`, tính lại `section_scores` qua `tallyAndScoreSections` (phần AI `score: null`, phần khách quan giữ nguyên), đặt `status = 'NEEDS_REVIEW'`, `total_score = NULL`, `passed = NULL`, hoàn 1 slot cho giáo viên tương ứng (GV lớp `class_ref` hoặc người tạo đề) và gọi `notifyNeedsReview`. Khi tất cả thành công chuyển `GRADED` và gọi `notifyExamGraded`.
- [x] `GET /api/submissions/[id]`: chặn học sinh (`STUDENT`) xem bài đang làm (`status = 'IN_PROGRESS'`) với mã `409` `{ success: false, error }`, không trả `questions` / đáp án; giữ nguyên cho giáo viên và bài đã nộp.
- [x] `worker/grading-worker.js`: chỉ `XACK` khi gọi API trả `res.ok` và `json.success !== false`; định kỳ dùng `XAUTOCLAIM` để nhận lại tin treo quá 60 giây; giới hạn `MAX_DELIVERIES = 5` lần giao (vượt ngưỡng thì log lỗi và `XACK` để tránh lặp vô hạn).
- [x] `lib/attempt-summary.ts`: tạo hàm thuần client-safe `summarizeAttemptResult(attempt)` trả `{ state, graded, pending, total, passed }` theo thứ tự `standard_snapshot.sections` và ép kiểu số cho `total`.
- [x] Màn kết quả (`app/student/exam/[examId]/page.tsx`, pha `result`) và trang xem lại (`app/student/exam/review/[submissionId]/page.tsx`): hiển thị 4 trạng thái `FINAL`, `PARTIAL`, `WAITING_AI`, `WAITING_TEACHER` qua `summarizeAttemptResult`, tách rõ phần đã chấm và phần chờ chấm, nhắc học sinh theo dõi mục Thông báo, giữ polling 5 giây khi `GRADING`, và hiển thị điểm kèm nhận xét AI (`feedback`) dưới từng câu AI ở trang xem lại.
- [x] `verify.sh` exit 0.

## File đã tạo/sửa
- `lib/attempt-summary.ts` — Tạo mới module tổng hợp trạng thái và điểm từng phần (`summarizeAttemptResult`), không phụ thuộc module server.
- `lib/exam-ai-grading.ts` — Cập nhật `gradeExamOpenAnswer` trả `{ score, feedback }` (cắt `feedback` tối đa 2000 ký tự).
- `app/api/student/exam-attempts/[id]/submit/route.ts` — Lưu `GRADING` trước khi đẩy sự kiện Redis; xử lý lỗi đẩy sự kiện (chuyển `NEEDS_REVIEW`, hoàn slot, `notifyNeedsReview`) và thông báo khi hết slot.
- `app/api/exam/grade-async/route.ts` — Lưu `score` + `feedback` cho câu AI; xử lý lỗi sau 3 lần thử chuyển `NEEDS_REVIEW`, hoàn slot, thông báo GV; khi chấm xong gọi `notifyExamGraded`.
- `app/api/submissions/[id]/route.ts` — Trả `409` không kèm câu hỏi/đáp án khi `STUDENT` gọi lúc bài còn `IN_PROGRESS`.
- `worker/grading-worker.js` — Chỉ `XACK` khi `res.ok`, thêm `XAUTOCLAIM` định kỳ cho tin treo và giới hạn `MAX_DELIVERIES = 5`.
- `app/student/exam/[examId]/page.tsx` — Cập nhật pha `result` dùng `summarizeAttemptResult` cho 4 trạng thái `FINAL`, `PARTIAL`, `WAITING_AI`, `WAITING_TEACHER`.
- `app/student/exam/review/[submissionId]/page.tsx` — Dùng `summarizeAttemptResult` ở bảng tổng hợp và hiển thị điểm + `feedback` của AI dưới từng câu tự luận/nói.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-029-luong-cham-ket-qua/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-029
...
 ✓ tests/lesson-preview.test.ts (5 tests) 33568ms
   ✓ GET /api/teacher/lessons/[id]/preview — nội dung giống học sinh thấy > chưa đăng nhập 401; STUDENT 403; bài của GV khác 403; không có 404  6927ms
   ✓ GET /api/teacher/lessons/[id]/preview — nội dung giống học sinh thấy > câu hỏi đúng thứ tự, đã ẩn đáp án; flashcard đã ẩn từ đúng  2927ms
   ✓ POST /api/teacher/lessons/[id]/preview — chấm thử, KHÔNG lưu > trả kết quả từng câu kèm đáp án + điểm khách quan; câu AI chỉ đánh dấu; không ghi lesson_attempts  4181ms
   ✓ POST /api/teacher/lessons/[id]/preview — chấm thử, KHÔNG lưu > answers không phải object → 400; bài của GV khác → 403  15714ms
   ✓ Nút Xem trước trong trang soạn bài > app/teacher/lessons/[id]/page.tsx dùng LessonPlayer và gọi /preview  3806ms
 ✓ tests/notifications-lib.test.ts (6 tests) 39541ms
   ✓ notifyExamGraded > tạo thông báo cho học sinh kèm điểm, đạt và link xem lại  6511ms
   ✓ notifyExamGraded > gọi lại (chấm lại) không nhân đôi, cập nhật nội dung và đặt lại chưa đọc  2947ms
   ✓ notifyExamGraded > bài chưa GRADED hoặc không tồn tại → không tạo; lỗi DB không ném ra ngoài  5438ms
   ✓ notifyNeedsReview > bài của lớp → giáo viên lớp; bài luyện tập → người tạo đề; kèm tên học sinh, link /teacher/grading  14964ms
   ✓ listNotifications / markNotificationsRead > chỉ thấy của mình, mới nhất trước, đếm chưa đọc; đánh dấu theo id hoặc tất cả, không đụng của người khác  3190ms
   ✓ listNotifications / markNotificationsRead > giới hạn số lượng 1–100  6464ms

 Test Files  37 passed (37)
      Tests  647 passed (647)
   Start at  13:26:36
   Duration  212.33s (transform 16.91s, setup 0ms, collect 18.02s, tests 1310.38s, environment 42ms, prepare 18.23s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
