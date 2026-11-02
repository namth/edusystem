# FEAT-013: Tối ưu phân hệ quản trị — tổng quan, đơn hàng slot & VietQR, chi phí AI

> Trạng thái: SPEC_DRAFT (2026-11-02) · Quyết định: DEC-030 → DEC-035 (`docs/14-decisions.md`)

## 1. Tổng quan & mục tiêu nghiệp vụ
Rà soát khu `/admin` ngày 02/11/2026 thấy:
- Không có trang tổng quan. Admin đăng nhập vào thẳng `/admin/requests`.
- Menu có hai mục cùng chỉnh việc chấm điểm: **Chuẩn chấm điểm** (`/admin/scoring-standards`, bảng `scoring_standards`) và **Quản lý tiêu chí chấm điểm** (`/admin/rubrics`, bảng `scoring_rubrics`). Chuẩn chấm chỉ tham chiếu tiêu chí qua `rubric_id`, nên hai trang chồng lên nhau.
- Mua slot chỉ có đơn do giáo viên gửi (`slot_requests`). Đơn không có mã chuyển khoản và không có QR. Admin duyệt mà không có gì để đối chiếu.
- **`users.slot_limit` đang bị dùng sai nghĩa.** Mỗi lần AI chấm bài, code trừ 1 slot (DEC-009/018/021). Giao diện lại gọi đó là "slot sĩ số học sinh". Trang `/teacher/slots` còn viết cứng "đã dùng 218".
- Luồng chấm AI thật (`lib/ai-engine.ts`) **không ghi token**. Bảng `ai_usage_logs` chỉ có dòng ghi từ AI Import và từ route thử Portkey. Bảng này lại do `lib/portkey.ts` tự tạo, không có trong migration. Chi phí đang ước tính cố định $0.002/1K token.

FEAT-013 gồm:
1. **Trang tổng quan `/admin`**: số giáo viên, học sinh, bài học/đề thi, bài đã nộp, bài chấm bằng AI, token đã dùng, chi phí AI (VND) trong tháng.
2. **Gộp chấm điểm vào một menu** "Chuẩn chấm điểm" có 2 tab: *Chuẩn chấm* và *Bộ tiêu chí AI* (DEC-030).
3. **Đổi tên** menu "Khách hàng tiềm năng" thành "Liên hệ từ website". Tính năng giữ nguyên (đã làm 02/11).
4. **Slot = 1 học sinh** (DEC-031). Chấm AI không trừ slot nữa. Ghi danh học sinh vượt slot thì bị chặn.
5. **Đơn hàng mua slot** (DEC-032, DEC-033). Giáo viên tự tạo đơn, hoặc admin tạo đơn cho giáo viên. Mỗi đơn có trang thanh toán kèm **mã VietQR** sinh ra theo số tiền và mã đơn. Admin đối chiếu rồi duyệt; sau này webhook ngân hàng sẽ tự duyệt. Trang **Đơn hàng** thay cho trang "Phê duyệt thanh toán".
6. **Ghi nhận token & chi phí AI** cho mọi lần gọi AI. Chi phí tính theo bảng giá từng model, quy ra VND theo tỷ giá admin cấu hình (DEC-034).
7. Giao diện: nhãn nút không có dấu "+" ở đầu; icon trên nền xanh dùng màu trắng (DEC-035, đã làm 02/11, khoá bằng `tests/design-rules.test.ts`).

Ngoài phạm vi:
- webhook ngân hàng (SePay/Casso) tự duyệt đơn. Chỉ chuẩn bị mã đơn và hàm duyệt dùng chung.
- hoá đơn VAT
- gói thuê bao theo tháng
- học sinh mua khoá học (DEC-019 giữ nguyên)
- email/Zalo báo đơn. Chỉ có thông báo trong app (bảng `notifications`).

