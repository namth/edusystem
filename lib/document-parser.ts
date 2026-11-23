// Polyfill essential Web DOM APIs in Node.js server environment for pdfjs-dist / pdf-parse
if (typeof (globalThis as Record<string, unknown>).DOMMatrix === "undefined") {
  (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  };
}
if (typeof (globalThis as Record<string, unknown>).ImageData === "undefined") {
  (globalThis as Record<string, unknown>).ImageData = class ImageData {};
}
if (typeof (globalThis as Record<string, unknown>).Path2D === "undefined") {
  (globalThis as Record<string, unknown>).Path2D = class Path2D {};
}

// FEAT-009 AI nhập đề + FEAT-015 (DEC-042, DEC-045): bóc tách giữ <u>/<b>/<i>, AI gắn nhãn dạng câu trên giấy.
// Việc dựng content chuẩn do lib/question-conversion.ts làm (hàm thuần), file này chỉ lo đọc file + gọi AI.
import mammoth from "mammoth";
import { Portkey } from "portkey-ai";
import OpenAI from "openai";
import { recordAiUsage } from "@/lib/ai-usage";
import { getAiIngestionModelConfig, AiModelConfig } from "./ai-model-resolver";
import {
  PAPER_FORMATS,
  groupMissesPassage,
  type AnswerSource,
  type NeedsAiReason,
  type PaperFormat,
  type RawGroup,
  type RawOption,
  type RawSubQuestion,
} from "./question-conversion";

export interface StructuredExamResult {
  examTitle: string;
  suggestedDurationMinutes: number;
  groups: RawGroup[];
}

export interface DocumentParseResult {
  rawText: string;
  engineUsed: "DIGITAL_PARSER" | "MULTIMODAL_VISION_OCR";
  structuredData: StructuredExamResult;
}

/** Mọi nhà cung cấp AI đều lỗi (BR-W11). Route trả 503 thay vì 500. */
export class AiUnavailableError extends Error {
  code = "AI_UNAVAILABLE";
  constructor(message = "AI đang bận, vui lòng thử lại sau ít phút.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** File quá dài để AI xử lý trong một lần nhập (FEAT-015 BR-I18). Route trả 400 kèm hướng dẫn tách file. */
export class DocumentTooLongError extends Error {
  code = "DOCUMENT_TOO_LONG";
  constructor(message: string) {
    super(message);
    this.name = "DocumentTooLongError";
  }
}

/** Giới hạn của một lần nhập (BR-I18). */
export const MAX_SCANNED_PAGES = 40;
const OCR_PAGES_PER_CALL = 4;
const OCR_MAX_TOKENS = 16384;
const STRUCTURE_MAX_TOKENS = 32768;
export const STRUCTURE_MAX_CHARS = 150000;

// ── Engine 1: DOCX / PDF có chữ ──────────────────────────────────────────
const IMAGE_MARK = "[HÌNH ẢNH]";

/**
 * HTML của mammoth → văn bản có đánh dấu: giữ <u> <b> <strong> <i> <em>, đoạn/ô bảng/<br> thành xuống dòng,
 * ảnh thành "[HÌNH ẢNH]" (để AI nhận ra câu cần hình), bỏ mọi thẻ khác nhưng giữ chữ (BR-I14).
 */
export function docxHtmlToMarkedText(html: string): string {
  return html
    .replace(/<img\b[^>]*>/gi, ` ${IMAGE_MARK} `)
    .replace(/<\/(p|li|tr|h[1-6]|div|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<(\/?)(u|b|strong|i|em)\b[^>]*>/gi, "<$1$2>")
    .replace(/<(?!\/?(?:u|b|strong|i|em)>)[^>]*>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "‹")
    .replace(/&gt;/g, "›")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDigitalText(buffer: Buffer, fileExtension: string): Promise<string> {
  const ext = fileExtension.toLowerCase().replace(/^\./, "");
  if (ext === "docx") {
    const res = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: ["u => u"], // mặc định mammoth bỏ gạch chân
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
      }
    );
    return docxHtmlToMarkedText(res.value || "");
  }
  if (ext === "pdf") {
    const pages = await extractPdfPages(buffer);
    return pages.join("\n");
  }
  return "";
}

/** Chữ của từng trang PDF (pdfjs; dự phòng pdf-parse trả cả file thành một phần tử). Không đọc được → []. */
export async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  try {
    // @ts-expect-error — module worker không có khai báo kiểu
    const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    (globalThis as Record<string, unknown>).pdfjsWorker = pdfjsWorker;
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    }
    if (pages.length > 0) return pages;
  } catch (pdfjsErr) {
    console.warn("Direct pdfjs-dist text extraction failed, trying PDFParse:", (pdfjsErr as Error)?.message || pdfjsErr);
  }
  {
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new (PDFParse as unknown as new (d: Uint8Array) => { load: () => Promise<void>; getText: () => Promise<string | { text?: string }> })(new Uint8Array(buffer));
      await parser.load();
      const parsed = await parser.getText();
      const text = typeof parsed === "string" ? parsed : parsed?.text || "";
      if (text.trim().length > 0) return [text];
    } catch (err) {
      console.warn("Digital PDF text extraction error, will fallback to OCR:", (err as Error)?.message || err);
    }
  }
  return [];
}

