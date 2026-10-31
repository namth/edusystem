# TASK-017 — Khu admin chuyển sang API pg: người dùng, lớp, duyệt đơn mua slot

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
5 trang admin đang đọc/ghi DB **thẳng từ trình duyệt** bằng Supabase client (vi phạm CONTEXT bất biến 9): `accounts`, `students`, `students/[id]`, `teachers`, `requests`. Task này thêm API admin dùng `queryPg` và chuyển 5 trang sang gọi API. Trang duyệt đơn chỉ xử lý **đơn mua slot của giáo viên** (`slot_requests`); phần "đơn mua khóa học của học sinh" (`orders`) tạm ẩn vì DB chưa có bảng `orders` và chưa chốt mô hình giá.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2, 6, 9)
- `lib/api-auth.ts`; route có sẵn `app/api/admin/create-user/route.ts`, `app/api/admin/delete-user/route.ts`, `app/api/admin/teachers/[id]/route.ts` (giữ nguyên, trang tiếp tục dùng)
- Các trang hiện tại (đọc để biết dữ liệu nào đang hiển thị)
- Test: `tests/admin-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/admin/users/route.ts` (mới: GET), `app/api/admin/users/[id]/route.ts` (mới: GET, PUT)
- `app/api/admin/classes/route.ts` (mới: GET)
- `app/api/admin/requests/route.ts` (mới: GET), `app/api/admin/requests/[id]/route.ts` (mới: PUT)
- `app/admin/accounts/page.tsx`, `app/admin/students/page.tsx`, `app/admin/students/[id]/page.tsx`, `app/admin/teachers/page.tsx`, `app/admin/requests/page.tsx`

**Không được sửa:**
- Mọi file trong `tests.lock`, `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/**`, các route admin có sẵn, các trang khác
- `stitch_english_mock_exam_portal/`

## 4. Đặc tả chi tiết
Mọi route mới: `requireRole(["ADMIN"])` dòng đầu (trước `await params`/`req.json()`); SQL tham số hoá; lỗi `{ success: false, error }`. **Không bao giờ** trả cột `password`, `reset_token`, `reset_token_expires` — liệt kê cột tường minh, không `SELECT *` cho `users`.

### 4.1 `GET /api/admin/users?role=&q=`
- `role` ∈ `ADMIN|TEACHER|STUDENT` (sai → 400; bỏ trống = tất cả); `q`: `name ILIKE` hoặc `email ILIKE` (không phân biệt hoa thường).
- `200 { users }` — mỗi phần tử `{ id, name, email, role, phone, target_band, status, slot_limit, created_at, class_ids, submission_count, latest_score }`: `class_ids` = các `class_id` trong `enrollments` (mảng, có thể rỗng); `submission_count` = số `submissions` (`number`); `latest_score` = `final_score` của bài nộp mới nhất (`number` hoặc `null`). Sắp `created_at DESC`.

### 4.2 `/api/admin/users/[id]`
- **GET** → `200 { user, classes, submissions }` (user theo cột của 4.1 không gồm các trường tổng hợp; `classes` = lớp đã ghi danh `{ id, name, code, teacher_id }`; `submissions` = bài nộp của user `created_at DESC`). Không có → 404.
- **PUT** `{ name?, phone?, target_band?, status?, class_ids? }`:
  - `name` sau `trim` không rỗng; `status` ∈ `ACTIVE|INACTIVE|SUSPENDED`; `class_ids` mảng id lớp tồn tại và **chỉ** cho user `role = 'STUDENT'`. Sai → 400, không ghi gì.
  - Bỏ qua mọi trường khác (`role`, `password`, `email`…).
  - `class_ids` → thay toàn bộ ghi danh của học sinh (xoá dòng cũ, chèn dòng mới `id = "enr_" + crypto.randomUUID()`), trong một giao dịch (`getPgPool().connect()`, `BEGIN/COMMIT/ROLLBACK`, `release`); với lớp mới thêm gọi `syncStudentEnrolledInClass` trong `try/catch`.
  - `200 { success, user }`.

### 4.3 `GET /api/admin/classes`
`200 { classes }` — mọi lớp `{ id, name, code, teacher_id, teacher_name, student_count, course_id }` (`student_count` kiểu `number`).

### 4.4 Duyệt đơn mua slot
- **GET `/api/admin/requests`** → `200 { slot_requests }` — mọi dòng `slot_requests`, `PENDING` lên trước rồi `created_at DESC`; `total_cost` kiểu `number`.
- **PUT `/api/admin/requests/[id]`** `{ action: "APPROVE" | "REJECT" }` (khác → 400). Không có → 404; `status ≠ 'PENDING'` → 409.
  - `APPROVE`: trong một giao dịch: `UPDATE slot_requests SET status='APPROVED' WHERE id=$1 AND status='PENDING'` (0 dòng → 409) rồi `UPDATE users SET slot_limit = COALESCE(slot_limit,0) + requested_slots WHERE id = teacher_id`.
  - `REJECT`: `status = 'REJECTED'`, không đổi slot.
  - `200 { success, slot_request }`.

### 4.5 Trang admin
- Thay mọi `supabase.from(...)` bằng `fetch` tới API trên; xoá học sinh dùng `POST /api/admin/delete-user` có sẵn (như trang giáo viên đang làm). Bỏ import `@/lib/supabase`.
- Giữ nguyên giao diện; thêm trạng thái lỗi + "Thử lại" nếu trang chưa có; lỗi API hiện `json.error`.
- `requests/page.tsx`: chỉ còn danh sách đơn mua slot với nút Duyệt / Từ chối (`PUT …/requests/[id]`), cập nhật dòng tại chỗ; phần đơn khóa học thay bằng ghi chú "Chưa hỗ trợ đơn mua khóa học của học sinh".

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] 5 trang admin không còn `@/lib/supabase`
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-017`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không trả mật khẩu/token dưới bất kỳ hình thức nào.
- `COUNT`/`numeric` → `Number(...)`.
- Không thêm thư viện mới.