## 2. Phân quyền
| Hành động | TEACHER dùng thử | TEACHER đã xác minh | ADMIN |
| :--- | :---: | :---: | :---: |
| Xem tổng quan `/admin` | — | — | ✓ |
| Tạo đơn mua slot cho mình | — (DEC-027) | ✓ | — |
| Tạo đơn cho một giáo viên, sửa giá kèm ghi chú | — | — | ✓ |
| Xem đơn và trang thanh toán | đơn của mình | đơn của mình | mọi đơn |
| Báo "đã chuyển khoản" | — | đơn của mình, khi `PENDING` | ✓ |
| Huỷ đơn | — | đơn của mình, khi `PENDING` | mọi đơn `PENDING` |
| Duyệt / từ chối đơn | — | — | ✓ |
| Cấu hình tài khoản nhận tiền, đơn giá slot | — | — | ✓ |
| Cấu hình bảng giá model AI, tỷ giá | — | — | ✓ |

Không có phiên trả `401`, sai vai trò trả `403`. Giáo viên mở đơn của người khác nhận `404` (không lộ là đơn có tồn tại).

## 3. Luồng

### 3.1 Giáo viên tự mua slot
1. Vào `/teacher/slots`. Trang hiện slot **đang dùng / tổng** bằng số thật (số học sinh khác nhau trong các lớp của mình so với `slot_limit`) và danh sách đơn của mình.
2. Nhập số slot, bấm **Tạo đơn**. Server tính tiền: số slot × đơn giá trong `system_settings.slot_pricing`.
3. Chuyển sang `/teacher/orders/[id]`. Trang có mã QR, ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung chuyển khoản (= mã đơn), mỗi dòng có nút sao chép.
4. Giáo viên chuyển khoản rồi bấm **Tôi đã chuyển khoản**. Server ghi `payment_reported_at` và gửi thông báo cho admin.
5. Admin duyệt thì `slot_limit` tăng và giáo viên nhận thông báo. Admin từ chối (bắt buộc ghi lý do) thì giáo viên nhận thông báo kèm lý do.

### 3.2 Admin tạo đơn cho giáo viên
1. Ở `/admin/teachers/[id]` có nút **Tạo đơn mua slot**. Form gồm số slot, giá (mặc định số slot × đơn giá, được sửa, 0 đồng = tặng) và ghi chú. Nếu giá khác giá chuẩn thì ghi chú là bắt buộc.
2. Đơn tạo với `source = 'ADMIN'`. Giáo viên nhận thông báo kèm link trang thanh toán.
3. Admin có thể **duyệt ngay** (đã nhận tiền mặt / chuyển khoản ngoài) hoặc gửi link cho giáo viên tự thanh toán. Đơn giá 0 đồng duyệt được ngay.

### 3.3 Admin xử lý đơn — `/admin/orders`
- Danh sách lọc theo trạng thái. Mặc định hiện đơn **Chờ xử lý**, đơn giáo viên đã báo chuyển khoản lên đầu. Lọc thêm theo nguồn (giáo viên / admin), tìm theo mã đơn hoặc tên/email giáo viên.
- Mỗi dòng có: mã đơn, giáo viên, số slot, số tiền, nguồn, trạng thái, thời điểm báo chuyển khoản, nút Duyệt / Từ chối / Huỷ / Xem trang thanh toán.
- Tab **Cấu hình thanh toán**: mã ngân hàng (BIN, chọn từ danh sách ngân hàng VietQR), số tài khoản, tên chủ tài khoản (in hoa không dấu), đơn giá 1 slot (VND).
- `/admin/requests` chuyển hướng 308 sang `/admin/orders`.

### 3.4 Ghi danh khi hết slot
Học sinh vào lớp bằng mã/link, giáo viên thêm học sinh, hoặc admin gán học sinh vào lớp → server kiểm tra:
- học sinh **đã có** trong một lớp khác của cùng giáo viên → không tốn thêm slot, luôn cho vào;
- học sinh mới và số học sinh khác nhau của giáo viên ≥ `slot_limit` → `409 { error: "Thầy cô đã dùng hết slot học sinh. Vui lòng mua thêm slot." }`.