/** Số ký tự tối thiểu để một trang được coi là "có chữ thật". */
const MIN_PAGE_TEXT = 120;

/**
 * PDF scan có lớp chữ rác (watermark, số trang, đầu/chân trang lặp lại) vẫn phải OCR (BR-I18).
 * Bỏ các chuỗi ngắn xuất hiện nguyên trang ở ≥ 2 trang khỏi mọi trang, rồi đếm trang còn ≥ MIN_PAGE_TEXT ký tự;
 * ít hơn một nửa số trang có chữ thật → coi là bản scan.
 */
export function pdfTextLooksScanned(pages: string[]): boolean {
  if (pages.length === 0) return true;
  const norm = pages.map((p) => p.replace(/\s+/g, " ").trim());
  const freq = new Map<string, number>();
  for (const p of norm) if (p && p.length < 100) freq.set(p, (freq.get(p) || 0) + 1);
  const noise = [...freq].filter(([, n]) => n >= 2).map(([t]) => t);
  const withText = norm.filter((p) => {
    let t = p;
    for (const w of noise) t = t.split(w).join(" ");
    return t.replace(/\s+/g, " ").trim().length >= MIN_PAGE_TEXT;
  }).length;
  return withText < Math.ceil(pages.length / 2);
}

// ── Gọi model (chuỗi dự phòng Gemini → Portkey → OpenAI) ─────────────────
interface InlineFile {
  mimeType: string;
  base64: string;
}

async function callGemini(model: string, text: string, config: AiModelConfig, json: boolean, file?: InlineFile): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const parts: Record<string, unknown>[] = [{ text }];
  if (file) parts.push({ inlineData: { mimeType: file.mimeType, data: file.base64 } });
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        ...(json ? { responseMimeType: "application/json" } : {}),
        temperature: config.temperature ?? 0.1,
        maxOutputTokens: config.max_tokens ?? 8192,
      },
    }),
  });
  if (!response.ok) {
    // ghi lý do để chẩn đoán (429/503 quá tải, 400 sai tham số…) — không lộ API key
    const body = await response.text().catch(() => "");
    console.warn(`Gemini ${model} HTTP ${response.status}: ${body.slice(0, 300)}`);
    return null;
  }
  const data = await response.json();
  const out = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    console.warn(`Gemini ${model} hết giới hạn ${config.max_tokens ?? 8192} token đầu ra`);
    // JSON bị cắt giữa chừng không dùng được — báo giáo viên tách file thay vì lỗi 500 (BR-I18)
    if (json) throw new DocumentTooLongError("Đề quá dài để AI xử lý trong một lần. Hãy tách file theo từng phần (vd mỗi kỹ năng hoặc mỗi bài đọc một file, kèm trang đáp án) rồi nhập lần lượt.");
  }
  if (!out) {
    if (data.candidates?.[0]?.finishReason) console.warn(`Gemini finishReason: ${data.candidates[0].finishReason}`);
    return null;
  }
  const usage = data.usageMetadata;
  await recordAiUsage({
    provider: "google",
    model,
    promptTokens: usage?.promptTokenCount ?? 0,
    completionTokens: usage?.candidatesTokenCount ?? 0,
    totalTokens: usage?.totalTokenCount ?? ((usage?.promptTokenCount ?? 0) + (usage?.candidatesTokenCount ?? 0)),
  });
  return out;
}

type ChatContent = string | { type: string; text?: string; image_url?: { url: string } }[];

