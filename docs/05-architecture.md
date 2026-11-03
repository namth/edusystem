# 05 — Kiến trúc

> Cập nhật: 2026-11-03 · Nguồn: `package.json`, `docker-compose.yml`, `Dockerfile`, `worker/`, `lib/`, `middleware.ts`, `instrumentation.ts`.

## 1. Stack
| Lớp | Công nghệ |
| :--- | :--- |
| Web + API | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 (`@theme` token) |
| CSDL chính | PostgreSQL. Truy cập **chỉ** qua `queryPg` / `getPgPool` trong `lib/db-pg.ts` (driver `pg`) |
| Đồ thị (phụ) | Neo4j (`lib/neo4j.ts`). Đồng bộ quan hệ khoá – đề – lớp – học sinh. Lỗi chỉ log, không làm hỏng giao dịch PostgreSQL |
| Hàng đợi | Redis Streams (`lib/redis-queue.ts`, stream `stream:learning:grading`); consumer `worker/grading-worker.js` (consumer group) |
| AI | Portkey gateway (`portkey-ai`) → Gemini / OpenAI; dự phòng OpenAI trực tiếp; Gemini REST cho AI nhập đề (`lib/ai-engine.ts`, `lib/document-parser.ts`) |
| Lưu file | Supabase Storage qua server (`app/api/uploads` + `lib/supabase-server.ts`); media cũ ở thư mục server mount vào `/app/public/media` |
| TTS | Google Text-to-Speech, xác thực bằng service account (`app/api/tts`) |
| Biểu đồ / QR | `recharts`; `qrcode` (vẽ VietQR ở client, payload từ `lib/vietqr.ts`) |
| Trích tài liệu | `mammoth` (DOCX), `pdf-parse` (PDF) |
| Test | Vitest + PGlite (Postgres WASM) cho API; Playwright E2E (`e2e/`, DB Docker riêng) |

## 2. Sơ đồ thành phần
```text
Trình duyệt ──HTTPS──▶ Next.js (container nextjs, cổng 3645→3000)
   │                     ├─ middleware.ts: chặn /admin /teacher /student theo JWT cookie
   │                     ├─ app/api/**: requireRole → queryPg (PostgreSQL)
   │                     │              ├─ đồng bộ phụ Neo4j (lỗi chỉ log)
   │                     │              ├─ XADD stream:learning:grading (Redis)
   │                     │              ├─ AI: Portkey / OpenAI / Gemini → recordAiUsage → ai_usage_logs
   │                     │              └─ Supabase Storage (upload qua server)
   │                     └─ instrumentation.ts → lib/env-check.ts (fail-fast thiếu biến bắt buộc)
   │
grading-worker (container) ──XREADGROUP──▶ Redis
   └─ POST /api/exam/grade-async | /api/lessons/grade-async  (header x-internal-token)
```

## 3. Nguyên tắc kiến trúc (bất biến, xem `CONTEXT.md` §3)
1. **Trình duyệt không chạm DB.** Mọi dữ liệu nghiệp vụ đi qua API route dùng `queryPg`. Không dùng Supabase client cho dữ liệu nghiệp vụ. Supabase chỉ còn dùng cho Storage, qua server.
2. **Mọi API kiểm phiên trước khi chạm DB, AI hoặc hàng đợi** (`lib/api-auth.ts` `requireRole`), trừ các route công khai có chủ đích (`docs/07` §1).
3. **Chấm điểm ở server.** Câu khách quan chấm ngay khi nộp (`lib/grading.ts`, `lib/exam-scoring.ts`). Mục AI chấm nền qua worker. Trình duyệt không bao giờ nhận đáp án trước khi nộp.
4. **Giờ thi theo server** (`started_at`, `deadline_at`).
5. **Schema đổi bằng file migration mới** (`docs/db-migration-0NN-*.sql`). `ensureSchema()` trong `lib/db-pg.ts` chạy cùng DDL khi khởi động. Code không được tự `ALTER TABLE` lúc chạy.
6. **Ghi log AI không làm hỏng việc chính.** `recordAiUsage` nuốt lỗi; ngữ cảnh (purpose, id bài) truyền qua `AsyncLocalStorage` (`withAiUsageContext`).

## 4. Chấm điểm bất đồng bộ
| Bước | Ai | Chi tiết |
| :--- | :--- | :--- |
| 1 | API nộp bài | Lưu trạng thái `GRADING` **trước**, sau đó mới `XADD` sự kiện (`GRADING_REQUESTED` cho đề thi, `LESSON_GRADING_REQUESTED` cho bài học). Đẩy lỗi thì chuyển `NEEDS_REVIEW` và báo giáo viên |
| 2 | Worker | `XREADGROUP`, gọi API chấm nội bộ, `XACK`. Giao nhiều lần vẫn lỗi thì gọi `giveUp` |
| 3 | `grade-async` | Bỏ qua nếu bài không còn `GRADING`. Mỗi mục AI thử 3 lần. Lỗi thì `NEEDS_REVIEW`, không cho điểm thấp nhất (DEC-021) |

## 5. Hạ tầng & triển khai
| Thành phần | Chi tiết |
| :--- | :--- |
| Máy chủ | `thaochi@192.168.1.36` (ARM). Thư mục `/home/thaochi/edusystem/` |
| Container | `nextjs` (cổng 3645, có healthcheck `/login`), `redis` (redis:7-alpine), `grading-worker` |
| PostgreSQL | Ngoài compose, kết nối qua `DATABASE_URL` |
| Media | `${MEDIA_HOST_DIR:-../edusystem-media}` → `/app/public/media` (chỉ đọc). Volume phải nằm trong compose của repo, vì `deploy.sh` rsync `--delete` |
| Deploy | `scripts/deploy.sh`: build image ở máy local (arm64), rsync mã nguồn, `docker save \| ssh docker load`, `docker compose up -d --no-build`. **Không build trên server.** Luôn hỏi người dùng trước khi deploy |
| Migration | 001–014, 016 tự chạy qua `ensureSchema`. **015 chạy tay một lần** (`docs/db-migration-015-student-slots.sql`) |
| E2E | `npm run e2e`: `docker-compose.e2e.yml` dựng Postgres riêng từ `e2e/schema.sql` + seed, rồi chạy Playwright |

## 6. Thành phần di sản (còn trong repo, không có đường chạy)
| File | Hiện trạng |
| :--- | :--- |
| `lib/kafka.ts`, `lib/db-schema.ts` | Không route nào import |
| `lib/db-init.js` | Script khởi tạo cũ, không ai gọi; có bảng `orders` (học sinh mua khoá, đã bỏ theo DEC-019) |
| Bảng `exam_categories`, `lesson_exams`, `course_exams` (migration 002), `exams.scoring_rubric_id` (001) | Không code nào đọc |
| `docs/ADR-001-ai-scoring-architecture.md`, `docs/ADR_AUTH.md`, `docs/SCORING.md` | Tài liệu tháng 07/2026, mô tả Supabase Auth và luồng chấm cũ. **Không còn đúng**: auth hiện là JWT HS256 tự quản, chấm theo FEAT-011. Chỉ giữ để tham khảo lịch sử |

Việc dọn các thành phần trên được ghi ở `docs/11` §4.
