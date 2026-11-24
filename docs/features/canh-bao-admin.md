# FEAT-016: Kênh cảnh báo admin (Telegram + trang Cảnh báo hệ thống)

> Trạng thái: DONE (2026-11-23, TASK-048 → 050 Claude tự làm, chưa deploy — cấu hình Telegram ở `docs/15` §4) · Quyết định: DEC-047, DEC-048 (`docs/14-decisions.md`) · FEAT-015 là nguồn sự kiện đầu tiên

## 1. Tổng quan & mục tiêu nghiệp vụ
Hiện admin không biết khi hệ thống gặp lỗi. Lỗi 500 chỉ được `console.error` trong log container: 56 file route với 86 nhánh `catch` trả 500. Worker chấm bài cũng chỉ log. Lỗi AI và dạng câu nhập đề chưa hỗ trợ (FEAT-015) cũng không có kênh báo.

FEAT-016 thêm:
1. Hàm dùng chung **`reportAlert()`** (`lib/admin-alerts.ts`). Hàm không bao giờ ném lỗi; nó ghi sự kiện vào bảng **`admin_alerts`**, gộp theo `fingerprint`.
2. **Telegram** là kênh đẩy (`lib/telegram.ts`), có chống spam: 1 tin/15 phút cho mỗi fingerprint, tối đa 20 tin/giờ cho toàn hệ thống (DEC-048).
3. Trang **`/admin/alerts`** (SCR-52): lọc, xem chi tiết, đánh dấu đã xử lý, gửi tin thử. Menu có huy hiệu số cảnh báo mới.
4. Nguồn sự kiện:
   - mọi lỗi 500 của API, qua helper **`serverError(err, ctx)`**;
   - lỗi chưa bắt, qua `onRequestError` trong `instrumentation.ts`;
   - lỗi AI ở mọi nhà cung cấp;
   - lỗi worker chấm bài;
   - nhập đề gặp dạng câu chưa hỗ trợ hoặc chuyển đổi thất bại (FEAT-015).

Ngoài phạm vi: sự kiện nghiệp vụ (đơn hàng, giáo viên mới) vẫn đi qua thông báo trong app như hiện tại; email hoặc Zalo; nhiều kênh Telegram theo mức độ.

## 2. Phân quyền
| Hành động | Khách | STUDENT | TEACHER | ADMIN | Nội bộ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Xem, lọc, đánh dấu cảnh báo; gửi tin thử | — | — | — | ✓ | — |
| Gửi sự kiện từ worker | — | — | — | — | 🔑 `x-internal-token` |
| Tạo sự kiện từ server (`reportAlert`) | (trong tiến trình server, không có route) | | | | |

Trang `/admin/alerts` được middleware chặn theo `/admin/*` (chỉ ADMIN).

## 3. Luồng tương tác
```mermaid
flowchart TD
  A[Route catch → serverError] --> R[reportAlert]
  B[onRequestError] --> R
  C[AI mọi nhà cung cấp lỗi / grade-async NEEDS_REVIEW do AI] --> R
  D[Worker lỗi → POST internal alerts 🔑] --> R
  E[FEAT-015 UNSUPPORTED / CONVERSION_FAILED] --> R
  R --> F[Làm sạch: bỏ PII, cắt độ dài]
  F --> G{Ghi DB upsert theo fingerprint}
  G -->|OK| H{Cần gửi Telegram?}
  G -->|DB lỗi| I[Gửi thẳng Telegram, chống spam trong bộ nhớ]
  H -->|lần đầu / tái phát sau RESOLVED / đã quá 15 phút| J{Trần 20 tin/giờ}
  H -->|chưa quá 15 phút| K[Chỉ tăng bộ đếm]
  J -->|còn hạn mức| L[sendTelegram → đặt last_notified_at]
  J -->|chạm trần| M[1 tin "đã chạm trần" rồi im tới hết giờ]
  N[Admin /admin/alerts] -->|Đánh dấu đã xử lý| O[status RESOLVED]
```

