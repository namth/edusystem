# ADR-001: Kiến Trúc Hệ Thống Chấm Điểm Bài Thi Bằng AI

**Status:** Accepted  
**Date:** 2026-07-27  
**Session:** Grill with Docs — Lead Architect Interview  

---

## Bối Cảnh (Context)

Hệ thống EdTech hiện có luồng chấm bài một phần: auto-grading cho câu hỏi trắc nghiệm/điền từ đã hoạt động, nhưng AI grading cho Writing & Speaking còn nhiều điểm yếu nghiêm trọng:

1. **Speaking grading giả**: Audio URL gửi vào text-only model → AI không nghe được audio → fallback cứng `8.0/10` mọi lúc.
2. **Rubric hardcode**: 3 tiêu chí cố định không thể mở rộng sang IELTS, TOEIC, TOEFL.
3. **Không có teacher override**: Giáo viên không thể can thiệp vào điểm AI.
4. **Queue thiếu**: Redis Streams chưa kết nối vào grading pipeline. Grading là HTTP call đồng bộ, không retry khi fail.
5. **Bảo mật**: API key Portkey hardcode trong source code.
6. **Supabase client sai**: `grade-async/route.ts` dùng browser client thay vì server client.

---

## ADR-001-01: Speaking Grading — Gemini Multimodal via Portkey

**Quyết định:** Dùng Gemini Multimodal (audio inline) route qua Portkey để chấm Speaking. AI nhận audio file trực tiếp để đánh giá phát âm (Pronunciation), không qua STT intermediate.

**Hệ quả:**
- Thêm `evaluateSpeakingWithAudio()`: URL → fetch → base64 → multimodal Portkey request.
- Audio phải upload lên Supabase Storage trước khi trigger grading để có URL ổn định.
- Configure Portkey virtual model route tới `gemini-2.5-flash` (hỗ trợ `inlineData` audio).
- Chấm điểm xảy ra **async sau khi học sinh nộp bài**, không real-time.

---

## ADR-001-02: Pluggable Rubric Engine

**Quyết định:** Thay `EvaluationResult` hardcode 3 tiêu chí bằng bảng `scoring_rubrics` độc lập trong PostgreSQL.

**Schema `scoring_rubrics`:**
```sql
CREATE TABLE scoring_rubrics (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  scale_min       NUMERIC DEFAULT 0,
  scale_max       NUMERIC DEFAULT 9,
  scale_step      NUMERIC DEFAULT 0.5,
  criteria        JSONB NOT NULL,
  output_language TEXT DEFAULT 'vi',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- criteria shape: Array<{ key, label, weight, descriptor? }>
```

**Schema `exams` — bổ sung:**
```sql
ALTER TABLE exams
  ADD COLUMN scoring_rubric_id       TEXT REFERENCES scoring_rubrics(id),
  ADD COLUMN scoring_rubric_override JSONB;
```

**Interface mới:**
```typescript
interface EvaluationResult {
  rubricId: string;
  overallScore: number;
  bandDescriptor?: string;               // "Band 6.5 - Good User"
  criteriaScores: Record<string, number>; // Flexible key-value
  feedback: string;
  errorsDetected: string[];
  improvements: string[];
}
```

**Rubric seed sẵn:**
- `ielts_speaking`: 4 tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, **Pronunciation**), scale 0–9 step 0.5
- `ielts_writing_task2`: 4 tiêu chí (Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy), scale 0–9 step 0.5
- `internal_10`: 3 tiêu chí legacy (vocabulary, grammar, fluency), scale 0–10 step 0.5

**Lý do:** Muốn thêm TOEIC/TOEFL → chỉ cần `INSERT` 1 record. Không sửa code.

---

## ADR-001-03: Hiển Thị Điểm Tách Biệt Theo Kỹ Năng

**Quyết định:** Không gộp điểm 4 kỹ năng thành 1 điểm tổng. Hiển thị riêng biệt:
- `Objective Score: 15/20` (Reading + Listening — MC, Fill-in, Ordering, Matching)
- `Writing: Band 6.5` (AI + rubric IELTS Writing)
- `Speaking: Band 7.0` (AI + rubric IELTS Speaking)

**Lý do:** So sánh điểm Reading với Speaking là "táo với cam". Tách biệt trung thực hơn và phù hợp chuẩn IELTS.

---

## ADR-001-04: Teacher Override — AI là "Draft Grader"

**Quyết định:** Giáo viên có quyền override điểm AI cho Writing & Speaking. Kết quả cuối = `teacher_review` nếu có, fallback về `ai_evaluation_details`.

**Schema `submissions` — bổ sung:**
```sql
ALTER TABLE submissions
  ADD COLUMN grading_attempts         INTEGER DEFAULT 0,
  ADD COLUMN last_grading_error       TEXT,
  ADD COLUMN teacher_review           JSONB,
  ADD COLUMN final_evaluation_details JSONB;
```

