# TASK-056 — Dashboard học sinh: bỏ dữ liệu giả, lỗi từng khối, lượt đang làm dở, huy hiệu lớp

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

**Lệnh agent được chạy:** CHỈ `python3` — kiểm bằng `python3 scripts/handoff.py verify TASK-056 --quiet`, nộp bằng `submit`. Đọc/sửa file bằng công cụ file; không dùng `ls`, `git`, `sed`, `npx`, `cat`.

## 1. Mục tiêu
Dashboard hiện "Daily Streak: 14 Days" là số cứng; một API lỗi làm hỏng cả trang (một khối try chung); lượt `IN_PROGRESS` bị liệt kê như "Bài thi đã nộp" và nút "Xem chi tiết" dẫn tới trang review trả 409; danh sách lớp không báo lớp bị khoá/hết hạn. Nhãn song ngữ ("Welcome back").

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `docs/03-screens-and-ui.md` (màn hình học sinh SCR-11…); `docs/12-business-rules.md` (BR-W: khoá lớp).

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/student/dashboard/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, migration, `middleware.ts`.

## 4. Đặc tả chi tiết
Theo mục 1 và 5; chi tiết chưa nêu thì bám cách làm của các trang/route cùng thư mục.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Bỏ thẻ streak giả (không còn "14"/"Daily Streak"); lời chào bằng tiếng Việt.
- [ ] Lỗi API lớp học không làm mất khối bài đã làm và ngược lại: mỗi khối có trạng thái lỗi riêng kèm nút "Thử lại".
- [ ] Lượt `IN_PROGRESS` KHÔNG nằm trong danh sách đã nộp; hiển thị riêng ở khối "Đang làm dở" với liên kết vào `/student/exam/{examId}` (kèm `?classId=` nếu có). Không có liên kết "Xem chi tiết" tới lượt chưa nộp.
- [ ] Mỗi lớp có huy hiệu theo trường `billing_status` đã có trong dữ liệu lớp: lớp `LOCKED` hiện "Đã khoá", `GRACE` hiện "Sắp khoá", `ENDED` hiện "Đã kết thúc".

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test trong `tests.lock`, `docs/`, migration, `middleware.ts`, API ngoài phạm vi mục 3. Không thêm đường tắt bỏ qua kiểm quyền.
- Giao diện tiếng Việt có dấu; giữ đủ 4 trạng thái (đang tải / rỗng / lỗi / có dữ liệu); không hiện mã HTTP thô cho người dùng.
- Test hiện có bị vỡ vì thay đổi hợp lệ thì do người viết test cập nhật (`tests/`); người code ghi vào `report.md` file nào bị ảnh hưởng.
- Kiểm bằng `python3 scripts/handoff.py verify TASK-056 --quiet` (CHỈ python3). Nộp bằng `submit`.