## 4. Giao diện & 4 trạng thái UI
**SCR-52 `/admin/alerts`**, menu "Cảnh Báo Hệ Thống" đặt ngay sau "Tổng quan", có huy hiệu số cảnh báo `NEW` (giống huy hiệu đơn chờ).

- Thanh lọc: Trạng thái (*Mới* mặc định / *Đã xử lý* / *Tất cả*), Mức (ERROR / WARN / INFO), Nguồn (API / SERVER / AI / WORKER / EXAM_IMPORT).
- Bảng: Mức (huy hiệu rose / amber / sky), Nguồn, Tiêu đề, Số lần, Lần đầu, Lần cuối, Đã gửi Telegram (giờ hoặc "—"). Phân trang 50 dòng.
- Bấm một dòng mở ngăn chi tiết: `detail` (thông điệp, route, method, mã người dùng và vai trò, 10 dòng stack đã làm sạch, `extra`), các nút *Đánh dấu đã xử lý* / *Mở lại*.
- Khung trên cùng hiện trạng thái Telegram: "Đã cấu hình" kèm nút **Gửi tin thử**, hoặc "Chưa cấu hình. Đặt `TELEGRAM_BOT_TOKEN` và `TELEGRAM_ALERT_CHAT_ID` (xem docs/15 §4)".

| Trạng thái | Biểu hiện |
| :--- | :--- |
| Đang tải | Skeleton bảng 8 dòng. |
| Rỗng | "Chưa có cảnh báo nào. Hệ thống đang chạy ổn." kèm biểu tượng khiên; lọc ra rỗng thì "Không có cảnh báo khớp bộ lọc" + nút *Xoá lọc*. |
| Lỗi | Banner rose với `error` từ API + nút *Thử lại*. Gửi tin thử lỗi thì hiện toast rose kèm lý do Telegram trả về. |
| Có dữ liệu | Như trên. |

## 5. Tác động dữ liệu
**Migration 018** `docs/db-migration-018-admin-alerts.sql` (chạy cùng `ensureSchema`):
```sql
CREATE TABLE IF NOT EXISTS admin_alerts (
  id TEXT PRIMARY KEY,                         -- 'alr_' + uuid
  fingerprint TEXT NOT NULL UNIQUE,
  level TEXT NOT NULL CHECK (level IN ('ERROR','WARN','INFO')),
  source TEXT NOT NULL CHECK (source IN ('API','SERVER','AI','WORKER','EXAM_IMPORT')),
  title TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,   -- mẫu gần nhất, đã làm sạch
  occurrences INTEGER NOT NULL DEFAULT 1,
  unsent_count INTEGER NOT NULL DEFAULT 0,     -- số lần xảy ra từ tin Telegram gần nhất
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','RESOLVED')),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_notified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_status_last ON admin_alerts (status, last_seen_at DESC);
```
Không đụng dữ liệu cũ. Rollback: bảng độc lập, xoá được mà không ảnh hưởng gì.

## 6. Hợp đồng API & hàm dùng chung
### 6.1 Hàm (server)
- `reportAlert(input): Promise<void>`. **Không bao giờ ném lỗi.**
  - `input = { level, source, title, fingerprint, detail?: { message?, route?, method?, userId?, role?, stack?, extra? } }`.
  - `title` cắt còn 200 ký tự, mỗi chuỗi trong `detail` cắt còn 1.500 ký tự, `stack` giữ 10 dòng đầu.
- `serverError(err, ctx): NextResponse`.
  - `ctx = { route: string, method: string, userId?, role?, message?: string }`.
  - Hàm `console.error`, gọi `reportAlert` mức ERROR, nguồn `API` theo kiểu không chờ (`void`, có `.catch`), rồi trả **500** `{ success:false, error: ctx.message ?? "Đã xảy ra lỗi hệ thống. Vui lòng thử lại." }`.
  - Fingerprint: `API:<METHOD> <route>:<err.name>[:<err.code>]`, không lấy thông điệp lỗi (vì thông điệp có id thay đổi).
  - `ctx.body` (tuỳ chọn) thay thân phản hồi cho route có hợp đồng riêng — chỉ `/api/tts` dùng (`{ error: "TTS_FAILED", message }`).
