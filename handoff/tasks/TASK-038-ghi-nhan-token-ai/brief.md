# TASK-038 — Ghi nhận token & chi phí AI theo model

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/quan-tri-he-thong.md` (FEAT-013) §1 mục 6, §5 (phần `ai_usage_logs` + `ai_pricing`), §6 thư viện, §7 quy tắc 9 · Quyết định DEC-034.
> Chạy **song song** với TASK-039 (slot) và TASK-040 (rubric). TASK-039 cũng sửa `app/api/exam/grade-async/route.ts` nhưng ở **đoạn hoàn slot**. Task này chỉ bọc ngữ cảnh quanh đoạn gọi chấm, không đụng đoạn hoàn slot.

## 1. Tài liệu bắt buộc đọc
- Đặc tả nêu trên, `CONTEXT.md` §3.
- Test: `tests/ai-usage.test.ts` (mới, là hợp đồng nghiệm thu). Mọi test cũ phải xanh.

## 2. Phạm vi file
**Được tạo/sửa:**
- `docs/db-migration-014-ai-usage.sql` (mới), `lib/db-pg.ts` (thêm DDL 014 vào `ensureSchema`)
- `lib/ai-pricing.ts` (mới, thuần), `lib/ai-usage.ts` (mới)
- `lib/ai-engine.ts`, `lib/document-parser.ts`, `lib/portkey.ts`
- `app/api/exam/grade-async/route.ts` (chỉ bọc ngữ cảnh), `app/api/lessons/grade-async/route.ts`, `app/api/teacher/exams/ai-parse/route.ts`, `app/api/teacher/exams/ai-import/route.ts` (bỏ đoạn INSERT log bịa), `app/api/admin/parse-exam-text/route.ts`, `app/api/admin/test-portkey/route.ts` (nếu cần)
- `app/api/admin/settings/ai-pricing/route.ts` (mới), `app/admin/settings/page.tsx` (thêm mục bảng giá)

**Không được sửa:** `tests/**`, `e2e/**`, `docs/` (trừ file migration 014), `package*.json`. Các file của TASK-039: `app/api/student/**`, `lib/enrollment.ts`, `lib/student-slots.ts`, `app/api/teacher/**` (trừ `exams/ai-parse`, `exams/ai-import`). Các file của TASK-040: `app/admin/rubrics/**`, `app/admin/scoring-standards/**`, `components/**`.

## 3. Đặc tả
### 3.1 Migration 014 — `docs/db-migration-014-ai-usage.sql`
Chạy lặp được. Nội dung:
- `CREATE TABLE IF NOT EXISTS ai_usage_logs`, theo đúng cột cũ trong `lib/portkey.ts`.
- `ADD COLUMN IF NOT EXISTS` cho `purpose VARCHAR(30)`, `provider VARCHAR(30)`, `lesson_attempt_id VARCHAR(50)`.
- Hai index như §5.
- Seed `system_settings` khoá `'ai_pricing'` = `{"usd_vnd_rate":26000,"models":{}}`, dùng `ON CONFLICT DO NOTHING`.
- Chép cùng DDL vào `ensureSchema()`.
- Bỏ đoạn `CREATE TABLE` trong `lib/portkey.ts`.

### 3.2 `lib/ai-pricing.ts` (thuần, không import DB)
```ts
export interface ModelPrice { input_per_1m: number; output_per_1m: number }       // USD / 1 triệu token
export interface AiPricing { usd_vnd_rate: number; models: Record<string, ModelPrice> }
export const DEFAULT_AI_PRICING: AiPricing;                                         // { usd_vnd_rate: 26000, models: {} }
export function findModelPrice(model: string, p: AiPricing): ModelPrice | null;     // khớp chính xác → phần sau "/" cuối → không phân biệt hoa thường
export function costUsd(model: string, promptTokens: number, completionTokens: number, p: AiPricing): number; // token âm/NaN = 0; chưa có giá = 0
export function usdToVnd(usd: number, rate: number): number;                        // Math.round
export function validateAiPricing(x: unknown): { ok: true; value: AiPricing } | { ok: false; error: string };
```
Quy tắc của `validateAiPricing`:
- `usd_vnd_rate` là number, > 0 và ≤ 1.000.000.
- `models` là object thường (không phải mảng), tối đa 100 khoá.
- Tên model không rỗng, ≤ 100 ký tự.
- Mỗi giá là number trong khoảng 0–10.000.
- Thông điệp lỗi bằng tiếng Việt.

### 3.3 `lib/ai-usage.ts` (server)
```ts
export type AiPurpose = "EXAM_GRADING" | "LESSON_GRADING" | "EXAM_IMPORT" | "OTHER";
export interface AiUsageContext { purpose: AiPurpose; teacherId?: string | null; studentId?: string | null; submissionId?: string | null; lessonAttemptId?: string | null }
export function withAiUsageContext<T>(ctx: AiUsageContext, fn: () => Promise<T>): Promise<T>;   // AsyncLocalStorage (node:async_hooks)
export function getAiUsageContext(): AiUsageContext | undefined;
export async function getAiPricing(): Promise<AiPricing>;          // system_settings 'ai_pricing', thiếu/lỗi → DEFAULT_AI_PRICING
export async function recordAiUsage(e: { provider: string; model: string; promptTokens: number; completionTokens: number; totalTokens?: number } & Partial<AiUsageContext>): Promise<void>;
```
- `recordAiUsage` gộp tham số với ngữ cảnh hiện tại, tham số truyền thẳng thắng. `purpose` mặc định `OTHER`. `total = totalTokens ?? in + out`. `cost_usd = costUsd(...)` theo `getAiPricing()`. Id `aiu_` + uuid.
- Mọi lỗi đều bọc trong try/catch và chỉ `console.warn`, **không bao giờ ném lỗi ra ngoài**.
- Đây là nơi **duy nhất** trong `app/`, `lib/`, `worker/` có câu lệnh `INSERT INTO ai_usage_logs`.

### 3.4 Gắn vào nơi gọi model
- **`lib/ai-engine.ts`:**
  - Sau mỗi lời gọi Portkey/OpenAI **thành công** (trong `createAICompletion` và `evaluateSpeakingWithAudio`), gọi `recordAiUsage` với token lấy từ `response.usage` (`prompt_tokens`, `completion_tokens`, `total_tokens`).
  - Không có `usage` thì ghi 0. Lời gọi lỗi thì không ghi.
  - `model` lấy từ `response.model`, không có thì lấy model đã gửi đi.
  - `provider` là `"portkey"` hoặc `"openai"`.
- **`lib/document-parser.ts`:**
  - Làm tương tự ở cả 6 nhánh gọi model (Gemini REST, Portkey, OpenAI trong `extractImageOcrText` và `structureExamQuestionsWithAi`).
  - Với Gemini REST, token lấy từ `usageMetadata.promptTokenCount`, `candidatesTokenCount`, `totalTokenCount`; `provider` là `"google"`.
- **`lib/portkey.ts`:** bỏ số bịa (850/320, $0.002/1K) và câu lệnh INSERT; dùng `recordAiUsage`.
- **Route bọc ngữ cảnh:**
  - `exam/grade-async`: bọc phần chấm của một bài nộp trong `withAiUsageContext({ purpose: "EXAM_GRADING", submissionId, studentId, teacherId })`. `teacherId` là giáo viên của lớp (`class_ref`), không có lớp thì lấy người tạo đề.
  - `lessons/grade-async`: dùng `LESSON_GRADING`, kèm `lessonAttemptId`, `studentId`, `teacherId` (giáo viên của lớp).
  - `teacher/exams/ai-parse` và `admin/parse-exam-text`: dùng `EXAM_IMPORT`, `teacherId` là người gọi.
  - `ai-import`: xoá đoạn SAVEPOINT + INSERT log bịa (việc gọi AI đã được ghi ở bước parse).

### 3.5 API `app/api/admin/settings/ai-pricing/route.ts`
- `GET` (chỉ ADMIN) trả `{ success, pricing, unpriced_models }`. `unpriced_models` là danh sách các `model` khác nhau trong `ai_usage_logs` mà `findModelPrice` trả `null`, sắp xếp theo chữ cái.
- `PUT` (chỉ ADMIN) nhận body là `AiPricing`.
  - Không hợp lệ: trả 400 với `error` từ `validateAiPricing`.
  - Hợp lệ: upsert `system_settings` (ghi `updated_by` = id admin) và trả `{ success, pricing }`.
- `requireRole(["ADMIN"])` **trước** mọi truy vấn.

### 3.6 Giao diện `app/admin/settings/page.tsx`
Thêm khối **"Bảng giá model AI"** (giữ nguyên phần đang có):
- ô **Tỷ giá** USD→VND;
- bảng model gồm các cột tên model, giá input / 1M token (USD), giá output / 1M token (USD), có nút thêm dòng và xoá dòng;
- danh sách `unpriced_models` dạng gợi ý: bấm vào thì thêm thành dòng mới;
- nút Lưu gọi `PUT`. Lỗi hiển thị bằng tiếng Việt.
- Theo DEC-022/DEC-035: không viết mã hex trong class, icon trên nền xanh dùng trắng, nhãn nút không có "+" ở đầu.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-038` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Không bịa token. Ghi log không được làm hỏng hay làm chậm việc chấm: không chặn bằng lỗi, không gọi thêm model.
- `lib/ai-usage.ts` dùng `node:async_hooks`, nên **không** import vào component `"use client"`. Trang settings chỉ gọi API.
- Không đọc giá từ biến môi trường, không viết cứng giá model trong code (ngoài `DEFAULT_AI_PRICING` rỗng).
