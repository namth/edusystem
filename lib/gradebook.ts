// Lõi bảng điểm theo lớp (FEAT-014, BR-B03 → BR-B13, DEC-037 → DEC-041).
// Module thuần: không gọi DB, không import next/*.
import { computeScorePercent } from "@/lib/grading";
import { aggregateTotal, type ScoringStandard } from "@/lib/exam-scoring";
import { tallyAndScoreSections } from "@/lib/exam-attempts";
import { submissionScore } from "@/lib/score-display";

export type ItemKind = "LESSON" | "EXAM";

export class GradebookError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message || code);
    this.name = "GradebookError";
    this.status = status;
    this.code = code;
  }
}

export interface AttemptLite {
  id: string;
  status: string;
  score: number | null;
  submitted_at: string | Date;
  has_ai: boolean;
  reviewed_at: string | Date | null;
}

export interface TeacherEdit {
  question_id: string;
  item_key?: string;
  teacher_score: number | null;
  teacher_feedback?: string;
}

/** Làm tròn 0.1 (BR-B04). */
export function round1(n: number): number {
  return Math.round(n * 10 + 1e-9) / 10;
}

function toTime(v: string | Date): number {
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isGradedStatus(status: string): boolean {
  return status === "GRADED" || status === "AI_SKIPPED";
}

/** BR-B01: gộp lộ trình + bài giao, bỏ trùng (kind + id), giữ thứ tự lộ trình trước. */
export function mergeClassItems(
  roadmap: { kind: ItemKind; id: string; title: string }[],
  assignments: { exam_id: string; title: string }[]
): { kind: ItemKind; id: string; title: string; source: "ROADMAP" | "ASSIGNMENT" }[] {
  const out: { kind: ItemKind; id: string; title: string; source: "ROADMAP" | "ASSIGNMENT" }[] = [];
  const seen = new Set<string>();
  for (const r of roadmap || []) {
    const key = `${r.kind}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: r.kind, id: r.id, title: r.title, source: "ROADMAP" });
  }
  for (const a of assignments || []) {
    const key = `EXAM:${a.exam_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "EXAM", id: a.exam_id, title: a.title, source: "ASSIGNMENT" });
  }
  return out;
}

/** BR-B03: MANUAL > CHOSEN > BEST (hoà điểm lấy lượt sớm hơn). */
export function pickCountedAttempt(
  attempts: AttemptLite[],
  opt: { chosenAttemptId?: string | null; manualScore10?: number | null }
): {
  source: "MANUAL" | "CHOSEN" | "BEST" | "NONE";
  attempt: AttemptLite | null;
  state: "GRADED" | "GRADING" | "NEEDS_REVIEW" | "NOT_SUBMITTED";
} {
  if (opt && opt.manualScore10 !== null && opt.manualScore10 !== undefined) {
    return { source: "MANUAL", attempt: null, state: "GRADED" };
  }
  const list = attempts || [];
  if (opt?.chosenAttemptId) {
    const chosen = list.find((a) => a.id === opt.chosenAttemptId);
    if (chosen && chosen.status === "GRADED") {
      return { source: "CHOSEN", attempt: chosen, state: "GRADED" };
    }
  }
  const graded = list.filter((a) => isGradedStatus(a.status));
  if (graded.length > 0) {
    let best = graded[0];
    for (const a of graded.slice(1)) {
      const bs = best.score ?? -Infinity;
      const as = a.score ?? -Infinity;
      if (as > bs || (as === bs && toTime(a.submitted_at) < toTime(best.submitted_at))) best = a;
    }
    return { source: "BEST", attempt: best, state: "GRADED" };
  }
  if (list.length === 0) return { source: "NONE", attempt: null, state: "NOT_SUBMITTED" };
  let latest = list[0];
  for (const a of list.slice(1)) {
    if (toTime(a.submitted_at) > toTime(latest.submitted_at)) latest = a;
  }
  return {
    source: "NONE",
    attempt: null,
    state: latest.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "GRADING",
  };
}

