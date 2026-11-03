# SCORING.md — Tài Liệu Kỹ Thuật: Hệ Thống Chấm Điểm AI

**Dự án:** English Learning & AI Mock Test System  
**Phiên bản:** 2.0 (sau Grill with Docs — 2026-07-27)  
**Tham chiếu ADR:** [ADR-001-ai-scoring-architecture.md](./ADR-001-ai-scoring-architecture.md)

---

## 1. Tổng Quan Luồng Chấm Điểm (Grading Pipeline)

```
┌─────────────────────────────────────────────────────────────┐
│                    STUDENT EXAM SUBMISSION                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Upload Speaking audio → Supabase Storage (public URL)   │
│  2. INSERT submissions {status: "PENDING_GRADING"}          │
│  3. XADD stream:learning:grading GRADING_REQUESTED {...}    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Redis Stream
                               ▼
┌─────────────────────────────────────────────────────────────┐
│              GRADING WORKER (Docker Container)               │
│                                                             │
│  XREADGROUP → pick job → UPDATE status: AI_GRADING_IN_PROGRESS
│                                                             │
│  For each question in exam:                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ MC / Fill-in / Ordering / Matching                   │  │
│  │   → Rule-based auto-grade (1pt/sub-question)         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Writing (Essay / Short Answer / Sentence Rewrite)    │  │
│  │   → Load rubric from scoring_rubrics                 │  │
│  │   → evaluateWritingWithRubric() → Portkey text call  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Speaking (Topic Prompt / Read Aloud)                 │  │
│  │   → Fetch audio from Supabase Storage URL            │  │
│  │   → Convert to base64                                │  │
│  │   → evaluateSpeakingWithAudio() → Portkey multimodal │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  → UPDATE submissions {status: "GRADED", ...details}       │
│  → XACK (acknowledge message)                               │
│  → INSERT notification for student                          │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼ (on failure, grading_attempts < 3)
┌─────────────────────────────────────────────────────────────┐
│  UPDATE status: "AI_GRADING_FAILED"                         │
│  Retry with exponential backoff: 30s → 2min → 10min         │
│  After 3 attempts → "GRADED_WITH_FALLBACK" + notify teacher │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Thay Đổi

### 2.1. Bảng Mới: `scoring_rubrics`

```sql
CREATE TABLE scoring_rubrics (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  scale_min       NUMERIC NOT NULL DEFAULT 0,
  scale_max       NUMERIC NOT NULL DEFAULT 9,
  scale_step      NUMERIC NOT NULL DEFAULT 0.5,
  criteria        JSONB NOT NULL,
  output_language TEXT NOT NULL DEFAULT 'vi',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ví dụ criteria JSONB:
-- [
--   { "key": "pronunciation", "label": "Phát Âm (Pronunciation)", "weight": 0.25,
--     "descriptor": "Assess clarity of pronunciation, word stress, intonation patterns" },
--   { "key": "fluency_coherence", "label": "Trôi Chảy & Mạch Lạc", "weight": 0.25,
--     "descriptor": "Assess speech rate, hesitation, logical flow of ideas" },
--   { "key": "lexical_resource", "label": "Vốn Từ Vựng", "weight": 0.25,
--     "descriptor": "Assess range and accuracy of vocabulary used" },
--   { "key": "grammatical_range", "label": "Ngữ Pháp & Độ Chính Xác", "weight": 0.25,
--     "descriptor": "Assess range and accuracy of grammatical structures" }
-- ]
```

### 2.2. Seed Data — Rubric Chuẩn

```sql
-- IELTS Speaking
INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria) VALUES
('ielts_speaking', 'IELTS Speaking Band Score', 'Chấm theo tiêu chí IELTS Speaking chính thức', 0, 9, 0.5, '[
  {"key":"fluency_coherence","label":"Trôi Chảy & Mạch Lạc","weight":0.25,"descriptor":"Assess fluency, coherence, hesitation frequency and repair"},
  {"key":"lexical_resource","label":"Vốn Từ Vựng","weight":0.25,"descriptor":"Assess range, accuracy and appropriacy of vocabulary"},
  {"key":"grammatical_range","label":"Ngữ Pháp & Độ Chính Xác","weight":0.25,"descriptor":"Assess range and accuracy of grammatical forms"},
  {"key":"pronunciation","label":"Phát Âm","weight":0.25,"descriptor":"Assess phonemic accuracy, word stress, sentence stress, intonation and rhythm"}
]'::jsonb);