- `redactSensitive(text)`: thay email → `[email]`; số điện thoại VN (`0` hoặc `+84` + 9–10 số) → `[phone]`; JWT `eyJ…` → `[jwt]`; `Bearer …` → `[token]`; cặp `key|token|secret|password|authorization=…` → `[redacted]`; chuỗi hex/base64 từ 32 ký tự → `[redacted]`.
- `sendTelegram(text)`: `POST https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendMessage`, body `{ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }`, chờ tối đa 5 giây, text ≤ 3.500 ký tự (đã escape HTML). Trả `{ ok, error? }`, không ném lỗi.
- `instrumentation.ts` xuất `onRequestError(err, request, context)` → `reportAlert` mức ERROR, nguồn `SERVER`, fingerprint `SERVER:<routePath>:<err.name>`.

### 6.2 Route mới (đã có trong `docs/07` §2.5, §2.6)
| Method | Route | Vai trò | Request → Phản hồi |
| :--- | :--- | :--- | :--- |
| GET | `/api/admin/alerts?status=NEW\|RESOLVED\|ALL&level=&source=&page=` | ADMIN | `{ success, items: Alert[], total, page, pageSize: 50, counts: { NEW }, telegram: { configured: boolean } }`; tham số sai → 400 |
| PATCH | `/api/admin/alerts/[id]` | ADMIN | `{ status: "RESOLVED" \| "NEW" }` → `{ success, alert }`; không có → 404; status sai → 400 |
| POST | `/api/admin/alerts/test` | ADMIN | → `{ success: true }`; chưa cấu hình → 400 "Chưa cấu hình Telegram."; Telegram từ chối → 502 kèm lý do |
| POST | `/api/internal/alerts` | 🔑 `x-internal-token` | `{ level, title, fingerprint, detail? }` → `{ success: true }`; nguồn luôn là `WORKER` (server đặt); thiếu hoặc sai token → 401; body sai → 400 |

Không có route nào trả thẳng `detail` chưa làm sạch. `AdminLayout` lấy huy hiệu bằng `GET /api/admin/alerts?status=NEW&page=1` (đọc `counts.NEW`), hỏi lại mỗi 60 giây giống chuông thông báo.

## 7. Quy tắc nghiệp vụ & máy trạng thái
- **BR-W01** `reportAlert` không bao giờ làm hỏng luồng gọi nó: mọi lỗi bên trong chỉ được `console.error`. Lỗi trong `reportAlert` không được gọi lại `reportAlert` hay `serverError`.
- **BR-W02** Upsert theo `fingerprint`: dòng có sẵn thì `occurrences + 1`, `unsent_count + 1`, `last_seen_at = NOW()`, `detail` = mẫu mới nhất, `level` = mức cao hơn giữa cũ và mới. Dòng đang `RESOLVED` thì chuyển về `NEW`, xoá `resolved_at` / `resolved_by`, và **gửi Telegram ngay**.
- **BR-W03** Telegram được gửi khi dòng mới tạo, khi tái phát sau `RESOLVED`, hoặc khi `last_notified_at` cách đây ≥ 15 phút. Ngoài các trường hợp đó thì không gửi. Tin sau ghi "lặp lại N lần từ tin trước" (N = `unsent_count`). Gửi thành công thì đặt `last_notified_at = NOW()`, `unsent_count = 0`. Gửi lỗi thì giữ nguyên, lần sau thử lại.
- **BR-W04** Trần toàn hệ thống: tối đa 20 tin trong cửa sổ trượt 60 phút, đếm trong bộ nhớ tiến trình Next.js (chỉ có một container `nextjs`). Tin thứ 21 được thay bằng một tin "Đã chạm trần 20 tin/giờ, xem /admin/alerts", sau đó im tới khi cửa sổ có chỗ trống. Sự kiện vẫn được ghi DB đủ. Tin gửi thử của admin không bị tính trần.
- **BR-W05** DB lỗi khi ghi → gửi thẳng Telegram, chống spam bằng `Map<fingerprint, lastSent>` trong bộ nhớ (15 phút) và vẫn tính trần BR-W04.
- **BR-W06** Không có thông tin cá nhân hay bí mật trong DB lẫn Telegram:
  - mọi chuỗi đi qua `redactSensitive`;
  - không ghi body request, cookie, header hay tên file người dùng tải lên;
  - danh tính chỉ gồm `userId` và `role`.
