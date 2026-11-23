// TASK-052 · FEAT-015 BR-I14, DEC-045 (TC-I12) — DOCX giữ gạch chân / đậm / nghiêng, bỏ thẻ nguy hiểm; chuẩn hoá JSON AI.
import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { docxHtmlToMarkedText, extractDigitalText, normalizeStructuredResult } from "@/lib/document-parser";
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
