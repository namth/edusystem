# TASK-004 — Trang học sinh dùng API pg, bỏ Supabase client và dữ liệu giả

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
TASK-003 đã có API học sinh trên PostgreSQL. Task này chuyển 3 trang học sinh sang gọi các API đó bằng `fetch`, bỏ hẳn Supabase client trong trình duyệt và **mọi dữ liệu giả/fallback** (hiện khi DB trống, trang vẫn hiện đề "IELTS Mock Test #01", giáo viên "Thầy Nguyễn Văn Đức"…). Thêm `GET /api/exams` cho ngân hàng đề luyện tập và xoá trang cũ `/student/test/[id]`.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3, 4
- Các route của TASK-003: `app/api/student/classes/route.ts`, `app/api/student/classes/[classId]/route.ts`, `app/api/student/enroll/route.ts`, `app/api/exams/[id]/route.ts`, `app/api/submissions/route.ts` — đọc để biết đúng hình dạng phản hồi
- Test: `tests/student-pages.test.ts`

## 3. Phạm vi file
**Được tạo/sửa/xoá:**
- `app/api/exams/route.ts` (mới)
- `app/student/dashboard/page.tsx`
- `app/student/class/[classId]/page.tsx`
- `app/student/analytics/page.tsx`
- Xoá cả thư mục `app/student/test/` (trang `/student/test/[id]` dùng schema đề cũ — `reading_passage`, `reading_questions`… — không còn trong DB và không có liên kết nào trỏ tới)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, mọi route API khác (kể cả của TASK-003)
- `app/student/page.tsx`, `app/student/exam/**` (task sau), `lib/**`, `context/**`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết

### 4.1 `GET /api/exams`
- `requireRole()` (mọi vai trò đã đăng nhập) ở dòng đầu.
- `SELECT id, title, duration_minutes, skills, created_at FROM exams ORDER BY created_at DESC` → `200 { success: true, exams }`. **Không** trả `stimulus_text`, `question_ids`, đáp án hay nội dung đề.

### 4.2 Quy ước chung cho 3 trang
- Gọi API bằng `fetch` (same-origin, cookie tự gửi). Đọc `json.success`; khi `!res.ok` hiển thị `json.error`.
- Mỗi trang có đủ 4 trạng thái: **đang tải** (giữ spinner/skeleton hiện có), **lỗi** (khối thông báo đỏ nhạt + nút "Thử lại" gọi lại hàm tải), **rỗng** (thông điệp tiếng Việt + gợi ý hành động), **có dữ liệu**.
- Không import `@/lib/supabase`, `@/lib/neo4j`, `@/lib/mock-data`, `@/lib/db-pg`.
- Không còn dữ liệu giả/fallback: xoá mọi danh sách "starter"/"demo", tên giáo viên, sĩ số, tiêu đề đề thi, id `student_01`/`teacher_01`/`test_01` viết cứng. Không dùng `user?.id || "..."`.
- Giữ nguyên giao diện (class Tailwind, bố cục, màu) — chỉ thay nguồn dữ liệu và thêm trạng thái lỗi/rỗng.

### 4.3 `app/student/dashboard/page.tsx`
- Lớp của tôi: `GET /api/student/classes` → map `{ id, name, code, schedule }`. Xoá `teacherName`, `studentCount` giả và chỗ hiển thị chúng (hoặc ẩn khi không có dữ liệu thật).
- Bài nộp gần đây: `GET /api/submissions` → lấy 5 bài đầu.
- Ghi danh: `POST /api/student/enroll` với `{ code }`. Thông điệp:
  - `200` + `alreadyEnrolled: true` → "Bạn đã tham gia lớp này từ trước rồi!"
  - `200` + `alreadyEnrolled: false` → `Đã tham gia lớp "<tên lớp>" thành công!` rồi tải lại danh sách lớp
  - `404` → "Mã lớp không hợp lệ hoặc không tồn tại!"
  - `409` → "Lớp học đã đủ chỗ, vui lòng liên hệ giáo viên."
  - khác → `json.error` hoặc "Đã xảy ra lỗi khi tham gia lớp."
- Xoá đoạn import động `@/lib/neo4j` (server đã đồng bộ Neo4j).

### 4.4 `app/student/class/[classId]/page.tsx`
- `GET /api/student/classes/${classId}`:
  - `403` → trạng thái "Bạn chưa tham gia lớp học này." + link về `/student/dashboard`.
  - `404` → "Không tìm thấy lớp học." + link về `/student/dashboard`.
  - `200` → `classDetail = json.class`; `assignedExams` map từ `json.assignments`: `exam_id`, `assignment_id = a.id`, `title = a.exam?.title`, `duration_minutes = a.exam?.duration_minutes`, `skills = a.exam?.skills ?? []`, `due_date` định dạng `vi-VN` hoặc "Hạn linh hoạt" khi `null`, `max_attempts`, `isOverdue`. Bài có `exam === null` → tiêu đề "Đề thi không còn tồn tại", không có nút làm bài.
  - Tab "đã chấm": từ `json.submissions`, tiêu đề đề lấy theo `exam_id` từ danh sách assignments; điểm `final_score ?? ai_score` (số, có thể `null` → hiển thị "Chưa chấm").
- Tab luyện tập: `GET /api/exams` → `json.exams`.
- Rỗng: không có bài giao → "Giáo viên chưa giao bài nào cho lớp này."; không có bài đã chấm → "Bạn chưa có bài nào được chấm.".

### 4.5 `app/student/analytics/page.tsx`
- `GET /api/submissions` + `GET /api/exams` (map tiêu đề theo `exam_id`; không tìm thấy → "Đề thi đã xoá").
- Điểm: `final_score ?? ai_score` (Number). Điểm kỹ năng lấy từ cột thật `listening_score`, `reading_score`, `writing_score`, `speaking_score`; `null` → hiển thị "—". **Xoá phần "mô phỏng" tính điểm kỹ năng từ ai_score.**
- `avgScore` khởi tạo `null`; chỉ tính trên các bài có điểm. Không có bài → trạng thái rỗng "Bạn chưa làm bài thi nào." + link `/student/dashboard`, không hiện biểu đồ giả.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] 3 trang có đủ 4 trạng thái (tải / lỗi + Thử lại / rỗng / dữ liệu) như mục 4
- [ ] Không còn dữ liệu giả, không đổi giao diện ngoài phần cần thêm
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa/xoá

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không "lách" kiểm tra chuỗi bằng cách ghép chuỗi (`"student_" + "01"`) hay chuyển dữ liệu giả sang file khác.
- Không gọi API khác ngoài các API liệt kê ở mục 4; không tạo route mới ngoài `GET /api/exams`.
- Không dùng `useAuth().user.id` làm tham số truy vấn — server tự lấy từ cookie.
- Không thêm thư viện mới; không đổi `context/AuthContext.tsx`.
- Trang là client component (`"use client"`), giữ nguyên.
