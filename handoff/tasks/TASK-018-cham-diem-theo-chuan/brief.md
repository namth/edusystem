# TASK-018 — Migration 009 + lib/exam-scoring (điểm phần, tổng theo chuẩn) + chấm Speaking bằng AI

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Nền của FEAT-011 (chấm đề thi phía server theo chuẩn chấm):
1. Đưa DDL `docs/db-migration-009-scoring-standards.sql` (đã viết sẵn, kèm seed 4 chuẩn hệ thống) vào `ensureSchema()`.
2. Module thuần `lib/exam-scoring.ts`: điểm từng phần theo chuẩn (tuyến tính / bảng tra) và điểm tổng (trung bình / cộng / trọng số, điểm đạt, điểm sàn).
3. `gradeQuestion` trong `lib/grading.ts` thêm tuỳ chọn chấm Speaking bằng AI (dùng cho đề thi; bài học giữ nguyên hành vi cũ).
4. `lib/lesson-ai-grading.ts` chấm Speaking bằng `evaluateSpeakingWithAudio`.

## 2. Tài liệu bắt buộc đọc
- `docs/features/exam-server-grading.md` mục 5, 7 (BR-E02, BR-E06), `docs/14-decisions.md` DEC-014, DEC-015
- `docs/db-migration-009-scoring-standards.sql`
- `lib/grading.ts`, `lib/lesson-ai-grading.ts`, `lib/ai-engine.ts` (`evaluateSpeakingWithAudio(audio, prompt, rubric?)`)
- Test: `tests/exam-scoring.test.ts` (và mọi test cũ phải tiếp tục xanh, nhất là `tests/grading.test.ts`)

## 3. Phạm vi file
**Được tạo/sửa:** `lib/exam-scoring.ts` (mới), `lib/grading.ts`, `lib/lesson-ai-grading.ts`, `lib/db-pg.ts` (chỉ thêm DDL migration 009).

**Không được sửa:** mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-00*.sql`), `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, mọi route/trang/component, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả chi tiết
### 4.1 `ensureSchema()`
Thêm **nguyên văn** nội dung `docs/db-migration-009-scoring-standards.sql` vào cuối khối DDL hiện có (sau migration 008). Câu `INSERT … ON CONFLICT DO NOTHING` cũng đưa vào.

### 4.2 `lib/exam-scoring.ts` — thuần (không import DB/React/next)
```ts
export type Skill = "Reading" | "Listening" | "Writing" | "Speaking";
export interface StandardSection { skill: Skill | string; min: number; max: number; step: number;
  conversion: "LINEAR" | "TABLE"; table_question_count?: number; table?: { min_correct: number; score: number }[]; rubric_id?: string }
export interface StandardAggregation { method: "AVERAGE" | "SUM" | "WEIGHTED"; round_step: number;
  weights?: Record<string, number>; pass_score?: number; section_min?: Record<string, number> }
export interface ScoringStandard { id: string; name: string; framework?: string; sections: StandardSection[]; aggregation: StandardAggregation }
export interface SectionTally { objective_earned: number; objective_max: number; ai_earned: number; ai_max: number }

export function roundToStep(value: number, step: number, min: number, max: number): number;
export function scoreSection(section: StandardSection, tally: SectionTally): number | null;
export function aggregateTotal(standard: ScoringStandard, scores: Record<string, number | null | undefined>): { total: number | null; passed: boolean | null };
```
- **`roundToStep`**: làm tròn **nửa lên** tới bội của `step` tính từ 0 (`Math.floor(value / step + 0.5) * step`), khử sai số dấu phẩy động (vd làm tròn kết quả tới 6 chữ số thập phân), rồi kẹp trong `[min, max]`.
- **`scoreSection`** (BR-E02): `objective_max + ai_max = 0` → `null`. Nếu `conversion === "TABLE"` **và** `ai_max === 0` và có `table`: `n = Math.round(objective_earned / objective_max × (table_question_count ?? objective_max))`; điểm = `score` của dòng có `min_correct` lớn nhất ≤ `n` (không có dòng nào → `min`). Ngược lại: `ratio = (objective_earned + ai_earned) / (objective_max + ai_max)`, điểm = `roundToStep(min + ratio × (max − min), step, min, max)`.
- **`aggregateTotal`** (BR-E06): chỉ xét skill có điểm là số (bỏ `null`/`undefined`). Không có → `{ total: null, passed: null }`. `AVERAGE` = trung bình; `SUM` = tổng; `WEIGHTED` = Σ(w·s)/Σw với `w = weights[skill] ?? 1`. `total = roundToStep(x, round_step, -Infinity, Infinity)`. `passed`: không có `pass_score` → `null`; có → `total ≥ pass_score` và với mọi `section_min[skill]` mà skill có điểm thì điểm ≥ mức sàn.

### 4.3 `gradeQuestion` — tuỳ chọn thứ 4
`gradeQuestion(q, answer, flashcards?, options?: { speaking?: "AI" | "UNSUPPORTED" })`. Mặc định `"UNSUPPORTED"` (giữ nguyên hành vi cũ cho bài học). Với `speaking: "AI"` và `category` bắt đầu bằng `SPEAKING_`: `{ kind: "AI", earned: 0, max: 1, items: [{ key: "speaking", correct: false, given: answer, expected: null }] }`. Không đổi gì khác.

### 4.4 `lib/lesson-ai-grading.ts`
`gradeOpenAnswer`: `category` bắt đầu bằng `SPEAKING_` → `evaluateSpeakingWithAudio(answer, prompt)` (answer là URL audio), lấy `overallScore`, kẹp 0–9; câu trả lời rỗng → 0 không gọi AI. Các dạng khác giữ nguyên.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ test + `tsc`)
- [ ] `lib/exam-scoring.ts` thuần
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test, không sửa `docs/db-migration-009-scoring-standards.sql`.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-018`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không đổi chữ ký/hành vi mặc định của `gradeQuestion` (test cũ của bài học phải xanh).
- Không thêm thư viện mới.
