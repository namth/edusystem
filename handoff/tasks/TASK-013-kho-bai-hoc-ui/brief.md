# TASK-013 — Giao diện Kho bài học, soạn bài, bộ chọn bài học trong lộ trình

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Giao diện giáo viên của FEAT-010 (backend đã có ở TASK-008, component soạn câu hỏi dùng chung ở TASK-010):
- **SCR-L1** `/teacher/lessons` — Kho bài học.
- **SCR-L2** `/teacher/lessons/[id]` — soạn bài học (`id = new` để tạo) bằng `QuestionSetEditor` chế độ `LESSON`.
- **SCR-L4** — trong trang lộ trình `/teacher/tests`, thêm bài học = **chọn từ kho** (gửi `lesson_id`), thay cho nhập tiêu đề trống (API đã bắt buộc `lesson_id`, nên hiện tại thêm bài học trong cây đang bị lỗi 400).
- Menu giáo viên thêm "Kho Bài Học".

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 4 (SCR-L1, L2, L4), mục 6 (Kho bài học, Lộ trình), mục 7 (BR-L02, BR-L03)
- `app/api/teacher/lessons/route.ts`, `app/api/teacher/lessons/[id]/route.ts` — hình dạng phản hồi
- `components/question-builder/QuestionSetEditor.tsx` — props (`mode`, `initial*`, `onSave` trả `{ ok, error? }`)
- `app/teacher/tests/create/page.tsx` — mẫu dùng `QuestionSetEditor` cho đề thi
- `app/teacher/tests/page.tsx` — modal thêm mục (`modalType`, `handleSubmitModal`), cách cập nhật cây tại chỗ (TASK-006)
- Test: `tests/lesson-library-ui.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/teacher/lessons/page.tsx` (mới)
- `app/teacher/lessons/[id]/page.tsx` (mới)
- `app/teacher/tests/page.tsx` (chỉ phần modal thêm/sửa mục `LESSON` + liên kết sửa bài học trên nút LESSON)
- `components/TeacherLayout.tsx` (thêm 1 mục menu)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/**`, mọi route API, `components/question-builder/**`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết
Chung: client component, `fetch` API, đủ 4 trạng thái (đang tải / lỗi + "Thử lại" / rỗng / dữ liệu), lỗi API hiện `json.error`; không import `@/lib/supabase`, `@/lib/neo4j`, `@/lib/db-pg`, `@/lib/mock-data`; bọc trong `TeacherLayout` như các trang giáo viên khác; giữ phong cách giao diện hiện có.

### 4.1 SCR-L1 `app/teacher/lessons/page.tsx`
- `GET /api/teacher/lessons?q=&skill=` (dựng bằng `URLSearchParams`; tìm kiếm debounce ~300ms; lọc kỹ năng: Tất cả / Reading / Listening / Writing).
- Bảng/thẻ: tiêu đề, mô tả ngắn, kỹ năng (chip), `block_count` khối, "Dùng trong `usage_count` khóa", cập nhật lúc (`vi-VN`). Bấm dòng → `/teacher/lessons/{id}`.
- Nút "Tạo bài học" → `/teacher/lessons/new`.
- Xoá: xác nhận → `DELETE /api/teacher/lessons/{id}`; `200` → bỏ khỏi danh sách tại chỗ; `409` → hộp thông báo liệt kê `json.usages` (tên khóa `course_title`) kèm hướng dẫn "Gỡ bài học khỏi lộ trình trước khi xoá" (DEC-005).
- Rỗng (không lọc): "Chưa có bài học nào — Tạo bài học đầu tiên"; rỗng khi đang lọc: "Không tìm thấy bài học phù hợp".

### 4.2 SCR-L2 `app/teacher/lessons/[id]/page.tsx`
- `id === "new"`: render `QuestionSetEditor mode="LESSON"` trống. `onSave(payload)`: `POST /api/teacher/lessons { title, description }` → lấy `lesson.id` → `PUT /api/teacher/lessons/{id} { question_ids: payload.question_ids }` → thành công `router.replace("/teacher/lessons/" + id)` và trả `{ ok: true }`; lỗi trả `{ ok: false, error }`.
- `id` có sẵn: `GET /api/teacher/lessons/{id}` → truyền `initialTitle`, `initialDescription`, `initialQuestions = json.questions`, `initialFlashcards = json.flashcards`; `onSave` → `PUT /api/teacher/lessons/{id} { title, description, question_ids }`.
- Trạng thái: `403` → "Bạn không có quyền xem bài học này"; `404` → "Không tìm thấy bài học" (kèm link về `/teacher/lessons`); lỗi khác → thông báo + "Thử lại".
- Nút "← Kho bài học" ở đầu trang.

### 4.3 SCR-L4 trong `app/teacher/tests/page.tsx`
- Khi mở modal với `modalType === "LESSON"`: tải `GET /api/teacher/lessons` (một lần, có thể cache trong state); hiển thị ô tìm + danh sách chọn một bài học (tiêu đề, số khối). Bài học `block_count === 0` hiển thị mờ với ghi chú "Chưa có nội dung" và không chọn được (BR-L03).
- Tiêu đề mục mặc định = tiêu đề bài học đã chọn (cho sửa).
- Gửi `POST /api/teacher/curriculum` với `lesson_id: <id đã chọn>` (giữ `course_id`, `parent_id`, `type: "LESSON"`); sửa mục LESSON → `PUT` kèm `lesson_id`. Giữ cơ chế cập nhật cây tại chỗ của TASK-006.
- Liên kết "Tạo bài học mới" mở `/teacher/lessons/new` ở **tab mới** (`target="_blank"`) và nút "Tải lại danh sách".
- Trên mỗi nút `LESSON` trong cây có biểu tượng sửa dẫn tới `` `/teacher/lessons/${item.lesson_id}` `` (khi có `lesson_id`).
- Không đổi luồng UNIT / EXAM.

### 4.4 Menu
`components/TeacherLayout.tsx`: thêm `{ href: "/teacher/lessons", label: "Kho Bài Học", icon: <icon lucide phù hợp, vd BookMarked> }` ngay sau mục "Soạn & Tạo Đề Thi".

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Tạo bài học mới → thêm khối câu hỏi → lưu → gắn vào lộ trình hoạt động trọn luồng
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách kiểm tra chuỗi.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-013`). `npx`, `git`, `find`, `ls`, `rm` đều bị từ chối quyền — đọc/ghi file bằng công cụ file.
- `app/teacher/tests/page.tsx` dài: chỉ sửa phần modal LESSON và nút sửa trên nút LESSON; không định dạng lại file, không đổi logic kéo thả.
- Dùng `QuestionSetEditor` như component có sẵn, không sửa nó.
- Không thêm thư viện mới.
