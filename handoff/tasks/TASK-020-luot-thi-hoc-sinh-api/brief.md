# TASK-020 — Lượt thi học sinh do server quản lý, chấm khi nộp, grade-async/grade-override bằng pg

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Backend FEAT-011: học sinh bắt đầu lượt thi (server ghi giờ, chụp chuẩn chấm), tải đề đã ẩn đáp án, lưu tạm, nộp → server chấm khách quan theo chuẩn, Writing/Speaking chấm AI nền (trừ slot) hoặc chờ giáo viên; viết lại `grade-async`, `grade-override` bằng `queryPg`; khoá đường nộp cũ `POST /api/submissions`.

## 2. Tài liệu bắt buộc đọc
- `docs/features/exam-server-grading.md` mục 3, 6, 7 (BR-E01 → BR-E08); `docs/14-decisions.md` DEC-014 → DEC-018
- `lib/exam-scoring.ts` (`scoreSection`, `aggregateTotal`, `roundToStep`), `lib/grading.ts` (`gradeQuestion(q, a, fc, { speaking: "AI" })`, `sanitize*`), `lib/lesson-access.ts` + `lib/roadmap*.ts` (mục EXAM trong lộ trình lớp), `lib/api-auth.ts`, `lib/redis-queue.ts`, `lib/rubric-resolver.ts`, `lib/ai-engine.ts`
- Route hiện có: `app/api/exam/grade-async/route.ts`, `app/api/exam/grade-override/route.ts`, `app/api/exams/[id]/content/route.ts`, `app/api/submissions/route.ts`
- Test: `tests/exam-attempts-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/exam-attempts.ts` (mới — chọn chuẩn, kiểm quyền làm đề, đếm lượt, chấm & tổng hợp phần)
- `lib/exam-ai-grading.ts` (mới)
- `app/api/student/exams/[examId]/attempts/route.ts`, `app/api/student/exams/[examId]/content/route.ts`, `app/api/student/exam-attempts/[id]/answers/route.ts`, `app/api/student/exam-attempts/[id]/submit/route.ts` (mới)
- `app/api/exam/grade-async/route.ts`, `app/api/exam/grade-override/route.ts`, `app/api/exams/[id]/content/route.ts`, `app/api/submissions/route.ts` (chỉ POST → 410)

