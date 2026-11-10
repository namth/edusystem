# TASK-058 — Analytics học sinh: chịu lỗi API, hiển thị nhận xét AI đúng, nhãn đề đã xoá

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

**Lệnh agent được chạy:** CHỈ `python3` — kiểm bằng `python3 scripts/handoff.py verify TASK-058 --quiet`, nộp bằng `submit`. Đọc/sửa file bằng công cụ file; không dùng `ls`, `git`, `sed`, `npx`, `cat`.

## 1. Mục tiêu
Trang phân tích lấy tên đề từ `/api/exams`; API đó lỗi thì hỏng cả trang. Nhận xét có thể in `JSON.stringify(ai_feedback)` thô khi dữ liệu không phải chuỗi. Đề không còn trong danh sách hiện chữ khó hiểu.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `docs/03-screens-and-ui.md` (màn hình học sinh SCR-11…); `docs/12-business-rules.md` (BR-W: khoá lớp).

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/student/analytics/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, migration, `middleware.ts`.

## 4. Đặc tả chi tiết
Theo mục 1 và 5; chi tiết chưa nêu thì bám cách làm của các trang/route cùng thư mục.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `/api/exams` lỗi → trang vẫn hiển thị điểm/biểu đồ, tên đề dùng dự phòng "Đề thi" kèm báo nhẹ; không trắng trang.
- [ ] `ai_feedback` là chuỗi thì hiện chuỗi; là object/mảng thì hiện dạng danh sách đọc được (không in JSON thô, không `[object Object]`).
- [ ] Đề không tìm được tên hiển thị "Đề thi đã gỡ"; chỉ tính các lượt đã nộp (không `IN_PROGRESS`).
- [ ] Có trạng thái rỗng tiếng Việt khi chưa có bài nào.

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test trong `tests.lock`, `docs/`, migration, `middleware.ts`, API ngoài phạm vi mục 3. Không thêm đường tắt bỏ qua kiểm quyền.
- Giao diện tiếng Việt có dấu; giữ đủ 4 trạng thái (đang tải / rỗng / lỗi / có dữ liệu); không hiện mã HTTP thô cho người dùng.
- Test hiện có bị vỡ vì thay đổi hợp lệ thì do người viết test cập nhật (`tests/`); người code ghi vào `report.md` file nào bị ảnh hưởng.
- Kiểm bằng `python3 scripts/handoff.py verify TASK-058 --quiet` (CHỈ python3). Nộp bằng `submit`.