Học sinh gặp lỗi này thấy thông báo "Lớp đã đủ chỗ, hãy báo thầy cô". Giáo dùng thử vẫn theo giới hạn 3 học sinh (DEC-027), kiểm tra trước.

### 3.5 Tổng quan `/admin`
- Thẻ số liệu **tổng** (toàn thời gian): giáo viên (đã xác minh / dùng thử), học sinh, bài học, đề thi.
- Thẻ số liệu **trong tháng đang chọn** (mặc định tháng hiện tại, chọn được 12 tháng gần nhất, giờ Việt Nam): bài đã nộp (đề thi + bài học), bài chấm bằng AI, token đã dùng, chi phí AI (VND), doanh thu từ đơn đã duyệt (VND), số đơn chờ xử lý (bấm vào sang `/admin/orders`).
- Biểu đồ cột theo ngày trong tháng: chi phí AI (VND) và số bài nộp (`recharts`).
- Bảng 10 giáo viên tốn chi phí AI nhiều nhất trong tháng: tên, số bài AI chấm, token, chi phí.
- `/` và các luồng đăng nhập của ADMIN chuyển về `/admin` thay vì `/admin/requests`.

## 4. Giao diện
Menu admin, theo thứ tự:

| Mục | Đường dẫn | Icon |
| :--- | :--- | :--- |
| Tổng quan | `/admin` | `LayoutDashboard` |
| Đơn hàng (kèm số đơn chờ xử lý) | `/admin/orders` | `Receipt` |
| Quản lý giáo viên | `/admin/teachers` | `UserCheck` |
| Quản lý học sinh | `/admin/students` | `GraduationCap` |
| Quản lý tài khoản | `/admin/accounts` | `Users` |
| Chuẩn chấm điểm | `/admin/scoring-standards` | `Scale` |
| Liên hệ từ website | `/admin/leads` | `Inbox` |
| Cấu hình AI & hệ thống | `/admin/settings` | `Settings` |

Mục "Tổng quan" chỉ sáng khi đường dẫn đúng bằng `/admin`.

Menu giáo viên: đổi "Mua Slot Tài Khoản" thành **"Slot học sinh & đơn hàng"** (`/teacher/slots`).

`/admin/scoring-standards` có 2 tab đồng bộ với `?tab=standards|rubrics`. Tab *Bộ tiêu chí AI* là nội dung trang `/admin/rubrics` hiện tại, chuyển thành component `components/admin/RubricManager.tsx`. Trong form chuẩn chấm, cạnh ô chọn tiêu chí có link "Sửa tiêu chí này", mở tab rubrics ở đúng tiêu chí đó. `/admin/rubrics` chuyển hướng 308 sang `/admin/scoring-standards?tab=rubrics`.

Trang thanh toán (component dùng chung `components/orders/PaymentPanel.tsx`, dùng cho cả `/teacher/orders/[id]` và `/admin/orders/[id]`):
- QR ở giữa, khoảng 240px. Dưới QR là logo/tên ngân hàng.
- Các dòng thông tin có nút sao chép.
- Huy hiệu trạng thái: Chờ thanh toán (amber), Đã báo chuyển khoản (brand), Đã duyệt (emerald), Từ chối / Đã huỷ (rose).
- Đơn đã duyệt, từ chối hoặc huỷ thì ẩn QR, chỉ còn biên nhận.
- Admin chưa cấu hình tài khoản nhận tiền: hiện "KitoKit chưa cấu hình tài khoản nhận tiền, vui lòng liên hệ quản trị viên" và không vẽ QR.

Trang nào cũng có đủ 4 trạng thái: đang tải (skeleton), rỗng, lỗi (có nút Thử lại), có dữ liệu. Quy tắc giao diện theo DEC-022 và DEC-035.

