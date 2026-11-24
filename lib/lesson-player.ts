export function emptyAnswerFor(q: { category: string; content: any; [k: string]: unknown }): unknown {
  const category = q?.category || "";
  // FEAT-017 (BR-P12): trắc nghiệm / trả lời ngắn một ý — đáp án là chuỗi
  if ((category.endsWith("_MC") || category === "WRITING_SHORT_ANSWER") && !Array.isArray(q?.content?.sub_questions)) {
    return "";
  }
  if (
    category.endsWith("_MC") ||
    category.endsWith("_MATCHING") ||
    category.endsWith("_FLASHCARD_SET") ||
    category === "WRITING_SHORT_ANSWER"
  ) {
    return {};
  }
  if (category.endsWith("_FILL_IN") || category === "WRITING_FREE_TYPING_BLANKS") {
    const gapCount = Number(q?.content?.gap_count) || 0;
    return Array.from({ length: gapCount }, () => "");
  }
  if (category.endsWith("_ORDERING")) {
    return [];
  }
  if (category === "WRITING_SENTENCE_REWRITE" || category === "WRITING_ESSAY") {
    return "";
  }
  return null;
}

export function setAnswerPart<T>(answer: T, key: string | number, value: unknown): T {
  if (Array.isArray(answer)) {
    const copy = [...answer];
    copy[Number(key)] = value;
    return copy as unknown as T;
  }
  if (typeof answer === "object" && answer !== null) {
    return {
      ...answer,
      [key]: value,
    } as T;
  }
  return {
    [key]: value,
  } as unknown as T;
}

export function countAnswered(
  questions: { id: string; category: string; content: any; [k: string]: unknown }[],
  answers: Record<string, unknown>
): number {
  if (!Array.isArray(questions) || !answers) return 0;
  let count = 0;
  for (const q of questions) {
    if (!q || !q.id) continue;
    const a = answers[q.id];
    if (a == null) continue;
    if (typeof a === "string") {
      if (a.trim().length > 0) count++;
    } else if (Array.isArray(a)) {
      if (
        a.length > 0 &&
        a.some((val) =>
          typeof val === "string" ? val.trim().length > 0 : val != null && val !== ""
        )
      ) {
        count++;
      }
    } else if (typeof a === "object") {
      const values = Object.values(a as Record<string, unknown>);
      if (
        values.length > 0 &&
        values.some((val) =>
          typeof val === "string" ? val.trim().length > 0 : val != null && val !== ""
        )
      ) {
        count++;
      }
    }
  }
  return count;
}

// ── Kho từ OPTION_BANK: bấm từ để điền vào ô (BR-I26) ─────────────────────
const sameWord = (a: unknown, b: unknown) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/** Từ thứ i trong kho đã được dùng chưa (kho có thể lặp từ: mỗi lần dùng chiếm một thẻ). */
export function bankUsage(bank: string[], answers: unknown[]): boolean[] {
  const left = (Array.isArray(answers) ? answers : []).filter((a) => String(a ?? "").trim() !== "");
  return bank.map((w) => {
    const k = left.findIndex((a) => sameWord(a, w));
    if (k < 0) return false;
    left.splice(k, 1);
    return true;
  });
}

/** Ô trống đầu tiên từ vị trí `from` (vòng lại đầu); hết ô trống → null. */
export function nextEmptyGap(answers: unknown[], gapCount: number, from = 0): number | null {
  for (let k = 0; k < gapCount; k++) {
    const i = (from + k) % gapCount;
    if (!String((Array.isArray(answers) ? answers[i] : "") ?? "").trim()) return i;
  }
  return null;
}

/**
 * Bấm một từ trong kho: điền vào ô đang chọn (hoặc ô trống đầu tiên), rồi chuyển sang ô trống kế tiếp.
 * Không còn ô để điền → giữ nguyên.
 */
export function pickBankWord(
  answers: unknown[],
  gapCount: number,
  active: number | null | undefined,
  word: string
): { answers: string[]; active: number | null } {
  const cur = Array.from({ length: gapCount }, (_, i) => String((Array.isArray(answers) ? answers[i] : "") ?? ""));
  const target = active != null && active >= 0 && active < gapCount ? active : nextEmptyGap(cur, gapCount);
  if (target == null) return { answers: cur, active: null };
  cur[target] = word;
  return { answers: cur, active: nextEmptyGap(cur, gapCount, target + 1) };
}

// ── Kéo thả (FEAT-017 BR-P15): cho cùng đáp án như khi bấm ─────────────────
export type BankDrag = { from: "bank"; word: string } | { from: "gap"; index: number };

/** Thả vào ô `target`: từ trong kho → điền ô; từ ô khác → đổi chỗ hai ô. */
export function dropOnGap(answers: unknown[], gapCount: number, drag: BankDrag, target: number): string[] {
  const cur = Array.from({ length: gapCount }, (_, i) => String((Array.isArray(answers) ? answers[i] : "") ?? ""));
  if (target < 0 || target >= gapCount) return cur;
  if (drag.from === "bank") {
    cur[target] = drag.word;
  } else if (drag.index !== target && drag.index >= 0 && drag.index < gapCount) {
    const t = cur[target];
    cur[target] = cur[drag.index];
    cur[drag.index] = t;
  }
  return cur;
}

/** Kéo từ một ô thả về kho → ô đó trống. */
export function dropOnBank(answers: unknown[], gapCount: number, drag: BankDrag): string[] {
  const cur = Array.from({ length: gapCount }, (_, i) => String((Array.isArray(answers) ? answers[i] : "") ?? ""));
  if (drag.from === "gap" && drag.index >= 0 && drag.index < gapCount) cur[drag.index] = "";
  return cur;
}

export type OrderDrag = { from: "pool"; item: string } | { from: "line"; index: number };

/** Sắp xếp: thả mảnh vào dòng đáp án ở vị trí `at` (chèn trước mảnh đang ở đó; at = độ dài → cuối dòng). */
export function dropOnLine(order: unknown[], drag: OrderDrag, at: number): string[] {
  const cur = (Array.isArray(order) ? order : []).map((x) => String(x ?? ""));
  let pos = Math.max(0, Math.min(at, cur.length));
  if (drag.from === "pool") {
    cur.splice(pos, 0, drag.item);
    return cur;
  }
  if (drag.index < 0 || drag.index >= cur.length) return cur;
  const [x] = cur.splice(drag.index, 1);
  if (drag.index < pos) pos -= 1;
  cur.splice(pos, 0, x);
  return cur;
}

/** Kéo mảnh trong dòng đáp án ra ngoài (về hàng có sẵn) → bỏ mảnh đó. */
export function dropOffLine(order: unknown[], drag: OrderDrag): string[] {
  const cur = (Array.isArray(order) ? order : []).map((x) => String(x ?? ""));
  if (drag.from === "line" && drag.index >= 0 && drag.index < cur.length) cur.splice(drag.index, 1);
  return cur;
}
