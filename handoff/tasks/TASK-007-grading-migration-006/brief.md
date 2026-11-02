# TASK-007 — Migration 006 + lib/grading.ts: chấm khách quan phía server và ẩn đáp án

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Task nền của FEAT-010 (Kho bài học). Hai việc:
1. Đưa DDL migration 006 (đã viết sẵn ở `docs/db-migration-006-lessons.sql`) vào `ensureSchema()` để app tự tạo bảng khi khởi động.
2. Viết module thuần `lib/grading.ts`: chấm khách quan 15 dạng câu hỏi **trên server**, và hàm **ẩn đáp án** trước khi gửi câu hỏi cho học sinh. Module dùng chung cho bài học (task sau) và đề thi (sau này thay việc trình duyệt tự chấm).

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 5 (schema), mục 7 (BR-L06 → BR-L09)
- `docs/14-decisions.md` DEC-001, DEC-009
- `lib/question-content-types.ts` — cấu trúc `content` của từng dạng + hàm có sẵn: `parseFillInGaps`, `splitOrderingItems`, `parseSentenceRewriteCue`, `normalizeSentenceRewriteAnswer`
- Test: `tests/grading.test.ts`, `tests/migration-006.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/grading.ts` (mới)
- `lib/db-pg.ts` (chỉ thêm DDL migration 006 vào khối DDL của `ensureSchema`)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-006-lessons.sql`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/question-content-types.ts` (chỉ import, không sửa), mọi route API và trang
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết

### 4.1 `ensureSchema()` trong `lib/db-pg.ts`
Thêm **nguyên văn** các câu lệnh của `docs/db-migration-006-lessons.sql` (kể cả `DELETE FROM curriculum_items WHERE type = 'LESSON' AND lesson_id IS NULL;`) vào cuối khối DDL hiện có, sau phần migration 005. Đặt sau `CREATE TABLE IF NOT EXISTS curriculum_items` (bảng phải tồn tại trước câu `ALTER`). Không đổi các câu DDL khác.

### 4.2 `lib/grading.ts` — hàm thuần, không import DB/React/next
```ts
export type GradeKind = "OBJECTIVE" | "AI" | "UNSUPPORTED";
export interface GradableQuestion { id: string; category: string; content: any; prompt?: string; skill?: string; [k: string]: unknown }
export interface GradeItem { key: string; correct: boolean; given: unknown; expected: unknown }
export interface GradeResult { question_id: string; category: string; kind: GradeKind; earned: number; max: number; items: GradeItem[] }
export interface FlashcardRow { id: string; vietnamese_name?: string; correct_english_word: string; options?: string[]; image_url?: string | null; audio_url?: string | null }

export function gradeQuestion(q: GradableQuestion, answer: unknown, flashcards?: Record<string, FlashcardRow>): GradeResult;
export function sanitizeQuestionForStudent(q: GradableQuestion): GradableQuestion;
export function sanitizeFlashcardForStudent(card: FlashcardRow): { id; vietnamese_name; image_url; audio_url; options: string[] };
export function summarizeResults(results: GradeResult[]): { objective_earned: number; objective_max: number; ai_max: number; has_ai: boolean };
export function computeScorePercent(objEarned: number, objMax: number, aiEarned: number | null, aiMax: number): number;
```

**Chuẩn hoá so sánh** (mọi dạng trừ viết lại câu): `String(x).trim().replace(/\s+/g, " ").toLowerCase()`. Giá trị không phải chuỗi → coi như sai. Câu trả lời thiếu/sai kiểu → mọi mục sai, **không ném lỗi**.

