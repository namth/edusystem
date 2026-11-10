# TASK-059 — Dọn lối vào học sinh: /student, /student/landing, nhãn vai trò hồ sơ

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

**Lệnh agent được chạy:** CHỈ `python3` — kiểm bằng `python3 scripts/handoff.py verify TASK-059 --quiet`, nộp bằng `submit`. Đọc/sửa file bằng công cụ file; không dùng `ls`, `git`, `sed`, `npx`, `cat`.

## 1. Mục tiêu
`/student` theo docs là trang chuyển hướng nhưng thực tế là một trang đầy đủ 296 dòng trùng với dashboard (form vào lớp trùng, layout lệch StudentLayout). `/student/landing` chỉ `redirect("/")`. Trang hồ sơ hiện vai trò thô "STUDENT".

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `docs/03-screens-and-ui.md` (màn hình học sinh SCR-11…); `docs/12-business-rules.md` (BR-W: khoá lớp).

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/student/page.tsx`
- `app/student/landing/page.tsx`
- `app/profile/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, migration, `middleware.ts`.

## 4. Đặc tả chi tiết
Theo mục 1 và 5; chi tiết chưa nêu thì bám cách làm của các trang/route cùng thư mục.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `/student` chuyển hướng tới `/student/dashboard` (server `redirect`), không còn mã giao diện/form cũ trong file.
- [ ] `/student/landing` chuyển hướng tới `/student/dashboard` thay vì `/`.
- [ ] Trang `/profile` hiển thị vai trò bằng tiếng Việt: STUDENT → "Học sinh", TEACHER → "Giáo viên", ADMIN → "Quản trị viên" (hàm/bảng ánh xạ, không in `{role}` thô).
- [ ] Không đụng `middleware.ts`; các liên kết nội bộ khác tới `/student` vẫn hoạt động.

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test trong `tests.lock`, `docs/`, migration, `middleware.ts`, API ngoài phạm vi mục 3. Không thêm đường tắt bỏ qua kiểm quyền.
- Giao diện tiếng Việt có dấu; giữ đủ 4 trạng thái (đang tải / rỗng / lỗi / có dữ liệu); không hiện mã HTTP thô cho người dùng.
- Test hiện có bị vỡ vì thay đổi hợp lệ thì do người viết test cập nhật (`tests/`); người code ghi vào `report.md` file nào bị ảnh hưởng.
- Kiểm bằng `python3 scripts/handoff.py verify TASK-059 --quiet` (CHỈ python3). Nộp bằng `submit`.