/** Bài học: score_percent → thang 10. */
export function lessonScore10(scorePercent: number | null): number | null {
  if (scorePercent === null || scorePercent === undefined) return null;
  const n = Number(scorePercent);
  if (Number.isNaN(n)) return null;
  return round1(n / 10);
}

/** Đề: quy đổi total_score theo chuẩn chấm về thang 10 qua submissionScore().percent. */
export function examScore10(sub: {
  total_score: any;
  standard_snapshot: any;
  status?: string;
  [k: string]: any;
}): number | null {
  if (!sub) return null;
  const percent = submissionScore(sub).percent;
  if (percent === null || percent === undefined) return null;
  return round1(percent / 10);
}

/** BR-B05: lượt GRADED có mục AI và chưa được giáo viên duyệt. */
export function isPendingReview(a: AttemptLite): boolean {
  return a.status === "GRADED" && !!a.has_ai && !a.reviewed_at;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function validateScale(v: unknown, min: number, max: number, step: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) throw new GradebookError(400, "OUT_OF_SCALE");
  if (v < min - 1e-9 || v > max + 1e-9) throw new GradebookError(400, "OUT_OF_SCALE");
  if (step > 0) {
    const k = (v - min) / step;
    if (Math.abs(k - Math.round(k)) > 1e-9) throw new GradebookError(400, "OUT_OF_SCALE");
  }
  return v;
}

/** BR-B06/B07: áp sửa điểm giáo viên lên đề, giữ bản gốc AI, tính lại điểm phần + tổng. */
export function applyExamTeacherEdits(
  results: any[],
  snapshot: ScoringStandard,
  edits: TeacherEdit[],
  teacherId: string,
  now: Date
): {
  results: any[];
  section_scores: Record<string, any>;
  total_score: number | null;
  passed: boolean | null;
  allAiScored: boolean;
} {
  const out: any[] = clone(results || []);
  for (const e of edits || []) {
    const r = out.find((x) => x && x.question_id === e.question_id && x.kind === "AI");
    if (!r) throw new GradebookError(400, "NOT_AI_ITEM");
    const section = (snapshot?.sections || []).find((s) => s.skill === r.skill) || {
      min: 0,
      max: 9,
      step: 0.5,
    };
    if (e.teacher_score !== null && e.teacher_score !== undefined) {
      validateScale(e.teacher_score, Number(section.min), Number(section.max), Number(section.step));
    }
    // Lần sửa đầu: giữ bản gốc AI (cả dữ liệu cũ, BR-B13)
    if (r.ai_score === undefined || r.ai_score === null) {
      if (typeof r.score === "number") r.ai_score = r.score;
      if (r.feedback !== undefined && (r.ai_feedback === undefined || r.ai_feedback === null)) {
        r.ai_feedback = r.feedback;
      }
    }
    if (e.teacher_score === null || e.teacher_score === undefined) {
      delete r.teacher_score;
      delete r.teacher_feedback;
      delete r.teacher_by;
      delete r.teacher_at;
      if (typeof r.ai_score === "number") r.score = r.ai_score;
      else delete r.score;
      if (r.ai_feedback !== undefined) r.feedback = r.ai_feedback;
    } else {
      r.teacher_score = e.teacher_score;
      if (e.teacher_feedback !== undefined) r.teacher_feedback = e.teacher_feedback;
      r.teacher_by = teacherId;
      r.teacher_at = now.toISOString();
      r.score = r.teacher_score ?? r.ai_score;
    }
  }

  const sectionScores = tallyAndScoreSections(snapshot, out) as Record<string, any>;
  const aiResults = out.filter((r) => r && r.kind === "AI");
  const allAiScored = aiResults.every((r) => typeof r.score === "number" && !Number.isNaN(r.score));
  let total: number | null = null;
  let passed: boolean | null = null;
  if (allAiScored) {
    const scoreMap: Record<string, number | null> = {};
    for (const [skill, entry] of Object.entries(sectionScores)) scoreMap[skill] = (entry as any)?.score ?? null;
    const agg = aggregateTotal(snapshot, scoreMap);
    total = agg.total;
    passed = agg.passed;
  }
  return { results: out, section_scores: sectionScores, total_score: total, passed, allAiScored };
}