-- IELTS Writing Task 2
INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria) VALUES
('ielts_writing_task2', 'IELTS Writing Task 2 Band Score', 'Chấm theo tiêu chí IELTS Academic Writing Task 2', 0, 9, 0.5, '[
  {"key":"task_achievement","label":"Task Achievement","weight":0.25,"descriptor":"Assess how fully the student addresses all parts of the task"},
  {"key":"coherence_cohesion","label":"Coherence & Cohesion","weight":0.25,"descriptor":"Assess logical organization and use of cohesive devices"},
  {"key":"lexical_resource","label":"Vốn Từ Vựng","weight":0.25,"descriptor":"Assess range and accuracy of vocabulary"},
  {"key":"grammatical_range","label":"Ngữ Pháp & Độ Chính Xác","weight":0.25,"descriptor":"Assess range and accuracy of grammatical structures"}
]'::jsonb);

-- Internal Scale (legacy compatibility)
INSERT INTO scoring_rubrics (id, name, description, scale_min, scale_max, scale_step, criteria) VALUES
('internal_10', 'Thang Điểm Nội Bộ 10', 'Thang điểm nội bộ cho đánh giá tổng quát', 0, 10, 0.5, '[
  {"key":"vocabulary","label":"Từ Vựng","weight":0.33},
  {"key":"grammar","label":"Ngữ Pháp","weight":0.33},
  {"key":"fluency_coherence","label":"Trôi Chảy & Mạch Lạc","weight":0.34}
]'::jsonb);
```

### 2.3. Bảng `exams` — Cột Bổ Sung

```sql
ALTER TABLE exams
  ADD COLUMN scoring_rubric_id       TEXT REFERENCES scoring_rubrics(id),
  ADD COLUMN scoring_rubric_override JSONB;
-- scoring_rubric_override: partial rubric object để merge/override rubric chuẩn
-- VD: { "scale_max": 10 } để đổi thang điểm, hoặc { "criteria": [...] } để thêm tiêu chí
```

### 2.4. Bảng `submissions` — Cột Bổ Sung

```sql
ALTER TABLE submissions
  ADD COLUMN grading_attempts         INTEGER     NOT NULL DEFAULT 0,
  ADD COLUMN last_grading_error       TEXT,
  ADD COLUMN teacher_review           JSONB,
  ADD COLUMN final_evaluation_details JSONB;

-- teacher_review shape:
-- {
--   "overridden_scores": {
--     "<questionId>": {
--       "rubricId": "ielts_speaking",
--       "overallScore": 7.5,
--       "criteriaScores": { "pronunciation": 7.5, "fluency_coherence": 7.0, ... },
--       "feedback": "...",
--       "errorsDetected": [...],
--       "improvements": [...]
--     }
--   },
--   "teacher_note": "Ghi chú tổng quan của giáo viên",
--   "reviewed_by": "teacher_uid",
--   "reviewed_at": "2026-07-27T10:00:00.000Z"
-- }

-- Status values:
-- PENDING_GRADING, AI_GRADING_IN_PROGRESS, GRADED, AI_GRADING_FAILED,
-- GRADED_WITH_FALLBACK, TEACHER_REVIEWED
```

---

## 3. TypeScript Interface Mới

### 3.1. `types/scoring.ts` (file mới)

```typescript
export interface RubricCriteria {
  key: string;
  label: string;
  weight: number;        // 0–1, tổng = 1.0
  descriptor?: string;  // Nhúng vào system prompt AI
}

export interface ScoringRubric {
  id: string;
  name: string;
  description?: string;
  scale: { min: number; max: number; step: number };
  criteria: RubricCriteria[];
  outputLanguage?: string;
}

export interface EvaluationResult {
  rubricId: string;
  overallScore: number;
  bandDescriptor?: string;               // "Band 6.5 - Good User"
  criteriaScores: Record<string, number>; // { "pronunciation": 7.0, ... }
  feedback: string;
  errorsDetected: string[];
  improvements: string[];
}

export interface TeacherReview {
  overridden_scores: Record<string, EvaluationResult>;
  teacher_note?: string;
  reviewed_by: string;
  reviewed_at: string;
}

export type SubmissionStatus =
  | 'PENDING_GRADING'
  | 'AI_GRADING_IN_PROGRESS'
  | 'GRADED'
  | 'AI_GRADING_FAILED'
  | 'GRADED_WITH_FALLBACK'
  | 'TEACHER_REVIEWED';
