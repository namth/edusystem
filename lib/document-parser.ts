// Polyfill essential Web DOM APIs in Node.js server environment for pdfjs-dist / pdf-parse
if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  };
}
if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {};
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = class Path2D {};
}

import mammoth from "mammoth";
import { Portkey } from "portkey-ai";
import OpenAI from "openai";
import { getAiIngestionModelConfig, AiModelConfig } from "./ai-model-resolver";

export interface ParsedQuestionOption {
  key: string;
  text: string;
}

export interface ParsedSubQuestion {
  id: string;
  number: number;
  text: string;
  options: ParsedQuestionOption[];
  correct_answer: string;
}

export interface ParsedQuestionItem {
  tempId: string;
  groupNumber: number;
  number?: number;
  skill: string;
  category: string;
  prompt: string;
  stimulus_text?: string;
  sub_questions: ParsedSubQuestion[];
  options?: ParsedQuestionOption[];
  content?: {
    correct_answer?: string;
    explanation?: string;
  };
}

export interface StructuredExamResult {
  examTitle: string;
  suggestedDurationMinutes: number;
  questions: ParsedQuestionItem[];
}

export interface DocumentParseResult {
  rawText: string;
  engineUsed: "DIGITAL_PARSER" | "MULTIMODAL_VISION_OCR";
  structuredData: StructuredExamResult;
}

/**
 * Engine 1: Extract plain text from digital DOCX / PDF
 */
export async function extractDigitalText(
  buffer: Buffer,
  fileExtension: string
): Promise<string> {
  const ext = fileExtension.toLowerCase().replace(/^\./, "");
  if (ext === "docx") {
    const res = await mammoth.extractRawText({ buffer });
    return res.value || "";
  }
  if (ext === "pdf") {
    // 1. Direct pdfjs-dist extraction with in-memory worker (bypasses standalone worker file resolution)
    try {
      // @ts-ignore
      const pdfjsWorker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      (globalThis as any).pdfjsWorker = pdfjsWorker;
      // @ts-ignore
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        isEvalSupported: false,
        useSystemFonts: true,
      });
      const doc = await loadingTask.promise;
      let fullText = "";
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const pageStr = content.items.map((item: any) => item.str).join(" ");
        fullText += pageStr + "\n";
      }
      if (fullText.trim().length > 0) {
        return fullText;
      }
    } catch (pdfjsErr: any) {
      console.warn("Direct pdfjs-dist text extraction failed, trying PDFParse:", pdfjsErr?.message || pdfjsErr);
    }

    // 2. PDFParse fallback
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new (PDFParse as any)(new Uint8Array(buffer));
      await parser.load();
      const parsed = await parser.getText();
      const text = typeof parsed === "string" ? parsed : parsed?.text || "";
      if (text.trim().length > 0) {
        return text;
      }
    } catch (err: any) {
      console.warn("Digital PDF text extraction error, will fallback to OCR:", err?.message || err);
    }
  }
  return "";
}

/**
 * Engine 2: Multimodal Vision OCR via Gemini 2.5 Flash / Portkey
 */
export async function extractImageOcrText(
  buffer: Buffer,
  mimeType: string,
  modelConfig: AiModelConfig
): Promise<string> {
  const base64Image = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64Image}`;

  const promptText = `You are an academic curriculum assistant. Transcribe and extract all educational test questions, reading passages, question numbers, prompts, multiple choice options (A, B, C, D), answer keys, and explanations from this exam document into clean, readable text. Preserve question numbers and all options.`;

  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (googleApiKey) {
    try {
      const model = modelConfig.model === "gemini-2.5-flash" || !modelConfig.model ? "gemini-flash-lite-latest" : modelConfig.model;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: mimeType || "image/jpeg",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: modelConfig.temperature ?? 0.1,
            maxOutputTokens: modelConfig.max_tokens ?? 8192,
          },
        }),
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      if (data.candidates?.[0]?.finishReason) {
        console.warn(`Gemini Vision OCR finishReason: ${data.candidates[0].finishReason}`);
      }
    } catch (err) {
      console.warn("Direct Google Gemini Vision OCR failed, falling back to Portkey/OpenAI:", err);
    }
  }

  const apiKey = process.env.PORTKEY_API_KEY;
  if (apiKey) {
    try {
      const portkey = new Portkey({
        apiKey,
        config: process.env.PORTKEY_CONFIG_ID || "pc-gemini-f72e00",
      });

      const response = await portkey.chat.completions.create({
        model: modelConfig.model || "gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: promptText },
              { type: "image_url", image_url: { url: dataUri } },
            ] as any,
          },
        ],
        max_tokens: modelConfig.max_tokens || 8192,
        temperature: modelConfig.temperature || 0.1,
      });

      const content = response.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
    } catch (err) {
      console.warn("Portkey Vision OCR failed, falling back to OpenAI if available:", err);
    }
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
      max_tokens: 4096,
    });
    return response.choices?.[0]?.message?.content || "";
  }

  throw new Error("No AI Vision provider configured to process scanned images.");
}

/**
 * Structures raw extracted text into standardized IELTS/CEFR questions and passages
 */
export async function structureExamQuestionsWithAi(
  rawText: string,
  targetSkill?: string,
  modelConfig?: AiModelConfig
): Promise<StructuredExamResult> {
  const config = modelConfig || (await getAiIngestionModelConfig());

  const systemPrompt = `You are an expert academic exam ingestion AI. Your task is to extract exam papers, worksheets, and tests into a clean, structured JSON format with GROUPED questions based on shared context.

