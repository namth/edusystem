# Báo cáo TASK-002

## Đã làm
- [x] Gỡ bỏ toàn bộ JWT secret viết cứng dự phòng trong `lib/jwt.ts`; đọc `process.env.JWT_SECRET` mỗi lần gọi, kiểm tra bắt buộc tối thiểu 32 ký tự, ném lỗi khi ký và trả `null` khi xác thực nếu secret thiếu hoặc ngắn hơn 32 ký tự.
- [x] Cập nhật `comparePassword` trong `lib/auth.ts`: từ chối mọi trường hợp mật khẩu plaintext hoặc không đúng định dạng `salt:hash`.
- [x] Loại bỏ hoàn toàn nhánh "legacy row migration" và fallback `123456` trong `app/api/auth/login/route.ts`.
- [x] Sửa `app/api/auth/register/route.ts` để lưu `phone` dạng `phone?.trim() || null`, không còn gán mặc định `"0912345678"`.
- [x] Loại bỏ chuỗi kết nối và key Supabase/PostgreSQL viết cứng trong `lib/db-pg.ts`, `lib/db-init.js`, `lib/supabase.ts`, `lib/supabase-server.ts`. Bổ sung kiểm tra biến môi trường và ném lỗi/exit 1 nếu thiếu.
- [x] Cập nhật hàm băm seed password trong `lib/db-init.js` sử dụng scrypt `salt:hash` từ `process.env.SEED_DEFAULT_PASSWORD`.
- [x] Thêm `JWT_SECRET` và `DATABASE_URL` vào danh sách biến bắt buộc kiểm tra trong `lib/env-check.ts`.
- [x] Khai báo `JWT_SECRET=${JWT_SECRET}` trong `docker-compose.yml` cho service `nextjs`.
- [x] Chạy kiểm tra tự động thành công: 106 tests trong `tests/secrets-password.test.ts` và `tests/api-auth.test.ts` đều pass, `tsc --noEmit` và `node --check lib/db-init.js` exit 0. Toàn bộ repo không còn chuỗi bí mật bị lộ.

## File đã tạo/sửa
- `lib/jwt.ts`: Đọc `process.env.JWT_SECRET` động mỗi lần gọi, kiểm tra độ dài >= 32 ký tự, xoá secret hardcode.
- `lib/auth.ts`: Cập nhật `comparePassword` từ chối mật khẩu plaintext/không đúng định dạng `salt:hash`.
- `lib/env-check.ts`: Thêm `JWT_SECRET` và `DATABASE_URL` vào danh sách `required`.
- `lib/db-pg.ts`: Gỡ fallback chuỗi kết nối có mật khẩu, kiểm tra `DATABASE_URL` trong `getPgPool()`.
- `lib/db-init.js`: Thoát nếu thiếu `DATABASE_URL`, băm mật khẩu seed scrypt từ `SEED_DEFAULT_PASSWORD`, gỡ bỏ fallback connection string.
- `lib/supabase.ts`: Bỏ fallback URL & anon key, ném lỗi nếu thiếu biến môi trường.
- `lib/supabase-server.ts`: Bỏ fallback URL & anon key trong `createClient()`, ném lỗi nêu tên biến nếu thiếu.
- `app/api/auth/login/route.ts`: Xoá bỏ nhánh legacy migration, cập nhật password và fallback plaintext `123456`.
- `app/api/auth/register/route.ts`: Lưu `phone` là `null` khi không truyền vào thay vì số điện thoại mặc định.
- `docker-compose.yml`: Bổ sung `JWT_SECRET=${JWT_SECRET}` cho service `nextjs`.

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-002-go-bi-mat-mat-khau/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/phoi-hop-antigravity-review-468cb6


 ❯ tests/secrets-password.test.ts [queued]

 Test Files 0 passed (2)
      Tests 0 passed (0)
   Start at 08:05:07
   Duration 218ms

 ❯ tests/api-auth.test.ts 1/90
 ❯ tests/secrets-password.test.ts 0/16

 Test Files 0 passed (2)
      Tests 1 passed (106)
   Start at 08:05:07
   Duration 417ms

 ❯ tests/api-auth.test.ts 20/90
 ❯ tests/secrets-password.test.ts 4/16

 Test Files 0 passed (2)
      Tests 24 passed (106)
   Start at 08:05:07
   Duration 619ms
 ✓ tests/api-auth.test.ts (90 tests) 281ms

 ❯ tests/secrets-password.test.ts 11/16

 Test Files 1 passed (2)
      Tests 101 passed (106)
   Start at 08:05:07
   Duration 720ms
 ✓ tests/secrets-password.test.ts (16 tests) 388ms

 Test Files  2 passed (2)
      Tests  106 passed (106)
   Start at  08:05:07
   Duration  760ms (transform 233ms, setup 0ms, collect 169ms, tests 669ms, environment 0ms, prepare 153ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