**Định dạng câu trả lời & cách chấm** (`category` xét theo hậu tố/tên):
| Dạng | `answer` | Mục (key) | Đáp án đúng | Điểm |
| :--- | :--- | :--- | :--- | :--- |
| `*_MC` | `{ [subId]: "A".."D" }` | `subId` | `sub.correct_answer` (viết hoa trong `expected`) | 1/câu con |
| `*_FILL_IN` | `string[]` theo thứ tự ô | `gap_<i>` | `content.correct_answers` nếu là mảng không rỗng, ngược lại `parseFillInGaps(content.passage).gaps` | 1/ô |
| `*_ORDERING` | `string[]` | `order` | `splitOrderingItems(correct_text, ordering_type)` — đúng khi cùng độ dài và từng phần tử bằng nhau | 1 |
| `*_MATCHING` | `{ [pairId]: rightText }` | `pairId` | `pair.right` | 1/cặp |
| `*_FLASHCARD_SET` | `{ [flashcardId]: word }` | `flashcardId` | `flashcards[id].correct_english_word`; thẻ không có trong `flashcards` → bỏ qua (không tính vào max) | 1/thẻ |
| `WRITING_FREE_TYPING_BLANKS` | `string[]` | `gap_<i>` | `parseFillInGaps(content.passage).gaps` | 1/ô |
| `WRITING_SENTENCE_REWRITE` | `string` | `rewrite` | `normalizeSentenceRewriteAnswer(answer, content.correct_answer).isCorrect`; `expected` = `parseSentenceRewriteCue(...).cleanAnswer` | 1 |
| `WRITING_ESSAY` | `string` | `essay` | — | `kind: "AI"`, `max: 1`, `earned: 0` |
| `WRITING_SHORT_ANSWER` | `{ [subId]: string }` | `subId` | — | `kind: "AI"`, `max` = số câu con, `earned: 0` |
| `SPEAKING_*` / dạng khác | — | — | — | `kind: "UNSUPPORTED"`, `max: 0`, `items: []` |

Dạng khách quan: `kind: "OBJECTIVE"`, `earned` = số mục đúng, `max` = số mục. Mục AI có `correct: false`, `expected: null`.

**`summarizeResults`**: cộng `earned`/`max` của các kết quả `OBJECTIVE`; `ai_max` = tổng `max` các kết quả `AI`; `has_ai = ai_max > 0`.

**`computeScorePercent`**: `(objEarned + (aiEarned ?? 0)) / (objMax + aiMax) × 100`, làm tròn 1 chữ số thập phân (`Math.round(x * 10) / 10`); mẫu số 0 → `100`.

**`sanitizeQuestionForStudent`** — trả **bản sao** (không đổi đầu vào), giữ mọi trường ngoài `content`, và trong `content`:
| Dạng | Biến đổi |
| :--- | :--- |
| `*_MC` | bỏ `correct_answer` ở mọi câu con; giữ phần còn lại (`text`, `option_*`, `audio_url`…) |
| `*_FILL_IN` | bỏ `correct_answers` và `passage`; thêm `passage_parts = parseFillInGaps(passage).parts`, `gap_count`; `option_bank` và `options` của từng `inline_options_per_gap` **sắp xếp** |
| `*_ORDERING` | bỏ `correct_text`; thêm `items = splitOrderingItems(...)` đã **sắp xếp**; giữ `ordering_type` |
| `*_MATCHING` | bỏ `pairs`; thêm `left = pairs.map(p => ({ id: p.id, text: p.left }))` (giữ thứ tự), `right = pairs.map(p => p.right)` đã **sắp xếp** |
| `WRITING_FREE_TYPING_BLANKS` | bỏ `passage`; thêm `passage_parts`, `gap_count` |
| `WRITING_SENTENCE_REWRITE` | bỏ `correct_answer`; nếu `starting_cue` rỗng thì gán `parseSentenceRewriteCue(correct_answer).cue` |
| `WRITING_SHORT_ANSWER` | bỏ `sample_answer` ở mọi câu con |
| dạng khác | giữ nguyên |

**`sanitizeFlashcardForStudent`**: trả đúng `{ id, vietnamese_name, image_url, audio_url, options }` (không có `correct_english_word`), `options` đã **sắp xếp** (thiếu → `[]`).

"Sắp xếp" = `[...arr].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))` — dùng **đúng** hàm so sánh này ở mọi chỗ (để thứ tự không tiết lộ đáp án và test tái lập được).

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] `lib/grading.ts` không import DB, React, `next/*`
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test, không sửa `docs/db-migration-006-lessons.sql`; không lách bằng nhánh `NODE_ENV`/`VITEST`.
- **Không chạy lệnh shell để dò/xoá file** (`find`, `ls`, `rm`, `git rm` từng bị từ chối) — dùng công cụ đọc/ghi file; chỉ chạy `python3 scripts/handoff.py …`, `npx vitest`, `npx tsc`.
- Dùng lại hàm có sẵn trong `lib/question-content-types.ts`, không viết lại logic tách ô trống/sắp xếp/viết lại câu.
- Ẩn đáp án theo **danh sách trắng**: xoá đúng các trường đáp án đã nêu; chú ý đáp án nằm **trong đoạn văn** của dạng điền ô (phải thay bằng `passage_parts`).
- Không chấm AI trong module này (chỉ đánh dấu `kind: "AI"`).
- Không thêm thư viện mới.