```

---

## 4. AI Engine — Hàm Mới & Cập Nhật

### 4.1. `evaluateSpeakingWithAudio()` — Gemini Multimodal

```typescript
// lib/ai-engine.ts
export async function evaluateSpeakingWithAudio(
  audioUrl: string,     // Supabase Storage public URL
  prompt: string,
  rubric: ScoringRubric
): Promise<EvaluationResult> {
  // 1. Fetch audio file từ URL
  const audioResponse = await fetch(audioUrl);
  const audioBuffer = await audioResponse.arrayBuffer();
  const base64Audio = Buffer.from(audioBuffer).toString('base64');
  const mimeType = audioResponse.headers.get('content-type') || 'audio/webm';

  // 2. Build dynamic system prompt từ rubric
  const criteriaDesc = rubric.criteria.map(c =>
    `- ${c.label} (${c.key}): ${c.descriptor || ''}`
  ).join('\n');

  const systemPrompt = `You are an expert IELTS Speaking examiner.
Evaluate the student's spoken audio for the given prompt.
Scale: ${rubric.scale.min}–${rubric.scale.max} (step: ${rubric.scale.step}).
Scoring criteria:
${criteriaDesc}

Return JSON:
{
  "rubricId": "${rubric.id}",
  "overallScore": <weighted average>,
  "bandDescriptor": "<band label>",
  "criteriaScores": { ${rubric.criteria.map(c => `"${c.key}": <score>`).join(', ')} },
  "feedback": "<detailed assessment in Vietnamese>",
  "errorsDetected": ["<specific pronunciation/fluency issues>"],
  "improvements": ["<actionable advice>"]
}`;

  // 3. Call Portkey với multimodal content (audio inline)
  const portkey = new Portkey({ apiKey: process.env.PORTKEY_API_KEY! });
  const response = await portkey.chat.completions.create({
    model: process.env.PORTKEY_GEMINI_MULTIMODAL_MODEL || '@nam-tran/gemini-multimodal',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Prompt: ${prompt}\n\n${systemPrompt}` },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Audio}` } }
      ]
    }],
    max_tokens: 1024,
  });
  // ... parse & return EvaluationResult
}
```

### 4.2. `evaluateWritingWithRubric()` — Dynamic Rubric

```typescript
export async function evaluateWritingWithRubric(
  essayText: string,
  prompt: string,
  rubric: ScoringRubric
): Promise<EvaluationResult> {
  const criteriaDesc = rubric.criteria.map(c =>
    `- ${c.label} (${c.key}, weight ${Math.round(c.weight * 100)}%): ${c.descriptor || ''}`
  ).join('\n');

  const systemPrompt = `You are an expert English Writing examiner.
Evaluate the student essay. Scale: ${rubric.scale.min}–${rubric.scale.max}.
Criteria:
${criteriaDesc}
Return JSON with rubricId, overallScore, bandDescriptor, criteriaScores, feedback, errorsDetected, improvements.`;
  // ... call Portkey text completion, parse result
}
```

---

## 5. Redis Consumer Group Worker

### 5.1. `worker/grading-worker.ts`

```typescript
// Standalone Node.js process — chạy trong Docker container riêng
import Redis from 'ioredis';
const STREAM = 'stream:learning:grading';
const GROUP = 'grading-workers';
const CONSUMER = `worker-${process.env.WORKER_ID || '1'}`;

