# TASK-010 — Tách QuestionSetEditor dùng chung, API ghi đề thi, trang tạo đề lưu qua API

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
`app/teacher/tests/create/page.tsx` (~2.970 dòng) đang: ghi đề và câu hỏi **thẳng vào Supabase từ trình duyệt**, import `@/lib/neo4j` ở trình duyệt, dùng `INITIAL_COURSES` (dữ liệu giả) và id cứng `usr_teacher_01`. Task này:
1. Thêm API ghi đề thi (`POST /api/teacher/exams`, `GET/PUT /api/teacher/exams/[id]`), đồng bộ Neo4j và phát sự kiện ở **server**.
2. Chuyển toàn bộ phần soạn câu hỏi sang component dùng chung `components/question-builder/QuestionSetEditor.tsx` có `mode: "EXAM" | "LESSON"` — TASK-011 sẽ dùng chế độ `LESSON` cho trang soạn bài học.
3. Trang tạo đề còn là lớp vỏ mỏng: tải đề qua API khi sửa, gọi API khi lưu.

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 6 (Câu hỏi), DEC-002, DEC-011
- `app/api/teacher/questions/route.ts`, `app/api/teacher/questions/[id]/route.ts` (TASK-008 — API lưu câu hỏi)
- `app/api/teacher/lessons/[id]/route.ts` (mẫu trả câu hỏi theo thứ tự + flashcards), `app/api/teacher/exams/route.ts` (GET hiện có — giữ nguyên)
- `lib/neo4j.ts` (`syncCourseExam`, `runCypherQuery`, `getExamCourseMapping`), `lib/redis-queue.ts` (`pushRedisStreamEvent`)
- Test: `tests/exams-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/teacher/exams/route.ts` (thêm POST; GET giữ nguyên hành vi)
- `app/api/teacher/exams/[id]/route.ts` (mới: GET, PUT)
- `components/question-builder/QuestionSetEditor.tsx` (mới — chuyển code từ trang tạo đề sang)
- `components/question-builder/*` (được tách thêm file con nếu cần, tối đa 5 file)
- `app/teacher/tests/create/page.tsx` (thu gọn thành vỏ)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-00*.sql`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/**`, các route API khác, `components/teacher/AiExamIngestionStudio.tsx` (chỉ import)
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết

### 4.1 API đề thi — `requireRole(["ADMIN","TEACHER"])` dòng đầu; route `[id]` kiểm quyền trước `await params`
Quyền: đọc/sửa đề — ADMIN mọi đề; TEACHER chỉ đề `created_by = userId` (khác → 403). Khóa học hợp lệ: tồn tại và TEACHER đọc được (`created_by = userId` hoặc `IS NULL`). Câu hỏi dùng được: tồn tại và (ADMIN hoặc `created_by = userId` hoặc `created_by IS NULL`) — giống `canUseQuestion` của TASK-008.
- **POST** `{ title, description?, duration_minutes?, question_ids, course_id? }`:
  - 400 khi: `title.trim()` rỗng hoặc > 255; `question_ids` không phải mảng chuỗi hoặc rỗng; có câu không dùng được; `duration_minutes` có gửi nhưng không phải số nguyên ≥ 1; `course_id` có gửi nhưng không hợp lệ. Không ghi gì.
  - `id = "exam_" + crypto.randomUUID()`; `duration_minutes` mặc định 60; `skills` = `questions.skill` không trùng theo thứ tự `question_ids`; `created_by = userId`; `description` lưu cột `description`.
  - Có `course_id` → `syncCourseExam(course_id, course.title, examId, title)` trong `try/catch` (lỗi chỉ log). Luôn `pushRedisStreamEvent("stream:learning:exams", "EXAM_CREATED", { courseId, exam: { id, title, duration_minutes, skills } })` trong `try/catch`.
  - `201 { success, exam }` (mọi cột).
- **GET `[id]`** → `200 { success, exam, questions, flashcards, course_id }`: `questions` theo đúng thứ tự `question_ids` (giữ đáp án — chỉ giáo viên); `flashcards` = thẻ được câu `*FLASHCARD*` tham chiếu (`content.flashcard_ids`/`flashcardIds`); `course_id` = `getExamCourseMapping()` tìm theo `examId` (lỗi/không có → `null`). Không có đề → 404.
- **PUT `[id]`** `{ title?, description?, duration_minutes?, question_ids?, course_id? }`: validate như POST cho trường gửi lên; chỉ cập nhật trường gửi lên; đổi `question_ids` → tính lại `skills`. Có `course_id` (kể cả `null`) → `runCypherQuery("MATCH (c:Course)-[r:HAS_EXAM]->(e:Exam {id: $examId}) DELETE r", { examId })` rồi (nếu khác null) `syncCourseExam(...)`, trong `try/catch`. `200 { success, exam }`.

