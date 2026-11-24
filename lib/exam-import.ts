// FEAT-015 — ghép bóc tách + chuyển dạng câu + AI lượt 2 + báo admin, dùng ở ai-parse (server).
import { reportAlert } from "@/lib/admin-alerts";
import { refineGroupWithAi } from "@/lib/document-parser";
import { stripHtml } from "@/lib/stimulus-html";
import {
  CONVERTER_VERSION,
  convertGroup,
  countScoreItems,
  type ConvertWarning,
  type GroupConversion,
  type RawGroup,
} from "@/lib/question-conversion";

export const MAX_REFINE_GROUPS = 10; // BR-I09
export const REFINE_TIMEOUT_MS = 20000;
const SAMPLE_MAX = 1500; // DEC-046

export interface ImportConversion {
  converterVersion: number;
  groups: GroupConversion[];
  warningsCount: number;
  scoreItems: number;
  paperQuestions: number;
}

function groupSample(g: RawGroup): string {
  const parts = [
    g.prompt,
    stripHtml(g.stimulus_html || ""),
    ...g.sub_questions.map((s) => `${s.number}. ${stripHtml(s.text_html)} ${s.options.map((o) => `${o.key}. ${stripHtml(o.text_html)}`).join(" ")}`),
  ].filter(Boolean);
  const text = parts.join("\n");
  return text.length > SAMPLE_MAX ? text.slice(0, SAMPLE_MAX - 1) + "…" : text;
}

export async function convertParsedGroups(
  groups: RawGroup[],
  ctx: { teacherId?: string; fileExt: string; file?: { mimeType: string; base64: string } }
): Promise<{ groups: RawGroup[]; conversion: ImportConversion }> {
  const finalGroups = [...groups];
  const results: GroupConversion[] = groups.map((g) => convertGroup(g));

  // AI lượt 2 cho các nhóm code không dựng được (song song, tối đa 10 nhóm)
  const pending = results.map((r, i) => ({ r, i })).filter(({ r }) => r.needsAi.length > 0).slice(0, MAX_REFINE_GROUPS);
  await Promise.all(
    pending.map(async ({ r, i }) => {
      const fixed = await refineGroupWithAi(groups[i], r.needsAi, { file: ctx.file, timeoutMs: REFINE_TIMEOUT_MS });
      if (!fixed) return;
      const again = convertGroup(fixed);
      // chỉ nhận bản sửa khi nó giảm được việc cần AI
      if (again.needsAi.length < r.needsAi.length) {
        finalGroups[i] = fixed;
        results[i] = again;
      }
    })
  );

  // Báo admin (BR-I08, BR-I09) — gộp theo lý do / dạng giấy
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const g = finalGroups[i];
    const unsupported = g.sub_questions.filter((s) => s.paper_format === "UNSUPPORTED");
    const reasons = [...new Set(unsupported.map((s) => s.unsupported_reason || "UNKNOWN"))];
    for (const reason of reasons) {
      void reportAlert({
        level: "WARN",
        source: "EXAM_IMPORT",
        title: `Nhập đề: dạng câu chưa hỗ trợ (${reason})`,
        fingerprint: `EXAM_IMPORT:UNSUPPORTED:${reason}`,
        detail: { userId: ctx.teacherId, role: "TEACHER", extra: { fileExt: ctx.fileExt, group: g.groupNumber, sample: groupSample(g) } },
      });
    }
    const failed = r.warnings.filter((w: ConvertWarning) => ["GAP_NOT_FOUND", "UNDERLINE_MISSING", "CONVERSION_FAILED"].includes(w.code));
    const formats = [...new Set(g.sub_questions.filter((s) => (s.paper_format as string) !== "UNSUPPORTED").map((s) => s.paper_format))];
    if (failed.length > 0) {
      void reportAlert({
        level: "WARN",
        source: "EXAM_IMPORT",
        title: `Nhập đề: không chuyển được dạng ${formats.join(", ")} (${failed.map((w) => w.code).join(", ")})`,
        fingerprint: `EXAM_IMPORT:CONVERSION_FAILED:${formats.join("+")}`,
        detail: { userId: ctx.teacherId, role: "TEACHER", extra: { fileExt: ctx.fileExt, group: g.groupNumber, warnings: failed.map((w) => w.message), sample: groupSample(g) } },
      });
    }
  }

  const all = results.flatMap((r) => r.questions);
  return {
    groups: finalGroups,
    conversion: {
      converterVersion: CONVERTER_VERSION,
      groups: results,
      warningsCount: results.reduce((n, r) => n + r.warnings.length, 0),
      scoreItems: all.reduce((n, q) => n + countScoreItems(q), 0),
      paperQuestions: new Set(finalGroups.flatMap((g) => g.sub_questions.map((s) => `${g.tempId}:${s.number}`))).size,
    },
  };
}
