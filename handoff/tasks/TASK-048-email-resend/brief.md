# TASK-048 — Gửi email qua Resend: quên mật khẩu, đơn hàng, thông báo admin

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** có (chạm khôi phục mật khẩu)

## 1. Mục tiêu
Hệ thống chưa gửi được email nào. Thêm một lớp gửi email dùng **Resend** (người dùng đã chốt) để: gửi link đặt lại mật khẩu, báo giáo viên khi đơn slot được duyệt/từ chối, báo admin khi có giáo viên đăng ký hoặc báo đã chuyển khoản. Thiếu cấu hình thì hệ thống chạy như cũ, không lỗi.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` §3 (bất biến), `docs/12-business-rules.md` BR-A06 và mục N (thông báo)
- `docs/10-env-and-security.md` §1, §2
- `lib/notifications.ts`, `app/api/auth/forgot-password/route.ts` (vừa vá, đọc kỹ chú thích)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/mailer.ts` (mới)
- `lib/email-templates.ts` (mới)
- `lib/notifications.ts`
- `app/api/auth/forgot-password/route.ts`
- `tests/mailer.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:**
- Mọi file trong `tests.lock`, đặc biệt `tests/forgot-password-security.test.ts`
- `lib/slot-orders.ts`, `app/api/auth/register/teacher/route.ts` (email đi qua `createNotification`, không sửa nơi gọi)
- `docs/` (Claude cập nhật)

## 4. Đặc tả chi tiết
**`lib/mailer.ts`**
- `export function isMailerConfigured(): boolean` — true khi có `RESEND_API_KEY` và `MAIL_FROM`.
- `export async function sendEmail(m: { to: string; subject: string; html: string; text: string }): Promise<{ ok: boolean; skipped?: boolean; error?: string }>`
  - Chưa cấu hình → `{ ok: false, skipped: true }`, không gọi mạng.
  - Gọi `fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer <key>", "Content-Type": "application/json" }, body: { from: MAIL_FROM, to: [to], subject, html, text } })`. **Không thêm gói npm** (dùng fetch).
  - Timeout 10 s (AbortController). Lỗi mạng / HTTP ≠ 2xx → `{ ok: false, error }`, **không ném lỗi**, `console.warn` chỉ ghi mã HTTP, không ghi nội dung email.
  - Bỏ qua địa chỉ email tạm (đuôi `@kito.io.vn`) → `{ ok: false, skipped: true }`.
- Link tuyệt đối dựng từ `APP_BASE_URL` (vd `https://kitokit.edu.vn`, bỏ `/` cuối); thiếu thì dùng `BRAND.company.website`.

**`lib/email-templates.ts`** — hàm thuần trả `{ subject, html, text }`, tiếng Việt có dấu, chân thư có tên công ty + hotline từ `lib/brand.ts`. Mọi giá trị người dùng nhập (tên, lý do từ chối…) phải **escape HTML**.
- `resetPasswordEmail({ name, url })` — nói rõ hạn 15 phút, "nếu không phải bạn yêu cầu thì bỏ qua".
- `notificationEmail({ title, body, url })` — mẫu chung cho thông báo.

**`lib/notifications.ts`** — sau khi INSERT thành công trong `createNotification`, với các type sau thì gửi thêm email tới `users.email` của người nhận (tra theo `userId`): `TEACHER_SIGNUP`, `ORDER_PAID_REPORTED`, `ORDER_APPROVED`, `ORDER_REJECTED`, `TEACHER_VERIFIED`. Link = `APP_BASE_URL + n.link`. Gửi email **không được** làm `createNotification` ném lỗi hay chậm luồng chính quá 10 s; lỗi chỉ cảnh báo. Không gửi lại khi INSERT trúng `ON CONFLICT` không tạo dòng mới (kiểm `rowCount`).

**`forgot-password`** — khi có email thật và đã lưu token: gửi `resetPasswordEmail` với `url = APP_BASE_URL/reset-password?token=…&email=…`. Phản hồi vẫn **giữ nguyên** `GENERIC_MESSAGE` và hình dạng response hiện tại (BR-A06) dù gửi được hay không. Không log token/url.

**Biến môi trường mới:** `RESEND_API_KEY`, `MAIL_FROM` (vd `KitoKit <no-reply@kitokit.edu.vn>`), `APP_BASE_URL`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0; `tests/forgot-password-security.test.ts` và `tests/docs-sync.test.ts` vẫn xanh (Claude sẽ thêm 3 biến vào docs/10 — nếu docs-sync đỏ chỉ vì 3 biến này thì ghi vào report, không sửa docs)
- [ ] Không có `RESEND_API_KEY` → `sendEmail` không gọi `fetch`, trả `skipped: true`
- [ ] Có cấu hình → `fetch` được gọi đúng URL, header `Authorization: Bearer <key>`, body có `from/to/subject/html/text`
- [ ] Resend trả 500 hoặc fetch ném lỗi → `sendEmail` trả `ok:false`, không ném
- [ ] Email đuôi `@kito.io.vn` không được gửi
- [ ] `forgot-password` với email thật + có cấu hình → gửi đúng 1 email tới đúng địa chỉ, html chứa `/reset-password?token=<token trong DB>`; response không chứa token
- [ ] `forgot-password` với email không tồn tại → không gửi email; response giống hệt ca có email
- [ ] `createNotification` type `ORDER_APPROVED` → gửi email tới email người nhận; type `EXAM_GRADED` → không gửi
- [ ] Tên chứa `<script>` được escape trong html
- [ ] Gọi `createNotification` khi Resend lỗi vẫn resolve bình thường

## 6. Ràng buộc & bẫy cần tránh
- Không trả/log token, link đặt lại, API key, nội dung email.
- Không thêm dependency npm. Không đổi chữ ký `createNotification`.
- Không gửi email trong vòng lặp chặn request quá 10 s; không retry vô hạn.
- Test phải mock `fetch` (`vi.stubGlobal`), không gọi Resend thật.
