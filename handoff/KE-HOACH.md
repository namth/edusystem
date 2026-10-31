# Kế hoạch tiếp tục — rà soát ngày 31/10/2026

Nguồn: đọc code ở commit `6034e88`, đối chiếu `FEATURE_INDEX.md` (25/07/2026) và `task.md`.

## 1. Đã làm

| Mảng | Hiện trạng |
| :--- | :--- |
| Xác thực | Bộ API `app/api/auth/*` (login, register, me, logout, đổi/quên/đặt lại mật khẩu) dùng PostgreSQL + JWT HS256 trong cookie httpOnly, mật khẩu băm scrypt. |
| Phân quyền trang | `middleware.ts` chặn `/admin/*` (ADMIN) và `/teacher/*` (TEACHER/ADMIN). |
| Giáo viên | Tạo đề 4 kỹ năng (`app/teacher/tests/create`), quản lý đề theo khoá học, CRUD khoá học/đề có kiểm tra quyền sở hữu (`app/api/teacher/*`), cây giáo trình kéo-thả, chấm bài. |
| Học sinh | Làm bài thi (`app/student/exam/[examId]`), xem lại bài, analytics, trang lớp. |
| Admin | Quản lý tài khoản, giáo viên, học sinh, rubric, duyệt đơn, import đề. |
| Hạ tầng | Portkey/OpenAI (`lib/ai-engine.ts`), TTS Gemini, Redis Streams producer, Neo4j sync, Docker/docker-compose, migration SQL 001–003. |

## 2. Chưa làm / lỗi phát hiện

### Bảo mật (ưu tiên cao nhất)
- **API không kiểm tra đăng nhập/quyền:** `middleware.ts` chỉ match trang, không match `/api`. Các route sau ai gọi cũng chạy: `api/admin/create-user`, `api/admin/delete-user`, `api/admin/teachers/[id]`, `api/admin/test-*`, `api/exam/*` (kể cả `grade-override`), `api/submissions`, `api/events`, `api/tts`. Chỉ `api/teacher/*` và `auth/me` có kiểm tra quyền.
- Trang `/student/*` không được middleware bảo vệ.
- `lib/jwt.ts:9` có `JWT_SECRET` dự phòng viết cứng → ai đọc được mã nguồn đều giả mạo được token ADMIN nếu môi trường thiếu biến.
- `lib/auth.ts` `comparePassword` chấp nhận so sánh mật khẩu dạng plaintext (luồng "legacy").
- `api/auth/register` gán số điện thoại mặc định `0912345678`.

### Dữ liệu thật
- Còn dùng `lib/mock-data.ts`: `app/student/page.tsx`, `app/teacher/tests/page.tsx`, `app/teacher/tests/create/page.tsx`.
- Hai lớp truy cập dữ liệu chạy song song: `lib/db-pg.ts` (pg trực tiếp — auth, admin, teacher) và Supabase client (`api/exam/*`, `api/submissions`). Cần chốt một hướng.
- Theo `FEATURE_INDEX.md`: kết quả nộp bài còn lưu tạm, trang chấm bài viết cứng tên đề `test_01`, QR thanh toán là ảnh tĩnh.

### Tính năng dở
- Worker tiêu thụ Redis Streams chạy liên tục (có `worker/grading-worker.js`, cần xác minh đã chạy trong docker-compose chưa).
- Thu âm Speaking (MediaRecorder) + chấm tự động.
- QR VietQR động theo số tiền.

### Hạ tầng phát triển
- **Không có test nào, không có test runner** trong `package.json` → chưa thể áp dụng `tests.lock`/`verify.sh` đúng nghĩa.
- Chưa có `CONTEXT.md` (bất biến nghiệp vụ) mà template brief tham chiếu.
- `FEATURE_INDEX.md` lệch thực tế (nhắc `app/admin/orders`, `app/admin/slots` không tồn tại).
- `.gitignore` bỏ qua `*.md` và `/docs/` → tài liệu mới sẽ không được commit nếu không `git add -f`.
- File quá lớn: `app/teacher/tests/create/page.tsx` (~2.900 dòng), `app/student/exam/[examId]/page.tsx` (~2.500 dòng).
- Rác: `scratch/`, `scratch_inspect_neo4j.cjs`, `README.md` mặc định của create-next-app.

## 3. Kế hoạch

| Đợt | Hạng mục | Người làm |
| :--- | :--- | :--- |
| ✅ 0 | Thêm Vitest + script `npm test`; viết `CONTEXT.md` (vai trò, bất biến RBAC, quy ước API); sửa `.gitignore` cho `docs/`, `*.md` | Claude |
| ✅ 1 | **TASK-001** (đã nghiệm thu) helper `requireAuth/requireRole` + gắn vào toàn bộ API admin/exam/submissions/events/tts; middleware bảo vệ `/student`; khoá hoặc xoá `api/admin/test-*` | Antigravity (Claude viết test) |
| ✅ 1 | **TASK-002** (đã nghiệm thu, mở rộng: gỡ chuỗi kết nối DB, key Supabase, nhánh login legacy, seed plaintext) bỏ JWT secret dự phòng (fail-fast trong `lib/env-check.ts`), bỏ so sánh plaintext, bỏ số điện thoại mặc định | Antigravity |
| 2 | Chốt lớp dữ liệu (pg trực tiếp hay Supabase) → **TSK-03** thống nhất | Người dùng quyết, Antigravity làm |
| 2 | **TSK-04** gỡ `mock-data` khỏi 3 trang; **TSK-05** lưu bài nộp vào `submissions`, trang chấm bài lấy tên đề thật | Antigravity |
| 3 | **TSK-06** worker Redis daemon; **TSK-07** thu âm + chấm Speaking (qua `/grill-feature`); **TSK-08** VietQR động | Antigravity |
| 4 | Tách 2 trang lớn thành component; dọn rác; cập nhật `FEATURE_INDEX.md`, `README.md` | Antigravity + Claude |

## 4. Tiến độ 31/10/2026
- ✅ TASK-003 API học sinh pg (migration 004: `enrollments`, `class_assignments`)
- ✅ TASK-004 trang dashboard / lớp / analytics học sinh dùng API pg; xoá `/student/test/[id]`
- ✅ TASK-005 trang làm bài / xem lại / tham gia lớp qua link dùng API pg; route công khai `classes/lookup`
- ✅ Deploy lên server 192.168.1.36 (ghi đè code server cũ theo quyết định người dùng; sao lưu `edusystem-backup-20261031.tar.gz`)

### Còn lại
- **TASK-006** chấm trắc nghiệm phía server, không gửi đáp án xuống trình duyệt (hiện client tự chấm và gửi `auto_graded_score`)
- Khu admin (students, students/[id], requests, accounts, teachers, profile) → API pg
- Khu giáo viên (classes, classes/[classId], slots, students/create, grading, flashcards) → API pg
- Trang tạo đề `teacher/tests/create`, `teacher/tests` → API pg, gỡ `mock-data`
- `app/student/page.tsx` (danh mục khoá học / đặt mua) — cần quyết định mô hình giá
- Upload audio Speaking + ảnh flashcard qua Supabase Storage từ trình duyệt → chuyển qua API
- Gỡ hẳn `lib/supabase.ts` (client trình duyệt) khi không còn trang nào dùng
- `api/exam/*` còn dùng `supabase-server` → chuyển sang `queryPg`
- Tài khoản học sinh trên server còn mật khẩu plaintext (4 tài khoản) → đặt lại mật khẩu