**`teacher_review` shape:**
```json
{
  "overridden_scores": { "<questionId>": "<EvaluationResult>" },
  "teacher_note": "Bài nói có accent địa phương, AI chấm thấp hơn thực tế.",
  "reviewed_by": "teacher_id_xxx",
  "reviewed_at": "2026-07-27T10:00:00Z"
}
```

**Logic resolve điểm cuối:**
```typescript
const finalScore = submission.teacher_review?.overridden_scores?.[qId]
  ?? submission.ai_evaluation_details?.aiTasks?.[qId]?.evaluation;
```

---

## ADR-001-05: Status Machine Cho Grading Pipeline

**Quyết định:** Thêm trạng thái rõ ràng vào `submissions.status`:

```
PENDING_GRADING
    → AI_GRADING_IN_PROGRESS
        → GRADED                  (success)
        → AI_GRADING_FAILED       (retry queue, grading_attempts < 3)
        → GRADED_WITH_FALLBACK    (AI fail hết retry, dùng rule-based)
GRADED / GRADED_WITH_FALLBACK
    → TEACHER_REVIEWED            (sau khi giáo viên override)
```

**Retry policy:** Exponential backoff — 30s → 2min → 10min. Sau 3 lần → `GRADED_WITH_FALLBACK` + notify giáo viên.

---

## ADR-001-06: Redis Streams Consumer Groups + Docker Worker

**Quyết định:** Nâng cấp Redis Streams dùng **Consumer Groups** (`XGROUP CREATE` / `XACK`). Worker chạy như Docker container riêng, 24/7.

**Event mới:**
```
Stream:  stream:learning:grading
Event:   GRADING_REQUESTED
Payload: { submissionId, examId, studentId, attemptNumber }
```

**Fixes cần thiết cho `redis-queue.ts` hiện tại:**

| Vấn đề | Fix |
|---|---|
| `XREAD "0-0"` — đọc lại từ đầu | `XREADGROUP GROUP grading-workers worker-1 COUNT 5 STREAMS stream:learning:grading >` |
| Không có `XACK` | Thêm `redis.xack(stream, group, messageId)` sau xử lý thành công |
| `setInterval` trong Next.js route | Chuyển sang standalone `worker/grading-worker.ts` (Node.js process) |

**Docker Compose:**
```yaml
services:
  nextjs:
    build: .
    ports: ["3000:3000"]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  grading-worker:
    build:
      context: .
      dockerfile: worker/Dockerfile
    environment:
      - REDIS_URL=redis://redis:6379
      - PORTKEY_API_KEY=${PORTKEY_API_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
    depends_on: [redis]
    restart: unless-stopped
```

---

## ADR-001-07: Bảo Mật API Key

**Quyết định:** Xóa toàn bộ hardcoded API key. Enforce đọc từ `process.env` bắt buộc với startup validation.

**Files cần fix:**
- `lib/portkey.ts` line 4: xóa literal `"+ILfqN7XuMz/..."`
- `lib/ai-engine.ts` line 4: xóa fallback literal
- Thêm `.env.example` với tất cả biến môi trường

**Startup validation:**
```typescript
// lib/env-check.ts
const required = ['PORTKEY_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}
```

---

## ADR-001-08: Supabase Server Client Trong API Routes

**Quyết định:** Tất cả API Routes phải dùng `supabase-server.ts` (service role key), không dùng `supabase.ts` (anon key / browser client).

**Lý do:** Browser client bị giới hạn bởi Row Level Security. Server client bypass RLS — cần thiết cho grading pipeline.

---

## Bảng Tóm Tắt

| # | Chủ đề | Quyết định |
|---|---|---|
| 01 | Speaking AI | Gemini Multimodal audio-inline qua Portkey |
| 02 | Rubric | Pluggable — bảng `scoring_rubrics` + override JSONB trong `exams` |
| 03 | Điểm tổng | Tách biệt 4 kỹ năng, không gộp |
| 04 | Teacher | Có quyền override điểm AI (`teacher_review` field) |
| 05 | Status | State machine: PENDING → IN_PROGRESS → GRADED/FAILED/FALLBACK |
| 06 | Queue | Redis Consumer Groups + Docker worker riêng |
| 07 | Bảo mật | Xóa hardcode key, enforce `process.env` |
| 08 | Supabase | API routes dùng server client |

---

## Tham Chiếu

- [SCORING.md](./SCORING.md) — Chi tiết kỹ thuật implementation
- [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) — Kiến trúc tổng thể
- `app/api/exam/grade-async/route.ts` — Grading API route hiện tại
- `lib/ai-engine.ts` — AI engine hiện tại
- `lib/redis-queue.ts` — Redis queue hiện tại
