import { describe, it, expect } from "vitest";
import fs from "fs";
import { sanitizeStimulusHtml, looksLikeHtml } from "@/lib/stimulus-html";

describe("sanitizeStimulusHtml — hiển thị ngữ cảnh câu hỏi an toàn", () => {
  it("giữ ảnh englishjunior (đường dẫn /media/...) và đoạn văn", () => {
    const raw = '<p><img src="/media/ej/h5p/content/129/images/a.png" alt="" style="max-width:100%;height:auto" /></p>';
    const out = sanitizeStimulusHtml(raw);
    expect(out).toContain('<img src="/media/ej/h5p/content/129/images/a.png"');
    expect(out).toMatch(/^<p>.*<\/p>$/);
    expect(out).not.toContain("style=");
  });

  it("văn bản thường: escape và xuống dòng thành <br>", () => {
    expect(sanitizeStimulusHtml("Tom & Jerry\nline 2")).toBe("Tom &amp; Jerry<br>line 2");
    expect(sanitizeStimulusHtml("a < b > c")).toBe("a &lt; b &gt; c");
    expect(looksLikeHtml("a < b")).toBe(false);
  });

  it("bỏ script/style/iframe kèm nội dung và mọi thuộc tính on*", () => {
    const out = sanitizeStimulusHtml('<p onclick="x()">Hi<script>alert(1)</script><style>p{}</style><iframe src="https://e.vn"></iframe></p>');
    expect(out).toBe("<p>Hi</p>");
    const img = sanitizeStimulusHtml('<img src="/a.png" onerror="alert(1)">');
    expect(img).not.toMatch(/onerror/i);
  });

  it("chặn URL javascript:/data:, kể cả khi mã hoá thực thể", () => {
    for (const bad of ["javascript:alert(1)", "jav&#x61;script:alert(1)", " JavaScript:alert(1)", "data:text/html;base64,AAAA", "//evil.com/x.png"]) {
      expect(sanitizeStimulusHtml(`<a href="${bad}">x</a>`)).not.toMatch(/href=/);
      expect(sanitizeStimulusHtml(`<img src="${bad}">`)).not.toContain("<img");
    }
    expect(sanitizeStimulusHtml('<a href="https://ok.vn">x</a>')).toContain('href="https://ok.vn"');
  });

  it("thẻ lạ bị bỏ nhưng chữ bên trong được giữ dạng escape; thẻ chưa đóng được đóng lại", () => {
    expect(sanitizeStimulusHtml("<custom>chữ</custom>")).toBe("chữ");
    expect(sanitizeStimulusHtml("<p><b>đậm")).toBe("<p><b>đậm</b></p>");
    expect(sanitizeStimulusHtml('<img src="x" onerror=alert(1)')).not.toContain("<img");
  });

  it("LessonPlayer hiển thị stimulus_text qua sanitizeStimulusHtml, không in chuỗi thô", () => {
    const src = fs.readFileSync("components/lesson-player/LessonPlayer.tsx", "utf8");
    expect(src).toContain("@/lib/stimulus-html");
    expect(src).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html:\s*sanitizeStimulusHtml\(/);
    expect(src).not.toMatch(/\{q\.stimulus_text\}/);
  });
});