async function callChat(
  provider: "portkey" | "openai",
  system: string | null,
  user: ChatContent,
  config: AiModelConfig,
  json: boolean
): Promise<string | null> {
  const messages = [
    ...(system ? [{ role: "system" as const, content: system }] : []),
    { role: "user" as const, content: user },
  ];
  if (provider === "portkey") {
    const apiKey = process.env.PORTKEY_API_KEY;
    if (!apiKey) return null;
    const portkey = new Portkey({ apiKey, config: process.env.PORTKEY_CONFIG_ID || "pc-gemini-f72e00" });
    const sentModel = config.model || "gemini-2.5-flash";
    const response = await portkey.chat.completions.create({
      model: sentModel,
      messages: messages as never,
      ...(json ? { response_format: { type: "json_object" } } : {}),
      temperature: config.temperature ?? 0.1,
      max_tokens: config.max_tokens ?? 8192,
    });
    const content = response.choices?.[0]?.message?.content;
    if (!content) return null;
    const p = response.usage?.prompt_tokens ?? 0;
    const c = response.usage?.completion_tokens ?? 0;
    await recordAiUsage({ provider: "portkey", model: (response as { model?: string }).model || sentModel, promptTokens: p, completionTokens: c, totalTokens: response.usage?.total_tokens ?? p + c });
    return typeof content === "string" ? content : JSON.stringify(content);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const openai = new OpenAI({ apiKey });
  const sentModel = Array.isArray(user) ? "gpt-4o" : "gpt-4o-mini";
  const response = await openai.chat.completions.create({
    model: sentModel,
    messages: messages as never,
    ...(json ? { response_format: { type: "json_object" as const } } : {}),
    temperature: 0.1,
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) return null;
  const p = response.usage?.prompt_tokens ?? 0;
  const c = response.usage?.completion_tokens ?? 0;
  await recordAiUsage({ provider: "openai", model: (response as { model?: string }).model || sentModel, promptTokens: p, completionTokens: c, totalTokens: response.usage?.total_tokens ?? p + c });
  return content;
}

function geminiCandidates(config: AiModelConfig): string[] {
  const first = config.model === "gemini-2.5-flash" || !config.model ? "gemini-flash-lite-latest" : config.model;
  return [...new Set([first, "gemini-3.5-flash-lite", "gemini-3.7-flash"])];
}

/** Gọi lần lượt các nhà cung cấp, trả chuỗi đầu tiên có nội dung. Hết cách → AiUnavailableError. */
async function runModel(opts: { system: string; user: string; config: AiModelConfig; json: boolean; file?: InlineFile }): Promise<string> {
  for (const model of geminiCandidates(opts.config)) {
    try {
      const out = await callGemini(model, `${opts.system}\n\n${opts.user}`, opts.config, opts.json, opts.file);
      if (out) return out;
    } catch (err) {
      if (err instanceof DocumentTooLongError) throw err;
      console.warn(`Gemini ${model} lỗi, thử model kế:`, (err as Error)?.message || err);
    }
  }
  const imageOnly = opts.file && opts.file.mimeType.startsWith("image/") ? opts.file : undefined;
  if (opts.file && !imageOnly) {
    // Portkey/OpenAI không nhận PDF gửi kèm — chỉ Gemini đọc được file gốc
    throw new AiUnavailableError();
  }
  const userContent: ChatContent = imageOnly
    ? [{ type: "text", text: opts.user }, { type: "image_url", image_url: { url: `data:${imageOnly.mimeType};base64,${imageOnly.base64}` } }]
    : opts.user;
  for (const provider of ["portkey", "openai"] as const) {
    try {
      const out = await callChat(provider, opts.system, userContent, opts.config, opts.json);
      if (out) return out;
    } catch (err) {
      console.warn(`${provider} lỗi:`, (err as Error)?.message || err);
    }
  }
  throw new AiUnavailableError();
}

function cleanJsonText(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
}

// ── Engine 2: OCR ảnh / PDF scan ─────────────────────────────────────────
const OCR_PROMPT = `You are an academic exam transcriber. Transcribe ALL text of this exam document in reading order: instructions, passages, question numbers, stems, options A/B/C/D, word boxes, answer keys.
Rules:
- Wrap underlined text in <u>…</u>, bold in <b>…</b>, italic in <i>…</i>. This is critical for pronunciation / error-identification questions.
- Keep blanks exactly as printed (e.g. "(25) ______", "_____").
- Where a picture, sign or chart is needed to answer, write ${IMAGE_MARK} followed by a short description.
- Output plain text only (no markdown).`;

export async function extractImageOcrText(buffer: Buffer, mimeType: string, modelConfig: AiModelConfig): Promise<string> {
  return runModel({
    system: OCR_PROMPT,
    user: "Transcribe this document.",
    config: modelConfig,
    json: false,
    file: { mimeType: mimeType || "image/jpeg", base64: buffer.toString("base64") },
  });
}

/**
 * OCR PDF scan theo cụm OCR_PAGES_PER_CALL trang, chạy song song (BR-I18): một lần gọi không đủ token đầu ra
 * cho cả file. Gửi cả file, yêu cầu chép đúng dải trang. Quá MAX_SCANNED_PAGES trang → DocumentTooLongError.
 */
export async function ocrPdfByPages(buffer: Buffer, numPages: number, modelConfig: AiModelConfig): Promise<string> {
  if (numPages > MAX_SCANNED_PAGES) {
    throw new DocumentTooLongError(
      `File scan có ${numPages} trang, vượt giới hạn ${MAX_SCANNED_PAGES} trang mỗi lần nhập. Hãy tách file theo từng đề hoặc từng kỹ năng (kèm trang đáp án) rồi nhập lần lượt.`
    );
  }
  const config = { ...modelConfig, max_tokens: Math.max(modelConfig.max_tokens ?? 8192, OCR_MAX_TOKENS) };
  if (numPages <= OCR_PAGES_PER_CALL) return extractImageOcrText(buffer, "application/pdf", config);
  const file = { mimeType: "application/pdf", base64: buffer.toString("base64") };
  const transcribe = (a: number, b: number) =>
    runModel({
      system: OCR_PROMPT,
      user: `The attached PDF has ${numPages} pages. Transcribe ONLY pages ${a} to ${b} (page 1 is the first page of the file), completely, and begin each page with a line "${PAGE_MARK} <page number> ===". Do not transcribe any other page.`,
      config,
      json: false,
      file,
    });
  const ranges: [number, number][] = [];
  for (let a = 1; a <= numPages; a += OCR_PAGES_PER_CALL) ranges.push([a, Math.min(numPages, a + OCR_PAGES_PER_CALL - 1)]);
  const pages = new Map<number, string>();
  const collect = (out: string, a: number, b: number) => {
    for (const [n, t] of splitOcrPages(out)) if (n >= a && n <= b && !pages.has(n)) pages.set(n, t);
  };
  (await Promise.all(ranges.map(([a, b]) => transcribe(a, b)))).forEach((out, i) => collect(out, ...ranges[i]));
  // Trang bị bỏ sót (AI chép thiếu dải trang) → chép lại riêng từng trang một lần
  const missing = Array.from({ length: numPages }, (_, i) => i + 1).filter((n) => !pages.has(n));
  if (missing.length) {
    console.warn(`OCR thiếu trang ${missing.join(", ")} — chép lại từng trang`);
    const again = await Promise.all(missing.map((n) => transcribe(n, n).catch(() => "")));
    again.forEach((out, i) => {
      collect(out, missing[i], missing[i]);
      // không có dấu trang nhưng có chữ → coi là trang đó
      if (!pages.has(missing[i]) && out.trim()) pages.set(missing[i], out.trim());
    });
    const still = missing.filter((n) => !pages.has(n));
    // Không bao giờ tạo đề thiếu trang mà không báo (BR-I18): giáo viên thử lại sau, admin được báo qua AI_UNAVAILABLE
    if (still.length) throw new AiUnavailableError(`AI chưa đọc được trang ${still.join(", ")} của file. Vui lòng thử lại sau ít phút.`);
  }
  return [...pages.entries()].sort((x, y) => x[0] - y[0]).map(([, t]) => t).join("\n");
}

const PAGE_MARK = "=== PAGE";

/** Tách kết quả OCR theo dấu "=== PAGE n ===" → [[n, chữ], …]. Không có dấu → []. */
export function splitOcrPages(out: string): [number, string][] {
  const re = /^\s*=+\s*PAGE\s+(\d+)\s*=*\s*$/gim;
  const marks: { n: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(out)) !== null) marks.push({ n: Number(m[1]), start: m.index, end: re.lastIndex });
  return marks.map((mk, i) => [mk.n, out.slice(mk.end, i + 1 < marks.length ? marks[i + 1].start : undefined).trim()] as [number, string]);
}

// ── Cấu trúc hoá + gắn nhãn dạng câu (DEC-042) ───────────────────────────
const FORMAT_GUIDE = `paper_format — choose exactly one:
- PRONUNCIATION: choose the word whose underlined part is pronounced differently (options contain <u>).
- STRESS: choose the word with a different stress position.
- CLOZE_PASSAGE: a passage with numbered blanks; each blank is one question with its own options A–D.
- SENTENCE_BLANK: ONE sentence with exactly ONE blank; the options fill that blank.
- SENTENCE_MULTI_BLANK: ONE sentence with 2+ blanks; each option fills all blanks (e.g. "who / which").
- WORD_BOX: fill blanks using words from a given box (questions have no own options).
- SENTENCE_ARRANGEMENT: arrange sentences/ideas labelled a, b, c… into a paragraph, letter or dialogue; options are orders like "b-d-a-c".
- WORD_ARRANGEMENT: words/phrases separated by "/" to be arranged; options are complete sentences.
- MATCHING: match items with a list of choices — two columns, matching information to paragraphs, headings to paragraphs, features, classification, sentence endings. Put the choices in matching.right [{key, text}] (key exactly as printed: "A", "vii"…), each item is one sub-question (text_html = the item), correct_answer = the choice key. Choices may be used more than once or not at all.
- ERROR_IDENTIFICATION: a sentence with 4 underlined parts labelled A–D; find the mistake.
- SYNONYM_ANTONYM: closest / opposite meaning to the underlined word(s).
- READING_COMPREHENSION: questions about a reading passage, including TRUE / FALSE / NOT GIVEN and YES / NO / NOT GIVEN (options A "TRUE", B "FALSE", C "NOT GIVEN" — or YES / NO / NOT GIVEN; correct_answer is the letter).
- SENTENCE_TRANSFORMATION: choose the sentence closest in meaning to a given sentence.
- SENTENCE_COMBINATION: choose the sentence that best combines two sentences.
- DIALOGUE_RESPONSE: choose the best response in an exchange.
- GENERAL_MC: any other multiple-choice question.
- REWRITE_WITH_CUE: rewrite a sentence starting with given words (written answer, no options).
- ESSAY: write a paragraph / essay / letter.
- SHORT_ANSWER: the student writes a few words or a number: sentence / summary / note / table / form / flow-chart completion ("NO MORE THAN TWO WORDS…") and short-answer questions. When the blanks sit in a shared text, put that text in stimulus_html with every blank marked "(n) ____". correct_answer = the exact words from the key; keep alternatives separated by " / " and write optional words in round brackets, e.g. "(space) race".
- UNSUPPORTED: needs a picture, sign, chart or table (${IMAGE_MARK}) to answer, or a format not listed above. Set unsupported_reason to NEEDS_IMAGE, NEEDS_TABLE or UNKNOWN.`;

const STRUCTURE_PROMPT = `You are an expert exam ingestion AI. Paper exams present almost everything as multiple choice A/B/C/D. Extract the exam into JSON and LABEL every question with its paper format so the system can convert it into interactive question types.

INPUT may contain <u>, <b>, <i> tags (underline / bold / italic) and "${IMAGE_MARK}" where an image was. KEEP these tags exactly as they appear inside text_html, options[].text_html and stimulus_html.

GROUPING: questions sharing one instruction or passage form ONE group.
- prompt: the shared instruction (e.g. "Read the following passage and mark the letter A, B, C, or D…").
- stimulus_html: the shared passage, copied in full with every numbered blank exactly as printed (e.g. "(25) ______"). null if none.
- word_box: list of words when a word box is given, else omit.
- matching: { "left": [{key,text}], "right": [{key,text}] } for matching tasks, else omit.
- passage_id: when several groups with different instructions all refer to the SAME long reading passage (e.g. IELTS "Reading Passage 1" followed by True/False/Not Given, matching and summary questions), copy that passage ONCE, in full, into the top-level "passages" array and set passage_id on EVERY group that uses it. stimulus_html then holds only text specific to the group (a summary with blanks, a list of headings, a table), or null.

EACH QUESTION (sub_questions[]):
- number: the question number printed on the paper.
- text_html: the stem (keep blanks "____" as printed; for a cloze blank use "Câu <number>").
- options: [{ "key": "A", "text_html": "…" }, …] exactly as printed (empty for WORD_BOX / MATCHING / REWRITE_WITH_CUE / ESSAY / SHORT_ANSWER).
- correct_answer: the letter A–D; for WORD_BOX the word; for MATCHING the right-column key; for REWRITE_WITH_CUE / SHORT_ANSWER the sample answer; null if unknown.
- answer_source: "KEY" if taken from an answer key in the document; "AI_SOLVED" if the document has no key and you solved it; "NONE" if you cannot tell. Never invent a key silently.
- paper_format: see the list below. unsupported_reason only when UNSUPPORTED.
- confidence: 0–1, how sure you are about paper_format.

${FORMAT_GUIDE}

Output ONLY this JSON:
{
  "examTitle": "string",
  "suggestedDurationMinutes": 60,
  "passages": [{ "id": "P1", "html": "Title\\n\\nA  First paragraph…\\n\\nB  Second paragraph…" }],
  "groups": [
    {
      "skill": "Reading",
      "prompt": "…",
      "stimulus_html": "… (25) ______ …" ,
      "sub_questions": [
        { "number": 25, "text_html": "Câu 25", "options": [{"key":"A","text_html":"…"},{"key":"B","text_html":"…"},{"key":"C","text_html":"…"},{"key":"D","text_html":"…"}],
          "correct_answer": "B", "answer_source": "KEY", "paper_format": "CLOZE_PASSAGE", "confidence": 0.95 }
      ]
    }
  ]
}`;

const ANSWER_SOURCES: AnswerSource[] = ["KEY", "AI_SOLVED", "NONE", "TEACHER"];

type Loose = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v === null || v === undefined ? "" : String(v));

