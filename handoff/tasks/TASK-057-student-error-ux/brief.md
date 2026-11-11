# TASK-057 — Trang làm bài học sinh: bỏ alert, thông báo lớp khoá và lỗi thân thiện

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

**Lệnh agent được chạy:** CHỈ `python3` — kiểm bằng `python3 scripts/handoff.py verify TASK-057 --quiet`, nộp bằng `submit`. Đọc/sửa file bằng công cụ file; không dùng `ls`, `git`, `sed`, `npx`, `cat`.

## 1. Mục tiêu
Nộp bài học lỗi hiện bằng `alert()`; lớp khoá (403 mã `CLASS_LOCKED`) chỉ hiện chuỗi lỗi thô. Trang đề thi hiện "Bạn không có quyền làm đề thi này (403)" cho mọi 403 (không phân biệt lớp khoá), lộ mã HTTP, và lỗi từ bước tạo lượt làm bị nuốt cho tới khi bấm "Bắt đầu".

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `docs/03-screens-and-ui.md` (màn hình học sinh SCR-11…); `docs/12-business-rules.md` (BR-W: khoá lớp).

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/student/lesson/[lessonId]/page.tsx`
- `app/student/exam/[examId]/page.tsx`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, migration, `middleware.ts`.

## 4. Đặc tả chi tiết
Theo mục 1 và 5; chi tiết chưa nêu thì bám cách làm của các trang/route cùng thư mục.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Không còn `alert(`/`confirm(` ở hai trang; lỗi hiển thị trong khung thông báo trên trang (role="alert").
- [ ] Phản hồi có `code: "CLASS_LOCKED"` → hiện khung "Lớp học đang bị khoá — liên hệ giáo viên" kèm liên kết về `/student/dashboard`, không hiện mã HTTP.
- [ ] 403 khác (không ghi danh) và 409 có câu tiếng Việt riêng; không hiện chuỗi "(403)"/"(409)"/"(400)" cho người dùng.
- [ ] Lỗi khi tạo lượt làm bài của đề thi được báo ngay đúng nguyên nhân, không rơi xuống màn "bắt đầu" như thể bình thường.

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test trong `tests.lock`, `docs/`, migration, `middleware.ts`, API ngoài phạm vi mục 3. Không thêm đường tắt bỏ qua kiểm quyền.
- Giao diện tiếng Việt có dấu; giữ đủ 4 trạng thái (đang tải / rỗng / lỗi / có dữ liệu); không hiện mã HTTP thô cho người dùng.
- Test hiện có bị vỡ vì thay đổi hợp lệ thì do người viết test cập nhật (`tests/`); người code ghi vào `report.md` file nào bị ảnh hưởng.
- Kiểm bằng `python3 scripts/handoff.py verify TASK-057 --quiet` (CHỈ python3). Nộp bằng `submit`.
