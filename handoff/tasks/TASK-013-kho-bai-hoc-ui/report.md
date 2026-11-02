# Báo cáo TASK-013

## Đã làm
- **SCR-L1 Kho bài học (`/teacher/lessons`)**: Client component hiển thị danh sách bài học độc lập; tìm kiếm debounce ~300ms theo tiêu đề; lọc kỹ năng (Tất cả / Reading / Listening / Writing); thẻ bài học hiển thị `block_count` khối, `usage_count` khóa, kỹ năng và thời gian cập nhật `vi-VN`; nút "Tạo bài học" dẫn tới `/teacher/lessons/new`; tính năng xóa kèm xác nhận, xử lý 409 hiện danh sách khóa đang sử dụng và hướng dẫn gỡ khỏi lộ trình; đủ 4 trạng thái UI (đang tải, lỗi + "Thử lại", rỗng, có dữ liệu).
- **SCR-L2 Soạn bài học (`/teacher/lessons/[id]`)**: Tích hợp `QuestionSetEditor` ở chế độ `LESSON`. Trường hợp `id = new` tạo mới bằng `POST /api/teacher/lessons { title, description }` rồi `PUT /api/teacher/lessons/{id} { question_ids }` và điều hướng về trang sửa bài học; trường hợp `id` có sẵn tải dữ liệu qua `GET /api/teacher/lessons/{id}` và lưu cập nhật qua `PUT`. Xử lý các trạng thái lỗi 403, 404, lỗi tải có nút "Thử lại", và nút "← Kho bài học" ở đầu trang.
- **SCR-L4 Bộ chọn bài học trong lộ trình (`/teacher/tests`)**: Modal thêm/sửa mục `LESSON` tải danh sách bài học từ `/api/teacher/lessons`, có ô tìm kiếm và danh sách chọn bài học; các bài học `block_count === 0` hiển thị mờ với ghi chú "Chưa có nội dung" và không cho chọn; tiêu đề mặc định theo bài học được chọn; gửi `lesson_id` qua `POST`/`PUT` `/api/teacher/curriculum`; lối tắt "Tạo bài học mới" mở tab mới (`target="_blank"`) kèm nút "Tải lại danh sách"; các nút `LESSON` trong cây lộ trình có biểu tượng liên kết dẫn tới `/teacher/lessons/${item.lesson_id}`.
- **Menu giáo viên (`components/TeacherLayout.tsx`)**: Thêm mục menu "Kho Bài Học" trỏ tới `/teacher/lessons` ngay sau mục "Soạn & Tạo Đề Thi".
- Không vi phạm các ràng buộc: không import trực tiếp DB/mock-data ở client components, giữ nguyên phạm vi file và logic kéo thả lộ trình hiện có.

## File đã tạo/sửa
- `app/teacher/lessons/page.tsx` — Tạo mới: Giao diện Kho bài học (SCR-L1)
- `app/teacher/lessons/[id]/page.tsx` — Tạo mới: Giao diện Soạn bài học (SCR-L2)
- `app/teacher/tests/page.tsx` — Chỉnh sửa: Tích hợp bộ chọn bài học từ kho và liên kết sửa bài học trong cây lộ trình (SCR-L4)
- `components/TeacherLayout.tsx` — Chỉnh sửa: Thêm mục menu "Kho Bài Học"

## Kết quả tự kiểm
```
 Test Files  18 passed (18)
      Tests  389 passed (389)
   Start at  12:58:26
   Duration  102.07s (transform 6.46s, setup 0ms, collect 9.60s, tests 638.02s, environment 29ms, prepare 5.44s)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
