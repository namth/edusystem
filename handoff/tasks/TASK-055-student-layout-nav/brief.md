# TASK-055 — Khung học sinh: sửa menu cls_101, điều hướng mobile, bỏ ô tìm kiếm chết

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

**Lệnh agent được chạy:** CHỈ `python3` — kiểm bằng `python3 scripts/handoff.py verify TASK-055 --quiet`, nộp bằng `submit`. Đọc/sửa file bằng công cụ file; không dùng `ls`, `git`, `sed`, `npx`, `cat`.

## 1. Mục tiêu
Menu học sinh còn trỏ cứng `/student/class/cls_101` (học sinh thật gặp 403/404) — docs/03 SCR-11 đang PARTIAL vì lỗi này. Dưới 768px không có menu (sidebar `hidden md:flex`). Ô tìm kiếm ở header không làm gì. Nhãn "IELTS Student" cứng cho mọi học sinh; nhãn song ngữ lẫn lộn.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `docs/03-screens-and-ui.md` (màn hình học sinh SCR-11…); `docs/12-business-rules.md` (BR-W: khoá lớp).

## 3. Phạm vi file
**Được tạo/sửa:**
- `components/StudentLayout.tsx`
- `app/teacher/classes/[classId]/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, migration, `middleware.ts`.

## 4. Đặc tả chi tiết
Theo mục 1 và 5; chi tiết chưa nêu thì bám cách làm của các trang/route cùng thư mục.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Không còn chuỗi `cls_101` trong `app/` và `components/` (kể cả dự phòng `params?.classId || "cls_101"` ở trang lớp giáo viên — dùng `params.classId` thẳng).
- [ ] Menu sidebar: Dashboard `/student/dashboard`, Lớp học của tôi `/student/dashboard#classes`, Analytics `/student/analytics`, Hồ sơ `/profile`, Đổi mật khẩu `/change-password`. Mỗi lúc chỉ MỘT mục được tô sáng (Dashboard không sáng khi đang ở `#classes`).
- [ ] Dưới `md` có điều hướng cho học sinh (thanh dưới cố định hoặc nút mở ngăn menu) chứa cùng các mục, có `aria-label`; nội dung trang không bị thanh che (padding đáy).
- [ ] Bỏ ô tìm kiếm không hoạt động ở header. Nhãn vai trò hiển thị "Học sinh" (không phải "IELTS Student"); nhãn menu/nút một ngôn ngữ tiếng Việt (vd "Đăng xuất", "Tổng quan", "Phân tích & báo cáo").

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test trong `tests.lock`, `docs/`, migration, `middleware.ts`, API ngoài phạm vi mục 3. Không thêm đường tắt bỏ qua kiểm quyền.
- Giao diện tiếng Việt có dấu; giữ đủ 4 trạng thái (đang tải / rỗng / lỗi / có dữ liệu); không hiện mã HTTP thô cho người dùng.
- Test hiện có bị vỡ vì thay đổi hợp lệ thì do người viết test cập nhật (`tests/`); người code ghi vào `report.md` file nào bị ảnh hưởng.
- Kiểm bằng `python3 scripts/handoff.py verify TASK-055 --quiet` (CHỈ python3). Nộp bằng `submit`.