function normalizeOption(o: unknown, i: number): RawOption {
  if (typeof o === "string") return { key: String.fromCharCode(65 + i), text_html: o };
  const x = (o || {}) as Loose;
  return { key: (str(x.key) || String.fromCharCode(65 + i)).toUpperCase(), text_html: str(x.text_html ?? x.text) };
}

/**
 * Bỏ tiền tố số câu đề giấy chép kèm ("<b>Câu 5.</b> ", "Question 5:", "5. ") — LessonPlayer tự hiện số câu (BR-I20).
 * Chỉ bỏ khi số trùng số câu, để không cắt câu bắt đầu bằng con số. Phần còn lại chỉ là dãy phương án
 * "A. … B. … C. …" (câu ngữ âm/trọng âm) → rỗng, vì phương án đã hiện thành nút chọn.
 */
export function cleanSubText(html: string, number: number, optionCount: number): string {
  const tag = String.raw`(?:<\/?(?:b|strong|i|em|u)>\s*)*`;
  const prefix = new RegExp(String.raw`^\s*${tag}(?:(?:Câu|Question|Q)\s*${number}|${number}(?=\s*[.):]))\s*[.):]?\s*${tag}\s*(?:[-–—]\s*)?`, "i");
  let out = html.replace(prefix, "");
  // thẻ đóng mồ côi còn sót ngay đầu sau khi cắt (vd "</b> text")
  out = out.replace(/^(?:\s*<\/(?:b|strong|i|em|u)>)+\s*/i, "");
  // gạch đầu dòng hội thoại "- Laura: …" còn lại ngay đầu câu
  out = out.replace(/^[-–—]\s+/, "");
  const plainText = out.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  if (optionCount >= 2 && /^A\s*[.)]\s*\S.*\bB\s*[.)]\s*\S.*\bC\s*[.)]\s*\S/.test(plainText)) return "";
  return out.trim();
}

