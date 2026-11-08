# 10 — Biến môi trường & bảo mật

> Cập nhật: 2026-11-03 · Nguồn: `process.env.*` trong `app/`, `lib/`, `worker/`; `lib/env-check.ts`; `docker-compose.yml`. Giá trị bên dưới là **giả**. `.env` thật nằm trên server, do người dùng quản lý; không commit `.env*`.

## 1. `.env.example`
```dotenv
# ── Bắt buộc (lib/env-check.ts chặn khởi động nếu thiếu) ──
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<openssl rand -hex 32>
INTERNAL_API_TOKEN=<openssl rand -hex 32>        # worker → /api/*/grade-async
REDIS_URL=redis://redis:6379

# ── Khuyến nghị (thiếu thì cảnh báo, tính năng tương ứng tắt / dự phòng) ──
PORTKEY_API_KEY=pk-xxxx
PORTKEY_CONFIG_ID=pc-xxxx
PORTKEY_MODEL=gemini-2.5-flash
GOOGLE_API_KEY=AIza-xxxx                          # Gemini REST cho AI nhập đề
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co # Storage (upload qua server)
SUPABASE_SERVICE_ROLE_KEY=eyJ-xxxx
NEO4J_URI=neo4j+s://xxxx.databases.neo4j.io

# ── Tuỳ chọn ──
OPENAI_API_KEY=sk-xxxx                            # dự phòng khi Portkey lỗi
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ-xxxx            # truyền lúc build image
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=xxxx
NEO4J_DATABASE=neo4j
DEFAULT_AI_MODEL=
GCP_CLIENT_EMAIL=tts@project.iam.gserviceaccount.com   # Google TTS
GCP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SLOT_UNIT_PRICE_VND=0                             # CHỈ là giá khởi tạo khi chưa có system_settings.slot_pricing (DEC-033)
MEDIA_HOST_DIR=../edusystem-media                 # docker-compose: thư mục media mount vào /app/public/media
SEED_DEFAULT_PASSWORD=                            # chỉ dùng cho script seed
RESEND_API_KEY=                                   # Resend: gửi email (TASK-048). Trống → không gửi, hệ thống vẫn chạy
MAIL_FROM="KitoKit <no-reply@kitokit.edu.vn>"     # địa chỉ gửi, domain phải xác minh trên Resend
APP_BASE_URL=https://kitokit.edu.vn               # dựng link tuyệt đối trong email
ALLOW_DEV_RESET_LINK=                             # =1 chỉ ở dev/e2e: forgot-password trả kèm resetUrl. Production luôn bị bỏ qua (BR-A06)

# ── Worker ──
APP_URL=http://nextjs:3000
WORKER_ID=worker-1
CRON_SECRET=                                      # FEAT-015: worker gọi /api/cron/slot-billing với Bearer này; ≥ 32 ký tự ngẫu nhiên
```
Cấu hình nghiệp vụ **không** đặt trong `.env`. Admin sửa trong app, giá trị lưu ở `system_settings`:

| Khoá | Nội dung | Nơi sửa |
| :--- | :--- | :--- |
| `payment_account`, `slot_pricing` | Tài khoản nhận tiền, đơn giá slot | `/admin/orders` → Cấu hình thanh toán |
| `ai_pricing` | Bảng giá model, tỷ giá | `/admin/settings` |
| `ai_exam_ingestion_model` | Model AI nhập đề | `/admin/settings` |

## 2. Bất biến bảo mật (trùng `CONTEXT.md` §3)
1. Phiên là JWT HS256 trong cookie httpOnly `auth_token`. Không lưu token ở `localStorage`, không đọc vai trò từ body hay query.
2. Mọi `app/api/**` kiểm phiên trước khi chạm DB, AI hoặc hàng đợi. Các route công khai có chủ đích được liệt kê ở `docs/07` §1. Không có phiên trả 401, sai vai trò trả 403.
3. Khi người gọi là `STUDENT`, danh tính lấy từ token, không lấy từ `student_id` client gửi lên.
4. `TEACHER` chỉ thao tác dữ liệu do mình tạo (`created_by` / `teacher_id`). Đơn hàng của người khác trả 404.
5. Gọi máy – máy dùng `x-internal-token` = `INTERNAL_API_TOKEN` (không được rỗng).
6. Mật khẩu băm scrypt dạng `salt:hash`, không so sánh plaintext.
7. Bí mật chỉ đọc từ biến môi trường, không có giá trị dự phòng viết cứng.
8. Không lộ đáp án cho học sinh trước khi nộp (`sanitizeQuestionForStudent`, `lib/grading.ts`).
9. Giới hạn tần suất (`lib/rate-limit.ts`) ở `auth/login`, `auth/register`, `auth/register/teacher`, `auth/forgot-password`, `auth/username-available`, `auth/email-available`, `leads`.
10. `next` sau khi đăng nhập chỉ nhận đường dẫn nội bộ (`safeNextPath`, chống open-redirect).
11. Tiền và điểm do server tính. Client gửi `total_cost` hay `score` lên thì server bỏ qua.

## 3. Rủi ro còn mở (theo dõi ở `docs/11` §4)
| Mức | Rủi ro | Chỗ |
| :--- | :--- | :--- |
| Trung bình | `users.password DEFAULT '123456'` trong `ensureSchema`, trái bất biến 6 về nguyên tắc (code luôn băm mật khẩu khi tạo user) | `lib/db-pg.ts` |
| Thấp | `ai_usage_logs.created_at` là TIMESTAMP không có múi giờ; dashboard đúng chỉ khi Postgres chạy múi giờ UTC | `lib/admin-dashboard.ts` |
| Thấp | 4 tài khoản học sinh trên server còn mật khẩu plaintext từ dữ liệu cũ, cần đặt lại | DB server |
| Thấp | `/api/admin/test-portkey` gọi AI thật (chỉ ADMIN, có ghi log chi phí) | `app/api/admin/test-portkey` |
| Trung bình | Chưa gửi được email → người dùng quên mật khẩu chỉ khôi phục được qua hỗ trợ, admin chưa có nút cấp lại mật khẩu | `docs/11` D12 |