CRITICAL INSTRUCTIONS:
1. QUESTION GROUPING BY SHARED CONTEXT:
   - Identify shared instructions, reading passages, cloze passages, or dialogues that apply to multiple questions.
   - Group them together into ONE parent question item.
   - Put the shared instruction (e.g. "Mark the letter A, B, C, or D on your answer sheet to indicate the word whose underlined part differs from the other three in pronunciation in each of the following questions.") into "prompt".
   - If there is a shared reading passage, article, or cloze text, put the full text into "stimulus_text".
   - Put all questions that belong to this shared context into the "sub_questions" array.
   - Examples of grouping:
     * Pronunciation / Stress instructions: Parent prompt = "Mark the letter A, B, C, or D...", sub_questions = [Câu 1, Câu 2].
     * Reading Cloze (Điền từ vào chỗ trống trong đoạn văn): Parent prompt = "Read the following passage and mark the letter A, B, C, or D...", stimulus_text = "Full passage text...", category = "READING_FILL_IN", sub_questions = [Câu 25, 26, 27, 28, 29, 30].
     * Reading Comprehension: Parent prompt = "Read the following passage and mark...", stimulus_text = "Full reading passage...", category = "READING_MC", sub_questions = [Câu 31, 32, 33, 34, 35].
     * Sentence Transformation / Combinations: Parent prompt = shared instruction, sub_questions = individual questions.
     * Standalone single questions (no shared context): Parent prompt = question stem, sub_questions = [single question].

2. ANSWER KEY EXTRACTION (PRIORITY):
   - Check the document carefully for an Answer Key (e.g., "ĐÁP ÁN", "Answer Key", "Key: 1.B 2.C...", or a table/grid of answers at the end).
   - If an Answer Key is present in the document, you MUST extract the exact answer from that Answer Key for each question! DO NOT guess or solve questions if answers are already provided in the document.
   - DO NOT include explanations. Leave explanations empty or omitted.

