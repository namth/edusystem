# TASK-052 — Lõi ví slot học sinh-tháng: migration 018, lib/slot-wallet, cron, ghi danh trừ ví

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** HIGH
**Nhạy cảm:** có (tiền, migration, đồng thời)

## 1. Mục tiêu
Chuyển slot sang **1 học sinh × 1 tháng của một lớp** (FEAT-015). Có ví `users.slot_balance`, lịch sử `slot_ledger`; trừ khi học sinh vào lớp và mỗi kỳ tháng; thiếu thì ân hạn 7 ngày rồi khoá; mua slot cộng ví. Task này làm **lõi + mọi đường ghi danh + cron**. API ví, khoá nộp bài và UI là TASK-053/054.

## 2. Tài liệu bắt buộc đọc
- `docs/features/vi-slot-hoc-sinh-thang.md` — toàn bộ, nhất là §5 (schema), §7 (BR-W01 → W13), §8 (TC-W)
- `docs/14-decisions.md` DEC-042 → DEC-047; `CONTEXT.md` §3
- Code hiện tại: `lib/student-slots.ts`, `lib/enrollment.ts`, `lib/slot-orders.ts` (`approveOrder` — mẫu transaction `getPgPool().connect()`), `lib/teacher-trial.ts`, `lib/notifications.ts`, `worker/grading-worker.js`

