# TASK-054 — Giao diện Ví slot: trang ví GV, cài đặt & banner lớp, ví ở chi tiết GV admin, banner lớp khoá ở HS

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

**Phụ thuộc:** TASK-052, TASK-053 đã merge (API ví, `billing`, `end`, `slot-adjust`, mã lỗi `CLASS_LOCKED`).

## 1. Mục tiêu
Đưa ví slot học sinh-tháng (FEAT-015) lên giao diện để giáo viên biết còn bao nhiêu slot, lần trừ tới ra sao và lớp nào sắp bị khoá. Admin xem và cộng/trừ ví; học sinh biết vì sao lớp đang tạm khoá.

## 2. Tài liệu bắt buộc đọc
- `docs/features/vi-slot-hoc-sinh-thang.md` §4 (SCR-29, SCR-21, SCR-44, SCR-11), §6 (payload API), §7
- `docs/03-screens-and-ui.md` (quy ước 4 trạng thái), DEC-035 (nút)
- Các API của TASK-053 (đọc route trong `app/api/teacher/slot-wallet`, `app/api/teacher/classes/[classId]/billing`, `.../end`, `app/api/admin/teachers/[id]/slot-wallet`, `.../slot-adjust`)

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/teacher/slots/page.tsx`
- `app/teacher/classes/[classId]/page.tsx`
- `app/admin/teachers/[id]/page.tsx`
- `app/student/class/[classId]/page.tsx`
- `components/slots/SlotLedgerTable.tsx`, `components/slots/ClassBillingBanner.tsx` (mới)
- `tests/slot-wallet-ui.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:** mọi file trong `tests.lock`; `app/api/**`, `lib/**`; `docs/`

## 4. Đặc tả chi tiết
**`/teacher/slots` → "Ví slot"** (gọi `GET /api/teacher/slot-wallet`)
- Thẻ lớn: số dư "N slot", dòng phụ "1 slot = 1 học sinh × 1 tháng trong một lớp".
- Cảnh báo vàng khi `balance < total_next_needed`: "Còn thiếu X slot cho các lần trừ trong 31 ngày tới" + nút "Mua slot" (cuộn tới form mua sẵn có).
- Bảng "Lớp & lần trừ tới": tên lớp (link tới lớp), trạng thái (Đang chạy / Ân hạn đến dd/mm / Tạm khoá / Đã kết thúc), ngày khai giảng, ngày trừ tới, sĩ số, "Đủ / Thiếu".
- Bảng lịch sử (`SlotLedgerTable`): thời gian, loại (Mua slot / Admin điều chỉnh / Học sinh vào lớp / Trừ theo tháng / Chuyển đổi), lớp, thay đổi (+xanh / −đỏ), số dư sau, ghi chú; lọc theo lớp, nút "Xem thêm" theo `next_cursor`.
- Giữ nguyên form tạo đơn và danh sách đơn hiện có. Bỏ chữ "slot đang dùng / tổng" kiểu cũ.

**`/teacher/classes/[classId]`**
- `ClassBillingBanner` trên đầu trang: GRACE → vàng "Lớp không đủ slot cho tháng mới. Còn N ngày trước khi tạm khoá." + nút "Mua slot" → `/teacher/slots`; LOCKED → đỏ "Lớp đang tạm khoá: học sinh chỉ xem được bài cũ."; ENDED → xám "Lớp đã kết thúc".
- Khối "Tính phí" (trong tab học sinh hoặc khu thông tin lớp): ngày khai giảng (ô ngày; chỉ sửa được khi API cho phép — lỗi 409 hiện thông điệp server), ngày trừ tới, nút "Kết thúc lớp" (hộp xác nhận "Không hoàn tác được, không hoàn slot") gọi `POST …/end`.
- Thêm học sinh lỗi 409 hết slot → hiện thông điệp server kèm link "Mua slot".

**`/admin/teachers/[id]`**: thay thẻ "Slot Capacity" (sửa `slot_limit`) bằng khối "Ví slot": số dư, `SlotLedgerTable`, form "Điều chỉnh" (số nguyên dương/âm, lý do bắt buộc ≤ 500 ký tự) gọi `slot-adjust`; bỏ gửi `slot_limit` trong PUT.

**`/student/class/[classId]`**: khi API trả `code: "CLASS_LOCKED"` hoặc lớp có `billing_status` LOCKED/ENDED → banner "Lớp đang tạm khoá, vui lòng liên hệ giáo viên" và ẩn/disable nút bắt đầu làm bài; điểm và bài cũ vẫn xem được.

Mọi khối: đủ 4 trạng thái (đang tải / lỗi + "Thử lại" / rỗng / có dữ liệu); số định dạng `vi-VN`; ngày `dd/mm/yyyy`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0 (vitest + tsc + `next build`)
- [ ] `/teacher/slots` hiển thị số dư, bảng lớp và lịch sử theo dữ liệu mock API; rỗng hiện "Chưa có giao dịch"
- [ ] Cảnh báo thiếu slot hiện khi `balance < total_next_needed`, ẩn khi đủ
- [ ] Banner lớp đúng màu/nội dung cho GRACE, LOCKED, ENDED; ACTIVE không có banner
- [ ] "Kết thúc lớp" phải qua hộp xác nhận mới gọi API
- [ ] Trang admin không còn ô `slot_limit`; form điều chỉnh chặn lý do trống ở client
- [ ] Trang học sinh lớp LOCKED không có nút bắt đầu làm bài

## 6. Ràng buộc & bẫy cần tránh
- Không tự tính số dư/kỳ ở client — chỉ hiển thị số API trả.
- Nhãn nút không có dấu `+` (DEC-035).
- Chỉ chạy lệnh `python3` (`python3 scripts/handoff.py verify TASK-054`).