async function main() {
  const redis = new Redis(process.env.REDIS_URL!);

  // Tạo Consumer Group nếu chưa có
  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM');
  } catch (e: any) {
    if (!e.message.includes('BUSYGROUP')) throw e;
  }

  console.log(`[Grading Worker] Listening on ${STREAM}...`);

  while (true) {
    // Block đọc message mới từ Consumer Group
    const result = await redis.xreadgroup(
      'GROUP', GROUP, CONSUMER,
      'COUNT', 1, 'BLOCK', 5000,
      'STREAMS', STREAM, '>'
    );

    if (!result) continue;

    for (const [, messages] of result) {
      for (const [messageId, fields] of messages) {
        const payload = JSON.parse(
          fields[fields.indexOf('payload') + 1]
        );

        try {
          await processGradingJob(payload);
          await redis.xack(STREAM, GROUP, messageId);
        } catch (err) {
          await handleGradingFailure(payload, err);
          // Không XACK → message quay lại queue để retry
        }
      }
    }
  }
}
```

### 5.2. Retry Logic

```typescript
async function handleGradingFailure(payload: any, error: unknown) {
  const { submissionId } = payload;
  const supabase = createServerSupabaseClient();

  const { data: sub } = await supabase
    .from('submissions')
    .select('grading_attempts')
    .eq('id', submissionId)
    .single();

  const attempts = (sub?.grading_attempts || 0) + 1;
  const MAX_ATTEMPTS = 3;
  const backoffMs = [30_000, 120_000, 600_000][attempts - 1] || 600_000;

  if (attempts >= MAX_ATTEMPTS) {
    // Fallback: chấm rule-based, notify teacher
    await supabase.from('submissions').update({
      status: 'GRADED_WITH_FALLBACK',
      grading_attempts: attempts,
      last_grading_error: String(error),
    }).eq('id', submissionId);
    // notify teacher...
  } else {
    await supabase.from('submissions').update({
      status: 'AI_GRADING_FAILED',
      grading_attempts: attempts,
      last_grading_error: String(error),
    }).eq('id', submissionId);

    // Schedule retry sau backoff
    setTimeout(async () => {
      await redis.xadd(STREAM, '*', 'eventType', 'GRADING_REQUESTED',
        'payload', JSON.stringify({ ...payload, attemptNumber: attempts + 1 }));
    }, backoffMs);
  }
}
```

---

## 6. Hiển Thị Điểm Trên Review Page

### 6.1. Điểm học sinh thấy (`/student/exam/review/[submissionId]`)

```
┌─────────────────────────────────────────────────────────┐
│  📊 KẾT QUẢ BÀI THI                                    │
├─────────────────────────────────────────────────────────┤
│  📖 Reading & Listening (Trắc nghiệm/Điền từ)          │
│     Điểm: 15/20 câu đúng                               │
├─────────────────────────────────────────────────────────┤
│  ✍️  Writing — IELTS Band Score                         │
│     Điểm tổng: Band 6.5                                │
│     Task Achievement: 6.5 | Coherence: 6.5             │
│     Lexical Resource: 7.0 | Grammar: 6.0               │
│     [AI Feedback Card]                                  │
├─────────────────────────────────────────────────────────┤
│  🎙️  Speaking — IELTS Band Score                        │
│     Điểm tổng: Band 7.0                                │
│     Fluency: 7.0 | Lexical: 7.0                        │
│     Grammar: 7.0 | Pronunciation: 7.0                  │
│     [AI Feedback Card] [Audio Player]                   │
└─────────────────────────────────────────────────────────┘
```

### 6.2. Resolve điểm cuối (AI vs Teacher)

```typescript
// Luôn ưu tiên teacher_review nếu có
function resolveFinalScore(submission: any, questionId: string): EvaluationResult | null {
  const teacherOverride = submission.teacher_review?.overridden_scores?.[questionId];
  if (teacherOverride) return { ...teacherOverride, _source: 'teacher' };

  const aiScore = submission.ai_evaluation_details?.aiTasks?.[questionId]?.evaluation;
  if (aiScore) return { ...aiScore, _source: 'ai' };

  return null;
}
```

---

## 7. API Routes Mới / Cập Nhật

| Method | Path | Mô tả |
|---|---|---|
| `POST` | `/api/exam/grade-async` | Trigger grading (legacy, vẫn giữ cho manual retry) |
| `PUT` | `/api/exam/grade-override` | Teacher override điểm AI (mới) |
| `GET` | `/api/exam/rubrics` | List tất cả rubrics (mới, cho Teacher UI) |

### Teacher Override API

```typescript
// PUT /api/exam/grade-override
// Body: { submissionId, questionId, overriddenScore: EvaluationResult, teacherNote }
// Auth: phải là Teacher role
```

---

## 8. Bảo Mật & Environment Variables

### 8.1. `.env.example` (cần tạo mới)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # CHỈ dùng server-side

# Portkey AI Gateway
PORTKEY_API_KEY=pk-...             # KHÔNG hardcode trong source code
PORTKEY_MODEL=@nam-tran/deep-research-pro-preview-12-2025
PORTKEY_GEMINI_MULTIMODAL_MODEL=@nam-tran/gemini-multimodal   # route → gemini-2.5-flash

# Redis
REDIS_URL=redis://localhost:6379

# Worker
WORKER_ID=1

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=...
```

### 8.2. Supabase Client Rule

```
lib/supabase.ts         → Browser client (anon key) → CHỈ dùng trong Client Components
lib/supabase-server.ts  → Server client (service role) → CHỈ dùng trong API Routes & Worker
```

---

## 9. Checklist Kiểm Tra Trước Khi Go Live

- [ ] Portkey virtual model `@nam-tran/gemini-multimodal` đã được configure route → `gemini-2.5-flash`
- [ ] Supabase Storage bucket `speaking-recordings` có policy `public read`
- [ ] Redis Consumer Group `grading-workers` được tạo khi worker khởi động
- [ ] `PORTKEY_API_KEY` không còn trong source code (scan với `git grep`)
- [ ] `grade-async/route.ts` đã dùng `supabase-server.ts`
- [ ] Tất cả status transitions được test (PENDING → IN_PROGRESS → GRADED / FAILED)
- [ ] Teacher override UI hoạt động và persist vào `teacher_review` JSONB
- [ ] Review page hiển thị đúng: teacher score nếu có, AI score nếu không