## 3. Phạm vi file
**Được tạo/sửa:**
- `docs/db-migration-018-slot-wallet.sql`, `docs/db-migration-018b-slot-wallet-data.sql` (mới)
- `lib/db-pg.ts` (thêm DDL 018 vào `ensureSchema`, **không** thêm 018b)
- `lib/slot-wallet.ts` (mới), `lib/student-slots.ts`, `lib/enrollment.ts`, `lib/slot-orders.ts` (chỉ `approveOrder`), `lib/notifications.ts` (chỉ thêm type)
- `app/api/cron/slot-billing/route.ts` (mới)
- `app/api/teacher/classes/route.ts` (khởi tạo cột tính phí khi tạo lớp), `app/api/teacher/classes/[classId]/students/route.ts`, `app/api/admin/users/[id]/route.ts`, `app/api/admin/create-user/route.ts`, `app/api/admin/teachers/[id]/verify/route.ts`
- `worker/grading-worker.js` (gọi cron hằng giờ)
- `tests/helpers/pg-fake.ts` chỉ khi cần nạp migration 018 (không đổi hành vi cũ)
- `tests/slot-wallet.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:** mọi file trong `tests.lock`; `app/admin/**`, `app/teacher/**` (UI); `app/api/admin/teachers/[id]/route.ts` (TASK-050); `docs/` ngoài 2 file migration.

## 4. Đặc tả & blueprint
**Migration 018** đúng như §5 của đặc tả. Sau `ALTER`: `UPDATE classes SET start_date = created_at::date WHERE start_date IS NULL`.

**Migration 018b** (chạy tay, phải chạy lặp được mà không cộng trùng — kiểm `NOT EXISTS (SELECT 1 FROM slot_ledger WHERE teacher_id = u.id AND reason = 'MIGRATION')`): theo §5 bước 1–2. Bước 3 (thông báo `SLOT_POLICY_CHANGED`) **không** thuộc task này.

**`lib/slot-wallet.ts`** — mọi hàm nhận `client` (PoolClient) tuỳ chọn để chạy trong giao dịch của người gọi; không có thì tự mở giao dịch.
```ts
export type LedgerReason = "PURCHASE" | "ADMIN_ADJUST" | "ENROLL" | "CYCLE" | "MIGRATION";
export async function getBalance(teacherId: string): Promise<number>;
// Khoá users FOR UPDATE, kiểm không âm, UPDATE slot_balance, INSERT slot_ledger (balance_after). Trả balance mới.
async function applyDelta(client, e: { teacherId; delta; reason; classId?; studentId?; orderId?; period?; studentCount?; studentIds?: string[]; note?; createdBy? }): Promise<{ ok: true; balance: number } | { ok: false; code: "INSUFFICIENT" | "DUPLICATE" }>;
// Bắt lỗi unique (23505) của các chỉ mục ở §5 → DUPLICATE (không ném).
export async function chargeEnrollment(client, a: { classId; studentId }): Promise<
  | { ok: true; charged: boolean }               // charged=false: trial / ADMIN / đã trả kỳ này
  | { ok: false; status: 409; error: string; code: "NO_SLOT" | "CLASS_LOCKED" | "CLASS_ENDED" }>;
export async function runBillingCycle(now = new Date()): Promise<{ charged: number; grace: number; locked: number; skipped: number }>;
export async function retryOverdueClasses(teacherId: string): Promise<number>; // BR-W07, trả số lớp mở lại
export async function adjustBalance(a: { teacherId; delta; note; createdBy }): Promise<...>; // ADMIN_ADJUST, delta dương thì gọi retryOverdueClasses sau COMMIT
export function addMonths(d: string /* YYYY-MM-DD */, n: number): string; // 31/01 + 1 → 28/02 (29/02 năm nhuận)
export function todayVN(now: Date): string; // ngày theo Asia/Ho_Chi_Minh, YYYY-MM-DD
```
`chargeEnrollment` (BR-W02, W06, W09, W10): đọc lớp `FOR UPDATE` → ENDED → 409 CLASS_ENDED; LOCKED → 409 CLASS_LOCKED; chủ lớp ADMIN hoặc giáo viên TRIAL/REJECTED → `charged:false`; học sinh **đã trả kỳ hiện tại** → `charged:false`. "Đã trả kỳ p" = có dòng `ENROLL` `(class_id, student_id, period = p)` **hoặc** dòng `CYCLE` `(class_id, period = p)` có `student_id` trong `student_ids`. Kỳ hiện tại `p = billing_period`. Còn lại `applyDelta(-1, ENROLL)`; INSUFFICIENT → 409 NO_SLOT "Thầy cô không đủ slot để thêm học sinh. Vui lòng mua thêm slot."

**Mọi đường ghi danh** (5 chỗ `INSERT INTO enrollments` trong §3) phải: mở giao dịch → `chargeEnrollment(client, …)` → INSERT enrollment → COMMIT. Lỗi ở bất kỳ bước nào → ROLLBACK (không trừ mà không ghi danh, không ghi danh mà không trừ). Thay `assertStudentSlotAvailable` bằng luồng này; `getStudentSlotUsage` giữ cho chỗ đang hiển thị nhưng trả `{ used: sĩ số hiện tại, limit: slot_balance }`. Thứ tự kiểm giữ BR-S04: quyền → dùng thử → ví → `max_slots`.

**Tạo lớp**: `start_date = todayVN`, `billing_period = 0`, `next_charge_at = addMonths(start_date, 1)`; giáo viên TRIAL/REJECTED → `next_charge_at = NULL`.

**Xác minh giáo viên** (BR-W09): bỏ `slot_limit = GREATEST(…, 250)`; các lớp của giáo viên: `start_date = todayVN`, `billing_period = 0`, `next_charge_at = start_date`.

**`runBillingCycle(now)`** (BR-W04, W05, W12): chọn lớp `billing_status IN ('ACTIVE','GRACE','LOCKED') AND next_charge_at IS NOT NULL AND next_charge_at <= todayVN(now)`, chủ là TEACHER đã xác minh. Mỗi lớp một giao dịch riêng, `try/catch` từng lớp. Trong giao dịch: đếm sĩ số; 0 → chỉ sang kỳ; đủ → `applyDelta(-n, CYCLE, period, studentCount = n, studentIds = danh sách học sinh đang trong lớp)`.
**Quy ước kỳ (chốt):** dòng CYCLE ghi `period = số kỳ được trả`. Lớp mới: kỳ 0 trả qua ENROLL, lần trừ đầu là `period 1`. Lớp từ dữ liệu cũ / vừa xác minh (`next_charge_at = start_date`): lần trừ đầu là `period 0`. Công thức chung: `period = monthsBetween(start_date, next_charge_at)`. Sau trừ: `billing_period = period`, `next_charge_at = addMonths(start_date, period + 1)`, `ACTIVE`, `grace_until = NULL`, báo `SLOT_CHARGED`.
Thiếu → nếu `ACTIVE`: `GRACE`, `grace_until = now + 7 ngày`, báo `SLOT_GRACE`; nếu `GRACE` và `now > grace_until`: `LOCKED`, báo `CLASS_LOCKED`; còn lại `skipped`. Thông báo gửi **sau COMMIT**, `refId` = `<classId>:<period>` để không trùng.

**`approveOrder`**: trong cùng giao dịch, thay `UPDATE users SET slot_limit…` bằng `applyDelta(client, +requested_slots, PURCHASE, orderId)`; sau COMMIT gọi `retryOverdueClasses`.

**Cron route** `POST /api/cron/slot-billing`: `Authorization: Bearer ${CRON_SECRET}`, so sánh hằng thời gian (`crypto.timingSafeEqual`); thiếu biến hoặc sai → 401. Trả JSON kết quả `runBillingCycle()`.
**Worker**: `setInterval` 1 giờ (và 1 lần lúc khởi động) gọi route trên với `CRON_SECRET`; lỗi chỉ log.

**Type thông báo mới** trong `NotificationType`: `SLOT_CHARGED`, `SLOT_GRACE`, `CLASS_LOCKED`, `SLOT_POLICY_CHANGED`; link `/teacher/slots`. Thêm `SLOT_GRACE`, `CLASS_LOCKED`, `SLOT_POLICY_CHANGED` vào danh sách type gửi email (TASK-048 đã có cơ chế).

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0 (vitest toàn bộ + `tsc --noEmit`); `tests/docs-sync.test.ts` xanh hoặc chỉ đỏ vì route cron chưa có trong docs/07 (ghi report)
- [ ] TC-W01, W02, W03, W04 (đồng thời: 2 lời gọi `Promise.all` khi số dư 1 → đúng 1 ok), W05, W06, W07, W09, W11, W12 (phần `adjustBalance`), W14, W15, W17 ở `docs/features/vi-slot-hoc-sinh-thang.md` §8 đều có test và xanh
- [ ] Ghi danh lỗi giữa chừng (vd lớp đủ `max_slots`) → số dư không đổi, không có dòng ledger
- [ ] Mọi dòng `slot_ledger` có `balance_after` khớp `users.slot_balance` sau thao tác
- [ ] Test cũ về slot (`tests/student-slots.test.ts`, `tests/slot-orders-api.test.ts`, `tests/teacher-trial.test.ts`, `tests/profile-slots-grading.test.ts`) nếu khẳng định hành vi DEC-031 cũ thì ghi rõ trong report từng ca đỏ vì đổi nghiệp vụ — **không tự sửa test bị khoá**; Claude sẽ cập nhật

## 6. Ràng buộc & bẫy cần tránh
- Không bao giờ đọc-rồi-ghi số dư ngoài `FOR UPDATE`; không để số dư âm.
- Không trừ trong cron cho lớp TRIAL/ADMIN/ENDED; không trừ hai lần một kỳ (dựa vào chỉ mục duy nhất, không chỉ dựa vào `next_charge_at`).
- Ngày theo `Asia/Ho_Chi_Minh`, không theo múi giờ máy chủ.
- Không gửi thông báo/email bên trong giao dịch.
- Chỉ chạy lệnh `python3` (`python3 scripts/handoff.py verify TASK-052`); không git/ls/npx.