3. SCHEMA:
{
  "examTitle": "string",
  "suggestedDurationMinutes": 60,
  "questions": [
    {
      "tempId": "group_1",
      "groupNumber": 1,
      "skill": "Reading",
      "category": "READING_MC",
      "prompt": "Shared instruction text...",
      "stimulus_text": "Shared reading passage or null if none",
      "sub_questions": [
        {
          "id": "sub_1",
          "number": 1,
          "text": "Câu 1" (or specific question stem if any),
          "options": [
            { "key": "A", "text": "..." },
            { "key": "B", "text": "..." },
            { "key": "C", "text": "..." },
            { "key": "D", "text": "..." }
          ],
          "correct_answer": "B"
        }
      ]
    }
  ]
}`;

  const userPrompt = `Target Skill Filter: ${targetSkill || "Auto"}\n\nDocument Text to Parse:\n"""\n${rawText.slice(0, 35000)}\n"""`;

  const cleanJsonText = (text: string): string => {
    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    return cleaned;
  };

  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (googleApiKey) {
    const candidateModels = [
      config.model === "gemini-2.5-flash" || !config.model ? "gemini-flash-lite-latest" : config.model,
      "gemini-3.5-flash-lite",
      "gemini-3.7-flash",
    ];

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleApiKey}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: config.temperature ?? 0.1,
              maxOutputTokens: config.max_tokens ?? 8192,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawContent) {
            const parsed = JSON.parse(cleanJsonText(rawContent));
            return normalizeStructuredResult(parsed);
          }
        }
      } catch (err) {
        console.warn(`Direct Google Gemini parse with model ${model} failed, trying next:`, err);
      }
    }
  }

  const apiKey = process.env.PORTKEY_API_KEY;
  if (apiKey) {
    try {
      const portkey = new Portkey({
        apiKey,
        config: process.env.PORTKEY_CONFIG_ID || "pc-gemini-f72e00",
      });

      const response = await portkey.chat.completions.create({
        model: config.model || "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: config.temperature ?? 0.1,
        max_tokens: config.max_tokens ?? 8192,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      if (rawContent) {
        const rawJson = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        const parsed = JSON.parse(cleanJsonText(rawJson));
        return normalizeStructuredResult(parsed);
      }
    } catch (err) {
      console.warn("Portkey structured parse failed, falling back to OpenAI:", err);
    }
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    });
    const rawContent = response.choices?.[0]?.message?.content;
    if (rawContent) {
      const rawJson = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      const parsed = JSON.parse(cleanJsonText(rawJson));
      return normalizeStructuredResult(parsed);
    }
  }

  throw new Error("Unable to structure document with AI. Please check API Gateway credentials.");
}

function normalizeStructuredResult(data: any): StructuredExamResult {
  const rawQuestions = Array.isArray(data.questions) ? data.questions : [];

  const normalizedQuestions: ParsedQuestionItem[] = rawQuestions.map((q: any, gIdx: number) => {
    const groupNum = gIdx + 1;
    let rawCategory = (q.category || "").toUpperCase();
    if (rawCategory.includes("FILL") || rawCategory.includes("CLOZE") || rawCategory.includes("BLANK")) {
      rawCategory = "READING_FILL_IN";
    } else if (rawCategory.includes("ESSAY") || rawCategory.includes("WRITING")) {
      rawCategory = "WRITING_ESSAY";
    } else {
      rawCategory = "READING_MC";
    }

    let subQs: ParsedSubQuestion[] = [];

    // Case 1: Already has sub_questions
    if (Array.isArray(q.sub_questions) && q.sub_questions.length > 0) {
      subQs = q.sub_questions.map((sub: any, sIdx: number) => {
        const subOpts: ParsedQuestionOption[] = Array.isArray(sub.options)
          ? sub.options.map((opt: any, optIdx: number) => ({
              key: (opt.key || String.fromCharCode(65 + optIdx)).toUpperCase(),
              text: typeof opt === "string" ? opt : opt.text || String(opt),
            }))
          : [
              { key: "A", text: sub.option_a || "A" },
              { key: "B", text: sub.option_b || "B" },
              { key: "C", text: sub.option_c || "C" },
              { key: "D", text: sub.option_d || "D" },
            ];

        return {
          id: sub.id || `sub_${gIdx + 1}_${sIdx + 1}`,
          number: Number(sub.number) || sIdx + 1,
          text: sub.text || `Câu ${sub.number || sIdx + 1}`,
          options: subOpts,
          correct_answer: (sub.correct_answer || "A").toUpperCase(),
        };
      });
    } else {
      // Case 2: Flat question, convert into 1 sub_question
      const subOpts: ParsedQuestionOption[] = Array.isArray(q.options)
        ? q.options.map((opt: any, optIdx: number) => ({
            key: (opt.key || String.fromCharCode(65 + optIdx)).toUpperCase(),
            text: typeof opt === "string" ? opt : opt.text || String(opt),
          }))
        : [
            { key: "A", text: "A" },
            { key: "B", text: "B" },
            { key: "C", text: "C" },
            { key: "D", text: "D" },
          ];

      subQs = [
        {
          id: `sub_${gIdx + 1}_1`,
          number: Number(q.number) || gIdx + 1,
          text: q.prompt || `Câu ${q.number || gIdx + 1}`,
          options: subOpts,
          correct_answer: (q.content?.correct_answer || q.correct_answer || "A").toUpperCase(),
        },
      ];
    }

    return {
      tempId: q.tempId || `group_${gIdx + 1}`,
      groupNumber: groupNum,
      skill: q.skill || "Reading",
      category: rawCategory,
      prompt: q.prompt || `Phần ${groupNum}`,
      stimulus_text: q.stimulus_text || undefined,
      sub_questions: subQs,
    };
  });

  return {
    examTitle: data.examTitle || "Đề Thi AI Trích Xuất Mới",
    suggestedDurationMinutes: Number(data.suggestedDurationMinutes) || 60,
    questions: normalizedQuestions,
  };
}

/**
 * Main Entry Point: Dual-Engine Document Ingestion
 */
export async function parseDocumentFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  targetSkill?: string
): Promise<DocumentParseResult> {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const modelConfig = await getAiIngestionModelConfig();

  let rawText = "";
  let engineUsed: "DIGITAL_PARSER" | "MULTIMODAL_VISION_OCR" = "DIGITAL_PARSER";

  // Check if digital document
  if (ext === "docx" || ext === "pdf") {
    try {
      rawText = await extractDigitalText(buffer, ext);
    } catch (e) {
      console.warn("Digital text extraction failed, fallback to OCR:", e);
    }
  }

  // Fallback to Multimodal Vision OCR if text is negligible or image format
  if (rawText.trim().length < 50 || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    engineUsed = "MULTIMODAL_VISION_OCR";
    const imageMime = mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;
    rawText = await extractImageOcrText(buffer, imageMime, modelConfig);
  }

  if (!rawText || rawText.trim().length < 10) {
    throw new Error("Không thể bóc tách nội dung từ tệp. Tệp có thể bị rỗng, mờ hoặc khóa mã hóa.");
  }

  const structuredData = await structureExamQuestionsWithAi(rawText, targetSkill, modelConfig);

  return {
    rawText,
    engineUsed,
    structuredData,
  };
}
