# TASK-011 — API học sinh: lộ trình lớp, nội dung bài ẩn đáp án, nộp bài, chấm AI nền

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Backend phía học sinh của FEAT-010: xem lộ trình lớp với trạng thái khoá/mở/hoàn thành, tải nội dung bài học (**không có đáp án**), nộp bài (server chấm khách quan ngay, tự luận chấm AI nền qua worker, trừ slot giáo viên), xem lịch sử làm bài.

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 6 (phần **Học sinh**, **Nội bộ**), mục 7 (BR-L04, BR-L06 → BR-L12, máy trạng thái)
- `docs/14-decisions.md` DEC-008 → DEC-010, DEC-013
- `lib/grading.ts` (`gradeQuestion`, `sanitizeQuestionForStudent`, `sanitizeFlashcardForStudent`, `summarizeResults`, `computeScorePercent`) — **dùng lại, không viết lại**
- `lib/roadmap.ts` (`flattenRoadmap`, `computeRoadmapStates`, `computeProgressPercent`), `lib/roadmap-data.ts` (`loadCompletedItemIds`)
- `lib/api-auth.ts` (`requireRole`, `hasValidInternalToken`), `lib/redis-queue.ts` (`pushRedisStreamEvent`), `lib/ai-engine.ts` (`evaluateWritingSubmission`)
- `worker/grading-worker.js`
- Test: `tests/student-lessons-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/lesson-access.ts` (mới — kiểm tra quyền làm bài dùng chung cho các route)
- `lib/lesson-ai-grading.ts` (mới)
- `app/api/student/classes/[classId]/roadmap/route.ts` (mới)
- `app/api/student/lessons/[lessonId]/route.ts` (mới)
- `app/api/student/lessons/[lessonId]/attempts/route.ts` (mới)
- `app/api/student/attempts/[id]/route.ts` (mới)
- `app/api/lessons/grade-async/route.ts` (mới)
- `worker/grading-worker.js` (thêm nhánh xử lý sự kiện bài học)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-00*.sql`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/grading.ts`, `lib/roadmap.ts`, `lib/roadmap-data.ts`, `lib/db-pg.ts`, mọi route đã có
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết
Route học sinh: `requireRole(["STUDENT"])` dòng đầu, trước `await params`; định danh học sinh **chỉ** từ token (bỏ qua `student_id` trong body/query). SQL tham số hoá; lỗi `{ success: false, error }`.

### 4.1 `lib/lesson-access.ts`
```ts
export async function loadStudentRoadmap(classId: string, studentId: string): Promise<
  | { ok: false; status: 403 | 404; error: string }
  | { ok: true; klass: { id; name; course_id; unlock_mode; pass_percent; teacher_id }; items: RoadmapItem[]; states: Record<string, { state; due_date }> }>;
export async function checkLessonAccess(classId: string, lessonId: string, studentId: string): Promise<
  | { ok: false; status: 400 | 403 | 404; error: string }
  | { ok: true; klass; item: RoadmapItem; lesson: { id; title; description; question_ids } }>;
```
- Lớp không có → 404; học sinh chưa ghi danh (`enrollments`) → 403.
- `items` = `curriculum_items` của `klass.course_id` (không có khóa → `[]`); `states` = `computeRoadmapStates({ items, mode: unlock_mode, unlocks: class_unlocks của lớp, completedItemIds: await loadCompletedItemIds(classId, studentId), studentId })`.
- `checkLessonAccess`: thiếu `classId` → 400; bài học không tồn tại → 404; không có mục `LESSON` nào của khóa lớp trỏ tới `lessonId` → 403 "Bài học không thuộc lộ trình lớp"; mục đó `LOCKED` → 403 "Bài học chưa được mở". `OPEN` hoặc `COMPLETED` → ok (làm lại được, DEC-010).

### 4.2 `GET /api/student/classes/[classId]/roadmap`
`200 { success, class: { id, name, unlock_mode, pass_percent }, progress_percent, items }` — `items` theo `flattenRoadmap`, mỗi phần tử `{ id, parent_id, type, title, order_index, lesson_id, exam_id, state, best_percent, due_date }`; `best_percent` (chỉ `LESSON`) = `MAX(score_percent)` các lần `GRADED`/`AI_SKIPPED` của học sinh ở lớp này (`number` hoặc `null`; `EXAM` → `null`); `progress_percent = computeProgressPercent(states, items)`.

### 4.3 `GET /api/student/lessons/[lessonId]?classId=`
Qua `checkLessonAccess`. `200 { success, lesson: { id, title, description }, questions, flashcards }` — `questions` theo đúng thứ tự `question_ids` (bỏ id không còn), **mỗi câu qua `sanitizeQuestionForStudent`**; `flashcards` = thẻ được câu `*FLASHCARD*` tham chiếu, **qua `sanitizeFlashcardForStudent`**. Không trả bất kỳ đáp án nào (BR-L09).