### 4.2 `components/question-builder/QuestionSetEditor.tsx`
```ts
"use client";
export interface QuestionSetSavePayload { title: string; description: string; duration_minutes: number; course_id: string | null; question_ids: string[] }
export interface QuestionSetEditorProps {
  mode: "EXAM" | "LESSON";
  initialTitle?: string; initialDescription?: string; initialDuration?: number; initialCourseId?: string | null;
  initialQuestions?: any[];        // dòng bảng questions (đã có id) theo thứ tự
  initialFlashcards?: any[];
  isLoading?: boolean;             // đang tải dữ liệu sửa
  saveLabel?: string;
  onSave: (payload: QuestionSetSavePayload) => Promise<{ ok: boolean; error?: string }>;
  aiIngestProps?: { initialDestinationType?: "standalone" | "curriculum"; initialCourseId?: string; initialUnitId?: string };
}
export default function QuestionSetEditor(props: QuestionSetEditorProps): JSX.Element;
```
- **Chuyển gần như nguyên văn** toàn bộ UI soạn câu hỏi (mọi dạng câu, xem trước, sửa/xoá câu con, flashcard, TTS, phát thử audio…) từ trang tạo đề vào component. Không đổi giao diện, không đổi cách dựng `content` (vẫn `buildStandardQuestionContent`).
- Dựng dữ liệu câu hỏi ban đầu từ `initialQuestions`/`initialFlashcards` theo đúng logic map hiện có của luồng `editId` trong trang.
- **Lưu**: với từng câu theo thứ tự, câu đã có id trong DB → `PUT /api/teacher/questions/{id}`, câu mới → `POST /api/teacher/questions`; lấy `question.id` trả về để dựng `question_ids`; lỗi bất kỳ → dừng, hiện lỗi, không gọi `onSave`. Sau đó gọi `props.onSave(payload)` và hiện lỗi trả về nếu `ok: false`.
- Danh sách khóa học (chọn khóa) lấy từ `GET /api/teacher/courses` thay `INITIAL_COURSES`.
- `mode === "EXAM"`: như hiện tại (thời gian làm bài, chọn khóa học, tab "AI" dùng `AiExamIngestionStudio` với `aiIngestProps`). `mode === "LESSON"`: **ẩn** thời gian làm bài, chọn khóa học, tab AI; đổi nhãn "Tên đề thi" → "Tên bài học".
- Phần thư viện flashcard (`flashcards`) và upload audio (`supabase.storage`) được giữ nguyên cách cũ trong task này (sẽ chuyển ở task sau) — nhưng **không** còn `supabase.from("questions")`, `supabase.from("exams")`.

### 4.3 `app/teacher/tests/create/page.tsx` — vỏ < 400 dòng
- Giữ `Suspense` + `useSearchParams` hiện có (`editId`, `tab`, `mode`, `source`, `courseId`, `unitId`).
- `editId` → `GET /api/teacher/exams/${editId}` → truyền `initialTitle/Description/Duration/CourseId/Questions/Flashcards`; lỗi → thông báo + nút "Thử lại".
- `onSave`: chưa có `editId` → `POST /api/teacher/exams`, có → `PUT /api/teacher/exams/${editId}`; thành công → hiện thông báo như cũ rồi chuyển về `/teacher/tests` như hành vi hiện tại.
- Bỏ mọi import `@/lib/supabase`, `@/lib/neo4j`, `@/lib/mock-data`; không còn `usr_teacher_01`, không gọi `/api/events` (server đã phát sự kiện).

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] Trang tạo đề hiển thị và hoạt động như cũ (tạo mới, sửa đề, mọi dạng câu, xem trước, AI Import)
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa, ghi rõ phần nào còn dùng Supabase (flashcard, storage)

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách kiểm tra chuỗi (ghép chuỗi, dời sang file khác ngoài `components/question-builder/`).
- **Không chạy lệnh shell để dò/xoá file, không chạy git** — dùng công cụ đọc/ghi file; chỉ chạy `python3 scripts/handoff.py …`, `npx vitest`, `npx tsc`.
- Đây là **chuyển code**, không viết lại: giữ nguyên state, handler, JSX của phần soạn câu hỏi; chỉ thay nguồn dữ liệu và chỗ lưu.
- `next build` phải còn chạy được: component client không được import module chỉ chạy server (`pg`, `neo4j-driver`, `lib/db-pg`, `lib/neo4j`).
- Không thêm thư viện mới.
