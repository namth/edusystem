# Báo cáo TASK-035

## Đã làm
- Tạo `docs/db-migration-013-onboarding.sql` và bổ sung DDL tương ứng vào `ensureSchema()` trong `lib/db-pg.ts` (cột `username`, chỉ mục duy nhất `idx_users_username` trên `LOWER(username)`, `email_is_placeholder`, `grade_level`, `learning_goals`, `teacher_status`, `idx_users_teacher_status`, gán `'VERIFIED'` cho giáo viên cũ và tạo bảng `teacher_profiles`).
- Tạo `lib/onboarding.ts` không phụ thuộc module server: `PLACEHOLDER_EMAIL_DOMAIN`, `placeholderEmail`, `isPlaceholderEmail`, `USERNAME_RE`, `RESERVED_USERNAMES`, `normalizeUsername`, `validateUsername`, `usernameBaseFromName`, `usernameBaseFromEmail`, `suggestUsernames`, `TRIAL_SLOT_LIMIT = 9` và các enum dùng chung (`GRADE_LEVELS`, `ENGLISH_GOALS`, `TEACHER_LEVELS`, `WORKPLACE_TYPES`, `STUDENT_COUNTS`, `TEACHER_NEEDS`, `SIGNUP_SOURCES`).
- Tách logic ghi danh lớp bằng mã sang `lib/enrollment.ts` (`enrollStudentByCode`) giữ nguyên đồng bộ Neo4j trong `try/catch` và cập nhật `app/api/student/enroll/route.ts`.
- Cập nhật `lib/notifications.ts`: bổ sung loại thông báo `TEACHER_SIGNUP`.
- Cập nhật `POST /api/auth/login`: hỗ trợ đăng nhập bằng `LOWER(email)`, `LOWER(username)` hoặc `id`; trả thêm `username`, `teacherStatus`, `emailIsPlaceholder`.
- Tạo `GET /api/auth/username-available`: giới hạn 30 lần/phút/IP, kiểm tra định dạng/tên cấm/trùng lặp và gợi ý ≥ 3 tên đăng nhập chưa có người dùng.
- Cập nhật `POST /api/auth/register` (học sinh): giới hạn 5 lần/giờ/IP đếm trước khi validate, bẫy bot `website`, kiểm tra dữ liệu trả `field` lỗi, hỗ trợ cả có email lẫn không email (tạo email tạm `@kito.io.vn`), tự sinh `username`, tính `target_band` động theo mục tiêu IELTS/TOEIC (bỏ giá trị cứng `'IELTS 6.5'`), ghi danh lớp qua `enrollStudentByCode` nếu có `classCode`, đặt cookie đăng nhập và cố định vai trò `STUDENT`.
- Tạo `POST /api/auth/register/teacher`: giới hạn 5 lần/giờ/IP, bẫy bot `website`, kiểm tra toàn bộ trường khảo sát + SĐT + email thật + mật khẩu ≥ 8 ký tự, tạo `users` (`role = 'TEACHER'`, `teacher_status = 'TRIAL'`, `slot_limit = 9`) và `teacher_profiles` trong một câu SQL CTE, gửi thông báo `TEACHER_SIGNUP` cho mọi `ADMIN`, đặt cookie đăng nhập.
- Cập nhật `POST /api/auth/forgot-password`: bỏ qua việc tạo token với tài khoản có `email_is_placeholder = true` nhưng giữ nguyên phản hồi chung chống dò tài khoản.
- Cập nhật `GET/PUT /api/profile`: trả thêm `username, email_is_placeholder` và cho phép đổi từ email tạm sang email thật hợp lệ (kiểm tra trùng và chặn đuôi `@kito.io.vn`, đổi xong đặt `email_is_placeholder = false`).