**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, các `lib/` có sẵn (`grading`, `exam-scoring`, `roadmap*`, `lesson-access`, `rubric-resolver`, `db-pg`), trang/component, `worker/` (worker đã xử lý `GRADING_REQUESTED → /api/exam/grade-async`), `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
Route học sinh: `requireRole(["STUDENT"])` dòng đầu; danh tính chỉ từ token; SQL tham số hoá; lỗi `{ success: false, error }`; các cột số trả `number`.

### 4.1 `lib/exam-attempts.ts`
- `resolveStandardForExam(examId)` (BR-E01): `exams.scoring_standard_id` → `courses.default_scoring_standard_id` của khóa có `curriculum_items.exam_id = examId` (lấy khóa đầu tiên có chuẩn) → `std_internal_10`. Trả dòng `scoring_standards` (`id, name, framework, sections, aggregation`).
- `checkExamAccess(examId, studentId, classId?)` (BR-E03, BR-E04): không có `classId` → luyện tập, cho phép, `limit = null`. Có `classId`: chưa ghi danh → 403; đề nằm trong `class_assignments` của lớp → `limit = max_attempts ?? 1`; ngược lại đề là mục `EXAM` của khóa lớp với trạng thái `OPEN`/`COMPLETED` (dùng `loadStudentRoadmap`) → `limit = 1`; còn lại → 403. `used` = số `submissions` của học sinh cho đề với `class_ref = classId` và `status <> 'IN_PROGRESS'`.
- Chấm (dùng chung cho submit / grade-async / grade-override): nhóm `results` theo `questions.skill` → tally mỗi kỹ năng `{ objective_earned, objective_max, ai_earned, ai_max }` (mục AI: `ai_earned` cộng **tỉ lệ 0–1** đã chấm, chưa chấm = 0). `section_scores[skill] = { score: scoreSection(section, tally), earned, max }` chỉ cho kỹ năng có trong chuẩn và có câu. Điểm phần do giáo viên chấm tay (`override: true`) được giữ nguyên.

### 4.2 Bắt đầu — `POST /api/student/exams/[examId]/attempts { classId? }`
Đề không có → 404; quyền theo `checkExamAccess`. Có lượt `IN_PROGRESS` của học sinh cho đề với cùng `class_ref` (NULL khi luyện tập) → `200` trả lượt đó (không đổi `started_at`). Ngược lại `used ≥ limit` → 409; tạo lượt: `id = "sub_" + crypto.randomUUID()`, `status = 'IN_PROGRESS'`, `answers = {}`, `started_at = NOW()`, `deadline_at = NOW() + duration_minutes phút`, `class_ref`, `standard_snapshot = resolveStandardForExam(...)` → `201`. Phản hồi `{ success, attempt: { id, exam_id, status, started_at, deadline_at, answers }, remaining_attempts }` (`remaining_attempts = limit − used` hoặc `null`).

### 4.3 Nội dung — `GET /api/student/exams/[examId]/content`
Chỉ khi học sinh có lượt `IN_PROGRESS` cho đề (403 nếu không). `{ exam: { id, title, duration_minutes, skills }, standard: { id, name, sections: [{ skill, min, max }] } (từ snapshot), questions (theo question_ids, qua sanitizeQuestionForStudent), flashcards (qua sanitizeFlashcardForStudent) }`. Cập nhật `app/api/exams/[id]/content/route.ts`: khi người gọi là STUDENT → câu hỏi/flashcard qua sanitize (giáo viên/admin giữ nguyên).

### 4.4 Lưu tạm — `PUT /api/student/exam-attempts/[id]/answers { answers }`
Không có → 404; của người khác → 403; không `IN_PROGRESS` hoặc `NOW() > deadline_at + 2 phút` → 409; `answers` phải là object → lưu → `200`.

### 4.5 Nộp — `POST /api/student/exam-attempts/[id]/submit { answers }`
404/403 như 4.4; không `IN_PROGRESS` → 409. Chấm từng câu `gradeQuestion(q, answers[q.id], flashcardsMap, { speaking: "AI" })`; `is_late = NOW() > deadline_at + 2 phút`; `submitted_at = NOW()`; lưu `answers`, `results`, `section_scores`.
- Không có mục AI → `total/passed = aggregateTotal(snapshot, điểm phần)`, `status = 'GRADED'`, `graded_at = NOW()`, `total_score`, `passed`.
- Có mục AI → trừ slot bằng **một** `UPDATE users SET slot_limit = slot_limit - 1 WHERE id = $teacher AND slot_limit > 0 RETURNING slot_limit` (`$teacher` = `classes.teacher_id` của `class_ref`, luyện tập = `exams.created_by`): có dòng → `status = 'GRADING'` rồi `pushGradingEvent(submissionId, examId, studentId)` (lỗi chỉ log); không có → `status = 'NEEDS_REVIEW'`. `total_score = NULL`.
- `200 { success, attempt }` (gồm `status, section_scores, total_score, passed, is_late, results`).

### 4.6 `POST /api/exam/grade-async { submissionId }` — chỉ `hasValidInternalToken` (ngược lại 401)
Không có → 404; `status ≠ 'GRADING'` → `200 { success: true, skipped: true }`. Mỗi mục AI: phần của kỹ năng trong snapshot → `gradeExamOpenAnswer({ category, prompt, answer, section: { min, max, step }, rubric_id: section.rubric_id })`, thử tối đa 3 lần; lỗi → điểm = `section.min`, ghi `last_grading_error`, `grading_attempts`. Tỉ lệ mục = `(điểm − min) / (max − min)` → cập nhật `results` (thêm `score`), tính lại `section_scores`, `aggregateTotal` → `status = 'GRADED'`, `graded_at`, `total_score`, `passed`. Không dùng Supabase.

### 4.7 `lib/exam-ai-grading.ts`
`gradeExamOpenAnswer({ category, prompt, answer, section, rubric_id? }): Promise<number>` — rỗng → `section.min`; lấy rubric bằng `resolveRubricForExam` hoặc đọc `scoring_rubrics` theo `rubric_id`, ép `scale = section`; `SPEAKING_*` → `evaluateSpeakingWithAudio(answer, prompt, rubric)`, còn lại → `evaluateWritingWithRubric(answer, prompt, rubric)`; trả `overallScore` đã `roundToStep` trong thang phần.

### 4.8 `PUT /api/exam/grade-override { submissionId, section_scores, feedback? }`
`requireRole(["ADMIN","TEACHER"])`; không có → 404; TEACHER phải là người tạo đề hoặc giáo viên của lớp `class_ref` (khác → 403). Mỗi điểm phải là số trong `[min, max]` của phần tương ứng trong snapshot (sai/kỹ năng không có → 400). Ghi đè `section_scores[skill] = { ...cũ, score, override: true }`, `teacher_feedback = feedback`, tính lại `aggregateTotal` → `status = 'GRADED'`, `graded_at`. `200 { success, attempt }`.

### 4.9 `POST /api/submissions` → `410 { success: false, error: "Đường nộp bài cũ đã ngừng — dùng /api/student/exam-attempts/{id}/submit" }`. `GET` giữ nguyên.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Không route nào nhận điểm do trình duyệt gửi; không trả đáp án trước khi nộp
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-020`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- `submissions.class_id` là UUID — dùng cột `class_ref`. `final_score` NUMERIC(3,1) quá nhỏ — dùng `total_score`.
- Dùng lại `lib/exam-scoring.ts` và `lib/grading.ts`, không viết lại công thức.
- Không gọi AI trong request nộp bài.
- Không thêm thư viện mới.
