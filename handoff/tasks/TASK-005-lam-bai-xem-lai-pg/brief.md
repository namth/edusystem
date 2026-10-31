# TASK-005 — Trang làm bài, xem lại bài, tham gia lớp qua link dùng API pg

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Ba trang còn đọc DB trực tiếp bằng Supabase client trong trình duyệt: trang làm bài `app/student/exam/[examId]`, trang xem lại bài `app/student/exam/review/[submissionId]`, trang mời vào lớp `app/join/[classId]`. Task này tạo 3 API route pg và chuyển 3 trang sang dùng chúng, bỏ các fallback giả (lấy toàn bộ ngân hàng câu hỏi khi đề trống, lấy "lớp đầu tiên" khi sai mã, tên giáo viên viết cứng…).
**Ngoài phạm vi (TASK-006 làm sau):** chấm điểm phía server và ẩn đáp án — giữ nguyên cách chấm hiện tại.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2, 3, 9) — chú ý ngoại lệ route công khai `app/api/classes/lookup/[ref]`
- `lib/api-auth.ts`, `lib/auth.ts` (`getAuthenticatedUserFromCookie`), `app/api/student/enroll/route.ts` (đã có)
- Test: `tests/exam-flow.test.ts`, `tests/helpers/pg-fake.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/exams/[id]/content/route.ts` (mới)
- `app/api/submissions/[id]/route.ts` (mới)
- `app/api/classes/lookup/[ref]/route.ts` (mới)
- `app/student/exam/[examId]/page.tsx`
- `app/student/exam/review/[submissionId]/page.tsx`
- `app/join/[classId]/page.tsx`

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, các route API đã có (kể cả `app/api/submissions/route.ts`)
- `lib/**` (kể cả `lib/audio-storage.ts` — upload audio Speaking giữ nguyên ở task này), `context/**`, `middleware.ts`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết
SQL luôn tham số hoá. Lỗi `{ success: false, error: "<tiếng Việt>" }`. `params` là `Promise<…>`; với route cần đăng nhập, kiểm quyền trước khi `await params`.

### 4.1 `GET /api/exams/[id]/content` — `requireRole()` (mọi vai trò đã đăng nhập)
- Không có đề → 404.
- `questions`: các dòng bảng `questions` có id thuộc `exam.question_ids` (JSONB mảng chuỗi), **giữ đúng thứ tự** trong `question_ids`, bỏ qua id không còn tồn tại. `question_ids` null/rỗng → `[]` (**không** trả toàn bộ ngân hàng câu hỏi).
- `flashcards`: các dòng bảng `flashcards` được tham chiếu bởi câu hỏi có `category` chứa `FLASHCARD`, lấy id từ `content.flashcard_ids` hoặc `content.flashcardIds`. Không có → `[]`.
- `200 { success: true, exam, questions, flashcards }` (trả nguyên các cột như hiện trang đang dùng).

### 4.2 `GET /api/submissions/[id]` — `requireRole()`
- Không có bài → 404. `STUDENT` mà `student_id !== userId` → 403. TEACHER/ADMIN xem được.
- `200 { success: true, submission, exam, questions }`: `exam` là dòng `exams` theo `submission.exam_id` hoặc `null` nếu đã xoá; `questions` theo thứ tự `exam.question_ids` (cùng quy tắc 4.1), `[]` nếu không có đề/không có id.

### 4.3 `GET /api/classes/lookup/[ref]` — **công khai** (không bắt đăng nhập)
- Tìm lớp có `id = $1` hoặc `UPPER(code) = UPPER($1)`. Không có → 404 (**không** trả lớp khác thay thế).
- `200 { success: true, class: { id, name, code, schedule, max_slots, teacher_name, enrolled_count, is_enrolled } }` — **chỉ đúng 8 trường này**:
  - `teacher_name`: `users.name` của `teacher_id`, không có → `null`.
  - `enrolled_count`: số dòng `enrollments` của lớp, kiểu `number`.
  - `is_enrolled`: `true` khi cookie hợp lệ là `STUDENT` đã ghi danh lớp này (đọc bằng `getAuthenticatedUserFromCookie`, không có phiên cũng không lỗi); ngược lại `false`.

