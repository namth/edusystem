// Xem trước "như học sinh" cho giáo viên (SCR-L3): dùng chung cho bài học và đề thi.
// Giáo viên KHÔNG mở trang của phân hệ học sinh — nội dung được nạp & chấm thử qua API teacher, không lưu kết quả.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { queryPg } from "@/lib/db-pg";
import {
  gradeQuestion,
  summarizeResults,
  computeScorePercent,
  sanitizeQuestionForStudent,
  sanitizeFlashcardForStudent,
  type GradableQuestion,
  type FlashcardRow,
  type GradeResult,
} from "@/lib/grading";

export type PreviewKind = "lesson" | "exam";

const TABLE: Record<PreviewKind, "lessons" | "exams"> = { lesson: "lessons", exam: "exams" };
const NOUN: Record<PreviewKind, string> = { lesson: "Bài học", exam: "Đề thi" };

function parseIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

type Loaded =
  | { error: NextResponse }
  | {
      error?: undefined;
      row: Record<string, unknown>;
      questions: GradableQuestion[];
      flashcards: Record<string, FlashcardRow>;
    };

/** Kiểm quyền (ADMIN/TEACHER chủ sở hữu) + nạp câu hỏi đúng thứ tự và flashcard (bản gốc, chưa ẩn đáp án). */
async function loadSet(kind: PreviewKind, id: string): Promise<Loaded> {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return { error: auth.error };
  const authUser = auth.user;

  const res = await queryPg(`SELECT * FROM ${TABLE[kind]} WHERE id = $1`, [id]);
  if (res.rows.length === 0) {
    return {
      error: NextResponse.json({ success: false, error: `${NOUN[kind]} không tồn tại.` }, { status: 404 }),
    };
  }
  const row = res.rows[0];
  if (authUser.role === "TEACHER" && row.created_by !== authUser.userId) {
    return {
      error: NextResponse.json(
        { success: false, error: `Bạn không có quyền truy cập ${NOUN[kind].toLowerCase()} này.` },
        { status: 403 }
      ),
    };
  }

  const questionIds = parseIds(row.question_ids);
  const questions: GradableQuestion[] = [];
  const flashcards: Record<string, FlashcardRow> = {};

  if (questionIds.length > 0) {
    const qRes = await queryPg("SELECT * FROM questions WHERE id = ANY($1)", [questionIds]);
    const qMap = new Map<string, GradableQuestion>(
      qRes.rows.map((r: Record<string, unknown>) => [
        String(r.id),
        {
          ...r,
          content: typeof r.content === "string" ? JSON.parse(r.content) : r.content,
        } as GradableQuestion,
      ])
    );
    for (const qid of questionIds) {
      const q = qMap.get(qid);
      if (q) questions.push(q);
    }

    const flashcardIdSet = new Set<string>();
    for (const q of questions) {
      if (typeof q.category === "string" && q.category.includes("FLASHCARD")) {
        const content = (q.content ?? {}) as { flashcard_ids?: unknown; flashcardIds?: unknown };
        const ids = content.flashcard_ids || content.flashcardIds;
        if (Array.isArray(ids)) {
          for (const fid of ids) {
            if (typeof fid === "string" && fid.trim()) flashcardIdSet.add(fid.trim());
          }
        }
      }
    }

    if (flashcardIdSet.size > 0) {
      const fcRes = await queryPg("SELECT * FROM flashcards WHERE id = ANY($1)", [[...flashcardIdSet]]);
      for (const r of fcRes.rows) {
        flashcards[r.id] = {
          ...r,
          options: typeof r.options === "string" ? JSON.parse(r.options) : r.options || [],
        };
      }
    }
  }

  return { row, questions, flashcards };
}

/** GET: nội dung đã ẩn đáp án, đúng như học sinh nhìn thấy. */
export async function previewContent(kind: PreviewKind, id: string): Promise<NextResponse> {
  const loaded = await loadSet(kind, id);
  if (loaded.error) return loaded.error;
  const { row, questions, flashcards } = loaded;

  const meta =
    kind === "lesson"
      ? { id: row.id, title: row.title, description: row.description }
      : {
          id: row.id,
          title: row.title,
          description: row.description ?? null,
          duration_minutes: row.duration_minutes != null ? Number(row.duration_minutes) : 60,
          skills: Array.isArray(row.skills) ? row.skills : [],
        };

  return NextResponse.json(
    {
      success: true,
      [kind]: meta,
      questions: questions.map((q) => sanitizeQuestionForStudent(q)),
      flashcards: Object.values(flashcards).map((fc) => sanitizeFlashcardForStudent(fc)),
    },
    { status: 200 }
  );
}

/** POST: chấm thử phần khách quan, KHÔNG ghi bất kỳ lượt làm bài nào. */
export async function previewGrade(kind: PreviewKind, id: string, req: Request): Promise<NextResponse> {
  const loaded = await loadSet(kind, id);
  if (loaded.error) return loaded.error;

  let body: { answers?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Dữ liệu JSON không hợp lệ." }, { status: 400 });
  }
  const rawAnswers = body?.answers;
  if (typeof rawAnswers !== "object" || rawAnswers === null || Array.isArray(rawAnswers)) {
    return NextResponse.json({ success: false, error: "answers phải là đối tượng." }, { status: 400 });
  }
  const answers = rawAnswers as Record<string, unknown>;

  const results: GradeResult[] = loaded.questions.map((q) => gradeQuestion(q, answers[q.id], loaded.flashcards));
  const { objective_earned, objective_max, ai_max } = summarizeResults(results);
  const score_percent = computeScorePercent(objective_earned, objective_max, 0, 0);

  return NextResponse.json(
    { success: true, results, objective_earned, objective_max, ai_max, score_percent },
    { status: 200 }
  );
}
