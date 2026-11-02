# Báo cáo TASK-003: API học sinh trên PostgreSQL: lớp, ghi danh, bài giao, bài nộp

## Đã làm
- [x] Thêm DDL migration 004 (bảng `enrollments` và `class_assignments` cùng các index liên quan) vào `ensureSchema()` trong `lib/db-pg.ts`.
- [x] Tạo route `GET /api/student/classes` truy vấn PostgreSQL bằng `queryPg`, trả về danh sách lớp học viên đã ghi danh, sắp xếp mới nhất trước, phân quyền qua `requireRole()`.
- [x] Tạo route `POST /api/student/enroll` cho phép học sinh ghi danh bằng mã code lớp, xử lý chuẩn hoá mã (UPPER + trim), kiểm tra trùng lặp (`alreadyEnrolled`), kiểm tra sĩ số (`max_slots` -> 409), chèn `enrollments` với UUID id, và gọi đồng bộ Neo4j `syncStudentEnrolledInClass` trong try/catch (không ảnh hưởng transaction chính).
- [x] Tạo route `GET /api/student/classes/[classId]` kiểm quyền trước khi await params, trả về thông tin lớp, danh sách bài tập được giao (LEFT JOIN với bảng `exams`), danh sách bài nộp của học sinh (đối với học sinh) hoặc mảng rỗng (đối với giáo viên / quản trị viên).
- [x] Tạo route `GET /api/exams/[id]` trả thông tin chi tiết đề thi cho người dùng đã xác thực.
- [x] Chuyển đổi toàn diện `app/api/submissions/route.ts` sang `queryPg`, loại bỏ toàn bộ import và sử dụng `@/lib/supabase` / `@/lib/supabase-server`, chuẩn hoá validate `exam_id` và `student_id`, định danh học sinh từ JWT token, bảo lưu toàn bộ logic chấm AI và lưu trữ JSONB chuẩn vào PostgreSQL.
- [x] Đảm bảo mọi câu lệnh SQL đều tham số hoá (`$1`, `$2`...), không ghép chuỗi tham số người dùng.
- [x] Tự kiểm tra bằng `python3 scripts/handoff.py verify TASK-003`: toàn bộ 131 test vitest và `tsc --noEmit` đạt chuẩn (exit 0).

## File đã tạo/sửa
- `lib/db-pg.ts`: Thêm DDL migration 004 vào `ensureSchema()`.
- `app/api/student/classes/route.ts`: API lấy danh sách các lớp đã ghi danh của học sinh.
- `app/api/student/enroll/route.ts`: API ghi danh học sinh vào lớp học bằng mã lớp.
- `app/api/student/classes/[classId]/route.ts`: API lấy chi tiết lớp học, bài giao kèm thông tin đề và bài nộp tương ứng.
- `app/api/exams/[id]/route.ts`: API lấy thông tin chi tiết đề thi.
- `app/api/submissions/route.ts`: Chuyển đổi handler GET và POST từ Supabase sang `queryPg` trên PostgreSQL.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-003-api-hoc-sinh-pg/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/phoi-hop-antigravity-review-468cb6

 ✓ tests/api-auth.test.ts (87 tests) 327ms
 ✓ tests/secrets-password.test.ts (16 tests) 493ms
 ✓ tests/student-api.test.ts (28 tests) 11587ms
   ✓ GET /api/student/classes — lớp đã ghi danh của chính mình > chưa đăng nhập → 401  1023ms
   ✓ GET /api/student/classes — lớp đã ghi danh của chính mình > STUDENT s1 thấy đúng c1 và c3, không thấy c2  398ms
   ✓ GET /api/student/classes — lớp đã ghi danh của chính mình > học sinh chưa ghi danh lớp nào → mảng rỗng  396ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > chưa đăng nhập → 401; TEACHER/ADMIN → 403  407ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > thiếu mã → 400  389ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > mã không tồn tại → 404  374ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > mã hợp lệ (không phân biệt hoa thường, có khoảng trắng) → ghi danh bằng userId của token + đồng bộ Neo4j  378ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > đã ghi danh rồi → 200 alreadyEnrolled=true, không tạo bản ghi trùng  369ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > lớp đã đủ chỗ → 409, không ghi danh  380ms
   ✓ POST /api/student/enroll — ghi danh bằng mã lớp > lỗi Neo4j không làm hỏng ghi danh  374ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > chưa đăng nhập → 401  402ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > lớp không tồn tại → 404  391ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > STUDENT chưa ghi danh lớp → 403  398ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > TEACHER không phụ trách lớp → 403; TEACHER phụ trách → 200  395ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > STUDENT đã ghi danh: lớp + bài được giao kèm thông tin đề + bài nộp của chính mình cho các đề đó  403ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > đề được giao nhưng đã bị xoá → exam: null, không lỗi  434ms
   ✓ GET /api/student/classes/[classId] — chi tiết lớp + bài được giao > TEACHER/ADMIN xem lớp: submissions là mảng rỗng  392ms
   ✓ GET /api/exams/[id] — chi tiết đề > chưa đăng nhập → 401  413ms
   ✓ GET /api/exams/[id] — chi tiết đề > có đề → 200 { success, exam }  375ms
   ✓ GET /api/exams/[id] — chi tiết đề > không có đề → 404  374ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > POST STUDENT: lưu vào bảng submissions, student_id lấy từ token  371ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > POST thiếu exam_id → 400, không ghi  399ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > POST TEACHER/ADMIN thiếu student_id → 400 (không còn mặc định student_01)  388ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > POST bài viết đủ dài → lưu điểm AI vào ai_score  394ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > GET STUDENT: chỉ bài của mình, mới nhất trước, bỏ qua student_id trên query  394ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > GET STUDENT lọc theo exam_id  394ms
   ✓ /api/submissions chạy trên PostgreSQL (pg) > GET TEACHER lọc theo student_id trên query  391ms
   ✓ ensureSchema tạo bảng của migration 004 > lib/db-pg.ts chứa DDL cho enrollments và class_assignments  391ms

 Test Files  3 passed (3)
      Tests  131 passed (131)
   Start at  08:23:29
   Duration  12.03s (transform 295ms, setup 0ms, collect 276ms, tests 12.41s, environment 0ms, prepare 176ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