## 5. Dữ liệu — migration 014 (`ai_usage_logs`), 015 (khôi phục slot, chạy một lần), 016 (đơn hàng + cấu hình)
```sql
-- Đơn hàng: mở rộng slot_requests (giữ tên bảng, dữ liệu cũ tương thích)
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS code VARCHAR(20);                -- mã đơn = nội dung CK, vd KK7Q4M2XA9
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,0);
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS source VARCHAR(10) NOT NULL DEFAULT 'TEACHER';  -- TEACHER | ADMIN
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS created_by VARCHAR(50);
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS payment_reported_at TIMESTAMPTZ;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS decided_by VARCHAR(50);           -- admin id | 'WEBHOOK'
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS reject_reason TEXT;
ALTER TABLE slot_requests ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(100);         -- mã giao dịch ngân hàng (webhook sau này)
UPDATE slot_requests SET code = 'KK' || UPPER(SUBSTRING(MD5(id) FROM 1 FOR 8)) WHERE code IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_slot_requests_code ON slot_requests (code);
-- status: PENDING | APPROVED | REJECTED | CANCELLED

-- Nhật ký gọi AI (chính thức hoá bảng do lib/portkey.ts tự tạo)
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50), student_id VARCHAR(50), submission_id VARCHAR(50),
  model VARCHAR(100), prompt_tokens INT DEFAULT 0, completion_tokens INT DEFAULT 0, total_tokens INT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS purpose VARCHAR(30);        -- EXAM_GRADING | LESSON_GRADING | EXAM_IMPORT | OTHER
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS lesson_attempt_id VARCHAR(50);
ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS provider VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_teacher ON ai_usage_logs (teacher_id, created_at);

-- Slot = học sinh (DEC-031): trả lại số slot đã bị trừ khi chấm AI
UPDATE users u SET slot_limit = GREATEST(COALESCE(u.slot_limit,0),
  250 + COALESCE((SELECT SUM(requested_slots) FROM slot_requests r WHERE r.teacher_id = u.id AND r.status = 'APPROVED'),0))
WHERE u.role = 'TEACHER' AND u.teacher_status = 'VERIFIED';

-- Cấu hình (system_settings)
INSERT INTO system_settings (key, value, description) VALUES
 ('payment_account', '{"bank_bin":"","bank_name":"","account_no":"","account_name":""}', 'Tài khoản nhận tiền VietQR'),
 ('slot_pricing', '{"unit_price_vnd":0}', 'Đơn giá 1 slot học sinh (VND)'),
 ('ai_pricing', '{"usd_vnd_rate":26000,"models":{}}', 'Giá model AI USD / 1 triệu token input-output, tỷ giá USD→VND')
ON CONFLICT (key) DO NOTHING;
```
`lib/db-pg.ts` `ensureSchema()` chạy cùng DDL. Giá trị khởi tạo của `slot_pricing.unit_price_vnd` lấy từ `SLOT_UNIT_PRICE_VND` nếu biến có trong môi trường. Sau đó admin sửa trong app, không đọc biến này nữa.

## 6. API
| Method | Route | Vai trò | Ghi chú |
| :--- | :--- | :--- | :--- |
| GET | `/api/admin/dashboard?month=YYYY-MM` | ADMIN | số liệu §3.5, `month` sai định dạng → 400 |
| GET | `/api/admin/orders?status=&source=&q=` | ADMIN | danh sách đơn |
| POST | `/api/admin/orders` | ADMIN | `{ teacher_id, requested_slots, total_cost?, note? }` → 201 |
| GET | `/api/orders/[id]` | TEACHER (của mình) / ADMIN | chi tiết đơn + `payment` (thông tin CK, `qr_payload`) |
| POST | `/api/orders/[id]/report-paid` | TEACHER chủ đơn / ADMIN | chỉ khi `PENDING`, lặp lại thì giữ nguyên (idempotent) |
| POST | `/api/orders/[id]/cancel` | TEACHER chủ đơn / ADMIN | chỉ khi `PENDING` |
| POST | `/api/admin/orders/[id]/approve` | ADMIN | giao dịch: `PENDING` → `APPROVED`, cộng `slot_limit`; đơn đã xử lý → 409 |
| POST | `/api/admin/orders/[id]/reject` | ADMIN | `{ reason }` bắt buộc |
| GET/PUT | `/api/admin/settings/payment` | ADMIN | `payment_account` + `slot_pricing` |
| GET/PUT | `/api/admin/settings/ai-pricing` | ADMIN | `ai_pricing` |
| GET | `/api/teacher/slot-requests` | TEACHER | giữ nguyên, thêm trường mới + `usage: { used, limit }` |
| POST | `/api/teacher/slot-requests` | TEACHER đã xác minh | giữ nguyên, sinh `code`, đơn giá đọc từ `slot_pricing` |
| GET | `/api/admin/requests`, PUT `/api/admin/requests/[id]` | ADMIN | giữ để tương thích, gọi chung `lib/slot-orders.ts` |

