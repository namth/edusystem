# TASK-024 — Hồ sơ, mua slot, trang chấm bài qua API pg

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
- **Bảo mật nghiêm trọng**: `app/profile/page.tsx` ghi thẳng vào `users` từ trình duyệt, gồm cả **`password` dạng thô** và `email`. Chuyển sang API chỉ cho sửa tên/sđt/mục tiêu; đổi mật khẩu dùng `POST /api/auth/change-password` có sẵn.
- `app/teacher/slots/page.tsx` tự chèn đơn mua slot (tự đặt giá) từ trình duyệt → API, giá tính phía server.
- `app/teacher/grading/page.tsx` đọc bài nộp bằng Supabase và gọi `grade-override` theo hợp đồng **cũ** (đã hỏng sau TASK-020) → API danh sách bài nộp + `grade-override` mới (`section_scores`).
- `app/teacher/tests/page.tsx`: bỏ import `@/lib/supabase` không dùng.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 1, 3, 6, 9)
- `app/api/auth/change-password/route.ts`, `app/api/exam/grade-override/route.ts` (hợp đồng mới: `{ submissionId, section_scores: { Writing?, Speaking?, … }, feedback? }`), `docs/features/exam-server-grading.md` mục 6–7
- Test: `tests/profile-slots-grading.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:** `app/api/profile/route.ts` (mới: GET, PUT), `app/api/teacher/slot-requests/route.ts` (mới: GET, POST), `app/api/teacher/submissions/route.ts` (mới: GET), `app/profile/page.tsx`, `app/teacher/slots/page.tsx`, `app/teacher/grading/page.tsx`, `app/teacher/tests/page.tsx` (chỉ xoá import thừa).

**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, `lib/**`, route đã có (kể cả `grade-override`, `change-password`), trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
Route: `requireRole` dòng đầu; SQL tham số hoá; lỗi `{ success: false, error }`; không bao giờ trả `password`/`reset_token`.
- **`/api/profile`** (mọi vai trò đã đăng nhập, luôn theo `userId` của token): `GET` → `{ user: { id, name, email, role, phone, target_band, slot_limit } }`; `PUT { name?, phone?, target_band? }` — chỉ 3 trường này (bỏ qua `password`, `email`, `role`, `slot_limit`…), `name` trim không rỗng (400) → `200 { success, user }`.
- **`/api/teacher/slot-requests`** (ADMIN, TEACHER): `GET` → đơn của chính người gọi, mới nhất trước; `POST { requested_slots }` — số nguyên 1–10000 (sai 400); `teacher_name`/`teacher_email` lấy từ bảng `users` theo `userId`; `total_cost = requested_slots × Number(process.env.SLOT_UNIT_PRICE_VND || 0)`; `status = 'PENDING'`; `id = "slr_" + crypto.randomUUID()` → `201 { success, slot_request }` (bỏ qua mọi giá/teacher_id client gửi).
- **`GET /api/teacher/submissions?status=`** (ADMIN, TEACHER): TEACHER thấy bài nộp của đề `created_by = userId` **hoặc** `class_ref` là lớp `teacher_id = userId`; ADMIN tất cả. Mỗi dòng `{ id, exam_id, exam_title, student_id, student_name, status, class_ref, section_scores, total_score, passed, is_late, submitted_at, created_at }`, `created_at DESC`; `status` lọc theo giá trị (tuỳ chọn).
- **Trang hồ sơ**: tải `GET /api/profile`, lưu `PUT /api/profile`; khối đổi mật khẩu riêng gọi `POST /api/auth/change-password` (theo body route đó đang nhận); email chỉ hiển thị.
- **Trang slot**: danh sách từ `GET`, mua qua `POST`, hiện tổng tiền server trả về.
- **Trang chấm bài**: danh sách từ `GET /api/teacher/submissions` (lọc "Chờ chấm" = `NEEDS_REVIEW`, "Đang chấm AI" = `GRADING`, "Đã chấm"); chọn bài → hiện `section_scores` từng kỹ năng; ô nhập điểm cho các kỹ năng (ưu tiên Writing/Speaking) + nhận xét → `PUT /api/exam/grade-override { submissionId, section_scores, feedback }`; hiện lỗi 400 (điểm ngoài thang) từ API. Bỏ logic cũ (`questionId`, `overriddenScore`, `teacher_01`).
- Bỏ import `@/lib/supabase` ở 4 trang.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-024`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không import module server vào component client (có test chặn). Không thêm thư viện mới.
