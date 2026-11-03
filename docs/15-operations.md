# 15 — Vận hành: deploy, migration, rollback, sao lưu

> Cập nhật: 2026-11-03 · Nguồn: `scripts/deploy.sh`, `docker-compose.yml`, `docs/qa/checklist-production.md`.
> **Luôn hỏi người dùng trước mỗi lần deploy.** Không build trên server.

## 1. Môi trường
| Môi trường | Nơi | Ghi chú |
| :--- | :--- | :--- |
| Local | Máy dev (macOS arm64) | `npm run dev`; DB theo `DATABASE_URL` trong `.env.local` |
| E2E | Docker `kitokit-e2e` | `npm run e2e` dựng Postgres từ `e2e/schema.sql` + `e2e/seed.ts` |
| Server | `thaochi@192.168.1.36` (aarch64), `/home/thaochi/edusystem/` | Cổng 3645. Container `edusystem-nextjs-1`, `edusystem-grading-worker-1`, `edusystem-redis-1`. `.env` do người dùng quản lý, không nằm trong repo |
| Máy thợ Antigravity | `namtran@192.168.1.34` (`AGY_HOST=macbook`) | Chỉ chạy task agy (`scripts/agy-worktree.sh`), không phải môi trường app |

## 2. Quy trình deploy (`scripts/deploy.sh`)
**Trước khi deploy:**
1. Nhánh cần deploy đã merge vào `main` qua PR. Test xanh (`docs/13` §3).
2. Docker Desktop local đang chạy, có SSH key tới server.
3. `docker-compose.yml` còn volume media `/app/public/media`. Script tự kiểm và dừng nếu thiếu, vì rsync `--delete` sẽ ghi đè compose trên server.
4. Đọc mục "Migration" của bản phát hành (§3). Nếu có migration chạy tay thì sao lưu DB trước (§5).

**Script làm theo thứ tự:**
1. Đọc `NEXT_PUBLIC_SUPABASE_*` từ `.env` của server. Biến chỉ giữ trong tiến trình, không ghi ra đĩa.
2. Build image `edusystem-nextjs` và `edusystem-grading-worker` tại máy local (linux/arm64).
3. `rsync --delete` mã nguồn lên server. Loại trừ `.env*`, `.git`, `node_modules`, `.next`, `handoff/`, `tests/`, `e2e/`, `scripts/`, `.claude/`, `.agents/`, rác. Mẫu loại trừ phải có `/` ở đầu, vì `tests/` không có `/` sẽ khớp cả `app/teacher/tests/`.
4. Đẩy image: `docker save | gzip | ssh docker load`.
5. Trên server: `docker compose up -d --no-build`, rồi dọn image cũ.
6. Tự kiểm: `/login` trả 200, file media mẫu trả 200, `docker compose ps`.

**Sau khi deploy:** xem log `docker logs edusystem-nextjs-1` để chắc không có lỗi `[env]` hay lỗi `ensureSchema`. Đi các mục liên quan trong `docs/qa/checklist-production.md`.

## 3. Migration
- Migration 001–014 và 016 chạy cùng `ensureSchema()` khi app khởi động; viết để chạy lặp được.
- **Migration chạy tay một lần** (không nằm trong `ensureSchema`, vì chạy lại sẽ ghi đè dữ liệu admin đã sửa):

  | File | Khi nào | Ghi chú |
  | :--- | :--- | :--- |
  | `docs/db-migration-015-student-slots.sql` | Lần deploy đầu tiên có FEAT-013 (TASK-039) | Trả lại slot học sinh bị trừ khi chấm AI. Sao lưu bảng `users` trước khi chạy |

  Cách chạy:
  ```bash
  psql "$DATABASE_URL" -f docs/db-migration-015-student-slots.sql
  ```
  Chạy xong thì ghi ngày chạy vào bảng §6.
- Thêm migration mới: tạo `docs/db-migration-0NN-*.sql`, thêm DDL vào `ensureSchema` (trừ khi là migration chạy tay), cập nhật `docs/06` §1 và bảng §3 ở trên. Không sửa file migration cũ.

## 4. Cấu hình sau deploy (lưu trong DB, admin nhập trong app)
| Việc | Nơi | Khi nào |
| :--- | :--- | :--- |
| Tài khoản nhận tiền VietQR + đơn giá slot | `/admin/orders`, tab Cấu hình thanh toán | Trước khi giáo viên mua slot. Mặc định trống và 0 |
| Bảng giá model AI + tỷ giá USD→VND | `/admin/settings` | Trước khi xem chi phí AI. Dashboard cảnh báo khi có model chưa có giá |
| Model AI nhập đề | `/admin/settings` | Tuỳ chọn |
| Kiểm múi giờ Postgres là UTC (`show timezone;`) | DB server | Một lần. Dashboard coi `ai_usage_logs.created_at` là UTC (`docs/11` D4) |

## 5. Sao lưu & rollback
- **Sao lưu mã nguồn trước lần ghi đè lớn:** dùng `tar` thư mục app trên server, ví dụ `edusystem-backup-20261031.tar.gz`.
- **Sao lưu DB:**
  ```bash
  pg_dump "$DATABASE_URL" -Fc -f edusystem-YYYYMMDD.dump
  ```
  Bắt buộc trước migration chạy tay. Khôi phục bằng `pg_restore`.
- **Rollback app:** checkout commit trước đó ở máy local rồi chạy lại `scripts/deploy.sh`. Image cũ đã bị dọn nên phải build lại.
- **Rollback migration:** migration hiện tại chỉ thêm (ADD COLUMN IF NOT EXISTS, INSERT … ON CONFLICT DO NOTHING) nên không cần gỡ. Riêng migration chạy tay thì khôi phục từ bản dump.

## 6. Nhật ký phát hành
| Ngày | Commit / PR | Nội dung | Migration tay | Người duyệt |
| :--- | :--- | :--- | :--- | :--- |
| 2026-10-31 | build local | Code chuẩn đầu tiên, ghi đè server cũ; migration 006–009, seed 4 chuẩn chấm | — | người dùng |
| 2026-11-01 | — | Đợt sửa media Cambridge (volume `/app/public/media`) | — | người dùng |
| *(chưa)* | namth/edusystem#5 | FEAT-013 quản trị | 015 | — |

## 7. Theo dõi & sự cố thường gặp
| Triệu chứng | Kiểm | Xử lý |
| :--- | :--- | :--- |
| Bài kẹt "đang chấm" (`GRADING`) | `docker logs edusystem-grading-worker-1`; Redis còn sống không | Khởi động lại worker. Bài thất bại sẽ tự chuyển `NEEDS_REVIEW` khi worker bỏ cuộc |
| Ảnh / mp3 bài học 404 | `curl localhost:3645/media/ej/...` | Kiểm volume media trong compose; file mới thêm cần khởi động lại nextjs |
| App không lên sau deploy | log `[env]` | Thiếu biến bắt buộc (`docs/10` §1) |
| Chi phí AI hiện 0 | `/admin/settings`, mục `unpriced_models` | Thêm giá cho model |
| QR không hiện | `/admin/orders`, tab Cấu hình thanh toán | Nhập BIN, STK, chủ tài khoản |