function normalizeSub(s: unknown, gIdx: number, sIdx: number): RawSubQuestion {
  const x = (s || {}) as Loose;
  const format = str(x.paper_format).toUpperCase();
  const known = (PAPER_FORMATS as readonly string[]).includes(format);
  const rawAnswer = str(x.correct_answer).trim();
  const src = str(x.answer_source).toUpperCase() as AnswerSource;
  const conf = Number(x.confidence);
  const options = Array.isArray(x.options) ? x.options.map(normalizeOption) : [];
  // Đáp án ghi bằng nội dung phương án ("FALSE", "NOT GIVEN") thay vì chữ cái → đổi về khoá của phương án đó
  const byText = rawAnswer && !options.some((o) => o.key.toLowerCase() === rawAnswer.toLowerCase())
    ? options.find((o) => o.text_html.replace(/<[^>]*>/g, "").trim().toLowerCase() === rawAnswer.toLowerCase())
    : undefined;
  const answer = byText ? byText.key : rawAnswer || null;
  const number = Number(x.number) || sIdx + 1;
  return {
    id: str(x.id) || `sub_${gIdx + 1}_${sIdx + 1}`,
    number,
    text_html: cleanSubText(str(x.text_html ?? x.text), number, options.length),
    options,
    // Không bao giờ tự gán "A" khi thiếu đáp án (BR-I07)
    correct_answer: answer,
    answer_source: !answer ? "NONE" : ANSWER_SOURCES.includes(src) ? src : "KEY",
    paper_format: (known ? format : "GENERAL_MC") as PaperFormat,
    unsupported_reason: x.unsupported_reason ? str(x.unsupported_reason) : undefined,
    confidence: known ? (Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.7) : 0.3,
  };
}

