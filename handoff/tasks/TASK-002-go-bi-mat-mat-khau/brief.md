# TASK-002 — Gỡ bí mật viết cứng & luồng mật khẩu plaintext

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Mã nguồn đang chứa: JWT secret dự phòng (ai đọc code cũng giả được token ADMIN), chuỗi kết nối PostgreSQL kèm mật khẩu, URL/anon key Supabase viết cứng. Login có nhánh "legacy" cho đăng nhập bằng `123456` hoặc bằng mật khẩu bất kỳ khi cột `password` rỗng; seed tạo admin mật khẩu plaintext `123456`. Task này loại bỏ toàn bộ, mọi bí mật chỉ đọc từ biến môi trường (bất biến 6, 7 trong `CONTEXT.md`).

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 1, 6, 7)
- Test: `tests/secrets-password.test.ts` (và `tests/api-auth.test.ts` phải tiếp tục xanh)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/jwt.ts`, `lib/auth.ts`, `lib/env-check.ts`
- `lib/db-pg.ts`, `lib/db-init.js`, `lib/supabase.ts`, `lib/supabase-server.ts`
- `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`
- `docker-compose.yml` (chỉ thêm biến môi trường)

**Không được sửa:**
- Mọi file trong `tests.lock` (test do trưởng phòng viết), `vitest.config.ts`, `package.json`
- `docs/`, `CONTEXT.md`
- `lib/api-auth.ts`, `middleware.ts` và các route của TASK-001 (trừ khi cần để `tests/api-auth.test.ts` tiếp tục xanh — không được cần)
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết

### 4.1 `lib/jwt.ts`
- Xoá hằng `JWT_SECRET_STRING`/`JWT_SECRET_BYTES` ở cấp module. Thêm hàm nội bộ `getJwtSecretBytes()` đọc `process.env.JWT_SECRET` **mỗi lần gọi**:
  - thiếu hoặc `length < 32` → `throw new Error("JWT_SECRET chưa được cấu hình hoặc ngắn hơn 32 ký tự.")`.
- `getHmacKey()` dùng hàm trên.
- `signJwtToken`: để lỗi trên ném ra ngoài (không nuốt).
- `verifyJwtToken`: thiếu/sai secret → trả `null` (đã có `try/catch`, chỉ cần đưa việc lấy key vào trong `try`).
- Giữ nguyên chữ ký hàm, `TokenPayload`, định dạng token. Phải chạy được trên Edge runtime (middleware) — không import `crypto` của Node.

### 4.2 `lib/auth.ts` — `comparePassword`
- `storedHash` rỗng hoặc không có dạng `salt:hash` → `return false`. Xoá hoàn toàn nhánh so sánh plaintext.

### 4.3 `app/api/auth/login/route.ts`
- Xoá toàn bộ nhánh "Legacy row migration" (kể cả việc `UPDATE users SET password` và chấp nhận `"123456"`).
- Logic còn lại: `isPasswordCorrect = comparePassword(cleanPass, storedHash)`; sai → 401 với `INVALID_CREDENTIALS_MSG` như hiện tại. Tài khoản cũ còn plaintext sẽ dùng luồng quên mật khẩu.
- Bỏ import `hashPassword` nếu không còn dùng. Không đổi định dạng phản hồi thành công.

### 4.4 `app/api/auth/register/route.ts`
- `phone`: `phone?.trim() || null` (không gán `"0912345678"`). Không đổi gì khác.

### 4.5 Kết nối DB & Supabase — không giá trị dự phòng
- `lib/db-pg.ts`: `connectionString = process.env.DATABASE_URL`. Trong `getPgPool()`, nếu thiếu → `throw new Error("DATABASE_URL chưa được cấu hình.")`. Không ném ở cấp module (để `import` không làm sập build).
- `lib/db-init.js`: thiếu `DATABASE_URL` → `console.error` thông báo rõ và `process.exit(1)` trước khi kết nối.
- `lib/db-init.js` seed `users`: không lưu `'123456'` plaintext. Băm mật khẩu seed bằng `crypto.scryptSync` cùng định dạng `salt:hash` với `hashPassword` trong `lib/auth.ts` (salt 16 byte hex, key 64 byte hex). Mật khẩu seed lấy từ `process.env.SEED_DEFAULT_PASSWORD`, thiếu thì `console.error` + `process.exit(1)`.
- `lib/supabase.ts`, `lib/supabase-server.ts` (`createClient`): đọc `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` không fallback. Thiếu → `throw new Error` nêu tên biến (ở `lib/supabase.ts` được phép ném lúc import; Dockerfile đã truyền 2 biến này lúc build).

### 4.6 `lib/env-check.ts`
- Danh sách `required` thêm `JWT_SECRET`, `DATABASE_URL` (giữ các biến cũ). Hành vi cảnh báo `console.warn` giữ nguyên.

### 4.7 `docker-compose.yml`
- `nextjs.environment` thêm `- JWT_SECRET=${JWT_SECRET}` (giữ đúng kiểu khai báo hiện có, không xoá biến nào).

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (cả `tests/secrets-password.test.ts` và `tests/api-auth.test.ts`, `tsc --noEmit`, `node --check lib/db-init.js`)
- [ ] `grep` toàn repo (trừ `tests/`, `handoff/`, `node_modules/`) không còn các chuỗi: `edutest_pro_super_secret`, `qereQScNVoecP8Kd`, `owlvfznycutvkrvgbiot`, `sb_publishable_8X7i9iuqijcB9IspKxOugA`
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã sửa

## 6. Ràng buộc & bẫy cần tránh
- **Không sửa test, không thêm nhánh `NODE_ENV === "test"`/`VITEST`** để lách. Test đổi `process.env.JWT_SECRET` giữa các ca → secret phải đọc lúc gọi, không cache.
- Không thay chuỗi bí mật bằng chuỗi bí mật khác, không mã hoá base64 để "giấu" — phải hoàn toàn không có giá trị dự phòng.
- Không tạo file `.env*` hay commit giá trị thật nào.
- Không thêm thư viện mới.
- Không ném lỗi ở cấp module trong `lib/jwt.ts` và `lib/db-pg.ts` (sẽ làm sập `next build` và middleware).
- Không đụng tới số điện thoại mặc định ở các trang admin/teacher — ngoài phạm vi task này.
