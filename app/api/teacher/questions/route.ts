import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";
import { buildStandardQuestionContent } from "@/lib/question-content-types";

export const VALID_QUESTION_CATEGORIES = new Set([
  "READING_MC",
  "LISTENING_MC",
  "READING_FILL_IN",
  "LISTENING_FILL_IN",
  "READING_ORDERING",
  "LISTENING_ORDERING",
  "READING_MATCHING",
  "LISTENING_MATCHING",
  "WRITING_MATCHING",
  "READING_FLASHCARD_SET",
  "WRITING_FLASHCARD_SET",
  "WRITING_ESSAY",
  "WRITING_FREE_TYPING_BLANKS",
  "WRITING_SHORT_ANSWER",
  "WRITING_SENTENCE_REWRITE",
  "SPEAKING_TOPIC_PROMPT",
  "SPEAKING_READ_ALOUD",
]);

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { skill, category, prompt, stimulus_text, stimulus_audio_url, content } = body;

    if (!skill || typeof skill !== "string" || !skill.trim()) {
      return NextResponse.json({ success: false, error: "Kỹ năng (skill) không được để trống." }, { status: 400 });
    }

    if (!category || typeof category !== "string" || !VALID_QUESTION_CATEGORIES.has(category)) {
      return NextResponse.json({ success: false, error: "Loại câu hỏi (category) không hợp lệ." }, { status: 400 });
    }

    if (!content || typeof content !== "object" || Array.isArray(content)) {
      return NextResponse.json({ success: false, error: "Nội dung câu hỏi (content) phải là một object." }, { status: 400 });
    }

    let contentToSave = content;
    try {
      const merged = { ...content, ...body };
      const standard = buildStandardQuestionContent(merged);
      if (standard && typeof standard === "object" && !Array.isArray(standard)) {
        contentToSave = standard;
      }
    } catch {
      contentToSave = content;
    }

    const id = "q_" + crypto.randomUUID();
    const cleanPrompt = prompt !== undefined && prompt !== null ? String(prompt) : null;
    const cleanStimulusText = stimulus_text !== undefined && stimulus_text !== null ? String(stimulus_text) : null;
    const cleanStimulusAudio = stimulus_audio_url !== undefined && stimulus_audio_url !== null ? String(stimulus_audio_url) : null;

    const res = await queryPg(
      `INSERT INTO questions (id, skill, category, prompt, content, created_by, stimulus_text, stimulus_audio_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *;`,
      [
        id,
        skill.trim(),
        category,
        cleanPrompt,
        JSON.stringify(contentToSave),
        authUser.userId,
        cleanStimulusText,
        cleanStimulusAudio,
      ]
    );

    const question = {
      ...res.rows[0],
      content: typeof res.rows[0].content === "string" ? JSON.parse(res.rows[0].content) : res.rows[0].content,
    };

    return NextResponse.json({ success: true, question }, { status: 201 });
  } catch (err: any) {
    console.error("API /api/teacher/questions POST Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi tạo câu hỏi." }, { status: 500 });
  }
}
