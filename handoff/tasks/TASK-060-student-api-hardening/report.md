# Báo cáo TASK-060

## Đã làm
- **Rà soát lời gọi API trước khi siết vai trò:** Đã quét toàn bộ `app/` và `components/`, xác nhận chỉ có các màn hình học sinh (`app/student/dashboard/page.tsx`, `app/student/class/[classId]/page.tsx`) gọi các route này. Không có vai trò nào khác (`TEACHER`, `ADMIN`) gọi hợp lệ tới `/api/student/classes*`.
- **Siết vai trò STUDENT cho `GET /api/student/classes` và `GET /api/student/classes/[classId]`:** Sử dụng `requireRole(["STUDENT"])`, trả về 401 khi chưa đăng nhập và 403 khi người dùng có vai trò khác (`TEACHER`, `ADMIN`).
- **Loại bỏ cột nội bộ tại `GET /api/student/classes/[classId]`:** Thay câu lệnh `SELECT * FROM classes` bằng danh sách cột tường minh gồm `id`, `name`, `code`, `course_id`, `schedule`, `start_date`, `ended_at`, `unlock_mode`, `pass_percent`, `billing_status`, `created_at`. Không chứa các cột nội bộ nhạy cảm như `teacher_id`, `next_charge_at`, `billing_period`, `grace_until`.
- **Thứ tự kiểm quyền tại `POST /api/student/lessons/[lessonId]/attempts`:** Chuyển `checkLessonAccess` lên trước `assertClassOpen(classId)`. Học sinh chưa ghi danh nhận mã lỗi kiểm quyền bài học (403/404) chứ không nhận `CLASS_LOCKED` (ngăn dò trạng thái khoá lớp); học sinh đã ghi danh vào lớp khoá vẫn nhận 403 `CLASS_LOCKED`.
- **Bảo toàn hồi quy:** Tất cả các test hiện có (`student-lessons-api.test.ts`, `slot-wallet-api.test.ts`) và kiểm tra kiểu TypeScript (`tsc --noEmit`) đều đạt 100%.

## File đã tạo/sửa
- `app/api/student/classes/route.ts`: Siết `requireRole(["STUDENT"])`.
- `app/api/student/classes/[classId]/route.ts`: Siết `requireRole(["STUDENT"])`, SELECT tường minh các cột an toàn, loại bỏ các cột nội bộ `teacher_id`, `next_charge_at`, `billing_period`, `grace_until`.
- `app/api/student/lessons/[lessonId]/attempts/route.ts`: Điều chỉnh thứ tự kiểm tra: gọi `checkLessonAccess` trước `assertClassOpen`.

## Kết quả tự kiểm
```text
=== TASK-060: Siết API lớp học sinh: vai trò, bỏ cột nội bộ, thứ tự kiểm quyền ===
--- 1. Chạy test nghiệm thu chéo (tests/student-classes-hardening.test.ts) ---

 ✓ tests/student-classes-hardening.test.ts (15 tests) 5836ms
   ✓ TASK-060: GET /api/student/classes — Siết vai trò STUDENT > chưa đăng nhập → 401  637ms
   ✓ TASK-060: GET /api/student/classes — Siết vai trò STUDENT > TEACHER và ADMIN không được phép truy cập → 403  383ms
   ✓ TASK-060: GET /api/student/classes — Siết vai trò STUDENT > STUDENT s1 xem danh sách lớp đã ghi danh → 200, đúng các lớp của mình  378ms
   ✓ TASK-060: GET /api/student/classes — Siết vai trò STUDENT > STUDENT chưa ghi danh lớp nào → 200, mảng classes rỗng  372ms
   ✓ TASK-060: GET /api/student/classes/[classId] — Siết vai trò & loại bỏ cột nội bộ > chưa đăng nhập → 401  374ms
   ✓ TASK-060: GET /api/student/classes/[classId] — Siết vai trò & loại bỏ cột nội bộ > TEACHER (kể cả giáo viên phụ trách) và ADMIN đều nhận 403 (chỉ cho STUDENT)  370ms
   ✓ TASK-060: GET /api/student/classes/[classId] — Siết vai trò & loại bỏ cột nội bộ > lớp không tồn tại → 404  362ms
   ✓ TASK-060: GET /api/student/classes/[classId] — Siết vai trò & loại bỏ cột nội bộ > STUDENT chưa ghi danh vào lớp → 403  361ms
   ✓ TASK-060: GET /api/student/classes/[classId] — Siết vai trò & loại bỏ cột nội bộ > STUDENT đã ghi danh: trả về đầy đủ trường cho UI, KHÔNG chứa các cột nội bộ (teacher_id, next_charge_at, billing_period, grace_until)  382ms
   ✓ TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá > chưa đăng nhập → 401; TEACHER → 403  444ms
   ✓ TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá > thiếu classId hoặc answers không hợp lệ → 400  352ms
   ✓ TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá > học sinh CHƯA ghi danh nộp bài vào lớp LOCKED: checkLessonAccess chạy trước, KHÔNG nhận CLASS_LOCKED  375ms
   ✓ TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá > học sinh CHƯA ghi danh nộp bài vào lớp ENDED: checkLessonAccess chạy trước, KHÔNG nhận CLASS_LOCKED  376ms
   ✓ TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá > học sinh ĐÃ ghi danh ở lớp LOCKED: vượt qua checkLessonAccess nhưng nhận 403 CLASS_LOCKED  378ms
   ✓ TASK-060: POST /api/student/lessons/[lessonId]/attempts — Thứ tự kiểm quyền với lớp khoá > học sinh ĐÃ ghi danh ở lớp ACTIVE: nộp bài thành công → 201  370ms

 Test Files  1 passed (1)
      Tests  15 passed (15)

--- 2. Chạy regression tests (student-lessons-api, slot-wallet-api) ---

 Test Files  2 passed (2)
      Tests  51 passed (51)

--- 3. Kiểm tra TypeScript ---
=== TASK-060 verify: TẤT CẢ ĐẠT ===

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
