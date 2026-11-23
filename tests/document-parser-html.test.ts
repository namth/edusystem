// TASK-052 · FEAT-015 BR-I14, DEC-045 (TC-I12) — DOCX giữ gạch chân / đậm / nghiêng, bỏ thẻ nguy hiểm; chuẩn hoá JSON AI.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { docxHtmlToMarkedText, extractDigitalText, normalizeStructuredResult, pdfTextLooksScanned, splitOcrPages, expectedQuestionNumbers, cleanSubText, refineKeepsWording } from "@/lib/document-parser";
import { sanitizeInlineHtml } from "@/lib/stimulus-html";

async function makeDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`
  );
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}
const run = (t: string, props = "") => `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const para = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;

describe("DOCX giữ định dạng (TC-I12)", () => {
  it("gạch chân, đậm, nghiêng còn nguyên; mỗi đoạn một dòng", async () => {
    const buf = await makeDocx(
      para(run("Câu 1. ", '<w:b/>'), run("Mark the word whose underlined part differs.")) +
        para(run("A. h"), run("a", '<w:u w:val="single"/>'), run("t   B. c"), run("a", '<w:u w:val="single"/>'), run("t")) +
        para(run("This is "), run("important", "<w:i/>"))
    );
    const text = await extractDigitalText(buf, "docx");
    expect(text).toContain("<strong>Câu 1. </strong>");
    expect(text).toContain("A. h<u>a</u>t");
    expect(text).toContain("c<u>a</u>t");
    expect(text).toContain("<em>important</em>");
    expect(text.split("\n")).toHaveLength(3);
  });

  it("docxHtmlToMarkedText: bỏ thẻ lạ / script, ảnh thành [HÌNH ẢNH], bảng thành dòng có |", () => {
    const out = docxHtmlToMarkedText(
      '<p>Look <img src="data:image/png;base64,AAAA"> sign</p><table><tr><td>a</td><td>b</td></tr></table><p><a href="x" onclick="evil()">link</a><script>alert(1)</script></p>'
    );
    expect(out).toContain("[HÌNH ẢNH]");
    expect(out).not.toContain("base64");
    expect(out).toContain("a | b |");
    expect(out).not.toMatch(/<a|onclick|<script|<img/);
  });

  it("sanitizeInlineHtml chỉ giữ u/b/strong/i/em/br, chặn img onerror", () => {
    expect(sanitizeInlineHtml('h<u>a</u>t <img src=x onerror="alert(1)"> <b>x</b> <p>y</p>')).toBe("h<u>a</u>t  <b>x</b> y");
    expect(sanitizeInlineHtml("a < b")).toBe("a &lt; b");
  });
});

describe("normalizeStructuredResult (JSON của AI)", () => {
  it("thiếu đáp án → null + NONE (không gán 'A'); paper_format lạ → GENERAL_MC, confidence thấp; nhận cả 'questions' kiểu cũ", () => {
    const r = normalizeStructuredResult({
      questions: [
        {
          prompt: "P",
          sub_questions: [
            { number: 3, text: "x", options: [{ key: "a", text: "1" }, "2"], paper_format: "LA" },
            { number: 4, text_html: "y", options: [], correct_answer: "b", answer_source: "AI_SOLVED", paper_format: "stress", confidence: 3 },
          ],
        },
      ],
    });
    const [s1, s2] = r.groups[0].sub_questions;
    expect(s1).toMatchObject({ number: 3, correct_answer: null, answer_source: "NONE", paper_format: "GENERAL_MC", options: [{ key: "A", text_html: "1" }, { key: "B", text_html: "2" }] });
    expect(s1.confidence).toBeLessThan(0.6);
    expect(s2).toMatchObject({ correct_answer: "b", answer_source: "AI_SOLVED", paper_format: "STRESS", confidence: 1 });
    expect(r.groups[0]).toMatchObject({ tempId: "group_1", groupNumber: 1, skill: "Reading" });
  });
});

describe("PDF scan có lớp chữ rác (BR-I18)", () => {
  const body = "Read the passage and answer questions 1-13. ".repeat(5);
  it("watermark lặp ở nhiều trang + vài trang có chữ → vẫn là bản scan", () => {
    const pages: string[] = Array.from({ length: 20 }, (_, i) => (i % 2 ? "www.example-watermark.ir" : ""));
    pages[5] = body;
    expect(pdfTextLooksScanned(pages)).toBe(true);
  });
  it("PDF chữ thật (kể cả có watermark trên mỗi trang) → không phải scan; không có trang nào → scan", () => {
    expect(pdfTextLooksScanned(Array.from({ length: 6 }, () => `${body} www.example-watermark.ir`))).toBe(false);
    expect(pdfTextLooksScanned([])).toBe(true);
  });
});

