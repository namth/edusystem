# Báo cáo TASK-049

## Đã làm
- **Sinh mật khẩu tạm thời (`lib/password-reset.ts`)**:
  - `generateTempPassword()`: sinh chuỗi 10 ký tự ngẫu nhiên bảo mật (dùng `crypto.randomInt`) từ bảng ký tự `ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789`. Đảm bảo luôn có ít nhất 1 chữ hoa, 1 chữ thường, và 1 chữ số.
  - `issueTempPassword(userId)`: băm mật khẩu tạm bằng `hashPassword` (chuẩn scrypt trong `lib/auth.ts`), cập nhật vào PostgreSQL bảng `users` với `must_change_password = TRUE`, đồng thời reset `reset_token = NULL` và `reset_token_expires = NULL`. Không lưu mật khẩu thô và trả về chuỗi mật khẩu tạm.
- **Route Admin (`app/api/admin/users/[id]/reset-password/route.ts`)**:
  - Phân quyền nghiêm ngặt bằng `requireRole(["ADMIN"])`. Người chưa đăng nhập trả về 401, không phải Admin trả về 403.
  - Chặn Admin tự cấp lại mật khẩu cho chính mình: trả về 400 kèm thông báo "Dùng chức năng đổi mật khẩu cho tài khoản của bạn".
  - Kiểm tra tồn tại người dùng: trả về 404 nếu không tìm thấy `id`.
  - Giới hạn tần suất 20 lần/giờ trên mỗi caller (`userId`) thông qua `lib/rate-limit.ts` (trả về 429 nếu vượt).
  - Đảm bảo header `Cache-Control: no-store` trên tất cả phản hồi; tuyệt đối không log mật khẩu tạm ra console.
- **Route Giáo viên (`app/api/teacher/students/[studentId]/reset-password/route.ts`)**:
  - Phân quyền `requireRole(["TEACHER"])`. Học sinh hoặc Admin gọi route này đều nhận 403.
  - Kiểm tra quan hệ học sinh - giáo viên thông qua truy vấn cơ sở dữ liệu `enrollments JOIN classes`: chỉ cho phép khi đối tượng là `STUDENT` và đang ghi danh trong ít nhất một lớp do giáo viên phụ trách (`classes.teacher_id = auth.user.userId`).
  - Các trường hợp khác (học sinh lớp khác, học sinh chưa ghi danh, tài khoản giáo viên/admin khác, id không tồn tại) đều trả về 404 với cùng một thông điệp thống nhất để chống dò tài khoản.
  - Giới hạn tần suất 20 lần/giờ trên mỗi giáo viên (429); header `Cache-Control: no-store`; không log mật khẩu tạm.
- **Giao diện người dùng (`components/ResetPasswordButton.tsx`)**:
  - Nút bấm thứ cấp chuẩn giao diện với icon `KeyRound` (lucide-react), nhãn đúng quy ước DEC-035: "Cấp lại mật khẩu" (không có dấu `+`).
  - Hộp xác nhận cảnh báo: "Mật khẩu cũ của <tên> sẽ không dùng được nữa".
  - Hộp hiển thị kết quả: hiển thị mật khẩu tạm, nút sao chép vào clipboard, và dòng lưu ý: "Chỉ hiện một lần. Người dùng sẽ phải đổi mật khẩu khi đăng nhập".
  - Quản lý trạng thái đang gửi (`isLoading`) và lỗi (`error`).
- **Tích hợp nút vào 3 trang theo brief**:
  - `app/admin/accounts/page.tsx`: gắn nút trên mỗi hàng tài khoản trong bảng (ngoại trừ chính tài khoản Admin đang đăng nhập).
  - `app/admin/students/[id]/page.tsx`: gắn nút trong phần Thông Tin Cơ Bản của học sinh.
  - `app/teacher/classes/[classId]/page.tsx`: gắn nút cho từng học sinh trong tab Danh sách Học viên.
  - Không chỉnh sửa trang `app/admin/teachers/[id]/page.tsx`.

## File đã tạo/sửa
- `lib/password-reset.ts`: Tạo mới logic sinh và cấp mật khẩu tạm trong DB.
- `app/api/admin/users/[id]/reset-password/route.ts`: Tạo mới API endpoint cấp lại mật khẩu cho Admin.
- `app/api/teacher/students/[studentId]/reset-password/route.ts`: Tạo mới API endpoint cấp lại mật khẩu cho Giáo viên.
- `components/ResetPasswordButton.tsx`: Tạo mới component nút + modal xác nhận + modal mật khẩu tạm.
- `app/admin/accounts/page.tsx`: Tích hợp `ResetPasswordButton` vào danh sách tài khoản quản trị.
- `app/admin/students/[id]/page.tsx`: Tích hợp `ResetPasswordButton` vào chi tiết học sinh.
- `app/teacher/classes/[classId]/page.tsx`: Tích hợp `ResetPasswordButton` vào danh sách học sinh của lớp.

## Kết quả tự kiểm
```
 Test Files  1 passed (1)
      Tests  25 passed (25)
   Start at  12:32:13
   Duration  14.97s (transform 98ms, setup 0ms, collect 76ms, tests 14.62s, environment 0ms, prepare 48ms)

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  12:32:29
   Duration  356ms (transform 22ms, setup 0ms, collect 20ms, tests 86ms, environment 0ms, prepare 56ms)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không. Mọi tiêu chí nghiệm thu đã hoàn thành đầy đủ, test nghiệp vụ 25/25 ca xanh, đồng bộ tài liệu 11/11 ca xanh, `verify.sh` đạt exit 0.
