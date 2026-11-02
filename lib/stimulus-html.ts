// Hiển thị ngữ cảnh câu hỏi (stimulus_text) an toàn: dữ liệu có thể là văn bản thường
// hoặc HTML (đề nhập từ englishjunior, RichTextEditor). Không truyền thẳng chuỗi gốc ra DOM:
// dựng lại HTML chỉ từ thẻ/thuộc tính trong danh sách cho phép, mọi chữ khác đều được escape.

const ALLOWED_TAGS = new Set([
  "p", "br", "b", "strong", "i", "em", "u", "s", "sub", "sup", "span", "div",
  "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "hr",
  "table", "thead", "tbody", "tr", "th", "td", "img", "a", "figure", "figcaption",
]);
const VOID_TAGS = new Set(["br", "hr", "img"]);
// Thẻ bị bỏ cả phần nội dung bên trong
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

const ALLOWED_ATTRS: Record<string, string[]> = {
  img: ["src", "alt", "width", "height"],
  a: ["href"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Giải mã thực thể để kiểm tra URL (chặn "jav&#x61;script:")
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function isSafeUrl(raw: string, kind: "src" | "href"): boolean {
  const v = decodeEntities(raw).replace(/[\u0000- \u007f]/g, "").toLowerCase();
  if (v.startsWith("/") && !v.startsWith("//")) return true;
  if (v.startsWith("https://") || v.startsWith("http://")) return true;
  if (kind === "href" && v.startsWith("mailto:")) return true;
  return false;
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function buildTag(name: string, attrText: string): string {
  const allowed = ALLOWED_ATTRS[name] || [];
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(attrText)) !== null) {
    const attr = m[1].toLowerCase();
    if (!allowed.includes(attr)) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    if ((attr === "src" || attr === "href") && !isSafeUrl(value, attr)) continue;
    if ((attr === "width" || attr === "height" || attr === "colspan" || attr === "rowspan") && !/^\d{1,4}%?$/.test(value)) continue;
    parts.push(`${attr}="${escapeHtml(decodeEntities(value))}"`);
  }
  if (name === "img" && !parts.some((p) => p.startsWith("src="))) return "";
  if (name === "a") parts.push('target="_blank"', 'rel="noopener noreferrer"');
  if (name === "img") parts.push('loading="lazy"');
  return `<${name}${parts.length ? " " + parts.join(" ") : ""}>`;
}

export function looksLikeHtml(raw: string): boolean {
  return /<\/?[a-zA-Z][^>]*>/.test(raw);
}

/**
 * Trả về HTML an toàn để gán vào dangerouslySetInnerHTML.
 * Văn bản thường: escape và giữ xuống dòng bằng <br>.
 */
export function sanitizeStimulusHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  if (!looksLikeHtml(raw)) {
    return escapeHtml(raw).replace(/\r?\n/g, "<br>");
  }

  const cleaned = raw.replace(/<!--[\s\S]*?-->/g, "").replace(DROP_WITH_CONTENT, "");
  const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*?)?)\s*(\/?)>/g;
  const out: string[] = [];
  const stack: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = TAG_RE.exec(cleaned)) !== null) {
    out.push(escapeHtml(decodeEntities(cleaned.slice(last, m.index))));
    last = TAG_RE.lastIndex;

    const isClose = m[1] === "/";
    const name = m[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;

    if (isClose) {
      if (VOID_TAGS.has(name)) continue;
      const idx = stack.lastIndexOf(name);
      if (idx === -1) continue;
      // Đóng cả các thẻ con chưa đóng để giữ cấu trúc hợp lệ
      while (stack.length > idx) out.push(`</${stack.pop()}>`);
      continue;
    }

    const tag = buildTag(name, m[3] || "");
    if (!tag) continue;
    out.push(tag);
    if (!VOID_TAGS.has(name)) stack.push(name);
  }
  out.push(escapeHtml(decodeEntities(cleaned.slice(last))));
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join("");
}