Thư viện:
- `lib/slot-orders.ts`: `createOrder`, `approveOrder(id, decidedBy, paymentRef?)` (webhook sau này gọi đúng hàm này), `rejectOrder`, `cancelOrder`, `reportPaid`, `generateOrderCode`.
- `lib/vietqr.ts` (thuần, không gọi mạng): `buildVietQrPayload({ bankBin, accountNo, amount, addInfo })` dựng chuỗi EMVCo/NAPAS 247 có CRC16-CCITT. QR vẽ ở trình duyệt bằng gói `qrcode` (thêm dependency). Không dùng ảnh từ dịch vụ ngoài.
- `lib/student-slots.ts`: `getStudentSlotUsage(teacherId)` và `assertStudentSlotAvailable(teacherId, studentId)`.
- `lib/ai-usage.ts`: `recordAiUsage({ purpose, provider, model, promptTokens, completionTokens, teacherId?, studentId?, submissionId?, lessonAttemptId? })`. Ghi lỗi thì chỉ log, không làm hỏng việc chấm.
- `lib/ai-pricing.ts` (thuần): `costUsd(model, promptTokens, completionTokens, pricing)`. Model không có trong bảng giá → 0, và dashboard cảnh báo "N lần gọi chưa có giá".

## 7. Quy tắc nghiệp vụ
1. Tiền là số nguyên VND. Số tiền đơn do server tính. Giáo viên gửi `total_cost` lên thì server bỏ qua.
2. `requested_slots` là số nguyên 1–10.000. Giá admin nhập là số nguyên 0–1.000.000.000. Giá khác giá chuẩn thì phải có `note`.
3. Mã đơn `KK` + 8 ký tự `[A-Z0-9]`, không có `0/O/1/I`, duy nhất. Nội dung chuyển khoản chỉ gồm mã đơn.
4. Duyệt đơn: `UPDATE … WHERE status='PENDING'` trong cùng giao dịch với cộng `slot_limit`. Duyệt hai lần không cộng hai lần.
5. Đơn đã `APPROVED` không huỷ được. Muốn thu hồi slot thì admin sửa `slot_limit` ở trang giáo viên (đã có).
6. Đếm slot đang dùng = `COUNT(DISTINCT enrollments.student_id)` trên các lớp có `classes.teacher_id = giáo viên`.
7. Giảm `slot_limit` xuống dưới số đang dùng thì không xoá học sinh nào, chỉ chặn ghi danh mới.
8. Chấm AI (đề thi, bài học) **không đọc và không trừ** `slot_limit`. `NEEDS_REVIEW` chỉ còn do AI lỗi sau 3 lần hoặc giáo viên yêu cầu chấm tay. Bỏ logic hoàn slot.
9. Mỗi lần gọi model AI (chấm Writing/Speaking/tự luận, AI Import, thử kết nối) ghi đúng 1 dòng `ai_usage_logs` với token thật từ `response.usage`. Không có `usage` thì ghi 0 token, **không bịa số** như code hiện tại (850/320). Gọi lỗi thì không ghi.
10. "Bài chấm bằng AI" = số `submission_id` / `lesson_attempt_id` khác nhau có log `purpose` là `EXAM_GRADING` hoặc `LESSON_GRADING` trong kỳ.
11. "Bài đã nộp" = `submissions.submitted_at` trong kỳ + `lesson_attempts` nộp trong kỳ.
12. Kỳ "tháng" tính theo múi giờ `Asia/Ho_Chi_Minh`.
13. Thông báo (bảng `notifications`): giáo viên nhận khi admin tạo đơn cho mình, khi đơn được duyệt, khi đơn bị từ chối; admin nhận khi giáo viên báo đã chuyển khoản.