describe("Bài đọc dùng chung (BR-I17)", () => {
  it("passages + passage_id → passage_html của mọi nhóm tham chiếu", () => {
    const r = normalizeStructuredResult({
      passages: [{ id: "P1", html: "# Invasive species…" }],
      groups: [
        { passage_id: "P1", prompt: "TFNG", sub_questions: [{ number: 1, text_html: "x", options: ["TRUE", "FALSE", "NOT GIVEN"], correct_answer: "A", paper_format: "READING_COMPREHENSION" }] },
        { passage_id: "P1", prompt: "Summary", sub_questions: [{ number: 8, text_html: "", correct_answer: "land", paper_format: "SHORT_ANSWER" }] },
        { prompt: "Other", sub_questions: [{ number: 20, text_html: "y", correct_answer: "B", paper_format: "GENERAL_MC" }] },
      ],
    });
    expect(r.groups.map((g) => g.passage_html)).toEqual(["Invasive species…", "Invasive species…", null]);
    const m = normalizeStructuredResult({ groups: [{ matching: { right: [{ key: "A", text_html: "school" }, "farm"] }, sub_questions: [] }] });
    expect(m.groups[0].matching?.right).toEqual([{ key: "A", text: "school" }, { key: "b", text: "farm" }]);
  });
});

describe("splitOcrPages (BR-I18)", () => {
  it("tách theo dấu '=== PAGE n ===', bỏ phần trước dấu đầu; không có dấu → []", () => {
    expect(splitOcrPages("rác\n=== PAGE 3 ===\nQuestions 1-3\n\n=== PAGE 4 ===\nA. hat")).toEqual([[3, "Questions 1-3"], [4, "A. hat"]]);
    expect(splitOcrPages("Questions 1-3")).toEqual([]);
  });
});

describe("Kiểm đủ câu (BR-I19)", () => {
  it("đọc tiêu đề Questions a–b / a and b / Question n; bỏ dải vô lý", () => {
    const t = "Questions 1-3 … Questions 4–7 … Question 12 … Questions 14 and 15 … Questions 900-1";
    expect([...expectedQuestionNumbers(t)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 12, 14, 15]);
  });
  it("đáp án ghi bằng nội dung phương án (TRUE/FALSE/NOT GIVEN) → khoá chữ cái", () => {
    const r = normalizeStructuredResult({ groups: [{ sub_questions: [{ number: 1, text_html: "x", options: ["TRUE", "FALSE", "NOT GIVEN"], correct_answer: "not given", paper_format: "READING_COMPREHENSION" }] }] });
    expect(r.groups[0].sub_questions[0].correct_answer).toBe("C");
  });
});

describe("Số câu & dãy phương án trong chữ câu (BR-I20)", () => {
  it("bỏ tiền tố 'Câu n.' / 'Question n:' / 'n.' khi trùng số câu; giữ câu bắt đầu bằng số khác", () => {
    expect(cleanSubText("<b>Câu 5.</b> When the church <u>was</u> first…", 5, 4)).toBe("When the church <u>was</u> first…");
    expect(cleanSubText("<strong>Câu 19. - </strong>Laura: “You look great!”", 19, 4)).toBe("Laura: “You look great!”");
    expect(cleanSubText("Question 7: Choose the word", 7, 4)).toBe("Choose the word");
    expect(cleanSubText("12. What time is it?", 12, 4)).toBe("What time is it?");
    expect(cleanSubText("1990 was a good year.", 3, 4)).toBe("1990 was a good year.");
    expect(cleanSubText("Câu 25", 25, 4)).toBe("");
    expect(cleanSubText("- Laura: “Hi!” - Maria: “____”", 19, 4)).toBe("Laura: “Hi!” - Maria: “____”");
  });
  it("chữ câu chỉ là dãy 'A. … B. … C. …' (ngữ âm) → rỗng; câu hỏi thường giữ nguyên", () => {
    expect(cleanSubText("<b>Câu 1.</b> A. <u>e</u>ndangered   B. g<u>e</u>neration   C. <u>e</u>mbroider   D. <u>e</u>nvironment", 1, 4)).toBe("");
    expect(cleanSubText("According to the passage, who wants to learn English?", 31, 4)).toBe("According to the passage, who wants to learn English?");
    const r = normalizeStructuredResult({ groups: [{ sub_questions: [{ number: 9, text_html: "<b>Câu 9.</b> Tet is a festival ____ occurs in late January.", options: ["when", "which"], correct_answer: "B", paper_format: "SENTENCE_BLANK" }] }] });
    expect(r.groups[0].sub_questions[0].text_html).toBe("Tet is a festival ____ occurs in late January.");
  });
});

describe("AI lượt 2 không được bịa đoạn văn (BR-I22)", () => {
  const sub = (n: number) => ({ id: `s${n}`, number: n, text_html: "", options: [{ key: "A", text_html: "named" }], correct_answer: "A", answer_source: "KEY" as const, paper_format: "CLOZE_PASSAGE" as const, confidence: 1 });
  const orig = { tempId: "g", groupNumber: 1, skill: "Reading", prompt: "Read the passage", stimulus_html: null, passage_html: "I have a daughter (25) ____ Nicole. She is three now.", sub_questions: [sub(25)] };
  it("chỉ đánh dấu lại ô trên chữ gốc → nhận; đoạn văn mới → loại", () => {
    expect(refineKeepsWording(orig, { ...orig, stimulus_html: "I have a daughter (25) ____ Nicole. She is three now." })).toBe(true);
    expect(refineKeepsWording(orig, { ...orig, stimulus_html: "(25) ____ after a famous explorer, the town grew rapidly during the gold rush." })).toBe(false);
  });
});
