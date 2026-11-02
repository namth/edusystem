# TASK-023 — Lớp học của giáo viên qua API pg (lớp, thành viên, giao đề, thêm học sinh)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
3 trang giáo viên còn đọc/ghi DB **từ trình duyệt** bằng Supabase (vi phạm CONTEXT bất biến 9): `app/teacher/classes/page.tsx`, `app/teacher/classes/[classId]/page.tsx`, `app/teacher/students/create/page.tsx`. Đặc biệt trang chi tiết lớp đang **chèn thẳng tài khoản học sinh vào bảng `users` từ trình duyệt**. Task này thêm API pg và chuyển 3 trang sang dùng API.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2, 4, 6, 9)
- `lib/api-auth.ts`, `lib/auth.ts` (`hashPassword`), `lib/neo4j.ts` (`syncTeacherManagesClass`, `syncStudentEnrolledInClass`)
- Các route lớp đã có (giữ nguyên): `app/api/teacher/classes/[classId]/{settings,unlocks,roadmap,progress}/route.ts`
- Test: `tests/teacher-classes-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/classes/route.ts` (mới: GET, POST), `app/api/teacher/classes/[classId]/route.ts` (mới: PUT, DELETE)
- `app/api/teacher/classes/[classId]/members/route.ts` (mới: GET), `…/assignments/route.ts` (mới: POST, DELETE), `…/students/route.ts` (mới: POST)
- `app/teacher/classes/page.tsx`, `app/teacher/classes/[classId]/page.tsx` (chỉ thay nguồn dữ liệu, giữ tab "Lộ trình" của TASK-012), `app/teacher/students/create/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/**`, các route đã có, trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
Mọi route: `requireRole(["ADMIN","TEACHER"])` dòng đầu (trước `await params`/`req.json()`); route `[classId]`: lớp không có → 404, TEACHER mà `classes.teacher_id ≠ userId` → 403. SQL tham số hoá; lỗi `{ success: false, error }`; số trả `number`; **không trả `password`/`reset_token`**.
- `GET /api/teacher/classes` → `{ classes }` (TEACHER: lớp của mình; ADMIN: tất cả) mỗi lớp `{ id, name, code, teacher_id, schedule, max_slots, course_id, unlock_mode, pass_percent, created_at, student_count }`.
- `POST` `{ name, schedule?, max_slots?, course_id? }` — `name` trim 1–150; `max_slots` số nguyên 1–500 (mặc định 30); `id = "cls_" + crypto.randomUUID()`; `code` 6 ký tự `A-Z0-9` ngẫu nhiên, sinh lại nếu trùng; `teacher_id = userId`; `syncTeacherManagesClass` trong try/catch → `201 { success, class }`.
- `PUT [classId]` `{ name?, schedule?, max_slots? }` (validate như POST, chỉ cập nhật trường gửi lên) → `200 { success, class }`.
- `DELETE [classId]` → xoá `enrollments`, `class_assignments`, `class_unlocks` của lớp rồi xoá lớp (một giao dịch) → `200`.
- `GET [classId]/members` → `{ students: [{ id, name, email, phone, status, submission_count, latest_total }], assignments: [{ id, exam_id, exam_title, due_date, max_attempts, created_at }] }` (`latest_total` = `total_score ?? final_score` của bài nộp mới nhất, hoặc null).
- `POST [classId]/assignments` `{ exam_id, due_date?, max_attempts? }` — đề phải tồn tại và (ADMIN hoặc `created_by = userId` hoặc `created_by IS NULL`), sai → 400; đã giao (`UNIQUE(class_id, exam_id)`) → 409; `max_attempts` số nguyên ≥ 1 (mặc định 1); `id = "asg_" + crypto.randomUUID()` → `201 { success, assignment }`.
- `DELETE [classId]/assignments?id=` → xoá đúng dòng thuộc lớp (không có → 404) → `200`.
- `POST [classId]/students` `{ name, email, phone? }` — `name` trim không rỗng, `email` hợp lệ (chuẩn hoá lowercase) → sai 400.
  - Email đã có: role ≠ `STUDENT` → 409; là học sinh → ghi danh (nếu chưa) → `200 { success, already_existed: true, student }` (không có `temp_password`).
  - Chưa có: lớp đủ `max_slots` (đếm `enrollments`) → 409; tạo user `id = "usr_" + crypto.randomUUID()`, `role = 'STUDENT'`, `password = hashPassword(temp)` với `temp` ≥ 8 ký tự ngẫu nhiên (`crypto.randomBytes`), `must_change_password = true` → ghi danh → `syncStudentEnrolledInClass` try/catch → `201 { success, already_existed: false, student, temp_password: temp }`.
  - Kiểm tra lớp đầy cũng áp dụng khi ghi danh học sinh có sẵn.
- **Trang**: thay mọi `supabase.from(...)` bằng `fetch` tới API trên; trang thêm học sinh hiện `temp_password` một lần cho giáo viên ghi lại (không lưu ở trình duyệt). Bỏ import `@/lib/supabase`. Giữ giao diện; thêm trạng thái lỗi + "Thử lại" nếu chưa có.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-023`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không bao giờ lưu mật khẩu dạng thô; không trả mật khẩu đã băm.
- Không import module server vào component client (có test chặn).
- Không thêm thư viện mới.
