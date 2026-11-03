# Báo cáo TASK-042

## Đã làm
- Hiện thực thư viện `lib/vietqr-banks.ts` gồm danh sách 20 ngân hàng lớn theo chuẩn NAPAS với BIN 6 số không trùng và hàm tra cứu `findBankByBin`.
- Hiện thực component `components/orders/PaymentPanel.tsx` vẽ mã VietQR bằng thư viện `qrcode` (không gọi dịch vụ ngoài), hiển thị đầy đủ thông tin thanh toán kèm nút sao chép nhanh, huy hiệu trạng thái chuẩn tiếng Việt, biên nhận đơn sau khi duyệt/huỷ và thông báo khi chưa cấu hình tài khoản.
- Cập nhật menu giáo viên trong `components/TeacherLayout.tsx` thành nhãn "Slot học sinh & đơn hàng".
- Hiện thực trang chi tiết đơn hàng giáo viên `/teacher/orders/[id]` hiển thị `PaymentPanel`, nút "Tôi đã chuyển khoản" (gọi `/report-paid`) và nút "Huỷ đơn" (gọi `/cancel`).
- Nâng cấp trang `/teacher/slots` hiển thị sĩ số thật từ `usage`, form mua slot với dự kiến chi phí, điều hướng sang trang đơn hàng VietQR sau khi tạo đơn và bảng lịch sử đơn hàng có link chi tiết.
- Hiện thực trang quản trị đơn hàng `/admin/orders` bọc `Suspense`, đọc `status`, `q`, `source` từ URL query, lọc theo trạng thái (hiện số từ counts), duyệt / từ chối (kèm modal lý do) / huỷ đơn, và tab "Cấu hình thanh toán" chọn ngân hàng từ `VIETQR_BANKS` cùng khung xem trước QR mẫu 10.000đ.
- Hiện thực trang chi tiết đơn hàng admin `/admin/orders/[id]` với `PaymentPanel` và các nút duyệt / từ chối.
- Bổ sung khối "Tạo đơn mua slot" trong trang chi tiết giáo viên `/admin/teachers/[id]` gọi `POST /api/admin/orders`.
- Chuyển hướng 308 trang `/admin/requests` sang `/admin/orders` bằng server component `permanentRedirect`.

## File đã tạo/sửa
- `lib/vietqr-banks.ts`: Danh sách ngân hàng VietQR theo chuẩn NAPAS và hàm tìm kiếm theo BIN.
- `components/orders/PaymentPanel.tsx`: Component hiển thị khung thanh toán VietQR và biên nhận đơn hàng.
- `components/TeacherLayout.tsx`: Đổi nhãn menu "/teacher/slots" thành "Slot học sinh & đơn hàng".
- `app/teacher/orders/[id]/page.tsx`: Trang chi tiết đơn hàng cho giáo viên với thao tác báo chuyển khoản và huỷ đơn.
- `app/teacher/slots/page.tsx`: Trang quản lý sĩ số slot và danh sách đơn hàng cho giáo viên.
- `app/admin/orders/page.tsx`: Trang quản trị đơn hàng (tab danh sách + tab cấu hình thanh toán VietQR).
- `app/admin/orders/[id]/page.tsx`: Trang chi tiết đơn hàng cho quản trị viên với thao tác duyệt / từ chối.
- `app/admin/teachers/[id]/page.tsx`: Thêm khối tạo đơn mua slot cho giáo viên.
- `app/admin/requests/page.tsx`: Server component chuyển hướng 308 sang `/admin/orders`.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-042-don-hang-giao-dien/verify.sh

 RUN  v3.2.7 /Users/namtran/agy-farm/worktrees/TASK-042

 Test Files  53 passed (53)
      Tests  949 passed (949)
   Start at  09:08:59
   Duration  87.29s (transform 2.21s, setup 0ms, collect 2.34s, tests 337.21s, environment 7ms, prepare 3.01s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
