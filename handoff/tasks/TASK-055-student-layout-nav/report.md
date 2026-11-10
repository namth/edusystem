# Báo cáo TASK-055

## Đã làm
- Đã loại bỏ hoàn toàn chuỗi `cls_101` khỏi giao diện người dùng (`components/StudentLayout.tsx` và `app/teacher/classes/[classId]/page.tsx`). Trang giáo viên dùng `params.classId` trực tiếp, không còn fallback `cls_101`.
- Cập nhật menu sidebar học sinh gồm đúng 5 mục bắt buộc: Tổng quan (`/student/dashboard`), Lớp học của tôi (`/student/dashboard#classes`), Phân tích & báo cáo (`/student/analytics`), Hồ sơ (`/profile`), Đổi mật khẩu (`/change-password`).
- Xây dựng cơ chế theo dõi `window.location.hash` và sự kiện `hashchange` để phân biệt trạng thái active giữa Tổng quan và Lớp học của tôi (`#classes`); tại mỗi thời điểm chỉ có duy nhất một mục được tô sáng.
- Bổ sung thanh điều hướng mobile cố định cạnh dưới màn hình (`fixed bottom-0 ... md:hidden`) với `aria-label="Điều hướng di động"`, tái sử dụng cùng mảng `navItems`, thêm padding đáy (`pb-20 md:pb-8`) cho thẻ `<main>` để tránh nội dung bị che.
- Loại bỏ hoàn toàn ô tìm kiếm không hoạt động và icon `Search` khỏi header.
- Cập nhật nhãn vai trò hiển thị "Học sinh" (thay cho "IELTS Student"); chuẩn hoá toàn bộ nhãn giao diện sang tiếng Việt có dấu ("Đăng xuất", "Tổng quan", "Phân tích & báo cáo", "Hồ sơ", "Đổi mật khẩu").

## File đã tạo/sửa
- `components/StudentLayout.tsx`: Tinh chỉnh menu 5 mục, logic active theo hash, thêm bottom nav mobile, loại bỏ ô tìm kiếm chết và chuẩn hoá nhãn tiếng Việt/vai trò Học sinh.
- `app/teacher/classes/[classId]/page.tsx`: Dùng `params.classId` trực tiếp, xoá fallback `cls_101`.

## Kết quả tự kiểm
```
 ✓ tests/student-layout-nav.test.ts (25 tests) 45ms
 ✓ tests/design-rules.test.ts (5 tests) 99ms

 Test Files  2 passed (2)
      Tests  30 passed (30)
   Start at  00:31:47
   Duration  750ms (transform 147ms, setup 0ms, collect 317ms, tests 143ms, environment 0ms, prepare 273ms)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
