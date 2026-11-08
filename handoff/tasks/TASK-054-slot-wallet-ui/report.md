# Báo cáo TASK-054

## Đã làm
- [x] `verify.sh` exit 0 (150 tests vitest PASS, tsc --noEmit không có lỗi type, next build thành công).
- [x] `/teacher/slots` hiển thị thẻ lớn số dư "N slot", dòng phụ "1 slot = 1 học sinh × 1 tháng trong một lớp", bảng "Lớp & lần trừ tới" kèm link và 4 trạng thái lớp; nhúng bảng lịch sử `SlotLedgerTable` theo dữ liệu API; rỗng hiện chính xác "Chưa có giao dịch".
- [x] Cảnh báo thiếu slot màu vàng hiển thị khi `balance < total_next_needed`, có nút "Mua slot" cuộn tới form mua.
- [x] Banner lớp `ClassBillingBanner` đúng màu sắc và câu chữ theo đặc tả cho GRACE (vàng, đếm ngày, link Mua slot), LOCKED (đỏ), ENDED (xám); ACTIVE không hiển thị (trả về null).
- [x] Thao tác "Kết thúc lớp" tại `/teacher/classes/[classId]` yêu cầu qua hộp xác nhận "Không hoàn tác được, không hoàn slot" trước khi gọi API `POST /api/teacher/classes/[classId]/end`.
- [x] Trang admin `/admin/teachers/[id]` gỡ bỏ hoàn toàn thẻ "Slot Capacity" và ô `slot_limit`, không gửi `slot_limit` trong PUT; thay bằng khối "Ví slot" hiển thị số dư, form "Điều chỉnh" (delta, note bắt buộc ≤ 500 ký tự và chặn trống ở client) gọi `slot-adjust`, và nhúng `SlotLedgerTable`.
- [x] Trang học sinh `/student/class/[classId]` hiển thị banner "Lớp đang tạm khoá, vui lòng liên hệ giáo viên" khi lớp LOCKED/ENDED hoặc mã `CLASS_LOCKED`; ẩn/vô hiệu hoá nút bắt đầu làm bài thi mới; học sinh vẫn xem được điểm số và bài đã chấm cũ. Không có liên kết tới `/teacher` hoặc `/admin`.
- [x] Tuân thủ quy chuẩn DEC-035 (không nhãn nút nào bắt đầu bằng `+ `), an toàn client bundle, định dạng số `vi-VN` và ngày `dd/mm/yyyy`.

## File đã tạo/sửa
- `components/slots/ClassBillingBanner.tsx`: Component banner hiển thị trạng thái thanh toán của lớp (GRACE, LOCKED, ENDED, ACTIVE).
- `components/slots/SlotLedgerTable.tsx`: Component hiển thị sổ cái ví slot 6 cột, lọc theo lớp, phân trang `next_cursor`, 4 trạng thái UI.
- `app/teacher/slots/page.tsx`: Cập nhật trang ví slot giáo viên, thẻ số dư lớn, cảnh báo thiếu slot, bảng lớp & lần trừ tới, nhúng `SlotLedgerTable`.
- `app/teacher/classes/[classId]/page.tsx`: Nhúng `ClassBillingBanner`, khối "Khai giảng & Tính phí" (sửa ngày khai giảng qua PUT billing, xử lý 409, kết thúc lớp qua POST end có xác nhận), thông báo lỗi thêm học sinh kèm link Mua slot.
- `app/admin/teachers/[id]/page.tsx`: Thay thế thẻ Slot Capacity bằng khối Ví slot, form điều chỉnh slot và `SlotLedgerTable`.
- `app/student/class/[classId]/page.tsx`: Banner lớp tạm khoá ở học sinh và vô hiệu hoá các nút bắt đầu làm bài khi lớp LOCKED/ENDED.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-054-slot-wallet-ui/verify.sh
… 195 dòng, log đầy đủ: /var/folders/38/_wzbbc7n3nb375zpmvlkr8100000gp/T/handoff-verify/TASK-054-TASK-054-slot-wallet-ui.log
ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
