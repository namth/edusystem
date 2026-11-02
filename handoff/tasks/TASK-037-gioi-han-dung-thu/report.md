# Báo cáo TASK-037

## Đã làm
- Đã tạo `lib/teacher-trial.ts` với `TRIAL_LIMITS`, `isTrialTeacher`, `getTrialUsage`, `assertTrialAllows`, `isTrialClass`, `trialLimitResponse` và `assertTrialAttemptAllowed` đọc trực tiếp trạng thái từ cơ sở dữ liệu ở mỗi request.
- Đã gắn kiểm tra giới hạn dùng thử vào các điểm tạo lớp (`max_slots <= 3`, tối đa 1 lớp), tạo bài học/đề thi/AI nhập đề (tối đa 3 nội dung tính chung), thêm/tạo học sinh và ghi danh qua mã lớp (tối đa 3 học sinh khác nhau qua mọi lớp), giao bài/làm đề/nộp bài học (tối đa 1 lượt mỗi bài/đề trong lớp dùng thử), và chặn gửi đơn mua slot khi đang dùng thử.
- Đã bổ sung loại thông báo `TEACHER_VERIFIED` trong `lib/notifications.ts`.
- Đã tạo API `GET /api/teacher/trial-usage` và `POST /api/admin/teachers/[id]/verify`, đồng thời cập nhật `GET /api/admin/users` (lọc `teacherStatus`) và `GET /api/admin/teachers/[id]` (trả `teacher_status` và `profile`).
- Đã tạo `components/teacher/TrialBanner.tsx` và gắn vào `components/TeacherLayout.tsx` (giữ nguyên menu).
- Đã cập nhật `/admin/teachers` (tab lọc "Chờ xác minh", đọc `?status=TRIAL`, hiển thị huy hiệu trạng thái) và `/admin/teachers/[id]` (khối "Khảo sát đăng ký" dùng nhãn tiếng Việt từ `@/lib/onboarding`, nút "Xác minh" / "Từ chối" kèm ghi chú).

## File đã tạo/sửa
- `lib/teacher-trial.ts` — Module server kiểm tra giới hạn dùng thử của giáo viên và lớp học.
- `lib/notifications.ts` — Thêm loại thông báo `TEACHER_VERIFIED`.
- `lib/enrollment.ts` — Kiểm tra giới hạn 3 học sinh của giáo viên dùng thử trong `enrollStudentByCode`.
- `lib/exam-attempts.ts` — Giới hạn `limit = 1` và kiểm tra lượt làm bài trong lớp dùng thử tại `checkExamAccess`.
- `app/api/teacher/classes/route.ts` — Chặn tạo quá 1 lớp và kẹp `max_slots <= 3` với giáo viên dùng thử.
- `app/api/teacher/lessons/route.ts` — Chặn tạo quá 3 nội dung (bài học + đề thi) với giáo viên dùng thử.
- `app/api/teacher/exams/route.ts` — Chặn tạo quá 3 nội dung (bài học + đề thi) với giáo viên dùng thử.
- `app/api/teacher/exams/ai-import/route.ts` — Kiểm tra giới hạn nội dung trước khi ghi DB khi AI nhập đề.
- `app/api/teacher/classes/[classId]/students/route.ts` — Kiểm tra giới hạn 3 học sinh trước khi kiểm tra lớp đầy hoặc tạo học sinh mới.
- `app/api/teacher/classes/[classId]/assignments/route.ts` — Ép `max_attempts = 1` khi giao bài cho lớp dùng thử.
- `app/api/teacher/slot-requests/route.ts` — Chặn giáo viên dùng thử gửi đơn mua thêm slot.
- `app/api/admin/create-user/route.ts` — Bổ sung kiểm tra `assertTrialAllows` cho học sinh khi có gắn lớp.
- `app/api/student/lessons/[lessonId]/attempts/route.ts` — Gọi `assertTrialAttemptAllowed` sau `checkLessonAccess` và trước khi ghi lượt làm bài học.
- `app/api/teacher/trial-usage/route.ts` — API trả tiến độ dùng thử, giới hạn và ghi chú xét duyệt cho giáo viên.
- `app/api/admin/teachers/[id]/verify/route.ts` — API cho ADMIN xác minh hoặc từ chối giáo viên, mở `slot_limit >= 250`, lưu hồ sơ duyệt và gửi thông báo.
- `app/api/admin/teachers/[id]/route.ts` — Trả thêm `teacher_status` và `profile` từ `teacher_profiles`.
- `app/api/admin/users/route.ts` — Hỗ trợ lọc `?teacherStatus=TRIAL|VERIFIED|REJECTED` và trả `teacher_status`.
- `components/teacher/TrialBanner.tsx` — Banner hiển thị tiến độ dùng thử và ghi chú từ chối cho giáo viên.
- `components/TeacherLayout.tsx` — Chèn `<TrialBanner />` phía trên `children`.
- `app/admin/teachers/page.tsx` — Thêm tab lọc "Chờ xác minh", đọc `?status=TRIAL` và hiển thị huy hiệu trạng thái.
- `app/admin/teachers/[id]/page.tsx` — Hiển thị khảo sát đăng ký bằng nhãn tiếng Việt từ `@/lib/onboarding` và form Xác minh / Từ chối.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-037-gioi-han-dung-thu/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/agy-worktrees/TASK-037

 ✓ tests/standard-selection.test.ts (6 tests) 20529ms
 ✓ tests/exam-runner-ui.test.ts (13 tests) 113ms
 ✓ tests/exam-layout.test.ts (23 tests) 60ms
 ✓ tests/attempt-summary.test.ts (10 tests) 30ms
 ✓ tests/lesson-library-ui.test.ts (13 tests) 45ms
 ✓ tests/score-display.test.ts (11 tests) 19ms
 ✓ tests/grading-hardening.test.ts (5 tests) 12ms
 ✓ tests/env-check.test.ts (4 tests) 25ms
 ✓ tests/class-roadmap-ui.test.ts (12 tests) 23ms
 ✓ tests/stimulus-html.test.ts (6 tests) 62ms
 ✓ tests/roadmap.test.ts (14 tests) 29ms

 Test Files  47 passed (47)
      Tests  829 passed (829)
   Start at  14:48:31
   Duration  319.17s (transform 24.32s, setup 0ms, collect 12.90s, tests 1210.41s, environment 17ms, prepare 12.10s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
