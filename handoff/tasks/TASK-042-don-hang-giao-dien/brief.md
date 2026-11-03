# TASK-042 — Đơn hàng mua slot: giao diện & trang thanh toán VietQR

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/quan-tri-he-thong.md` (FEAT-013) §3.1–3.3, §4 (trang thanh toán) · DEC-032, DEC-033, DEC-035.
> Phần server đã có (TASK-041). Hợp đồng API nằm ở `tests/slot-orders-api.test.ts` và §6 đặc tả. **Chỉ làm giao diện**, không sửa API.
> Chạy **song song** với TASK-043 (dashboard + menu admin). Không chạm `components/AdminLayout.tsx` và `app/admin/page.tsx`, hai file đó thuộc TASK-043, kể cả mục menu "Đơn hàng".

## 1. Tài liệu bắt buộc đọc
- Đặc tả nêu trên.
- `lib/slot-orders.ts` (kiểu `Order`), `lib/vietqr.ts`, các route `app/api/orders/**`, `app/api/admin/orders/**`, `app/api/admin/settings/payment`.
- Test:
  - `tests/orders-ui.test.ts` (mới).
  - `tests/design-rules.test.ts`, `tests/brand-tokens.test.ts`, `tests/teacher-trial.test.ts` ("giữ nguyên menu").
  - Mọi test khác phải xanh.
- Gói `qrcode` + `@types/qrcode` đã được cài sẵn. **Không sửa `package*.json`.**

## 2. Phạm vi file
**Được tạo/sửa:**
- `lib/vietqr-banks.ts` (mới, thuần)
- `components/orders/PaymentPanel.tsx` (mới), `components/orders/*` (component phụ nếu cần)
- `app/teacher/orders/[id]/page.tsx` (mới), `app/teacher/slots/page.tsx`, `components/TeacherLayout.tsx` (chỉ đổi nhãn mục slots)
- `app/admin/orders/page.tsx` (mới), `app/admin/orders/[id]/page.tsx` (mới), `app/admin/requests/page.tsx` (thay bằng trang chuyển hướng)
- `app/admin/teachers/[id]/page.tsx` (chỉ thêm khối tạo đơn)

**Không được sửa:** `tests/**`, `e2e/**`, `docs/**`, `package*.json`, `app/api/**`, `lib/` (trừ `lib/vietqr-banks.ts`), `components/AdminLayout.tsx`, `app/admin/page.tsx`, `app/page.tsx`, `components/Navbar.tsx`, `components/onboarding/**`.

## 3. Đặc tả
### 3.1 `lib/vietqr-banks.ts`
```ts
export interface VietQrBank { bin: string; short_name: string; name: string }
export const VIETQR_BANKS: VietQrBank[];        // ≥ 15 ngân hàng, BIN 6 số, không trùng
export function findBankByBin(bin: string): VietQrBank | null;
```
- Danh sách tối thiểu (BIN theo NAPAS): Vietcombank 970436, VietinBank 970415, BIDV 970418, Agribank 970405, MB 970422, Techcombank 970407, ACB 970416, VPBank 970432, TPBank 970423, Sacombank 970403, HDBank 970437, VIB 970441, SHB 970443, Eximbank 970431, MSB 970426, OCB 970448, SeABank 970440, LPBank 970449, Nam A Bank 970428, Bac A Bank 970409.

### 3.2 `components/orders/PaymentPanel.tsx`
```tsx
export default function PaymentPanel(props: { order: Order; payment: Payment; actions?: React.ReactNode })
// Payment = { configured, bank_bin, bank_name, account_no, account_name, amount, add_info, qr_payload }
```
- **QR:** có `qr_payload` thì vẽ bằng `QRCode.toDataURL` (gói `qrcode`) trong `useEffect`, hiện `<img>` khoảng 240px ở giữa. Dưới ảnh là tên ngân hàng (`bank_name`, không có thì lấy từ `findBankByBin`).
- **Các dòng thông tin:** ngân hàng, số tài khoản, chủ tài khoản, số tiền (`toLocaleString("vi-VN")` + " đ"), nội dung chuyển khoản (`add_info`). Mỗi dòng có nút sao chép (`navigator.clipboard.writeText`); sao chép xong báo "Đã sao chép" khoảng 2 giây.
- **Huy hiệu trạng thái:**

| Trạng thái | Nhãn | Màu |
| :--- | :--- | :--- |
| `PENDING` chưa báo chuyển khoản | Chờ thanh toán | amber |
| `PENDING` đã có `payment_reported_at` | Đã báo chuyển khoản | brand |
| `APPROVED` | Đã duyệt | emerald |
| `REJECTED` | Từ chối (kèm lý do) | rose |
| `CANCELLED` | Đã huỷ | rose |

- **Khi không vẽ QR:**
  - `configured = false` → hiện khung "KitoKit chưa cấu hình tài khoản nhận tiền, vui lòng liên hệ quản trị viên.", không vẽ QR.
  - Đơn không còn `PENDING` → không vẽ QR, chỉ hiện biên nhận: mã đơn, số slot, số tiền, thời điểm duyệt.
- **Ghi chú:** hiện ghi chú của đơn (`note`) nếu có. `actions` render ở cuối khung.

### 3.3 Giáo viên
- **`/teacher/orders/[id]`** (`TeacherLayout`):
  - `GET /api/orders/${id}` rồi hiện `PaymentPanel`.
  - Đơn `PENDING` có nút **"Tôi đã chuyển khoản"** (gọi `POST …/report-paid`, xong thì tải lại; đã báo thì nút chuyển thành dòng chữ "Đã báo — chờ KitoKit xác nhận") và nút **"Huỷ đơn"** (hỏi xác nhận, gọi `POST …/cancel`).
  - Lỗi 404 → "Không tìm thấy đơn hàng". Có link về `/teacher/slots`.
- **`/teacher/slots`:**
  - Thẻ "Đang dùng {usage.used} / {usage.limit} slot học sinh", kèm câu giải thích 1 slot = 1 học sinh.
  - Form số slot hiện giá dự kiến lấy từ `unit_price` của đơn gần nhất. Không biết giá thì ghi "Giá tính khi tạo đơn".
  - Tạo đơn thành công → `router.push(\`/teacher/orders/${id}\`)`.
  - Bảng đơn của tôi: mã đơn, số slot, số tiền, trạng thái, ngày tạo, link `href={\`/teacher/orders/${o.id}\`}`.
  - Giáo viên dùng thử (403 `TRIAL_LIMIT`) → hiện thông điệp lỗi server trả về.
- **`components/TeacherLayout.tsx`:** đổi nhãn `"/teacher/slots"` thành `"Slot học sinh & đơn hàng"`. Giữ nguyên các mục khác.

### 3.4 Admin
- **`/admin/orders`:** page bọc `<Suspense>`, nội dung dùng `useSearchParams`.
  - **Tab "Đơn hàng"** (mặc định):
    - Lọc trạng thái (Chờ xử lý / Đã duyệt / Từ chối / Đã huỷ / Tất cả, hiện số từ `counts`), lọc nguồn (Giáo viên / Admin), ô tìm mã đơn, tên hoặc email.
    - Đọc `?status=`, `?q=` để mở sẵn bộ lọc; link trong thông báo là `/admin/orders?q=<code>`.
    - Bảng gồm mã đơn, giáo viên, số slot, số tiền, nguồn, trạng thái, "Báo CK lúc", ngày tạo.
    - Nút trên mỗi dòng PENDING: **Duyệt** (hỏi xác nhận, `POST /api/admin/orders/${id}/approve`), **Từ chối** (modal bắt buộc nhập lý do, `POST …/reject` với `{ reason }`), **Huỷ** (`POST /api/orders/${id}/cancel`).
    - Mọi dòng có link **Xem** tới `/admin/orders/${id}`.
    - Xử lý xong thì cập nhật dòng và bộ đếm.
  - **Tab "Cấu hình thanh toán":**
    - `GET/PUT /api/admin/settings/payment`.
    - Ô chọn ngân hàng từ `VIETQR_BANKS`: chọn xong điền `bank_bin` + `bank_name`.
    - Số tài khoản, tên chủ tài khoản (gợi ý in hoa không dấu), đơn giá 1 slot (`unit_price_vnd`, VND).
    - Nút Lưu. Lỗi 400 hiện `error` của server.
    - Cạnh form có khung xem trước QR mẫu 10.000đ với nội dung "KITOKIT TEST".
- **`/admin/orders/[id]`** (`AdminLayout`): `GET /api/orders/${id}`, hiện `PaymentPanel` kèm `actions` Duyệt / Từ chối (bắt buộc lý do) khi PENDING. Có link về `/admin/orders`.
- **`/admin/teachers/[id]`:**
  - Thêm khối **"Tạo đơn mua slot"**: số slot, giá (mặc định trống = giá chuẩn), ghi chú.
  - Giá khác giá chuẩn thì ghi chú bắt buộc; server cũng kiểm và trả 400.
  - Gửi `POST /api/admin/orders` với body `{ teacher_id, requested_slots, total_cost?, note? }`.
  - Thành công thì hiện link tới `/admin/orders/${id}` và mã đơn.
- **`/admin/requests`:** server component `permanentRedirect("/admin/orders")`.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-042` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.** Không chạy git, npm hay shell khác, vì agy tự từ chối.
- Trang client chỉ gọi API, không import `@/lib/db-pg`, `@/lib/slot-orders`, `@/lib/notifications`. `lib/vietqr.ts` và `lib/vietqr-banks.ts` là thuần nên được dùng ở client.
- Không dùng ảnh QR của dịch vụ ngoài.
- Tiền là số nguyên VND. Không tính lại tiền ở client để gửi lên.
- Theo DEC-022/DEC-035:
  - không viết mã hex trong class;
  - icon trên nền xanh dùng `text-white`;
  - nhãn nút không có "+" ở đầu.
- Mỗi trang đủ 4 trạng thái: đang tải, rỗng, lỗi có nút Thử lại, có dữ liệu.
