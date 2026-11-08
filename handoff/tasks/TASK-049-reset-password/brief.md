# TASK-049 — Cấp lại mật khẩu tạm: admin cho mọi tài khoản, giáo viên cho học sinh lớp mình

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** có (phân quyền, mật khẩu)

## 1. Mục tiêu
Người dùng quên mật khẩu (nhất là học sinh nhỏ không có email) hiện không có đường khôi phục. Thêm nút **"Cấp lại mật khẩu"**: sinh mật khẩu tạm, hiện **một lần** cho người bấm để đưa lại cho chủ tài khoản, bắt đổi mật khẩu ở lần đăng nhập kế tiếp (BR-A03).

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` §3 (bất biến), `docs/12-business-rules.md` BR-A03, BR-A06
- `docs/07-api-contracts.md` (bảng admin users, teacher classes)
- Cách sinh mật khẩu tạm hiện có: `app/api/teacher/classes/[classId]/students/route.ts` dòng ~188

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/password-reset.ts` (mới)
- `app/api/admin/users/[id]/reset-password/route.ts` (mới)
- `app/api/teacher/students/[studentId]/reset-password/route.ts` (mới)
- `components/ResetPasswordButton.tsx` (mới — nút + hộp xác nhận + hộp hiện mật khẩu tạm có nút sao chép)
- `app/admin/accounts/page.tsx`, `app/admin/students/[id]/page.tsx`, `app/teacher/classes/[classId]/page.tsx` (chỉ gắn nút)
- `tests/reset-password.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:**
- Mọi file trong `tests.lock`; `app/admin/teachers/[id]/page.tsx` (TASK-050 đang sửa); `lib/notifications.ts`, `app/api/auth/forgot-password/route.ts` (TASK-048 đang sửa); `docs/`

## 4. Đặc tả chi tiết
**`lib/password-reset.ts`**
- `generateTempPassword(): string` — 10 ký tự từ bảng `ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789` (dùng `crypto.randomInt`), bảo đảm có ít nhất 1 hoa, 1 thường, 1 số.
- `issueTempPassword(userId): Promise<string>` — `UPDATE users SET password = hashPassword(temp), must_change_password = TRUE, reset_token = NULL, reset_token_expires = NULL WHERE id = $1`, trả `temp`.

**`POST /api/admin/users/[id]/reset-password`** — chỉ `ADMIN` (`requireRole`). Không tồn tại → 404. Không cho tự cấp lại cho chính mình (id = người gọi) → 400 "Dùng chức năng đổi mật khẩu cho tài khoản của bạn". Thành công → 200 `{ success: true, temp_password }`.

**`POST /api/teacher/students/[studentId]/reset-password`** — chỉ `TEACHER` (ADMIN dùng route admin). Chỉ được khi `studentId` là `STUDENT` **và** có `enrollments` trong ít nhất một lớp có `classes.teacher_id = giáo viên`. Không thoả (kể cả học sinh không tồn tại) → **404** cùng một thông điệp, để không dò được tài khoản. Thành công → 200 `{ success: true, temp_password }`.

Cả hai route: header `Cache-Control: no-store`; giới hạn 20 lần/giờ cho mỗi người gọi bằng `lib/rate-limit.ts` (vượt → 429); không log mật khẩu tạm.

**UI** — nút thứ cấp, icon `KeyRound` (lucide), nhãn "Cấp lại mật khẩu" (không dấu `+`, DEC-035). Bấm → xác nhận "Mật khẩu cũ của <tên> sẽ không dùng được nữa" → gọi API → hiện mật khẩu tạm + nút sao chép + dòng "Chỉ hiện một lần. Người dùng sẽ phải đổi mật khẩu khi đăng nhập". Có trạng thái đang gửi và lỗi.
- `/admin/accounts`: mỗi dòng tài khoản (trừ chính admin đang đăng nhập).
- `/admin/students/[id]`: phần thông tin học sinh.
- `/teacher/classes/[classId]` tab học sinh: mỗi học sinh.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0; `tests/docs-sync.test.ts` xanh hoặc chỉ đỏ vì thiếu 2 route mới trong docs/07 (ghi vào report, Claude bổ sung)
- [ ] Admin cấp lại cho học sinh → 200, `temp_password` dài 10, đăng nhập được bằng nó, `must_change_password = true`, mật khẩu cũ không còn đăng nhập được, `reset_token` về NULL
- [ ] Admin tự cấp cho chính mình → 400; id không tồn tại → 404; vai trò TEACHER/STUDENT/chưa đăng nhập gọi route admin → 401/403
- [ ] Giáo viên cấp lại cho học sinh trong lớp mình → 200
- [ ] Giáo viên với học sinh lớp giáo viên khác, với id giáo viên/admin khác, với id không tồn tại → đều 404 cùng thông điệp, mật khẩu đích không đổi
- [ ] STUDENT gọi route giáo viên → 403
- [ ] Lần gọi thứ 21 trong một giờ → 429
- [ ] Response có `Cache-Control: no-store`; trong DB lưu bản băm, không lưu plaintext
- [ ] 3 trang có `ResetPasswordButton`

## 6. Ràng buộc & bẫy cần tránh
- Băm bằng `hashPassword` của `lib/auth.ts`; không lưu, không trả lại mật khẩu cũ.
- Kiểm quyền giáo viên bằng SQL qua `enrollments JOIN classes`, không tin `classId` client gửi.
- Không cho giáo viên cấp lại cho giáo viên khác hay admin dưới mọi hình thức.
