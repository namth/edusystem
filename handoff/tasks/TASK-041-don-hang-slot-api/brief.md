# TASK-041 — Đơn hàng mua slot & VietQR: migration, thư viện, API

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/quan-tri-he-thong.md` (FEAT-013) §2, §3.1–3.3, §5 (phần `slot_requests` + `payment_account` + `slot_pricing`), §6, §7 · Quyết định **DEC-032**, **DEC-033**.
> Chạy **song song** với TASK-038/039/040 trên máy thợ. TASK-039 sửa **GET** của `app/api/teacher/slot-requests/route.ts` (thêm `usage`); task này chỉ sửa **POST** — không đụng GET. Giao diện thuộc TASK-042, task này **chỉ làm server**.

## 1. Tài liệu bắt buộc đọc
- Đặc tả nêu trên, `CONTEXT.md` §3, `lib/notifications.ts`, route cũ `app/api/admin/requests/**`.
- Test:
  - `tests/slot-orders-api.test.ts` (mới).
  - `tests/admin-api.test.ts`: đã thêm migration 016, và route cũ `/api/admin/requests` phải giữ nguyên hợp đồng.
  - Mọi test khác phải xanh.

## 2. Phạm vi file
**Được tạo/sửa:**
- `docs/db-migration-016-slot-orders.sql` (mới), `lib/db-pg.ts` (thêm DDL 016 vào `ensureSchema`)
- `lib/vietqr.ts` (mới, thuần), `lib/slot-orders.ts` (mới), `lib/notifications.ts` (chỉ thêm 4 loại thông báo)
- `app/api/admin/orders/route.ts`, `app/api/admin/orders/[id]/approve/route.ts`, `app/api/admin/orders/[id]/reject/route.ts` (mới)
- `app/api/orders/[id]/route.ts`, `app/api/orders/[id]/report-paid/route.ts`, `app/api/orders/[id]/cancel/route.ts` (mới)
- `app/api/admin/settings/payment/route.ts` (mới)
- `app/api/teacher/slot-requests/route.ts` (POST; giữ `usage` của GET), `app/api/admin/requests/route.ts`, `app/api/admin/requests/[id]/route.ts`

**Không được sửa:** `tests/**`, `e2e/**`, `docs/**` (trừ migration 016), `package*.json`, mọi trang `app/**/page.tsx`, `components/**`.

## 3. Đặc tả
### 3.1 Migration 016
Lấy phần `slot_requests` + `system_settings` (`payment_account`, `slot_pricing`) ở đặc tả §5. Yêu cầu:
- Chạy lặp được.
- `source` có `NOT NULL DEFAULT 'TEACHER'`.
- Điền mã cho đơn cũ bằng `'KK' || UPPER(SUBSTRING(MD5(id) FROM 1 FOR 8))`, đúng 10 ký tự.
- Có `UNIQUE INDEX` trên `code`.
- Chép cùng DDL vào `ensureSchema()`.

### 3.2 `lib/vietqr.ts` (thuần, không gọi mạng)
```ts
export function sanitizeTransferContent(s: string): string;   // bỏ dấu (đ→D), in hoa, chỉ giữ [A-Z0-9 ], gộp khoảng trắng, cắt 25 ký tự
export function buildVietQrPayload(o: { bankBin: string; accountNo: string; amount: number; addInfo: string }): string;
```
- Payload gồm, theo thứ tự:
  - `00`="01", `01`="12";
  - `38` = [`00`="A000000727", `01` = [`00`=BIN, `01`=STK], `02`="QRIBFTTA"];
  - `53`="704";
  - `54`=số tiền (bỏ tag này khi amount = 0);
  - `58`="VN";
  - `62` = [`08`=nội dung đã làm sạch];
  - `63` = CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 ký tự hex in hoa, tính trên toàn chuỗi kể cả "6304".
- Ném lỗi khi:
  - BIN không đúng 6 chữ số;
  - STK không phải 6–19 chữ số;
  - amount không phải số nguyên ≥ 0.

### 3.3 `lib/slot-orders.ts` (server)
```ts
export function generateOrderCode(): string;              // "KK" + 8 ký tự từ "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", crypto.randomInt
export async function getSlotPricing(): Promise<{ unit_price_vnd: number }>;  // system_settings; thiếu dòng → Number(SLOT_UNIT_PRICE_VND) || 0
export async function getPaymentAccount(): Promise<{ bank_bin; bank_name; account_no; account_name; configured: boolean }>;
export async function createOrder(i: { teacherId: string; requestedSlots: number; totalCost?: number; note?: string; source: "TEACHER" | "ADMIN"; createdBy: string }): Promise<Result<Order>>;
export async function approveOrder(id: string, decidedBy: string, paymentRef?: string): Promise<Result<Order>>;
export async function rejectOrder(id: string, decidedBy: string, reason: string): Promise<Result<Order>>;
export async function cancelOrder(id: string, by: { userId: string; role: string }): Promise<Result<Order>>;
export async function reportPaid(id: string, by: { userId: string; role: string }): Promise<Result<Order>>;
// Result<T> = { ok: true; order: T } | { ok: false; status: 400 | 403 | 404 | 409; error: string }
```
- **`approveOrder`:**
  - Chạy trong một giao dịch (`getPgPool().connect()`): `UPDATE slot_requests SET status='APPROVED', decided_by, decided_at=NOW(), payment_ref WHERE id=$1 AND status='PENDING' RETURNING *`.
  - Có dòng trả về thì `UPDATE users SET slot_limit = COALESCE(slot_limit,0) + requested_slots`, rồi COMMIT. Không có dòng thì trả 404 hoặc 409.
  - Sau COMMIT mới gửi thông báo `ORDER_APPROVED` cho giáo viên.
- **Quyền với đơn:** giáo viên chỉ thao tác đơn của mình, đơn người khác trả **404**. Mọi thao tác chỉ chạy khi đơn đang `PENDING`, không thì 409.
- **`reportPaid`:** idempotent. Đã có `payment_reported_at` thì trả ok và không báo lại. Lần đầu thì báo `ORDER_PAID_REPORTED` cho **mọi** ADMIN, với `link` = `/admin/orders?q=<code>`.
- **`rejectOrder`:** `reason` sau khi trim phải từ 1 đến 500 ký tự, rồi báo `ORDER_REJECTED`.
- **`createOrder` với `source: "ADMIN"`:**
  - giá mặc định = số slot × đơn giá chuẩn;
  - `totalCost` phải là số nguyên trong khoảng 0–1.000.000.000;
  - giá khác giá chuẩn thì `note` sau khi trim không được rỗng;
  - báo `ORDER_CREATED` cho giáo viên, với `link` = `/teacher/orders/<id>`.
- **Thông báo:** link cho giáo viên luôn là `/teacher/orders/<id>`. Thêm 4 loại `ORDER_CREATED`, `ORDER_APPROVED`, `ORDER_REJECTED`, `ORDER_PAID_REPORTED` vào `NotificationType`.
- **Đơn trả về:** số là `number` (không phải chuỗi NUMERIC), gồm `id, code, teacher_id, teacher_name, teacher_email, requested_slots, unit_price, total_cost, status, source, note, payment_reported_at, decided_at, reject_reason, created_at`.

### 3.4 API — hợp đồng ở đặc tả §6
Test là chuẩn chi tiết. Ghi chú thêm:
- **`GET /api/admin/orders`:**
  - Trả `{ success, orders, counts }`, với `counts` là số đơn theo từng trạng thái.
  - Sắp xếp: PENDING đã báo chuyển khoản (mới báo trước) → PENDING khác → các trạng thái còn lại, trong mỗi nhóm `created_at DESC`.
  - `q` tìm ILIKE theo `code`, `teacher_name`, `teacher_email`. `status`/`source` có giá trị lạ thì trả 400.
- **`GET /api/orders/[id]`:**
  - Trả `{ success, order, payment }`, với `payment = { configured, bank_bin, bank_name, account_no, account_name, amount, add_info, qr_payload }`.
  - `add_info` = `code`.
  - `qr_payload` là `null` khi chưa cấu hình tài khoản hoặc đơn không còn `PENDING`.
- **`PUT /api/admin/settings/payment`:**
  - Body `{ payment_account, slot_pricing }`.
  - `account_name` chuẩn hoá bằng `sanitizeTransferContent` nhưng không cắt, tối đa 50 ký tự.
  - `unit_price_vnd` là số nguyên trong khoảng 0–100.000.000.
- **Route cũ `/api/admin/requests`:**
  - GET giữ nguyên dạng `{ slot_requests }`, thêm trường mới.
  - PUT `APPROVE` gọi `approveOrder`. PUT `REJECT` gọi `rejectOrder` với lý do mặc định "Từ chối từ trang cũ".
  - Không còn tự `UPDATE users SET slot_limit`.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-041` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Tiền là số nguyên VND, không dùng số thực. Số tiền đơn do server tính.
- `requireRole` trước mọi truy vấn. Danh tính lấy từ token, không lấy từ body.
- Không gọi dịch vụ ảnh QR bên ngoài. Không thêm dependency, vì gói `qrcode` để TASK-042 thêm.