### 4.4 `app/student/exam/[examId]/page.tsx`
- Thay toàn bộ phần tải đề (exam, questions, flashcards) bằng một lời gọi `GET /api/exams/${examId}/content`. Giữ nguyên logic dựng `QuestionItem`, `flashcard_ids`, `flashcards_resolved` (dựng từ `json.flashcards`).
- Xoá nhánh fallback tải toàn bộ `questions` khi đề không có câu hỏi.
- Trạng thái: 404 → "Không tìm thấy đề thi." + link `/student/dashboard`; lỗi khác → thông báo + nút "Thử lại"; đề không có câu hỏi → "Đề thi này chưa có câu hỏi.".
- Body `POST /api/submissions`: **bỏ trường `student_id`** (server lấy từ cookie). Các trường khác giữ nguyên.
- Bỏ import `@/lib/supabase`. `uploadAudioToSupabaseStorage` giữ nguyên.

### 4.5 `app/student/exam/review/[submissionId]/page.tsx`
- Thay bằng `GET /api/submissions/${submissionId}` → `submission`, `exam`, `questions`.
- Xoá fallback "lấy bài mới nhất" và fallback tải toàn bộ câu hỏi.
- 403 → "Bạn không có quyền xem bài nộp này."; 404 → "Không tìm thấy bài nộp." (kèm link `/student/dashboard`); lỗi khác → thông báo + "Thử lại".
- Giữ cơ chế tự tải lại mỗi 3 giây khi `submission.status` là `PENDING_GRADING` hoặc `AI_GRADING_IN_PROGRESS` (dùng status của dữ liệu vừa tải, dọn timer khi unmount).

### 4.6 `app/join/[classId]/page.tsx`
- Thông tin lớp: `GET /api/classes/lookup/${classId}`. 404 → "Link mời không hợp lệ hoặc lớp không còn tồn tại." (không hiển thị lớp khác). Xoá tên giáo viên viết cứng; `teacher_name` null → ẩn dòng giáo viên. `isAlreadyEnrolled = json.class.is_enrolled`.
- Ghi danh: thay `enrollStudent` bằng `POST /api/student/enroll` với `{ code: classInfo.code }` (server tự đồng bộ Neo4j). Xử lý: 200 → vào `/student/dashboard` (hoặc `/change-password` nếu `mustChangePassword` như hiện tại); 409 → "Lớp học đã đủ chỗ, vui lòng liên hệ giáo viên."; 403 → "Chỉ tài khoản học sinh mới tham gia lớp được."; khác → `json.error`.
- Sau đăng ký: `register()` của AuthContext đã tự đăng nhập (cookie được đặt) → gọi thẳng `POST /api/student/enroll`. Xoá `supabase.auth.getUser()`.
- Sau đăng nhập: gọi `POST /api/student/enroll` như trên (không truyền id người dùng).
- Bỏ import `@/lib/supabase` và `@/lib/neo4j`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] 3 trang có trạng thái tải / lỗi / rỗng như mục 4, giao diện giữ nguyên ngoài phần thêm
- [ ] Route công khai `classes/lookup` chỉ trả đúng 8 trường
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách kiểm tra chuỗi bằng ghép chuỗi hay dời dữ liệu giả sang file khác.
- **Không chạy lệnh shell để dò/xoá file** (`find`, `ls`, `rm`, `git rm` từng bị từ chối) — đọc/ghi file bằng công cụ file; chỉ chạy `python3 scripts/handoff.py …` và `npx vitest`/`npx tsc` khi cần.
- Không đổi cách chấm điểm/`auto_graded_score` (TASK-006); không đổi `app/api/submissions/route.ts`.
- `COUNT(*)` trên pg thật trả chuỗi → `Number(...)`.
- Route `classes/lookup` không được gọi `requireRole` (nó công khai) nhưng tuyệt đối không trả `teacher_id`, email, sđt hay danh sách học sinh.
- Không thêm thư viện mới.