## 8. Test case (Claude viết, khoá trong `tests.lock`)
- RBAC: mọi route mới trả 401/403. Giáo viên xem đơn của người khác nhận 404.
- `buildVietQrPayload`: đúng tag 00/01/38/53/54/58/62/63, CRC khớp một payload mẫu đã kiểm bằng app ngân hàng, `amount` là số nguyên.
- Duyệt đơn chạy song song 2 lần: chỉ cộng slot 1 lần, lần thứ hai nhận 409.
- Giáo viên gửi `total_cost` thì bị bỏ qua. Admin đổi giá mà không có `note` → 400.
- Ghi danh khi đã đủ slot → 409. Học sinh đã có trong lớp khác của cùng giáo viên → vẫn vào được.
- Nộp đề có Writing khi `slot_limit = 0` → vẫn `GRADING`, `slot_limit` không đổi.
- `recordAiUsage` được gọi trong `lib/ai-engine.ts`. Chuỗi `850`/`320` không còn trong `lib/portkey.ts`.
- Dashboard: số liệu khớp dữ liệu seed, ranh giới tháng tính theo giờ Việt Nam.
- Điều hướng: `/admin/rubrics` → `/admin/scoring-standards?tab=rubrics`, `/admin/requests` → `/admin/orders`. Đăng nhập ADMIN về `/admin`.
- Thứ tự menu đúng §4.

## 9. Task
| Task | Nội dung | Phụ thuộc |
| :--- | :--- | :--- |
| TASK-038 | Ghi nhận token AI: `db-migration-014-ai-usage.sql`, `lib/ai-usage.ts` (ngữ cảnh `withAiUsageContext` + `recordAiUsage`), `lib/ai-pricing.ts`, gắn vào `ai-engine` / `document-parser` / `portkey`, route chấm và AI parse; API + mục cấu hình bảng giá model, tỷ giá | — |
| TASK-039 | Slot = học sinh: bỏ trừ/hoàn slot khi chấm AI, `lib/student-slots.ts`, chặn ghi danh vượt slot ở mọi đường ghi danh, `usage` trong `GET /api/teacher/slot-requests`; `db-migration-015-student-slots.sql` (chạy tay một lần, không đưa vào `ensureSchema`) | — |
| TASK-040 | Gộp tiêu chí vào Chuẩn chấm: `RubricManager`, 2 tab, chuyển hướng `/admin/rubrics`, bỏ mục menu rubrics | — |
| TASK-041 | Đơn hàng & VietQR: `db-migration-016-slot-orders.sql` (cột `slot_requests` + settings), `lib/slot-orders.ts`, `lib/vietqr.ts`, API đơn, `PaymentPanel`, `/admin/orders` (kèm tab cấu hình thanh toán), `/teacher/slots`, `/teacher/orders/[id]`, nút tạo đơn ở `/admin/teachers/[id]`, thông báo | TASK-039 |
| TASK-042 | Tổng quan & menu: `/admin`, `/api/admin/dashboard`, sắp lại menu `AdminLayout` + đếm đơn chờ, chuyển hướng đăng nhập ADMIN | TASK-038, TASK-041 |

TASK-038, TASK-039 và TASK-040 chạy song song được, vì không chạm cùng file.