- **BR-W07** Thiếu `TELEGRAM_BOT_TOKEN` hoặc `TELEGRAM_ALERT_CHAT_ID` → chỉ ghi DB, không báo lỗi. `env-check` chỉ cảnh báo, không chặn khởi động.
- **BR-W08** Mọi nhánh trả 500 trong `app/api/**/route.ts` phải đi qua `serverError`. Test khoá: file route nào còn chuỗi `status: 500` thì test đỏ.
- **BR-W09** Dọn dữ liệu: dòng `RESOLVED` có `last_seen_at` cũ hơn 90 ngày bị xoá. Việc dọn chạy kèm `reportAlert`, tối đa một lần mỗi 24 giờ cho mỗi tiến trình.
- **BR-W10** Worker gửi sự kiện khi bỏ cuộc sau `MAX_DELIVERIES` (5) lần giao (`WORKER:GIVE_UP:EXAM|LESSON`, ERROR) và khi mất kết nối Redis (`WORKER:REDIS_DOWN`, một lần cho mỗi lần mất, mở lại cờ khi Redis `ready`). Gửi lỗi thì worker chỉ log, không thử lại. Server luôn thêm tiền tố `WORKER:` vào fingerprint.
- **BR-W11** Nguồn `AI`:
  - `document-parser` hết mọi nhà cung cấp → ERROR `AI:EXAM_IMPORT:ALL_PROVIDERS_FAILED`;
  - bài chuyển `NEEDS_REVIEW` vì AI lỗi (BR-G01, BR-B12) → WARN `AI:GRADING:NEEDS_REVIEW:<EXAM|LESSON>`.

Máy trạng thái (`docs/12` §10):
```text
admin_alerts.status   (mới) ─▶ NEW ─admin đánh dấu─▶ RESOLVED ─tái phát / admin mở lại─▶ NEW
```

Mẫu tin Telegram (HTML, đã escape):
```text
🔴 ERROR · API
POST /api/exam/submit → 500 (TypeError)
Lần: 12 · lặp lại 11 lần từ tin trước
Lúc: 23/11 10:42 (giờ VN)
Cannot read properties of undefined (reading 'id')
user: usr_ab12 (STUDENT)
→ Xem: /admin/alerts
```
(🔴 ERROR · 🟠 WARN · 🔵 INFO. Không ghi tên miền: `APP_URL` của worker là địa chỉ nội bộ docker. Lỗi tái phát sau RESOLVED có thêm dòng nghiêng "Tái phát…"; DB lỗi có "Chưa lưu được vào DB".)

