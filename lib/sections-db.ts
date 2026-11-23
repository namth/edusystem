// FEAT-017 — Cầu nối server giữa API route và lõi cây phần (lib/exam-structure.ts).
// Chỉ import ở server (dùng queryPg / pool).
import { NextResponse } from "next/server";
import { queryPg, getPgPool } from "./db-pg";
import { sanitizeQuestionForStudent, type GradableQuestion } from "./grading";
import { loadTree, withTx, TreeError, type LoadOptions, type ParentKind, type Queryable, type TreeSection } from "./exam-structure";

/** queryPg dưới dạng Queryable (không giao dịch). */
export const pgDb: Queryable = {
  query: async (text, params) => {
    const r = await queryPg(text, params);
    return { rows: r.rows };
  },
};

/** Chạy hàm trong một transaction trên một kết nối riêng. */
export async function inPgTx<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPgPool().connect();
  const db: Queryable = {
    query: async (text, params) => {
      const r = await client.query(text, params as unknown[]);
      return { rows: r.rows };
    },
  };
  try {
    return await withTx(db, fn);
  } finally {
    client.release();
  }
}

/** Câu phẳng kèm thông tin phần — giữ dạng hàng `questions` cũ cho bộ chấm / màn cũ. */
export interface FlatQuestion extends GradableQuestion {
  section_id: string;
  section_position: number;
  section_instruction: string | null;
  stimulus_text: string | null;
  stimulus_audio_url: string | null;
  number_start?: number;
  number_count?: number;
  deleted_at?: string | null;
}

export function flatQuestions(sections: TreeSection[]): FlatQuestion[] {
  return sections.flatMap((s) =>
    s.questions.map((q) => ({
      id: String(q.id),
      category: q.category,
      prompt: q.prompt ?? undefined,
      content: q.content,
      skill: s.skill,
      section_id: String(s.id),
      section_position: Number(s.position) || 0,
      section_instruction: s.instruction ?? null,
      stimulus_text: s.stimulus_text ?? null,
      stimulus_audio_url: s.stimulus_audio_url ?? null,
      number_start: q.number_start,
      number_count: q.number_count,
      deleted_at: q.deleted_at ?? null,
    }))
  );
}

/** Đọc cây + danh sách câu phẳng theo thứ tự hiển thị. */
export async function loadParentQuestions(kind: ParentKind, id: string, opts: LoadOptions = {}, db: Queryable = pgDb) {
  const sections = await loadTree(db, kind, id, opts);
  return { sections, questions: flatQuestions(sections) };
}

/** Cây cho học sinh: bỏ đáp án (BR-L09, BR-E08), bỏ cờ xoá mềm. */
export function sectionsForStudent(sections: TreeSection[]) {
  return sections.map((s) => ({
    id: s.id,
    position: s.position,
    skill: s.skill,
    instruction: s.instruction ?? null,
    stimulus_type: s.stimulus_type,
    stimulus_text: s.stimulus_text ?? null,
    stimulus_audio_url: s.stimulus_audio_url ?? null,
    questions: s.questions.map((q) => {
      const clean = sanitizeQuestionForStudent({ id: String(q.id), category: q.category, prompt: q.prompt ?? undefined, content: q.content, skill: s.skill });
      return { ...clean, section_id: s.id, number_start: q.number_start, number_count: q.number_count };
    }),
  }));
}

/** TreeError → phản hồi JSON đúng mã (400 kèm danh sách lỗi theo vị trí, 404, 409); lỗi khác → null. */
export function treeErrorResponse(e: unknown): NextResponse | null {
  if (!(e instanceof TreeError)) return null;
  return NextResponse.json({ success: false, error: e.message, errors: e.errors }, { status: e.status });
}

/** Đọc `sections` từ body (mảng) — không phải mảng thì trả null (không đổi cây). */
export function sectionsFromBody(body: unknown): TreeSection[] | null {
  if (!body || typeof body !== "object") return null;
  const s = (body as Record<string, unknown>).sections;
  return Array.isArray(s) ? (s as TreeSection[]) : null;
}

/** Gom id flashcard từ các câu bộ thẻ. */
export function flashcardIdsOf(questions: { category: string; content: unknown }[]): string[] {
  const set = new Set<string>();
  for (const q of questions) {
    if (!String(q.category).includes("FLASHCARD")) continue;
    const c = (q.content || {}) as Record<string, unknown>;
    const ids = c.flashcard_ids || c.flashcardIds;
    if (Array.isArray(ids)) for (const f of ids) if (typeof f === "string" && f.trim()) set.add(f.trim());
  }
  return [...set];
}
