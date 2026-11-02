# TASK-034 — Nền tảng đa môn: bảng môn học, subject_id cho khoá/đề/bài học, trang quản lý môn, lọc theo môn

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity
> Chạy **song song** với TASK-033 (landing) trên worktree khác — không chạm file của task đó.

## 1. Mục tiêu
KitoKit chuyển từ "chỉ tiếng Anh" thành cổng bài học & đề thi **đa môn**. Quyết định đã chốt với người dùng: môn **tự do theo trung tâm** — giáo viên tự tạo môn của mình, admin tạo môn hệ thống dùng chung. Tiếng Anh giữ nguyên mọi thứ (mode `LANGUAGE`); môn khác mode `SIMPLE` (chỉ trắc nghiệm — dạng câu làm ở task sau, task này **chỉ làm nền dữ liệu + API + quản lý môn + lọc**).

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3; `lib/api-auth.ts`; `lib/db-pg.ts` (`ensureSchema`)
- `app/api/teacher/courses/route.ts`, `app/api/teacher/exams/route.ts` + `[id]/route.ts`, `app/api/teacher/lessons/route.ts` + `[id]/route.ts`
- `app/teacher/tests/page.tsx` (modal tạo/sửa khoá học), `components/teacher/ExamLibraryPanel.tsx`, `components/teacher/LessonLibraryPanel.tsx`, `components/TeacherLayout.tsx`
- Test: `tests/subjects.test.ts` (mới). Toàn bộ test khác (trừ `tests/landing.test.ts` của TASK-033) phải xanh.

## 3. Phạm vi file
**Được tạo/sửa:** `docs/db-migration-012-subjects.sql`, `lib/db-pg.ts` (thêm cùng DDL vào `ensureSchema`), `lib/subjects.ts` (mới, server), `app/api/subjects/route.ts`, `app/api/subjects/[id]/route.ts`, 5 route teacher ở mục 2, `app/teacher/subjects/page.tsx` (mới), `components/TeacherLayout.tsx` (thêm mục menu), `app/teacher/tests/page.tsx` (chỉ modal khoá học + chip môn trên danh sách khoá), `components/teacher/ExamLibraryPanel.tsx`, `components/teacher/LessonLibraryPanel.tsx` (chỉ bộ lọc môn).
**Không được sửa:** `tests.lock`, `app/page.tsx`, `components/landing/*`, `components/AdminLayout.tsx`, `app/login/*`, `app/register/*`, `package*.json`.

