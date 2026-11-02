# Báo cáo TASK-006

## Đã làm
- Hiện thực thư viện thuần `lib/curriculum-dnd.ts` với `isNoopGap` và `computeDrop` xử lý chính xác khe kéo thả cùng/khác cha, không gây lệch vị trí khi kéo xuống, và trả về danh sách các mục thực sự thay đổi.
- Viết lại API `/api/teacher/curriculum/route.ts` đầy đủ các method `GET`, `POST`, `PUT`, `DELETE`:
  - Kiểm tra `requireRole(["ADMIN", "TEACHER"])` ở dòng đầu mỗi method.
  - Kiểm tra quyền khóa học: ADMIN truy cập và ghi mọi khóa; TEACHER đọc khóa của mình hoặc khóa hệ thống (`created_by IS NULL`), chỉ ghi khóa do mình tạo (`created_by = userId`).
  - POST: sinh id dạng `curr_` + `crypto.randomUUID()`, tự động tính `order_index` phía server, validate loại mục và quan hệ cha-con.
  - PUT: cập nhật hàng loạt trong một transaction PostgreSQL (`BEGIN` ... `COMMIT` / `ROLLBACK`), chỉ cập nhật các trường được gửi.
  - DELETE: hỗ trợ xóa bài học hoặc xóa `UNIT` kèm cascade toàn bộ các mục con thuộc unit đó, trả về danh sách `deletedIds`.
- Cập nhật giao diện `app/teacher/tests/page.tsx`:
  - `fetchCurriculum` chỉ gọi duy nhất 1 lần khi nạp lần đầu hoặc đổi khóa học trong `useEffect`.
  - Mọi thao tác thêm (bài học/đề thi/unit/đề chưa phân loại), sửa, xoá đều cập nhật state `items` tại chỗ, unit mới tự động mở (`expandedUnits`).
  - Kéo thả và nút mũi tên lên/xuống sử dụng `computeDrop` và cập nhật lạc quan, tự động rollback nếu API lỗi.
  - Ô preview nét đứt chỉ hiển thị khi `!isNoopGap(...)` cho cả cấp gốc lẫn cấp con.
  - Thay thế toàn bộ `alert` chặn luồng bằng banner thông báo không chặn, hiển thị spinner loading cục bộ tại đúng nút đang thao tác thay vì khóa cả cây.
- Chạy `verify.sh` đạt exit 0 (vượt qua toàn bộ 229 tests và `tsc --noEmit`).

## File đã tạo/sửa
- `lib/curriculum-dnd.ts`: Module hàm thuần xử lý logic kéo thả và tính toán vị trí thả/khe không hợp lệ.
- `app/api/teacher/curriculum/route.ts`: Viết lại API lộ trình đầy đủ GET, POST, PUT, DELETE với kiểm tra quyền sở hữu và transaction DB.
- `app/teacher/tests/page.tsx`: Trang quản lý lộ trình học cập nhật tại chỗ không tải lại cả cây, tích hợp kéo thả mượt và banner thông báo lỗi.

## Kết quả tự kiểm
```
 Test Files  8 passed (8)
      Tests  229 passed (229)
   Start at  10:32:33
   Duration  30.42s (transform 1.37s, setup 0ms, collect 1.44s, tests 130.15s, environment 1ms, prepare 1.27s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
