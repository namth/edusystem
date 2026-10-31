# Báo cáo TASK-012

## Đã làm
- Hiện thực component client `TeacherClassRoadmap` (SCR-L5):
  - Tải song song `GET /api/teacher/classes/${classId}/roadmap` và `GET /api/teacher/courses`.
  - Khối cài đặt: dropdown chọn khóa học (có lựa chọn "— Chưa gắn —"), radio chọn 3 chế độ mở bài (`MANUAL`, `ALL_OPEN`, `SEQUENTIAL`), ô số `pass_percent` (1-100, kích hoạt khi `SEQUENTIAL`). Nút "Lưu cài đặt" gọi `PUT /api/teacher/classes/${classId}/settings` chỉ gửi các trường thay đổi; lưu thành công tự tải lại lộ trình.
  - Cây lộ trình hiển thị đúng thứ tự, mục con thụt lề dưới unit. Ở chế độ `MANUAL`, mỗi unit/mục có công tắc "Mở cho cả lớp" (`POST`/`DELETE` tới `/unlocks`) và input ngày `due_date` cập nhật state tại chỗ (không tải lại toàn bộ trang). Ở `ALL_OPEN` / `SEQUENTIAL`, ẩn công tắc và hiển thị ghi chú chế độ.
  - Bảng tiến độ học sinh: gọi `GET /api/teacher/classes/${classId}/progress`, hiển thị `best_percent`% (bài học) hoặc ✓/— (đề thi), nền xanh nhạt khi hoàn thành. Ở `SEQUENTIAL`, ô chưa hoàn thành có nút "Mở riêng" gọi `POST /unlocks` với `curriculum_item_id` và `student_id`.
  - Hiển thị đầy đủ 4 trạng thái: đang tải (spinner), lỗi (thông báo + nút "Thử lại"), rỗng ("Lớp chưa gắn khóa học. Chọn khóa học ở trên để bắt đầu." / "Khóa học chưa có lộ trình."), có dữ liệu. Không import DB/Neo4j/mock.
- Hiện thực component client `StudentRoadmap` (SCR-L6):
  - Gọi `GET /api/student/classes/${classId}/roadmap`.
  - Khối tiến độ tổng quan: thanh tiến độ `progress_percent`%, dòng phụ ghi chú chế độ lớp (`SEQUENTIAL` kèm ngưỡng `pass_percent`, `ALL_OPEN`, `MANUAL`).
  - Cây lộ trình: unit có thể gấp/mở. Biểu tượng theo 3 trạng thái (`LOCKED` 🔒 xám, `OPEN` ▶ màu thương hiệu `#6d3807`, `COMPLETED` ✔ xanh). Hiển thị điểm cao nhất `best_percent` và hạn `due_date` định dạng `vi-VN` (tô đỏ cảnh báo khi quá hạn).
  - Mục bài học (`LESSON`) ở trạng thái `OPEN`/`COMPLETED` là `Link` tới `/student/lesson/${item.lesson_id}?classId=${classId}`; mục đề thi (`EXAM`) là `Link` tới `/student/exam/${item.exam_id}`; mục `LOCKED` không bấm được và có `title="Chưa được mở"`.
  - Hiển thị đầy đủ 4 trạng thái: đang tải, lỗi (thông báo + nút "Thử lại", 403 hiện "Bạn chưa tham gia lớp học này."), rỗng ("Giáo viên chưa gắn khóa học cho lớp này hoặc khóa học chưa có lộ trình."), có dữ liệu.
- Tích hợp vào trang lớp:
  - `app/teacher/classes/[classId]/page.tsx`: mở rộng kiểu `activeTab` thêm `"roadmap"`, thêm nút tab thứ 3 "3. Lộ trình & Mở bài" và render `<TeacherClassRoadmap classId={classId} />`.
  - `app/student/class/[classId]/page.tsx`: thêm `"roadmap"` vào kiểu `activeTab`, đặt nút tab "Lộ trình" ở vị trí đầu tiên và làm tab mặc định; render `<StudentRoadmap classId={classId} />`.
- Đảm bảo toàn bộ 15 bộ test (342 bài test) và kiểm tra kiểu TypeScript (`tsc -p tsconfig.verify.json`) vượt qua 100%.

## File đã tạo/sửa
- `components/class-roadmap/TeacherClassRoadmap.tsx`: Component client giao diện tab Lộ trình lớp dành cho giáo viên (SCR-L5).
- `components/class-roadmap/StudentRoadmap.tsx`: Component client giao diện tab Lộ trình lớp dành cho học sinh (SCR-L6).
- `app/teacher/classes/[classId]/page.tsx`: Thêm tab "3. Lộ trình & Mở bài" và nhúng `TeacherClassRoadmap`.
- `app/student/class/[classId]/page.tsx`: Thêm tab "Lộ trình" làm tab mặc định và nhúng `StudentRoadmap`.

## Kết quả tự kiểm
```
 Test Files  15 passed (15)
      Tests  342 passed (342)
   Start at  12:40:31
   Duration  169.19s (transform 6.90s, setup 0ms, collect 4.11s, tests 1104.33s, environment 3ms, prepare 3.87s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