## 4. Đặc tả chi tiết
### 4.1 Migration 012 (chạy được nhiều lần; cùng DDL trong `ensureSchema`)
- `subjects (id VARCHAR(50) PK, code VARCHAR(60) NOT NULL, name VARCHAR(100) NOT NULL, icon VARCHAR(40), color VARCHAR(20), mode VARCHAR(20) NOT NULL DEFAULT 'SIMPLE' CHECK (mode IN ('LANGUAGE','SIMPLE')), owner_id VARCHAR(50) NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, order_index INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT NOW())`; unique index trên `(COALESCE(owner_id,''), LOWER(code))`.
- Seed `('english','english','Tiếng Anh','languages','#1453e0','LANGUAGE',NULL,TRUE,0)` với `ON CONFLICT (id) DO NOTHING`.
- `ALTER TABLE courses|exams|lessons ADD COLUMN IF NOT EXISTS subject_id VARCHAR(50)` + `UPDATE … SET subject_id='english' WHERE subject_id IS NULL` + index. (Không thêm cho `questions` ở task này.)
### 4.2 `lib/subjects.ts`
- `slugifySubjectCode(name)`: bỏ dấu tiếng Việt (cả `đ`→`d`), thường hoá, ký tự khác `[a-z0-9]` → `-`, gộp/cắt `-` thừa, tối đa 60.
- `canUseSubject(user, subjectId)`: ADMIN mọi môn tồn tại; TEACHER môn hệ thống (`owner_id IS NULL`) hoặc của mình; trả `false` nếu không tồn tại. Dùng trong 5 route teacher.
### 4.3 API môn học
- `GET /api/subjects` (`requireRole()` mọi vai trò): STUDENT → chỉ môn hệ thống `is_active`; TEACHER → hệ thống + `owner_id = mình`; ADMIN → tất cả. `?active=1` lọc `is_active`. Sắp `order_index, name`. Mỗi môn gồm `id, code, name, icon, color, mode, owner_id, is_active, order_index, usage_count` (= số khoá + đề + bài học có `subject_id` đó; một truy vấn, không N+1).
- `POST /api/subjects` (ADMIN/TEACHER): `name` trim 1–100 (400); `code` = `slugifySubjectCode(code || name)` (rỗng → 400); `mode` chỉ ADMIN được chọn (`LANGUAGE|SIMPLE`, lạ → 400), TEACHER luôn `SIMPLE`; `owner_id` = TEACHER: chính mình, ADMIN: `NULL`; trùng code cùng phạm vi chủ → 409; id `subj_<random>`; 201 `{success, subject}`.
- `PUT /api/subjects/[id]` (ADMIN/TEACHER): không có → 404; TEACHER chỉ môn của mình (môn hệ thống/GV khác → 403). Cập nhật được `name, icon, color, is_active, order_index` (+ `mode` chỉ ADMIN — TEACHER gửi `mode` thì bỏ qua). 200 `{success, subject}`.
- `DELETE /api/subjects/[id]`: quyền như PUT; `english` → 409; đang dùng → 409 `{success:false, error, usages:{courses, exams, lessons}}`; trống → xoá, 200.
### 4.4 subject_id ở route teacher
- **courses** POST/PUT: nhận `subject_id` (POST thiếu → `'english'`); có giá trị mà `!canUseSubject` → 400 "Môn học không hợp lệ". GET trả `subject_id`, hỗ trợ `?subject_id=`.
- **exams** POST và `[id]` PUT: như trên. GET (`/api/teacher/exams`) trả `subject_id`, hỗ trợ `?subject_id=` (kết hợp được với `?q=`).
- **lessons** POST và `[id]` PUT: như trên. GET trả `subject_id`, hỗ trợ `?subject_id=`.
- Giữ nguyên toàn bộ hành vi/phân quyền hiện có (test cũ phải xanh).
### 4.5 Giao diện (token màu `brand-*`, `ink*`, `line*`; không viết hex trong class)
- `/teacher/subjects` (client, `TeacherLayout`): tiêu đề "Môn Học"; danh sách thẻ môn (icon, tên, chip "Hệ thống"/"Của tôi", mode, số lần dùng, bật/tắt); tạo môn (tên, biểu tượng chọn từ vài icon lucide, màu chọn từ 8 màu gợi ý), sửa, bật/tắt (`PUT is_active`), xoá (xác nhận; 409 → báo "Môn đang được dùng: N khoá, N đề, N bài học"). Môn hệ thống chỉ xem với GV. Trạng thái tải / lỗi ("Thử lại") / rỗng ("Chưa có môn học riêng — bấm Tạo môn").
- Menu `TeacherLayout`: thêm `{ href: "/teacher/subjects", label: "Môn Học", icon: … }` ngay sau "Kho Bài Học & Đề Thi".
- `app/teacher/tests/page.tsx`: modal tạo/sửa khoá thêm select "Môn học" (từ `/api/subjects?active=1`, mặc định Tiếng Anh) gửi `subject_id`; danh sách khoá hiện chip tên môn.
- `ExamLibraryPanel`, `LessonLibraryPanel`: select "Tất cả môn / <môn>" → gọi API kèm `subject_id=` khi chọn.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (`python3 scripts/handoff.py verify TASK-034`).
- `requireRole` trước mọi truy vấn DB. Không N+1. Không thêm thư viện. Không nhánh riêng cho test.
- Component client không import `@/lib/subjects` / `@/lib/db-pg` (tách hàm slug thuần ra nếu cần dùng ở client).
- `app/teacher/tests/page.tsx` rất lớn — chỉ sửa đúng modal/danh sách khoá, không động vào logic kéo thả.