export function normalizeGroup(g: unknown, gIdx: number, fallbackSkill = "Reading", passages?: Map<string, string>): RawGroup {
  const x = (g || {}) as Loose;
  const subsRaw = Array.isArray(x.sub_questions) ? x.sub_questions : [x];
  const m = x.matching as Loose | undefined;
  const pairList = (v: unknown) =>
    Array.isArray(v)
      ? v.map((p, i) => {
          const o = (p && typeof p === "object" ? p : { text: p }) as Loose;
          return { key: str(o.key) || String.fromCharCode(97 + i), text: str(o.text ?? o.text_html ?? o.label) };
        })
      : [];
  return {
    tempId: str(x.tempId) || `group_${gIdx + 1}`,
    groupNumber: gIdx + 1,
    skill: str(x.skill) || fallbackSkill,
    prompt: str(x.prompt) || `Phần ${gIdx + 1}`,
    stimulus_html: str(x.stimulus_html ?? x.stimulus_text) || null,
    word_box: Array.isArray(x.word_box) ? x.word_box.map(str).filter(Boolean) : undefined,
    matching: m && (Array.isArray(m.left) || Array.isArray(m.right)) ? { left: pairList(m.left), right: pairList(m.right) } : undefined,
    passage_html: str(x.passage_html) || (passages && x.passage_id ? passages.get(str(x.passage_id)) || null : null),
    sub_questions: subsRaw.map((s, i) => normalizeSub(s, gIdx, i)),
  };
}