## File đã tạo/sửa
- `docs/db-migration-013-onboarding.sql` — Migration 013 thêm cột onboarding cho `users` và bảng `teacher_profiles`.
- `lib/db-pg.ts` — Bổ sung DDL của Migration 013 vào `ensureSchema()`.
- `lib/onboarding.ts` — Tiện ích kiểm tra/gợi ý tên đăng nhập, email tạm và các hằng số enum cho giao diện.
- `lib/enrollment.ts` — Hàm `enrollStudentByCode(studentId, code)` dùng chung cho route enroll và đăng ký học sinh.
- `lib/notifications.ts` — Thêm loại thông báo `TEACHER_SIGNUP`.
- `app/api/auth/login/route.ts` — Cho phép đăng nhập bằng `username` và trả thêm `username`, `teacherStatus`, `emailIsPlaceholder`.
- `app/api/auth/username-available/route.ts` — API kiểm tra tên đăng nhập trống kèm gợi ý thay thế và giới hạn tần suất.
- `app/api/auth/register/route.ts` — API đăng ký học sinh mới (có/không email, lưu mục tiêu học tập, ghi danh lớp, đặt cookie).
- `app/api/auth/register/teacher/route.ts` — API đăng ký giáo viên dùng thử kèm khảo sát trong một CTE và gửi thông báo cho admin.
- `app/api/auth/forgot-password/route.ts` — Không tạo reset token cho tài khoản đang dùng email tạm.
- `app/api/profile/route.ts` — Cho phép đổi email tạm sang email thật và trả thêm `username`, `email_is_placeholder`.
- `app/api/student/enroll/route.ts` — Gọi `enrollStudentByCode` từ `lib/enrollment.ts`.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-035-dang-ky-api/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/redesign-login-signup-teacher-a9a997

 ✓ tests/lesson-player.test.ts (19 tests) 45ms
 ✓ tests/class-roadmap-ui.test.ts (12 tests) 14ms
 ✓ tests/exam-runner-ui.test.ts (13 tests) 13ms
 ✓ tests/env-check.test.ts (4 tests) 10ms
 ✓ tests/lesson-library-ui.test.ts (13 tests) 15ms
 ✓ tests/attempt-summary.test.ts (10 tests) 26ms
 ✓ tests/curriculum-dnd.test.ts (16 tests) 7ms
 ✓ tests/exam-layout.test.ts (23 tests) 21ms
 ✓ tests/stimulus-html.test.ts (6 tests) 9ms
 ✓ tests/roadmap.test.ts (14 tests) 5ms
 ✓ tests/score-display.test.ts (11 tests) 5ms
 ✓ tests/grading-hardening.test.ts (5 tests) 7ms
 ✓ tests/change-password.test.ts (8 tests) 19228ms
   ✓ POST /api/auth/change-password > chưa đăng nhập → 401 kể cả khi gửi userId trong body; mật khẩu không đổi  3913ms
   ✓ POST /api/auth/change-password > lần đầu (must_change_password): đổi được không cần mật khẩu cũ; đăng xuất → đăng nhập bằng mật khẩu MỚI, không còn bị bắt đổi  2824ms
   ✓ POST /api/auth/change-password > tự đổi về sau: thiếu hoặc sai mật khẩu hiện tại → 403; đúng → 200  3080ms
   ✓ POST /api/auth/change-password > mật khẩu yếu hoặc trùng mật khẩu cũ → 400  3320ms
   ✓ Trang đổi mật khẩu lần đầu gọi API thật > AuthContext.updatePasswordAndProfile gọi /api/auth/change-password và /api/profile, trả lỗi về trang  2030ms
   ✓ Trang đổi mật khẩu lần đầu gọi API thật > trang hồ sơ gửi mật khẩu hiện tại khi tự đổi  1684ms
   ✓ Middleware chặn vượt qua bước đổi mật khẩu > token còn mật khẩu tạm (mcp) → mọi trang /teacher, /student, /admin chuyển về /change-password  1140ms
   ✓ Middleware chặn vượt qua bước đổi mật khẩu > đổi xong được cấp cookie mới không còn mcp → vào /teacher bình thường  1209ms

 Test Files  46 passed (46)
      Tests  802 passed (802)
   Start at  13:50:36
   Duration  499.20s (transform 47.00s, setup 0ms, collect 15.38s, tests 1940.73s, environment 29ms, prepare 9.62s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
