# Báo cáo TASK-045

## Đã làm
- **TC-B01**: Phân quyền & guard `assertClassAccess`: TEACHER không phải chủ lớp nhận 403 ở mọi route `/api/teacher/grading/**`; người tạo đề không thấy bài của lớp giáo viên khác (DEC-038); STUDENT nhận 403; chưa đăng nhập nhận 401; ADMIN truy cập được mọi lớp; kind ngoài `lesson|exam` nhận 400; lớp không tồn tại nhận 404.
- **TC-B02**: Danh sách bài của lớp = lộ trình ∪ đề giao, không trùng lặp, giữ thứ tự lộ trình trước đề giao sau. Bài luyện tự do (`class_ref` rỗng) không xuất hiện trong hub. Bài ngoài lớp trả 404 khi truy cập chi tiết.
- **TC-B05**: PUT lượt đề thi (`PUT /api/teacher/grading/attempts/exam/[attemptId]`): lưu `teacher_score`, giữ nguyên bản gốc `ai_score`, tính lại điểm phần `section_scores` và điểm tổng `total_score`, đặt `reviewed_at` và `reviewed_by`. Khi `teacher_score = null` thì khôi phục điểm AI gốc. Gửi/cập nhật đúng 1 dòng thông báo `EXAM_GRADED` cho học sinh. Lượt `IN_PROGRESS` hoặc `GRADING` trả 409.
- Sửa lượt bài học (`PUT /api/teacher/grading/attempts/lesson/[attemptId]`): tính lại `score_percent`. Lượt `NEEDS_REVIEW` khi chấm đủ mọi mục AI thì chuyển sang `GRADED` kèm `graded_at`; chấm thiếu thì vẫn giữ `NEEDS_REVIEW`.
- **TC-B08**: Finalize (`POST /api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/finalize`): trả 409 `GRADING_PENDING` kèm danh sách học sinh nếu còn lượt đang chấm hoặc cần chấm tay; trả 409 `UNREVIEWED` nếu còn bài AI chưa xem mà chưa xác nhận `confirmUnreviewed`. Khi có `confirmUnreviewed: true`, toàn bộ bước chụp ảnh điểm và gán `reviewed_at` chạy trong 1 giao dịch database (`BEGIN`/`COMMIT`), tạo ảnh chụp cho mọi học sinh ghi danh (học sinh chưa nộp lưu `score10 = NULL`). Sau COMMIT gửi thông báo `GRADEBOOK_FINALIZED` cho học sinh có điểm. Bài đã chốt gọi lại trả 409 `ALREADY_FINALIZED`.
- **TC-B09**: Sau chốt: PUT ô học sinh trả 409 `GRADEBOOK_FINALIZED`; PUT lượt nộp trước mốc chốt trả 409 `GRADEBOOK_FINALIZED`; lượt nộp sau mốc chốt trả 200 và ảnh chụp trong `class_grades` không bị đổi. Reopen (`POST .../reopen`): đặt `finalized_at = NULL`, `reopened_at = NOW()`, học sinh không còn thấy bài trong gradebook.
- **TC-B10 / TC-B11**: Bảng tổng kết (`summary`) và gradebook học sinh: tính trung bình thang 10 đúng chuẩn (bỏ qua ô rỗng, tính ô nhập tay 0, làm tròn 0.1). Gradebook học sinh chỉ trả các bài đã chốt của chính mình, không nhận `studentId` từ query/body; học sinh chưa ghi danh lớp trả 403.
- **TC-B14**: API `members` (`GET /api/teacher/classes/[classId]/members`): chỉ đếm `submission_count` và lấy `latest_total` từ các bài nộp có `class_ref = classId`.
- **TC-B15**: Thông báo `GRADEBOOK_FINALIZED` chỉ gửi cho học sinh có điểm, trỏ link `/student/class/[classId]?tab=gradebook`; chốt lại (reopen -> finalize) cập nhật cùng một dòng thông báo.
- Đã xoá 2 file route cũ: `app/api/teacher/submissions/route.ts` và `app/api/exam/grade-override/route.ts`.
- Cập nhật tài liệu `docs/07-api-contracts.md` và `docs/02-modules-and-features.md` đồng bộ hoàn toàn với code; toàn bộ test suite và `tests/docs-sync.test.ts` đều xanh.

## File đã tạo/sửa
- `lib/gradebook-data.ts`: Tạo mới module truy vấn DB cho bảng điểm theo lớp, bao gồm guard `assertClassAccess`, tải danh sách bài, học sinh, lượt thi, ảnh chụp bảng điểm, giao dịch chốt điểm và mở chốt.
- `app/api/teacher/grading/classes/route.ts`: Tạo mới route lấy danh sách lớp kèm số liệu `student_count`, `pending_review`, `needs_review`.
- `app/api/teacher/grading/classes/[classId]/route.ts`: Tạo mới route hub lớp liệt kê bài học và đề thi kèm thống kê chấm.
- `app/api/teacher/grading/classes/[classId]/summary/route.ts`: Tạo mới route bảng tổng kết lớp (học sinh × bài đã chốt) và tính trung bình thang 10.
- `app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/route.ts`: Tạo mới route xem chi tiết bảng điểm từng bài.
- `app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/students/[studentId]/route.ts`: Tạo mới route cập nhật ô điểm học sinh (chọn lượt, nhập tay điểm, ghi chú).
- `app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/finalize/route.ts`: Tạo mới route chốt bảng điểm một bài.
- `app/api/teacher/grading/classes/[classId]/items/[kind]/[itemId]/reopen/route.ts`: Tạo mới route mở chốt bảng điểm.
- `app/api/teacher/grading/attempts/[kind]/[attemptId]/route.ts`: Tạo mới route xem chi tiết lượt chấm (kèm đáp án cho giáo viên) và lưu sửa điểm từng câu AI.
- `app/api/student/classes/[classId]/gradebook/route.ts`: Tạo mới route bảng điểm chính thức cho học sinh.
- `app/api/teacher/classes/[classId]/members/route.ts`: Cập nhật truy vấn chỉ lấy bài nộp có `class_ref = classId`.
- `lib/notifications.ts`: Thêm kiểu và hàm `notifyGradebookFinalized`, cập nhật link `EXAM_NEEDS_REVIEW`.
- `lib/gradebook.ts`: Chuẩn hóa fallback `r.max`/`r.earned` trong `applyExamTeacherEdits` khi dữ liệu câu hỏi trong results chỉ có `score`.
- `docs/db-migration-017-gradebook.sql` & `lib/db-pg.ts`: Bổ sung `submitted_at` cho `lesson_attempts` và `teacher_feedback` cho `submissions`.
- `app/api/teacher/submissions/route.ts`: Đã xoá theo yêu cầu task.
- `app/api/exam/grade-override/route.ts`: Đã xoá theo yêu cầu task.
- `docs/07-api-contracts.md`: Cập nhật bảng hợp đồng API đủ các route mới và bỏ 2 route cũ.
- `docs/02-modules-and-features.md`: Cập nhật ma trận phân quyền bỏ `exam/grade-override`.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-045-grading-api/verify.sh
 Test Files  59 passed (59)
      Tests  1078 passed (1078)
   Start at  01:45:03
   Duration  129.46s (transform 3.68s, setup 0ms, collect 3.53s, tests 501.51s, environment 8ms, prepare 3.20s)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
