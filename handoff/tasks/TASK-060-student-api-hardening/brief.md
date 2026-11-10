# TASK-060 — Siết API lớp học sinh: vai trò, bỏ cột nội bộ, thứ tự kiểm quyền với lớp khoá

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity

**Độ khó:** HIGH
**Nhạy cảm:** có

**Lệnh agent được chạy:** CHỈ `python3` — kiểm bằng `python3 scripts/handoff.py verify TASK-060 --quiet`, nộp bằng `submit`. Đọc/sửa file bằng công cụ file; không dùng `ls`, `git`, `sed`, `npx`, `cat`.

## 1. Mục tiêu
(1) `GET /api/student/classes` và `/api/student/classes/[classId]` dùng `requireRole()` không giới hạn vai trò; API chi tiết trả `SELECT * FROM classes` nguyên dòng nên lộ cột nội bộ (teacher_id, next_charge_at, billing_period, grace…). (2) `POST …/lessons/[lessonId]/attempts` gọi `assertClassOpen(classId)` TRƯỚC `checkLessonAccess` nên người chưa ghi danh dò được trạng thái khoá của lớp bất kỳ qua 403 `CLASS_LOCKED`.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến); `docs/03-screens-and-ui.md` (màn hình học sinh SCR-11…); `docs/12-business-rules.md` (BR-W: khoá lớp).

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/student/classes/route.ts`
- `app/api/student/classes/[classId]/route.ts`
- `app/api/student/lessons/[lessonId]/attempts/route.ts`

**Không được sửa:** mọi file trong `tests.lock`, `docs/`, migration, `middleware.ts`.

## 4. Đặc tả chi tiết
Theo mục 1 và 5; chi tiết chưa nêu thì bám cách làm của các trang/route cùng thư mục.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Cả hai route `GET /api/student/classes*` chỉ cho vai `STUDENT` (vai khác → 403). TRƯỚC khi siết, tìm mọi nơi gọi các route này trong `app/` và `components/`; nếu có vai khác gọi hợp lệ thì KHÔNG siết, ghi vào `report.md` mục câu hỏi và dừng.
- [ ] `GET /api/student/classes/[classId]` trả danh sách cột tường minh: đủ mọi trường mà `app/student/class/[classId]/page.tsx` và `components/class-roadmap/StudentRoadmap.tsx` đọc, KHÔNG có `teacher_id`, `next_charge_at`, `billing_period`, ngày hết ân hạn hay số dư; vẫn giữ `billing_status`. Học sinh không ghi danh lớp đó → 404/403 như hiện tại.
- [ ] `POST …/lessons/[lessonId]/attempts`: kiểm ghi danh/quyền (`checkLessonAccess`) trước; người chưa ghi danh nhận đúng mã lỗi của `checkLessonAccess`, KHÔNG nhận `CLASS_LOCKED`; học sinh đã ghi danh ở lớp khoá vẫn nhận 403 `CLASS_LOCKED`.
- [ ] Giữ nguyên toàn bộ hành vi và test hiện có của `slot-wallet-api`, `student-lessons-api`, `student-api`.

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test trong `tests.lock`, `docs/`, migration, `middleware.ts`, API ngoài phạm vi mục 3. Không thêm đường tắt bỏ qua kiểm quyền.
- Giao diện tiếng Việt có dấu; giữ đủ 4 trạng thái (đang tải / rỗng / lỗi / có dữ liệu); không hiện mã HTTP thô cho người dùng.
- Test hiện có bị vỡ vì thay đổi hợp lệ thì do người viết test cập nhật (`tests/`); người code ghi vào `report.md` file nào bị ảnh hưởng.
- Kiểm bằng `python3 scripts/handoff.py verify TASK-060 --quiet` (CHỈ python3). Nộp bằng `submit`.