export function normalizeStructuredResult(data: unknown): StructuredExamResult {
  const x = (data || {}) as Loose;
  const list = Array.isArray(x.groups) ? x.groups : Array.isArray(x.questions) ? x.questions : [];
  const passageMap = new Map<string, string>();
  if (Array.isArray(x.passages)) {
    // bỏ dấu tiêu đề markdown ("# Invasive species") mà AI hay chèn
    for (const p of x.passages as Loose[]) if (p && str(p.id) && str(p.html ?? p.text)) passageMap.set(str(p.id), str(p.html ?? p.text).replace(/^#{1,6}\s+/gm, ""));
  }
  return {
    examTitle: str(x.examTitle) || "Đề Thi AI Trích Xuất Mới",
    suggestedDurationMinutes: Number(x.suggestedDurationMinutes) || 60,
    groups: list.map((g, i) => normalizeGroup(g, i, "Reading", passageMap)),
  };
}

/** Số câu mà đề tự khai qua tiêu đề "Questions 1–3", "Questions 14 and 15", "Question 12" (BR-I19). */
export function expectedQuestionNumbers(rawText: string): Set<number> {
  const out = new Set<number>();
  const range = /Questions?\s+(\d{1,3})\s*(?:[-–—]|to|and)\s*(\d{1,3})/gi;
  let m: RegExpExecArray | null;
  while ((m = range.exec(rawText)) !== null) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (b >= a && b - a <= 60) for (let n = a; n <= b; n++) out.add(n);
  }
  const single = /Question\s+(\d{1,3})(?!\s*(?:[-–—\d]|to|and))/g;
  while ((m = single.exec(rawText)) !== null) out.add(Number(m[1]));
  return out;
}

export async function structureExamQuestionsWithAi(rawText: string, targetSkill?: string, modelConfig?: AiModelConfig): Promise<StructuredExamResult> {
  const base = modelConfig || (await getAiIngestionModelConfig());
  if (rawText.length > STRUCTURE_MAX_CHARS) {
    throw new DocumentTooLongError("Đề quá dài để AI xử lý trong một lần. Hãy tách file theo từng phần (vd mỗi kỹ năng một file, kèm trang đáp án) rồi nhập lần lượt.");
  }
  const config = { ...base, max_tokens: Math.max(base.max_tokens ?? 8192, STRUCTURE_MAX_TOKENS) };
  const run = async () =>
    normalizeStructuredResult(
      JSON.parse(
        cleanJsonText(
          await runModel({
            system: STRUCTURE_PROMPT,
            user: `Target Skill Filter: ${targetSkill || "Auto"}\n\nDocument Text to Parse:\n"""\n${rawText}\n"""`,
            config,
            json: true,
          })
        )
      )
    );
  const first = await run();
  // BR-I17/BR-I19: AI đôi khi dừng giữa chừng hoặc làm rơi bài đọc dài → chạy lại một lần, giữ kết quả tốt hơn
  const expected = expectedQuestionNumbers(rawText);
  const lacks = (r: StructuredExamResult) => {
    const got = new Set(r.groups.flatMap((g) => g.sub_questions.map((q) => q.number)));
    return { numbers: [...expected].filter((n) => !got.has(n)).length, passages: r.groups.filter(groupMissesPassage).length };
  };
  const a = lacks(first);
  const tooFew = expected.size >= 5 && a.numbers > expected.size * 0.1;
  if (!tooFew && a.passages === 0) return first;
  console.warn(`AI cấu trúc thiếu ${a.numbers}/${expected.size} câu, rơi bài đọc ở ${a.passages} nhóm — cấu trúc lại một lần`);
  const second = await run().catch(() => null);
  if (!second) return first;
  const b = lacks(second);
  return b.numbers < a.numbers || (b.numbers === a.numbers && b.passages < a.passages) ? second : first;
}

const wordsOf = (h: string | null | undefined) =>
  (h || "").replace(/<[^>]*>/g, " ").toLowerCase().match(/[\p{L}\p{N}']+/gu) || [];

/**
 * BR-I22: AI lượt 2 chỉ được sửa dấu ô / thẻ gạch chân, không được viết đoạn văn mới. Bản sửa bị loại khi hơn 10%
 * từ trong đoạn dẫn hoặc chữ câu không có trong bản gốc (đoạn dẫn + bài đọc chung + chữ câu + phương án + lời dẫn).
 */
export function refineKeepsWording(orig: RawGroup, fixed: RawGroup): boolean {
  const source = new Set([
    ...wordsOf(orig.prompt),
    ...wordsOf(orig.stimulus_html),
    ...wordsOf(orig.passage_html),
    ...orig.sub_questions.flatMap((s) => [...wordsOf(s.text_html), ...s.options.flatMap((o) => wordsOf(o.text_html))]),
  ]);
  const produced = [...wordsOf(fixed.stimulus_html), ...fixed.sub_questions.flatMap((s) => wordsOf(s.text_html))];
  if (produced.length === 0) return true;
  const unknown = produced.filter((w) => !source.has(w) && !/^\d+$/.test(w)).length;
  return unknown / produced.length <= 0.1;
}

/** AI lượt 2 cho riêng một nhóm code không dựng được (BR-I09). Trả nhóm đã sửa, hoặc null nếu lỗi / quá thời gian. */
export async function refineGroupWithAi(
  group: RawGroup,
  reasons: NeedsAiReason[],
  opts: { file?: InlineFile; timeoutMs?: number; modelConfig?: AiModelConfig } = {}
): Promise<RawGroup | null> {
  const tasks: string[] = [];
  if (reasons.includes("GAP_NOT_FOUND")) {
    tasks.push(
      'Some blanks could not be located. Rewrite stimulus_html so that EVERY question\'s blank is marked exactly as "(n) ____" where n is the question number, in reading order. For single-sentence questions, rewrite text_html so each blank is exactly "____". Do not change any other wording.'
    );
  }
  const config = opts.modelConfig || (await getAiIngestionModelConfig());
  const run = runModel({
    system: `You fix one group of an extracted exam. ${tasks.join(" ")}\nNEVER invent, translate or add any text: use only words that appear in the input (or the attached document). If the passage that holds the blanks is "shared_passage", copy it into stimulus_html with the blanks marked; if no passage is given at all, return stimulus_html unchanged.\nReturn ONLY the corrected group JSON with the same shape and the same question numbers.`,
    user: JSON.stringify({
      skill: group.skill,
      prompt: group.prompt,
      stimulus_html: group.stimulus_html,
      shared_passage: group.passage_html ?? null,
      word_box: group.word_box,
      sub_questions: group.sub_questions,
    }),
    config,
    json: true,
  });
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), opts.timeoutMs ?? 20000));
  try {
    const out = await Promise.race([run, timeout]);
    if (!out) return null;
    const fixed = normalizeGroup(JSON.parse(cleanJsonText(out)), group.groupNumber - 1, group.skill);
    if (!refineKeepsWording(group, fixed)) {
      console.warn(`AI lượt 2 nhóm ${group.groupNumber}: bản sửa có chữ không có trong bản gốc — bỏ qua`);
      return null;
    }
    // giữ định danh nhóm, đáp án và nguồn đáp án gốc theo số câu (AI lượt 2 chỉ sửa chữ)
    const byNum = new Map(group.sub_questions.map((s) => [s.number, s]));
    return {
      ...fixed,
      tempId: group.tempId,
      groupNumber: group.groupNumber,
      passage_html: group.passage_html,
      sub_questions: fixed.sub_questions.map((s) => {
        const orig = byNum.get(s.number);
        return orig ? { ...s, id: orig.id, correct_answer: orig.correct_answer, answer_source: orig.answer_source, paper_format: orig.paper_format, confidence: orig.confidence } : s;
      }),
    };
  } catch (err) {
    console.warn("AI lượt 2 lỗi:", (err as Error)?.message || err);
    return null;
  }
}

