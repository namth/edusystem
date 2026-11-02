# Báo cáo TASK-017

## Đã làm
- [x] Tạo các API admin dùng PostgreSQL qua `queryPg` (`lib/db-pg.ts`), bảo vệ bằng `requireRole(["ADMIN"])` ở đầu route và không bao giờ lộ mật khẩu hay token bảo mật:
  - `GET /api/admin/users?role=&q=`: lọc role (`ADMIN|TEACHER|STUDENT`) và tìm kiếm tên/email không phân biệt hoa thường (`ILIKE`), tổng hợp `class_ids`, `submission_count`, `latest_score`.
  - `GET /api/admin/users/[id]`: trả chi tiết user (không mật khẩu), danh sách lớp đã ghi danh và bài nộp sắp xếp mới nhất.
  - `PUT /api/admin/users/[id]`: kiểm tra hợp lệ dữ liệu, cập nhật thông tin user và cập nhật danh sách lớp của học sinh qua transaction (kèm đồng bộ `syncStudentEnrolledInClass`).
  - `GET /api/admin/classes`: trả danh sách tất cả các lớp học kèm tên giáo viên và sĩ số (`student_count`).
  - `GET /api/admin/requests`: trả danh sách đơn mua slot của giảng viên, ưu tiên `PENDING` lên đầu và ép kiểu số cho `total_cost`.
  - `PUT /api/admin/requests/[id]`: xử lý phê duyệt (`APPROVE`) hoặc từ chối (`REJECT`) đơn mua slot trong transaction, cập nhật `slot_limit` cho giảng viên tương ứng.
- [x] Chuyển đổi toàn diện 5 trang admin sang gọi các API trên thay vì truy cập DB trực tiếp qua Supabase client (`@/lib/supabase`):
  - `app/admin/accounts/page.tsx`: gọi `GET /api/admin/users` và `GET /api/admin/classes`.
  - `app/admin/students/page.tsx`: gọi `GET /api/admin/users?role=STUDENT`, `GET /api/admin/classes`, và xoá học sinh bằng `POST /api/admin/delete-user`.
  - `app/admin/students/[id]/page.tsx`: gọi `GET /api/admin/users/[id]`, `PUT /api/admin/users/[id]`, và `GET /api/admin/classes`.
  - `app/admin/teachers/page.tsx`: gọi `GET /api/admin/users?role=TEACHER`, tạo/xoá qua các API admin có sẵn.
  - `app/admin/requests/page.tsx`: gọi `GET /api/admin/requests` và `PUT /api/admin/requests/[id]`, cập nhật trạng thái dòng tại chỗ; phần đơn mua khóa học hiển thị ghi chú "Chưa hỗ trợ đơn mua khóa học của học sinh".
- [x] Gỡ bỏ toàn bộ `import { supabase }` và các lệnh gọi `supabase.*` khỏi cả 5 trang admin.
- [x] Thêm trạng thái hiển thị lỗi trực quan và nút "Thử lại" trên các trang admin.
- [x] Toàn bộ 444 tests và kiểm tra kiểu TypeScript (`verify.sh`) chạy thành công exit code 0.

## File đã tạo/sửa
- `app/api/admin/users/route.ts`: API GET danh sách người dùng hỗ trợ lọc role, tìm kiếm q, tính tổng hợp lớp và bài nộp.
- `app/api/admin/users/[id]/route.ts`: API GET chi tiết người dùng và PUT cập nhật thông tin, thay thế ghi danh lớp trong transaction.
- `app/api/admin/classes/route.ts`: API GET danh sách lớp học kèm tên giáo viên và sĩ số học sinh.
- `app/api/admin/requests/route.ts`: API GET danh sách yêu cầu mua slot giảng viên sắp xếp PENDING trước.
- `app/api/admin/requests/[id]/route.ts`: API PUT duyệt/từ chối đơn mua slot và cộng hạn mức slot trong transaction.
- `app/admin/accounts/page.tsx`: Trang quản lý tài khoản chuyển sang gọi API pg, gỡ bỏ Supabase client, có trạng thái lỗi và thử lại.
- `app/admin/students/page.tsx`: Trang danh sách học sinh chuyển sang gọi API pg, gỡ bỏ Supabase client, có trạng thái lỗi và thử lại.
- `app/admin/students/[id]/page.tsx`: Trang chi tiết học sinh chuyển sang gọi API pg, gỡ bỏ Supabase client, có trạng thái lỗi và thử lại.
- `app/admin/teachers/page.tsx`: Trang quản lý giảng viên chuyển sang gọi API pg, gỡ bỏ Supabase client, có trạng thái lỗi và thử lại.
- `app/admin/requests/page.tsx`: Trang duyệt yêu cầu chuyển sang gọi API pg, gỡ bỏ Supabase client, ẩn đơn khóa học với ghi chú thích hợp.

## Kết quả tự kiểm
```
 Test Files  22 passed (22)
      Tests  444 passed (444)
   Start at  13:38:22
   Duration  41.67s (transform 1.81s, setup 0ms, collect 1.71s, tests 271.76s, environment 3ms, prepare 1.83s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