## 8. Test case (TC-W) & Review Focus
| TC | Ca kiểm | BR | File test |
| :--- | :--- | :--- | :--- |
| TC-W01 | Cùng fingerprint 3 lần trong 1 phút → 1 dòng, `occurrences = 3`, đúng 1 lần gửi Telegram | BR-W02, BR-W03 | `admin-alerts` |
| TC-W02 | Sau 15 phút (giả lập đồng hồ) xảy ra lại → gửi lần 2, có "lặp lại N lần" | BR-W03 | `admin-alerts` |
| TC-W03 | Dòng `RESOLVED` tái phát → `NEW` và gửi ngay dù chưa đủ 15 phút | BR-W02 | `admin-alerts` |
| TC-W04 | 25 fingerprint khác nhau trong 1 giờ → 20 tin + 1 tin chạm trần; DB có đủ 25 dòng | BR-W04 | `admin-alerts` |
| TC-W05 | DB ném lỗi → `reportAlert` không ném, vẫn gửi Telegram; Telegram cũng lỗi → vẫn không ném | BR-W01, BR-W05 | `admin-alerts` |
| TC-W06 | Chi tiết chứa email, SĐT, JWT, `password=…`, `Bearer …` → đều bị thay trong DB và trong tin | BR-W06 | `admin-alerts` |
| TC-W07 | Thiếu biến Telegram → chỉ ghi DB, không gọi `fetch` | BR-W07 | `admin-alerts` |
| TC-W08 | `serverError` trả 500 đúng dạng `{ success:false, error }`, gọi `reportAlert` với fingerprint không chứa thông điệp lỗi | §6.1 | `server-error` |
| TC-W09 | Không file `app/api/**/route.ts` nào còn chuỗi `status: 500` | BR-W08 | `server-error-coverage` |
| TC-W10 | `/api/admin/alerts*`: không phiên → 401, TEACHER/STUDENT → 403; lọc + `counts.NEW` + `telegram.configured` đúng; PATCH id lạ → 404 | §6.2 | `admin-alerts-api` |
| TC-W11 | `/api/internal/alerts`: thiếu hoặc sai token → 401; body thiếu `title` → 400; nguồn luôn `WORKER` dù body gửi khác | §6.2 | `admin-alerts-api` |
| TC-W12 | `onRequestError` gọi `reportAlert` nguồn `SERVER` | §6.1 | `server-error` |
| TC-W13 | Trang `/admin/alerts`: đủ 4 trạng thái, đánh dấu đã xử lý cập nhật dòng, nút Gửi tin thử hiện toast; menu có huy hiệu `NEW` | §4 | `admin-alerts-ui` |
| TC-W14 | Dọn: dòng `RESOLVED` 91 ngày bị xoá, `NEW` 91 ngày giữ lại | BR-W09 | `admin-alerts` |

**Review Focus:**
1. DB sập làm mọi route lỗi cùng lúc → Telegram không bị dội hàng trăm tin (TC-W04, TC-W05).
2. Thông điệp lỗi Postgres chứa giá trị dòng (email học sinh trong `duplicate key value (email)=(…)`) → bị làm sạch (TC-W06).
3. Admin bấm "Gửi tin thử" nhiều lần liên tiếp → mỗi lần gửi một tin, không bị trần chặn, không tạo dòng cảnh báo.
4. Worker gửi dồn khi Redis chập chờn → chỉ một sự kiện cho mỗi lần mất kết nối, fingerprint gộp lại (BR-W10).
5. Token bot sai → trang hiện "Đã cấu hình" nhưng gửi thử trả lý do của Telegram (502), không lộ token trong lỗi.

## 9. Task triển khai & DoD
| Task | Nội dung | Phụ thuộc | Độ khó / Nhạy cảm | DoD |
| :--- | :--- | :--- | :--- | :--- |
| TASK-048 | Migration 018 + `ensureSchema`; `lib/admin-alerts.ts` (`reportAlert`, `redactSensitive`, chống spam, dọn); `lib/telegram.ts`; `lib/api-errors.ts` `serverError`; `onRequestError`; `env-check` cảnh báo thiếu biến Telegram | — | HIGH (bảo mật, PII) | TC-W01 → 08, 12, 14 xanh; `docs/06`, `docs/10` khớp |
| TASK-049 | Thay 86 nhánh 500 ở 56 route bằng `serverError`; `/api/internal/alerts`; worker gửi sự kiện (BR-W10); nguồn AI (BR-W11) | 048 | LOW (cơ học) + HIGH ở route nội bộ | TC-W09, 11 xanh; mọi test cũ vẫn xanh; `docs/07` thêm route nội bộ |
| TASK-050 | `/api/admin/alerts`, `/api/admin/alerts/[id]`, `/api/admin/alerts/test`; trang `/admin/alerts`; menu + huy hiệu | 048 | MED | TC-W10, 13 xanh; `npx next build`; `docs/03` SCR-52 `Code: DONE`; `docs/07` thêm route |

Sau khi deploy: tạo bot, đặt biến môi trường, bấm "Gửi tin thử" (`docs/15` §4).
