# TASK-003 — API học sinh trên PostgreSQL: lớp, ghi danh, bài giao, bài nộp

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Đã chốt: **mọi truy cập dữ liệu đi qua API route dùng `queryPg` (`lib/db-pg.ts`)**, trình duyệt không gọi Supabase trực tiếp nữa. Task này làm phần backend cho khu vực học sinh. Task sau (TASK-004) sẽ chuyển các trang `app/student/*` sang gọi các API này.
DB thật chưa có bảng `enrollments` và `class_assignments` → thêm DDL theo `docs/db-migration-004-enrollments-assignments.sql` vào `ensureSchema()`.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2, 3, 4, 9)
- `docs/db-migration-004-enrollments-assignments.sql` (schema đã chốt — không đổi)
- `lib/api-auth.ts` (`requireRole`), `lib/db-pg.ts` (`queryPg`, `ensureSchema`)
- `app/api/teacher/exams/route.ts` — mẫu route dùng `queryPg`
- Test: `tests/student-api.test.ts`, `tests/helpers/pg-fake.ts` (schema thật mô phỏng)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/db-pg.ts` (chỉ thêm DDL migration 004 vào `ensureSchema`)
- `app/api/student/classes/route.ts` (mới)
- `app/api/student/classes/[classId]/route.ts` (mới)
- `app/api/student/enroll/route.ts` (mới)
- `app/api/exams/[id]/route.ts` (mới)
- `app/api/submissions/route.ts` (chuyển sang `queryPg`)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`
- Các trang `app/**/page.tsx` (thuộc TASK-004)
- `lib/supabase.ts`, `lib/supabase-server.ts`, `lib/api-auth.ts`, `lib/jwt.ts`, `lib/auth.ts`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết
Quy ước chung: kiểm quyền ở dòng đầu handler bằng `requireRole`; lỗi trả `{ success: false, error: "<tiếng Việt>" }`; SQL luôn tham số hoá (`$1`, `$2`…), không nối chuỗi. Định danh học sinh **luôn** lấy từ `auth.user.userId`.

### 4.1 `ensureSchema()` trong `lib/db-pg.ts`
Thêm nguyên văn các câu `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` của migration 004 vào khối DDL hiện có. Không đổi các câu DDL khác.

### 4.2 `GET /api/student/classes`
- Quyền: mọi vai trò đã đăng nhập (dữ liệu theo `userId` của token).
- Trả các lớp mà `userId` đã ghi danh (`enrollments` JOIN `classes`), sắp theo thời điểm ghi danh mới nhất trước.
- `200 { success: true, classes: ClassRow[] }` — `ClassRow` là các cột của bảng `classes`. Không có lớp → `classes: []`.

### 4.3 `POST /api/student/enroll` — body `{ code: string }`
- Quyền: chỉ `STUDENT` (TEACHER/ADMIN → 403).
- `code` sau `trim()` rỗng → 400. Tìm lớp theo `UPPER(code) = UPPER($1)`; không có → 404.
- Đã ghi danh lớp đó → `200 { success: true, class, alreadyEnrolled: true }`, không chèn thêm.
- Chưa ghi danh: đếm số ghi danh của lớp; `>= max_slots` → 409 "Lớp học đã đủ chỗ.". Ngược lại chèn `enrollments (id, student_id, class_id)` với `id = "enr_" + crypto.randomUUID()` và `ON CONFLICT (student_id, class_id) DO NOTHING`.
- Sau khi chèn gọi `syncStudentEnrolledInClass(userId, classId)` trong `try/catch` (lỗi chỉ log, vẫn trả 200 — bất biến 9).
- `200 { success: true, class, alreadyEnrolled: false }`. Bỏ qua mọi `student_id` trong body.

### 4.4 `GET /api/student/classes/[classId]` — `{ params }: { params: Promise<{ classId: string }> }`
- Quyền: đã đăng nhập; kiểm quyền **trước** khi `await params`.
- Lớp không tồn tại → 404.
- `STUDENT` chưa ghi danh lớp → 403. `TEACHER` mà `classes.teacher_id !== userId` → 403. `ADMIN` xem mọi lớp.
- `200 { success: true, class, assignments, submissions }`:
  - `assignments`: mọi dòng `class_assignments` của lớp, mỗi phần tử gồm các cột của bảng + `exam: { id, title, duration_minutes, skills } | null` (LEFT JOIN `exams`; đề đã xoá → `null`).
  - `submissions`: với `STUDENT` là bài nộp của chính họ có `exam_id` thuộc các đề được giao cho lớp, mới nhất trước; với TEACHER/ADMIN là `[]`.

### 4.5 `GET /api/exams/[id]` — `{ params }: { params: Promise<{ id: string }> }`
- Quyền: đã đăng nhập. `200 { success: true, exam }` (toàn bộ cột bảng `exams`); không có → 404.

### 4.6 `app/api/submissions/route.ts` — chuyển sang `queryPg`
- Xoá import và mọi sử dụng `@/lib/supabase`. Giữ nguyên phần chấm AI (writing/speaking) và cách tính `finalAiScore`/`aiFeedbackText`.
- **POST:** bỏ mặc định `student_id = "student_01"` và `exam_id = "test_01"`.
  - `exam_id` thiếu/rỗng → 400 (trước khi chấm AI và trước khi ghi DB).
  - `STUDENT` → `student_id = userId`. TEACHER/ADMIN → lấy `student_id` từ body; thiếu → 400.
  - `INSERT INTO submissions (id, exam_id, student_id, answers, ai_score, ai_feedback, final_score, final_feedback, status) VALUES (...) RETURNING *` — `answers` truyền `JSON.stringify(answers)`; `status = 'AI_GRADED'`; `id = "sub_" + crypto.randomUUID()`.
  - `200 { success: true, data: <dòng vừa chèn> }`. Lỗi DB → 500 (không còn "fallback" giả thành công).
- **GET:** STUDENT luôn lọc `student_id = userId` (bỏ qua query); TEACHER/ADMIN lọc theo `student_id` trên query nếu có. Lọc thêm `exam_id` nếu có. `ORDER BY created_at DESC`. `200 { success: true, data: rows }`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` — gồm test của TASK-001/002 — và `tsc --noEmit`)
- [ ] Không route nào trong phạm vi import `@/lib/supabase` hay `@/lib/supabase-server`
- [ ] Mọi SQL tham số hoá; không nối chuỗi giá trị người dùng vào SQL
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test hay `tests/helpers/pg-fake.ts`; không thêm nhánh `NODE_ENV === "test"`/`VITEST`.
- Test chạy trên Postgres thật (PGlite): `COUNT(*)` có thể trả `bigint`/chuỗi trên `pg` thật → luôn `Number(...)` trước khi so sánh.
- Không dùng `getPgPool()` hay transaction thủ công trong route — chỉ `queryPg`.
- Không đổi schema ngoài migration 004; không thêm cột vào bảng có sẵn.
- `submissions.class_id` trên DB thật là kiểu `UUID` — **không** ghi cột này.
- Không sửa giao diện trong task này; các trang vẫn gọi API cũ cũng không sao.
- Không thêm thư viện mới.