/** Điểm vào: đọc file → văn bản (giữ định dạng) → AI cấu trúc + gắn nhãn. */
export async function parseDocumentFile(buffer: Buffer, fileName: string, mimeType: string, targetSkill?: string): Promise<DocumentParseResult> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const modelConfig = await getAiIngestionModelConfig();

  let rawText = "";
  let engineUsed: "DIGITAL_PARSER" | "MULTIMODAL_VISION_OCR" = "DIGITAL_PARSER";
  if (ext === "pdf") {
    const pages = await extractPdfPages(buffer).catch(() => [] as string[]);
    if (pages.length > 1 && pdfTextLooksScanned(pages)) {
      // bản scan (kể cả có lớp chữ watermark) → OCR theo cụm trang (BR-I18)
      engineUsed = "MULTIMODAL_VISION_OCR";
      rawText = await ocrPdfByPages(buffer, pages.length, modelConfig);
    } else if (!pdfTextLooksScanned(pages)) {
      rawText = pages.join("\n");
    }
  } else if (ext === "docx") {
    try {
      rawText = await extractDigitalText(buffer, ext);
    } catch (e) {
      console.warn("Digital text extraction failed, fallback to OCR:", e);
    }
  }
  if (engineUsed === "DIGITAL_PARSER" && (rawText.trim().length < 50 || ["png", "jpg", "jpeg", "webp"].includes(ext))) {
    engineUsed = "MULTIMODAL_VISION_OCR";
    const fileMime = ext === "pdf" ? "application/pdf" : mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;
    rawText = await extractImageOcrText(buffer, fileMime, modelConfig);
  }
  if (!rawText || rawText.trim().length < 10) {
    throw new Error("Không thể bóc tách nội dung từ tệp. Tệp có thể bị rỗng, mờ hoặc khóa mã hóa.");
  }

  const structuredData = await structureExamQuestionsWithAi(rawText, targetSkill, modelConfig);
  return { rawText, engineUsed, structuredData };
}
