# TASK-008 — API câu hỏi dùng chung, Kho bài học, lộ trình nhận lesson_id

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Backend của FEAT-010 phía giáo viên: (1) API tạo/sửa câu hỏi dùng chung cho đề & bài học (thay việc trang tạo đề ghi Supabase trực tiếp — trang sẽ chuyển ở TASK-009); (2) CRUD Kho bài học; (3) nút `LESSON` trong lộ trình bắt buộc trỏ `lesson_id`. Thêm migration 007 (`questions.created_by`) vào `ensureSchema`.

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 2, 5, 6, 7 (BR-L01 → BR-L03)
- `docs/14-decisions.md` DEC-002, DEC-004, DEC-005, DEC-012
- `docs/db-migration-006-lessons.sql`, `docs/db-migration-007-question-owner.sql`
- `app/api/teacher/curriculum/route.ts` (TASK-006 — mở rộng, giữ nguyên hành vi cũ), `lib/api-auth.ts`, `lib/question-content-types.ts` (`buildStandardQuestionContent`, union `QuestionCategory`)
- Test: `tests/lessons-api.test.ts`, `tests/curriculum-api.test.ts` (đã cập nhật cho `lesson_id`)

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/questions/route.ts` (mới, POST)
- `app/api/teacher/questions/[id]/route.ts` (mới, PUT)
- `app/api/teacher/lessons/route.ts` (mới, GET/POST)
- `app/api/teacher/lessons/[id]/route.ts` (mới, GET/PUT/DELETE)
- `app/api/teacher/curriculum/route.ts`
- `lib/db-pg.ts` (chỉ thêm DDL migration 007 vào `ensureSchema`)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-00*.sql`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/grading.ts`, `lib/question-content-types.ts`, các trang `app/**/page.tsx`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết
Mọi handler: `requireRole(["ADMIN","TEACHER"])` dòng đầu; route có `[id]` kiểm quyền trước khi `await params`. SQL tham số hoá. Lỗi `{ success: false, error }` tiếng Việt.

### 4.1 Câu hỏi
**Quyền sửa câu hỏi** (`canEditQuestion`): ADMIN luôn được; TEACHER được nếu `questions.created_by = userId`, hoặc `created_by IS NULL` **và** id câu hỏi nằm trong `question_ids` của một `exams` hoặc `lessons` có `created_by = userId` (toán tử JSONB `question_ids ? $id`).
**Quyền dùng câu hỏi** trong bài học (`canUseQuestion`): ADMIN luôn được; TEACHER được nếu `created_by = userId` hoặc `created_by IS NULL`.

- `POST /api/teacher/questions` body `{ skill, category, prompt?, stimulus_text?, stimulus_audio_url?, content }`:
  - 400 nếu `skill` rỗng; `category` không thuộc danh sách hợp lệ (15 dạng của DEC-001 + `SPEAKING_TOPIC_PROMPT`, `SPEAKING_READ_ALOUD`); `content` không phải object.
  - `content` lưu = `buildStandardQuestionContent({ ...body })` nếu hàm trả object, ngược lại giữ `content` gửi lên (đáp án **được giữ** trong DB).
  - `id = "q_" + crypto.randomUUID()`, `created_by = userId`. `201 { success, question }` (mọi cột).
- `PUT /api/teacher/questions/[id]` body như POST, mọi trường tuỳ chọn; không có → 404; không quyền sửa → 403; chỉ cập nhật trường gửi lên (validate như POST). `200 { success, question }`.

### 4.2 Kho bài học (`lessons`, DEC-004)
Quyền với một bài học: ADMIN mọi bài; TEACHER chỉ bài `created_by = userId` (khác → 403).
- `GET /api/teacher/lessons?q=&skill=` → `200 { lessons }`; TEACHER chỉ bài của mình, ADMIN tất cả. Mỗi phần tử: `{ id, title, description, skills, question_ids, block_count, usage_count, created_by, created_at, updated_at }` — `block_count = jsonb_array_length(question_ids)`, `usage_count` = số `curriculum_items` có `lesson_id` này (kiểu `number`). `q`: `title ILIKE '%q%'`; `skill`: `skill = ANY(skills)`. Sắp `updated_at DESC`.
- `POST /api/teacher/lessons` `{ title, description? }` → `title.trim()` 1–255 ký tự (sai → 400); `id = "lsn_" + crypto.randomUUID()`, `question_ids = []`, `skills = {}`, `created_by = userId`. `201 { success, lesson }`.
- `GET /api/teacher/lessons/[id]` → `200 { success, lesson, questions, flashcards }`: `questions` theo đúng thứ tự `question_ids` (bỏ id không còn), **giữ đáp án** (chỉ giáo viên); `flashcards` = các thẻ được câu hỏi có `category` chứa `FLASHCARD` tham chiếu (`content.flashcard_ids` hoặc `content.flashcardIds`).
- `PUT /api/teacher/lessons/[id]` `{ title?, description?, question_ids? }`:
  - `title` validate như POST; `question_ids` phải là mảng chuỗi, mọi id tồn tại và `canUseQuestion` → sai → 400, không ghi gì.
  - Khi đổi `question_ids`: `skills` = danh sách `questions.skill` không trùng theo thứ tự xuất hiện trong `question_ids`.
  - Luôn cập nhật `updated_at = NOW()`. `200 { success, lesson }`.
- `DELETE /api/teacher/lessons/[id]`: đang được `curriculum_items.lesson_id` tham chiếu → `409 { success: false, error, usages: [{ course_id, course_title, curriculum_item_id }] }` (JOIN `courses`), không xoá. Ngược lại xoá dòng `lessons` (**không** xoá câu hỏi) → `200 { success: true }`.

### 4.3 Lộ trình (`app/api/teacher/curriculum/route.ts`)
Giữ nguyên mọi hành vi TASK-006, thêm:
- Mọi item trả về có thêm `lesson_id`.
- **POST** `type = "LESSON"`: bắt buộc `lesson_id`; bài học phải tồn tại, người gọi có quyền với bài học (DEC-004) và `jsonb_array_length(question_ids) ≥ 1` (BR-L03). Sai bất kỳ → 400. `UNIT`/`EXAM` bỏ qua `lesson_id` (lưu NULL).
- **PUT**: cho phép trường `lesson_id` trên item `LESSON`, kiểm tra như POST (sai → 400, cả lô không ghi).

### 4.4 `ensureSchema()`
Thêm nguyên văn DDL `docs/db-migration-007-question-owner.sql` sau phần migration 006.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] Không route nào trả câu hỏi kèm đáp án cho STUDENT (các route này cấm STUDENT)
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách bằng nhánh `NODE_ENV`/`VITEST`.
- **Không chạy lệnh shell để dò/xoá file** — dùng công cụ đọc/ghi file; chỉ chạy `python3 scripts/handoff.py …`, `npx vitest`, `npx tsc`.
- `COUNT(*)`/`jsonb_array_length` có thể trả chuỗi → `Number(...)`.
- Xoá bài học không được xoá câu hỏi (câu hỏi dùng chung với đề).
- Không đổi các test case cũ của lộ trình; `UNIT`/`EXAM` vẫn hoạt động như TASK-006.
- Không thêm thư viện mới.
