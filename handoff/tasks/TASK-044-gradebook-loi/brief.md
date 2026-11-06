# TASK-044 — Lõi bảng điểm: migration 017, lib/gradebook.ts, AI chấm giữ bản gốc, bài học NEEDS_REVIEW

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** HIGH
**Nhạy cảm:** có <!-- migration + logic điểm -->

## 1. Mục tiêu
Phần lõi phía server của FEAT-014 "Chấm & Bảng điểm theo lớp". Chưa có API mới và chưa có UI; các phần đó thuộc TASK-045/046/047. Task này làm 4 việc:
1. Đưa migration 017 vào `ensureSchema`.
2. Viết module thuần `lib/gradebook.ts` (chọn lượt tính, quy đổi thang 10, áp sửa điểm giáo viên, điều kiện chốt, trung bình).
3. Sửa hai route grade-async để ghi bản gốc AI (`ai_score`, `ai_feedback`).
4. Bài học bị AI lỗi thì chuyển `NEEDS_REVIEW` thay vì cho 0 điểm, kèm `giveUp` từ worker.

## 2. Tài liệu bắt buộc đọc
- `docs/features/cham-diem-bang-diem.md` §5 (dữ liệu), §7 (BR-B03 → BR-B13), §8 (TC-B03, 04, 06, 07, 12, 13)
- `docs/db-migration-017-gradebook.sql` (đã viết sẵn, chỉ chép DDL vào `ensureSchema`)
- `docs/12-business-rules.md` BR-L07, BR-L08, BR-G01; `docs/14-decisions.md` DEC-039 → DEC-041
- `CONTEXT.md` mục 3 (bất biến)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/gradebook.ts` (mới)
- `lib/db-pg.ts` (chỉ thêm khối "Migration 017" vào `ensureSchema`, sau khối 016)
- `app/api/exam/grade-async/route.ts`
- `app/api/lessons/grade-async/route.ts`
- `worker/grading-worker.js`
- `lib/notifications.ts` (thêm `notifyLessonNeedsReview` và kiểu `LESSON_NEEDS_REVIEW`)

**Không được sửa:**
- Mọi file trong `tests.lock`
- `docs/`, bao gồm `docs/db-migration-017-gradebook.sql`
- Mọi route và trang khác: `/api/teacher/**`, `/api/exam/grade-override`, `app/teacher/**`, `app/student/**` thuộc task sau
- `stitch_english_mock_exam_portal/`

## 4. Đặc tả chi tiết + blueprint
### 4.1 Migration
Chép nguyên DDL của `docs/db-migration-017-gradebook.sql` vào `ensureSchema()`. Mọi câu lệnh đều phải có `IF NOT EXISTS`.

### 4.2 `lib/gradebook.ts` — hàm thuần, không gọi DB
```ts
export type ItemKind = "LESSON" | "EXAM";
export class GradebookError extends Error { status: number; code: string }   // 400/409
export interface AttemptLite {
  id: string; status: string;            // GRADED | GRADING | NEEDS_REVIEW | AI_SKIPPED…
  score: number | null;                  // đề: total_score · bài học: score_percent
  submitted_at: string | Date;           // bài học: created_at
  has_ai: boolean; reviewed_at: string | Date | null;
}
export function mergeClassItems(roadmap: {kind: ItemKind; id: string; title: string}[],
                                assignments: {exam_id: string; title: string}[]): {kind; id; title; source: "ROADMAP"|"ASSIGNMENT"}[]
export function pickCountedAttempt(attempts: AttemptLite[], opt: {chosenAttemptId?: string|null; manualScore10?: number|null}):
  { source: "MANUAL"|"CHOSEN"|"BEST"|"NONE"; attempt: AttemptLite|null; state: "GRADED"|"GRADING"|"NEEDS_REVIEW"|"NOT_SUBMITTED" }
export function round1(n: number): number
export function lessonScore10(scorePercent: number|null): number|null
export function examScore10(sub: {total_score; standard_snapshot; status?}): number|null   // dùng submissionScore().percent (lib/score-display.ts)
export function isPendingReview(a: AttemptLite): boolean                                   // BR-B05
export interface TeacherEdit { question_id: string; item_key?: string; teacher_score: number|null; teacher_feedback?: string }
export function applyExamTeacherEdits(results: any[], snapshot: ScoringStandard, edits: TeacherEdit[], teacherId: string, now: Date):
  { results: any[]; section_scores; total_score: number|null; passed: boolean|null; allAiScored: boolean }
export function applyLessonTeacherEdits(results: any[], att: {objective_earned: number; objective_max: number; ai_max: number},
  edits: TeacherEdit[], teacherId: string, now: Date):
  { results: any[]; ai_earned: number|null; score_percent: number|null; allAiScored: boolean }
export function checkFinalize(rows: {student_id: string; attempts: AttemptLite[]; counted: AttemptLite|null}[], confirmUnreviewed: boolean):
  | { ok: true; markReviewedIds: string[] }
  | { ok: false; code: "GRADING_PENDING"; students: string[] }
  | { ok: false; code: "UNREVIEWED"; count: number }
export function average10(values: (number|null)[]): number|null                         // BR-B10
```

Các bước của `pickCountedAttempt` (BR-B03):
1. Có `manualScore10` khác null thì trả `MANUAL`, `attempt` là null, `state` là `GRADED`.
2. Có `chosenAttemptId` và lượt đó tồn tại, đang `GRADED`, thì trả `CHOSEN`.
3. Không thì xét các lượt `GRADED` (cả `AI_SKIPPED` cũ). Lấy `score` lớn nhất, bằng điểm thì lấy lượt có `submitted_at` sớm hơn, trả `BEST`.
4. Không có lượt chấm xong thì `state` là trạng thái của lượt có `submitted_at` mới nhất. Không có lượt nào thì `NOT_SUBMITTED`. Trả `NONE`.

Hàm `applyExamTeacherEdits`. Mỗi mục AI của đề là một phần tử `results[]` có `kind === "AI"` và các trường `score`, `skill`.
- Mỗi edit phải trỏ đúng một result `kind === "AI"`, nếu không thì ném `GradebookError(400, "NOT_AI_ITEM")`.
- Thang điểm lấy từ `snapshot.sections.find(s => s.skill === result.skill)`. Điểm phải nằm trong `[min, max]` và `(v - min) / step` gần số nguyên (sai số 1e-9). Sai thì `400 "OUT_OF_SCALE"`.
- Lần sửa đầu: nếu `ai_score` chưa có thì chép `score` cũ vào `ai_score`, và `feedback` cũ vào `ai_feedback`. Dữ liệu cũ (BR-B13) đi theo đường này.
- Đặt `teacher_score`, `teacher_feedback`, `teacher_by`, `teacher_at`, rồi `score = teacher_score ?? ai_score`.
- `teacher_score: null` thì xoá `teacher_*` và trả `score` về `ai_score`.
- Tính lại điểm phần bằng `tallyAndScoreSections(snapshot, results)` (`lib/exam-attempts.ts`), rồi điểm tổng bằng `aggregateTotal` (`lib/exam-scoring.ts`).
- `allAiScored` nghĩa là mọi result AI đều có `score` là số. Nếu còn thiếu thì `total_score` và `passed` là null.

Hàm `applyLessonTeacherEdits`. Ở bài học, điểm AI nằm ở `items[].band` (thang 0–9). Edit dùng `item_key` khớp với `items[].key`.
- Thang 0–9, bước 0.5. Sai thì 400.
- Giữ `ai_score` theo cùng cách như đề: chép `band` cũ vào trước. Đặt `band = teacher_score ?? ai_score`, `correct = band >= 5`.
- `r.earned = Σ band / 9`. `ai_earned = Σ r.earned` trên các result AI. `score_percent = computeScorePercent(...)` (`lib/grading.ts`, BR-L08).
- Còn mục thiếu `band` thì `ai_earned` và `score_percent` là null, `allAiScored = false`.
- **Không được làm biến đổi mảng đầu vào.** Trả về bản sao.

Hàm `checkFinalize` (BR-B08):
- Có lượt bất kỳ đang `GRADING` hoặc `NEEDS_REVIEW` thì trả `GRADING_PENDING` kèm danh sách `student_id`, không trùng.
- Không thì gom các lượt `counted` có `isPendingReview` đúng. Nếu có mà `confirmUnreviewed` là false thì trả `UNREVIEWED` kèm `count`. Nếu `confirmUnreviewed` là true thì trả `ok` kèm `markReviewedIds`.

### 4.3 grade-async
- **Đề** (`app/api/exam/grade-async/route.ts`): khi chấm AI thành công một mục, ghi cả `r.ai_score` và `r.ai_feedback` cạnh `r.score` và `r.feedback` hiện có. Mọi hành vi khác giữ nguyên.
- **Bài học** (`app/api/lessons/grade-async/route.ts`):
  - `callGradeWithRetry` sau 3 lần lỗi phải **ném lỗi**, không trả 0 nữa.
  - Mỗi mục bị lỗi thì bỏ trống `band` và `ai_score`, rồi chấm tiếp các mục còn lại. Mục thành công thì đặt `band` và `ai_score`.
  - Còn mục lỗi sau khi chạy hết thì cập nhật lượt: `status = 'NEEDS_REVIEW'`, `ai_earned = NULL`, `score_percent = NULL`, `last_grading_error = <thông điệp>`, lưu `results`. Sau đó gọi `notifyLessonNeedsReview(attemptId)`.
  - Body nhận thêm `giveUp: true`, chỉ có tác dụng kèm token nội bộ. Lượt đang `GRADING` thì chuyển `NEEDS_REVIEW` và báo **một lần**. Gọi lại khi lượt không còn `GRADING` thì `skipped`, không đổi gì.
- **Worker** (`worker/grading-worker.js`): khi vượt `MAX_DELIVERIES` với sự kiện `LESSON_GRADING_REQUESTED`, gọi `/api/lessons/grade-async` với `{ attemptId, giveUp: true }`, giống nhánh đề thi đang có.
- **`notifyLessonNeedsReview(attemptId)`** gửi cho giáo viên của `lesson_attempts.class_id`.
  - Nội dung: type `LESSON_NEEDS_REVIEW`, `ref_id` là attemptId, link `/teacher/grading/<class_id>/lesson/<lesson_id>`.
  - Lỗi bên trong chỉ log, không ném ra ngoài.
  - **Không** đổi link của `EXAM_NEEDS_REVIEW` (để cho TASK-045).

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0; `npx vitest run && npx tsc --noEmit` xanh, kể cả `tests/student-lessons-api.test.ts` (ca "AI lỗi liên tục → NEEDS_REVIEW") và `tests/docs-sync.test.ts`
- [ ] `ensureSchema` tạo được `class_grade_items`, `class_grades` và các cột mới; chạy 2 lần không lỗi
- [ ] `pickCountedAttempt`: thứ tự ưu tiên MANUAL > CHOSEN > BEST; hoà điểm thì lấy lượt sớm hơn; lượt chosen chưa `GRADED` thì bị bỏ qua, rơi về BEST; không có lượt nào thì `NOT_SUBMITTED`; chỉ có lượt GRADING thì state `GRADING`
- [ ] `examScore10` với IELTS 6.5/9 cho 7.2; `lessonScore10(82.5)` cho 8.3; null vào thì null ra
- [ ] `applyExamTeacherEdits`: `ai_score` giữ nguyên; `section_scores`/`total_score` tính lại đúng; điểm ngoài thang, sai bước hoặc sửa câu khách quan thì `GradebookError` 400; `teacher_score: null` trả về điểm AI; đầu vào không bị biến đổi
- [ ] `applyLessonTeacherEdits`: band → earned = band/9, `score_percent` theo BR-L08; thiếu mục thì `allAiScored = false` và `score_percent = null`
- [ ] `checkFinalize`: đủ 3 nhánh `GRADING_PENDING` / `UNREVIEWED` / ok kèm `markReviewedIds`; lượt không có AI không bao giờ tính là chưa duyệt
- [ ] `average10` bỏ qua null, làm tròn 0.1; mảng rỗng hoặc toàn null thì null
- [ ] grade-async đề ghi `ai_score`/`ai_feedback`; grade-async bài học: AI lỗi thì `NEEDS_REVIEW` và có thông báo `LESSON_NEEDS_REVIEW` cho đúng giáo viên với link đúng; `giveUp` chỉ đổi trạng thái 1 lần; thiếu token nội bộ thì 401

## 6. Ràng buộc & bẫy cần tránh
- Không ghi đè `ai_score` hay `ai_feedback` sau khi đã có (DEC-039).
- Không cho 0 điểm khi AI lỗi (DEC-041, BR-G01).
- Giữ nguyên ghi log `ai_usage_logs` (BR-G04, test `ai-usage`).
- `lib/gradebook.ts` là module thuần: không import `db-pg` hay `next/*`, để test gọi trực tiếp được.
- Không thêm route mới và không sửa UI. Không đụng `grade-override` hay `teacher/submissions` (TASK-045 sẽ bỏ).
- Điểm là `number`. Làm tròn chỉ qua `round1`, không dùng `toFixed` rồi để nguyên chuỗi.
- Không đổi số thứ tự hay nội dung các khối migration cũ trong `ensureSchema`.