/** Bài học: điểm AI nằm ở items[].band (thang 0–9, bước 0.5). */
export function applyLessonTeacherEdits(
  results: any[],
  att: { objective_earned: number; objective_max: number; ai_max: number },
  edits: TeacherEdit[],
  teacherId: string,
  now: Date
): { results: any[]; ai_earned: number | null; score_percent: number | null; allAiScored: boolean } {
  const out: any[] = clone(results || []);
  for (const e of edits || []) {
    const r = out.find(
      (x) =>
        x &&
        x.kind === "AI" &&
        x.question_id === e.question_id &&
        Array.isArray(x.items) &&
        (e.item_key === undefined || x.items.some((it: any) => String(it.key) === String(e.item_key)))
    );
    if (!r) throw new GradebookError(400, "NOT_AI_ITEM");
    const item =
      e.item_key === undefined
        ? r.items[0]
        : r.items.find((it: any) => String(it.key) === String(e.item_key));
    if (!item) throw new GradebookError(400, "NOT_AI_ITEM");
    if (e.teacher_score !== null && e.teacher_score !== undefined) {
      validateScale(e.teacher_score, 0, 9, 0.5);
    }
    if ((item.ai_score === undefined || item.ai_score === null) && typeof item.band === "number") {
      item.ai_score = item.band;
    }
    if (e.teacher_score === null || e.teacher_score === undefined) {
      delete item.teacher_score;
      delete item.teacher_feedback;
      delete item.teacher_by;
      delete item.teacher_at;
      if (typeof item.ai_score === "number") item.band = item.ai_score;
      else delete item.band;
    } else {
      item.teacher_score = e.teacher_score;
      if (e.teacher_feedback !== undefined) item.teacher_feedback = e.teacher_feedback;
      item.teacher_by = teacherId;
      item.teacher_at = now.toISOString();
      item.band = item.teacher_score ?? item.ai_score;
    }
    if (typeof item.band === "number") item.correct = item.band >= 5;
    else delete item.correct;
  }

  let allAiScored = true;
  let aiEarned = 0;
  for (const r of out) {
    if (!r || r.kind !== "AI") continue;
    let earned = 0;
    for (const it of r.items || []) {
      if (typeof it.band === "number" && !Number.isNaN(it.band)) earned += it.band / 9;
      else allAiScored = false;
    }
    r.earned = earned;
    aiEarned += earned;
  }
  if (!allAiScored) return { results: out, ai_earned: null, score_percent: null, allAiScored: false };
  const scorePercent = computeScorePercent(
    Number(att.objective_earned),
    Number(att.objective_max),
    aiEarned,
    Number(att.ai_max)
  );
  return { results: out, ai_earned: aiEarned, score_percent: scorePercent, allAiScored: true };
}

/** BR-B08: điều kiện chốt bài. */
export function checkFinalize(
  rows: { student_id: string; attempts: AttemptLite[]; counted: AttemptLite | null }[],
  confirmUnreviewed: boolean
):
  | { ok: true; markReviewedIds: string[] }
  | { ok: false; code: "GRADING_PENDING"; students: string[] }
  | { ok: false; code: "UNREVIEWED"; count: number } {
  const pendingStudents: string[] = [];
  for (const row of rows || []) {
    if ((row.attempts || []).some((a) => a.status === "GRADING" || a.status === "NEEDS_REVIEW")) {
      if (!pendingStudents.includes(row.student_id)) pendingStudents.push(row.student_id);
    }
  }
  if (pendingStudents.length > 0) {
    return { ok: false, code: "GRADING_PENDING", students: pendingStudents };
  }
  const unreviewed: string[] = [];
  for (const row of rows || []) {
    if (row.counted && isPendingReview(row.counted)) unreviewed.push(row.counted.id);
  }
  if (unreviewed.length > 0 && !confirmUnreviewed) {
    return { ok: false, code: "UNREVIEWED", count: unreviewed.length };
  }
  return { ok: true, markReviewedIds: unreviewed };
}

/** BR-B10: trung bình cộng bỏ null, làm tròn 0.1; rỗng → null. */
export function average10(values: (number | null)[]): number | null {
  const nums = (values || []).filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}
