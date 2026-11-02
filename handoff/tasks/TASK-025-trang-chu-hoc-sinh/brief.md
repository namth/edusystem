# TASK-025 — Trang chủ học sinh: bỏ bán khóa học, dùng API pg

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
DEC-019: giai đoạn này học sinh **không** mua khóa học trên app. `app/student/page.tsx` hiện hiển thị danh mục khóa học có giá giả (`lib/mock-data`), tạo đơn `orders` (bảng không tồn tại) và QR VietQR cứng, đọc DB bằng Supabase từ trình duyệt. Viết lại thành trang "Lớp của tôi" dùng API pg — đây là trang cuối cùng còn dùng Supabase phía trình duyệt.

## 2. Tài liệu bắt buộc đọc
- `docs/14-decisions.md` DEC-019; `CONTEXT.md` bất biến 9
- `app/api/student/classes/route.ts` (GET lớp đã ghi danh), `app/api/student/enroll/route.ts` (POST `{ code }`: 200 `alreadyEnrolled`, 404 sai mã, 409 lớp đầy, 403 không phải học sinh)
- `app/student/dashboard/page.tsx` (mẫu ô nhập mã lớp đã làm ở TASK-004)
- Test: `tests/student-home.test.ts`

## 3. Phạm vi file
**Được sửa:** `app/student/page.tsx` (viết lại).
**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/**`, route API, trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
- Lời chào theo `useAuth().user?.name` (không tên giả); lối tắt tới `/student/analytics` và `/student/dashboard` như hiện có.
- **Lớp của tôi**: `GET /api/student/classes` → thẻ lớp (tên, mã, lịch học) dẫn tới `/student/class/${id}`. Rỗng → "Bạn chưa tham gia lớp nào — nhập mã lớp do giáo viên cung cấp".
- **Tham gia lớp bằng mã**: ô nhập + nút → `POST /api/student/enroll { code }`; thông điệp: 200 `alreadyEnrolled` "Bạn đã ở trong lớp này", 200 "Đã tham gia lớp …" rồi tải lại danh sách, 404 "Mã lớp không đúng", 409 "Lớp đã đủ chỗ", khác → `json.error`.
- Đủ trạng thái tải / lỗi + "Thử lại".
- Xoá toàn bộ phần khóa học, giá, đơn mua, QR, `INITIAL_*`, import `@/lib/supabase` và `@/lib/mock-data`. Giữ phong cách giao diện hiện có.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-025`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không thêm thư viện mới.
