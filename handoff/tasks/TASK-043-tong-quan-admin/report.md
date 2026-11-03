# Báo cáo TASK-043 — Trang tổng quan admin & sắp lại menu

## Đã làm
- Hiện thực module server `lib/admin-dashboard.ts` và API route `app/api/admin/dashboard/route.ts`:
  - RBAC: `requireRole(["ADMIN"])` gọi trước mọi truy vấn; 401 khi chưa đăng nhập, 403 khi TEACHER hoặc STUDENT.
  - Tham số `month` kiểm tra regex `/^\d{4}-(0[1-9]|1[0-2])$/`, sai trả 400. Mặc định lấy tháng hiện tại theo giờ Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7).
  - Ranh giới kỳ tháng tính theo giờ Việt Nam `[YYYY-MM-01 00:00 VN, tháng sau 00:00 VN)`. Truyền mốc dạng `timestamptz` (ISO kèm `+07:00`) vào tham số truy vấn SQL.
  - `totals` (toàn thời gian): giáo viên đã xác minh (`teachers_verified`), giáo viên dùng thử (`teachers_trial`), học sinh (`students`), bài học (`lessons`), đề thi (`exams`).
  - `pending_orders`: đếm số đơn hàng `slot_requests` có `status = 'PENDING'`.
  - `monthly`: đếm `submissions` (đề thi nộp trong kỳ + lượt học bài học trong kỳ), `ai_graded` (đếm submission_id + lesson_attempt_id riêng biệt, lọc purpose EXAM_GRADING & LESSON_GRADING), `ai_tokens` (tổng token mọi purpose), `ai_cost_vnd` (tính từ `cost_usd` đã lưu với tỷ giá `getAiPricing()`), `revenue_vnd` (tổng tiền các đơn APPROVED có decided_at trong kỳ), `unpriced_calls` (số log gọi AI dùng model chưa có cấu hình giá trong hệ thống).
  - `daily`: đủ các ngày trong tháng (kể cả ngày 0), gom nhóm ngày theo giờ Việt Nam (`to_char(... AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`).
  - `top_teachers`: nhóm log theo giáo viên trong kỳ, sắp theo `cost_vnd` giảm dần, tối đa 10, hiển thị tên, số bài AI chấm, token và chi phí.
- Hiện thực giao diện trang tổng quan `app/admin/page.tsx`:
  - Khai báo `"use client"`, bọc trong `AdminLayout`.
  - Dropdown chọn 12 tháng gần nhất, mặc định tháng hiện tại, đổi tháng gọi `/api/admin/dashboard?month=...`.
  - Hàng thẻ tổng quan toàn thời gian và hàng thẻ số liệu trong tháng.
  - Dòng cảnh báo amber khi `unpriced_calls > 0` kèm link tới `/admin/settings`.
  - Biểu đồ cột theo ngày với `recharts` (`ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`), hiển thị số bài nộp (màu brand qua biến CSS) và chi phí AI VND (màu accent qua biến CSS).
  - Bảng "Top giáo viên dùng AI trong tháng" liên kết tới `/admin/teachers/${teacher_id}`.
  - Đầy đủ các trạng thái skeleton khi tải dữ liệu, thông báo lỗi kèm nút "Thử lại", và trạng thái dữ liệu rỗng.
- Cập nhật menu `components/AdminLayout.tsx`:
  - Sắp xếp 8 mục menu theo đúng thứ tự đặc tả: Tổng quan (`/admin`, icon `LayoutDashboard`), Đơn hàng (`/admin/orders`, icon `Receipt`), Quản Lý Giáo Viên, Quản Lý Học Sinh, Quản Lý Tài Khoản, Chuẩn Chấm Điểm, Liên Hệ Từ Website, Cấu Hình AI & Hệ Thống.
  - Mục Tổng quan chỉ sáng khi `pathname === "/admin"`.
  - Gọi `GET /api/admin/orders?status=PENDING` khi mount để hiển thị huy hiệu số đơn chờ xử lý cạnh mục Đơn hàng.
- Điều hướng ADMIN về `/admin`:
  - Đổi chuyển hướng ADMIN từ `/admin/requests` sang `/admin` tại `components/onboarding/redirect.ts`, `app/page.tsx`, `components/Navbar.tsx`, `app/change-password/page.tsx`.

## File đã tạo/sửa
- `lib/admin-dashboard.ts`: module server tính toán số liệu tổng quan admin.
- `app/api/admin/dashboard/route.ts`: route API GET `/api/admin/dashboard?month=YYYY-MM`.
- `app/admin/page.tsx`: trang giao diện tổng quan admin client component.
- `components/AdminLayout.tsx`: sắp xếp lại menu admin, cập nhật icon và hiển thị badge số đơn chờ duyệt.
- `components/onboarding/redirect.ts`: cập nhật `roleHomePath` và `safeNextPath` điều hướng ADMIN về `/admin`.
- `app/page.tsx`: cập nhật chuyển hướng người dùng ADMIN về `/admin`.
- `components/Navbar.tsx`: cập nhật liên kết Quản trị về `/admin`.
- `app/change-password/page.tsx`: cập nhật điều hướng ADMIN sau khi đổi mật khẩu về `/admin`.

## Kết quả tự kiểm
```
 Test Files  55 passed (55)
      Tests  979 passed (979)
   Start at  09:11:50
   Duration  185.42s (transform 4.57s, setup 0ms, collect 4.27s, tests 721.11s, environment 9ms, prepare 4.12s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