### 4.4 `POST /api/student/lessons/[lessonId]/attempts` body `{ classId, answers }`
- `answers` phải là object (không phải mảng/null) → sai 400; quyền qua `checkLessonAccess`.
- Chấm: với từng câu theo thứ tự, `gradeQuestion(q, answers[q.id], flashcardsMap)` (map theo id các thẻ được tham chiếu, **bản đầy đủ** có `correct_english_word`). `summarizeResults` → `objective_earned`, `objective_max`, `ai_max`.
- Không có câu AI → `status = "GRADED"`, `ai_earned = 0`, `score_percent = computeScorePercent(objE, objM, 0, 0)`.
- Có câu AI: trừ slot nguyên tử `UPDATE users SET slot_limit = slot_limit - 1 WHERE id = $teacher AND slot_limit > 0 RETURNING slot_limit` (`$teacher = klass.teacher_id`):
  - Có dòng trả về → `status = "GRADING"`, `ai_earned = NULL`, `score_percent = NULL`; sau khi chèn, `pushRedisStreamEvent("stream:learning:grading", "LESSON_GRADING_REQUESTED", { attemptId })` (lỗi chỉ log).
  - Không có (hết slot) → `status = "AI_SKIPPED"`, `ai_earned = 0`, `score_percent = computeScorePercent(objE, objM, 0, ai_max)` (BR-L11).
- Chèn `lesson_attempts` với `id = "att_" + crypto.randomUUID()`, `answers` và `results` (mảng `GradeResult`, **có** `expected` — học sinh đã nộp nên được xem đáp án), `graded_at = NOW()` khi không còn GRADING.
- `201 { success, attempt }` — `attempt` là dòng vừa chèn; các cột số trả về kiểu `number` (`objective_earned`, `objective_max`, `ai_max`, `score_percent`, `ai_earned` hoặc `null`).

### 4.5 `GET /api/student/lessons/[lessonId]/attempts?classId=`
Học sinh đã ghi danh lớp (không cần mục đang mở để xem lịch sử). `200 { success, attempts }` — các lần làm của **chính học sinh** cho bài này ở lớp này, `created_at DESC`.

### 4.6 `GET /api/student/attempts/[id]`
Không có → 404; `student_id ≠ userId` → 403. `200 { success, attempt }`.

### 4.7 `POST /api/lessons/grade-async` body `{ attemptId }` — **chỉ** `hasValidInternalToken(req)`, ngược lại 401 (kể cả có cookie)
- Không có attempt → 404. `status ≠ "GRADING"` → `200 { success: true, skipped: true }` (không gọi AI).
- Tải câu hỏi của bài theo `question_ids`. Với mỗi mục AI trong `results` (`kind === "AI"`): `WRITING_ESSAY` → 1 mục với `answer = answers[qid]`; `WRITING_SHORT_ANSWER` → mỗi câu con `answer = answers[qid][subId]`, kèm `sample_answer` của câu con. Gọi `gradeOpenAnswer({ category, prompt: question.prompt, answer, sample_answer })`, **thử tối đa 3 lần**; vẫn lỗi → band 0 (ghi `console.error`).
- Điểm mục = `band / 9` (kẹp 0–1); cập nhật `results` (mục: `correct = band ≥ 5`, thêm `band`), `ai_earned` = tổng, `score_percent = computeScorePercent(objective_earned, objective_max, ai_earned, ai_max)`, `status = "GRADED"`, `graded_at = NOW()`. `200 { success: true }`.

### 4.8 `lib/lesson-ai-grading.ts`
`export async function gradeOpenAnswer(input: { category: string; prompt: string; answer: string; sample_answer?: string | null }): Promise<number>` — trả band 0–9. Câu trả lời rỗng → 0 (không gọi AI). Gọi `evaluateWritingSubmission(answer, prompt + (sample_answer ? "\nĐáp án tham khảo: " + sample_answer : ""))` rồi lấy `overallScore`, kẹp 0–9.

### 4.9 `worker/grading-worker.js`
Thêm nhánh: `eventType === "LESSON_GRADING_REQUESTED" && payload.attemptId` → `POST ${APP_URL}/api/lessons/grade-async` với header `Content-Type` và `"x-internal-token": process.env.INTERNAL_API_TOKEN || ""`, body `{ attemptId }`. Giữ nguyên nhánh `GRADING_REQUESTED` hiện có; vẫn `xack` sau khi xử lý.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (Vitest trừ test TASK-010 + `tsc` theo `tsconfig.verify.json`)
- [ ] Không route học sinh nào trả đáp án trước khi nộp
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách bằng nhánh `NODE_ENV`/`VITEST`.
- **Không chạy lệnh shell để dò/xoá file, không chạy git** — dùng công cụ đọc/ghi file; chỉ chạy `python3 scripts/handoff.py …`, `npx vitest`, `npx tsc`.
- Trừ slot phải là **một câu UPDATE có điều kiện** (không SELECT rồi UPDATE).
- `numeric` trên pg thật trả chuỗi → `Number(...)` trước khi trả JSON.
- Không gọi AI trong request nộp bài (chỉ ở `grade-async`).
- Không thêm thư viện mới.
