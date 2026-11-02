# Báo cáo TASK-025

## Đã làm
- Viết lại trang `app/student/page.tsx` thành trang "Lớp của tôi" dùng API pg (`GET /api/student/classes` và `POST /api/student/enroll`), hoàn tất việc gỡ Supabase client phía trình duyệt cuối cùng trong toàn bộ dự án.
- Bỏ hoàn toàn phần bán khóa học, giá tiền, đơn mua (`orders`), mã QR VietQR động và mock data (`INITIAL_*`, `@/lib/mock-data`) theo đúng quyết định DEC-019 và bất biến 9.
- Lời chào hiển thị theo `useAuth().user?.name`, có các lối tắt dẫn tới `/student/dashboard` và `/student/analytics`.
- Hiển thị danh sách lớp học của học sinh: thẻ lớp gồm tên, mã lớp, lịch học và liên kết vào lớp `/student/class/${id}`. Khi chưa có lớp, hiển thị thông báo rỗng: "Bạn chưa tham gia lớp nào — nhập mã lớp do giáo viên cung cấp".
- Tính năng tham gia lớp học bằng mã: form gửi `POST /api/student/enroll { code }`, xử lý đầy đủ các trường hợp:
  - 200 `alreadyEnrolled`: "Bạn đã ở trong lớp này"
  - 200 tham gia mới thành công: thông báo và tải lại danh sách lớp
  - 404: "Mã lớp không đúng"
  - 409: "Lớp đã đủ chỗ"
  - Các lỗi khác: hiển thị `json.error`
- Có đầy đủ trạng thái nạp dữ liệu (loading), thông báo lỗi và nút "Thử lại".
- Tự kiểm bằng `python3 scripts/handoff.py verify TASK-025`: 31/31 test files pass, 585/585 tests pass, exit 0.

## File đã tạo/sửa
- `app/student/page.tsx`: Viết lại trang chủ học sinh dùng API pg, bỏ bán khóa học và gỡ Supabase client trình duyệt.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-025-trang-chu-hoc-sinh/verify.sh

 RUN  v3.2.7 /Users/namtran/agy-farm/worktrees/TASK-025

 ✓ tests/lesson-preview.test.ts (5 tests) 4661ms
 ✓ tests/standard-selection.test.ts (6 tests) 5196ms
 ✓ tests/migration-006.test.ts (13 tests) 5315ms
 ✓ tests/profile-slots-grading.test.ts (11 tests) 7296ms

 Test Files  31 passed (31)
      Tests  585 passed (585)
   Start at  22:44:57
   Duration  38.51s (transform 1.74s, setup 0ms, collect 2.19s, tests 244.84s, environment 5ms, prepare 2.85s)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
