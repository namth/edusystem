# Danh mục tính năng

> Cập nhật 31/10/2026. Nguồn chuẩn: `CONTEXT.md` (bất biến), `docs/14-decisions.md` (DEC), `docs/features/*.md` (đặc tả), `handoff/KE-HOACH.md` (tiến độ).

## Nền tảng & bảo mật
- Đăng nhập JWT HS256 trong cookie httpOnly; mật khẩu băm scrypt; không bí mật viết cứng (`JWT_SECRET`, `DATABASE_URL`… bắt buộc từ môi trường).
- Mọi API route kiểm tra phiên/vai trò bằng `lib/api-auth.ts` (`requireRole`, token nội bộ cho worker). Ngoại lệ công khai có chủ đích: `app/api/auth/*`, `app/api/classes/lookup/[ref]`.
- Trình duyệt không truy cập DB: mọi dữ liệu qua API route dùng `queryPg`. Upload file qua `/api/uploads` (server đẩy lên Supabase Storage bằng service role).
- Test: Vitest + PGlite (Postgres thật trong bộ nhớ), `npm test`.

## Giáo viên
- **Khóa học & lộ trình** (`/teacher/tests`): cây unit → bài học/đề, kéo thả cập nhật tại chỗ; chuẩn chấm mặc định của khóa.
- **Kho đề** & soạn đề (`/teacher/tests/create`): `QuestionSetEditor` 15 dạng câu, chọn chuẩn chấm; **AI Import** DOCX/PDF/ảnh (FEAT-009).
- **Kho bài học** (`/teacher/lessons`, FEAT-010): soạn bài từ khối câu hỏi dùng chung, xem trước như học sinh, gắn vào lộ trình.
- **Thư viện flashcard** dùng chung (`/teacher/flashcards`).
- **Lớp học** (`/teacher/classes`): tạo lớp, mã lớp, thêm học sinh (mật khẩu tạm), giao đề; tab Lộ trình: chế độ mở bài (thủ công / mở hết / tuần tự), ngưỡng hoàn thành, mở riêng cho học sinh, bảng tiến độ.
- **Chấm bài** (`/teacher/grading`): sửa điểm từng kỹ năng theo chuẩn chấm; **mua slot AI** (`/teacher/slots`, giá tính ở server).

## Học sinh
- Trang chủ: lớp của tôi + tham gia lớp bằng mã (không bán khóa học trên app — DEC-019); tham gia qua link mời `/join/[classId]`.
- Tab **Lộ trình** trong lớp; **làm bài học** (`/student/lesson/[id]`): chấm khách quan ngay, AI chấm tự luận nền, làm lại không giới hạn.
- **Làm đề** (`/student/exam/[id]`, FEAT-011): giờ theo server, chia phần kỹ năng, ghi âm Speaking, chấm theo chuẩn (IELTS/TOEIC/HSK/Thang 10…), xem lại kết quả; analytics.

## Admin
- Tài khoản, học sinh, giáo viên, lớp; duyệt đơn mua slot (tự cộng slot).
- **Chuẩn chấm điểm** (`/admin/scoring-standards`): phần thi theo kỹ năng, quy đổi tuyến tính / bảng tra, quy tắc tổng; rubric tiêu chí AI (`/admin/rubrics`); cấu hình model AI (`/admin/settings`).

## Hạ tầng
- PostgreSQL (`lib/db-pg.ts`, `ensureSchema` chạy migration `docs/db-migration-00*.sql`), Neo4j (đồng bộ phụ), Redis Streams + `worker/grading-worker.js` (chấm AI nền bài học & đề thi).
- Deploy: `scripts/deploy.sh` (build image ở máy local, đẩy lên server). Phối hợp Antigravity: `handoff/`, `scripts/handoff.py`, `scripts/agy-worktree.sh` (worktree song song, 2 tài khoản, máy thợ qua SSH).

## Chưa làm / ngoài phạm vi
- Bán khóa học cho học sinh (DEC-019).
- Cổng thanh toán tự động cho đơn mua slot (đang duyệt tay).
- Dạng Speaking trong bài học (chỉ có trong đề thi).
