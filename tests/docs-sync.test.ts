// DEC-036 — Tài liệu chuẩn docs/01–15 phải khớp code. Test đỏ = code đã đổi mà tài liệu chưa cập nhật.
// File do trưởng phòng viết. Sửa tài liệu cho khớp code, không nới test.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (f: string) => fs.readFileSync(f, "utf8");
function walk(dir: string, name: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, name, out);
    else if (e.name === name) out.push(p.split(path.sep).join("/"));
  }
  return out;
}

const STANDARD = [
  "01-overview", "02-modules-and-features", "03-screens-and-ui", "04-user-flows", "05-architecture",
  "06-database-schema", "07-api-contracts", "08-integrations", "09-conventions", "10-env-and-security",
  "11-tasks", "12-business-rules", "13-test-cases-and-qa", "14-decisions", "15-operations",
];

describe("Bộ tài liệu chuẩn (DEC-036)", () => {
  it("đủ 15 file docs/01–15 và CONTEXT.md trỏ tới từng file", () => {
    const ctx = read("CONTEXT.md");
    for (const f of STANDARD) {
      expect(fs.existsSync(`docs/${f}.md`), f).toBe(true);
      expect(ctx, `CONTEXT.md thiếu ${f}`).toContain(`docs/${f}.md`);
    }
  });

  it("không có tài liệu .md lẻ ngoài chuẩn ở gốc repo và gốc docs/", () => {
    const allowedRoot = ["AGENTS.md", "CLAUDE.md", "CONTEXT.md", "README.md"];
    const rootMd = fs.readdirSync(".").filter((f) => f.endsWith(".md") && !allowedRoot.includes(f));
    expect(rootMd).toEqual([]);
    const docsMd = fs.readdirSync("docs").filter((f) => f.endsWith(".md") && !STANDARD.includes(f.replace(/\.md$/, "")));
    expect(docsMd).toEqual([]);
  });
});

describe("docs/07 liệt kê mọi API route", () => {
  it("mỗi app/api/**/route.ts có đường dẫn đầy đủ trong docs/07-api-contracts.md", () => {
    const doc = read("docs/07-api-contracts.md");
    const missing = walk("app/api", "route.ts")
      .map((f) => "/" + f.replace(/^app\//, "").replace(/\/route\.ts$/, ""))
      .filter((r) => !doc.includes("`" + r + "`") && !doc.includes(r + "`") && !doc.includes(r + "?") && !doc.includes(r + ","));
    expect(missing).toEqual([]);
  });

  it("không liệt kê route đã không còn trong code", () => {
    const doc = read("docs/07-api-contracts.md");
    const routes = new Set(walk("app/api", "route.ts").map((f) => "/" + f.replace(/^app\//, "").replace(/\/route\.ts$/, "")));
    const listed = [...doc.matchAll(/`(\/api\/[A-Za-z0-9_\-/[\]]+)/g)].map((m) => m[1].replace(/\/$/, ""));
    expect(listed.filter((r) => !routes.has(r))).toEqual([]);
  });
});

describe("docs/03 liệt kê mọi trang", () => {
  it("mỗi app/**/page.tsx có đường dẫn trong docs/03-screens-and-ui.md", () => {
    const doc = read("docs/03-screens-and-ui.md");
    const missing = walk("app", "page.tsx")
      .map((f) => "/" + f.replace(/^app\/?/, "").replace(/\/?page\.tsx$/, ""))
      .map((r) => (r === "/" ? "/" : r.replace(/\/$/, "")))
      .filter((r) => !doc.includes("`" + r + "`") && !doc.includes("`" + r + "?") && !doc.includes("`" + r + ",") && !doc.includes(", `" + r + "`"));
    expect(missing).toEqual([]);
  });
});

describe("docs/06 khớp migration", () => {
  it("mỗi docs/db-migration-*.sql có dòng trong bảng danh mục migration", () => {
    const doc = read("docs/06-database-schema.md");
    const nums = fs.readdirSync("docs").filter((f) => /^db-migration-\d{3}/.test(f)).map((f) => f.slice(13, 16));
    expect(nums.length).toBeGreaterThan(0);
    expect(nums.filter((n) => !new RegExp(`^\\| ${n} \\|`, "m").test(doc))).toEqual([]);
  });

  it("mọi bảng tạo trong migration được mô tả trong docs/06", () => {
    const doc = read("docs/06-database-schema.md");
    const tables = new Set<string>();
    for (const f of fs.readdirSync("docs").filter((x) => x.startsWith("db-migration-"))) {
      for (const m of read(`docs/${f}`).matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) tables.add(m[1]);
    }
    expect([...tables].filter((t) => !doc.includes("`" + t + "`"))).toEqual([]);
  });
});

describe("Mã tham chiếu tồn tại", () => {
  it("mọi DEC-NNN được nhắc trong docs/, CONTEXT.md, CLAUDE.md đều có trong docs/14", () => {
    const dec = new Set([...read("docs/14-decisions.md").matchAll(/^\| (DEC-\d{3}) \|/gm)].map((m) => m[1]));
    const files = ["CONTEXT.md", "CLAUDE.md", ...STANDARD.map((f) => `docs/${f}.md`), ...fs.readdirSync("docs/features").map((f) => `docs/features/${f}`)];
    const bad: string[] = [];
    for (const f of files) for (const m of read(f).matchAll(/DEC-(\d{3})/g)) if (!dec.has(`DEC-${m[1]}`)) bad.push(`${f}: DEC-${m[1]}`);
    expect([...new Set(bad)]).toEqual([]);
  });

  it("mọi FEAT có đặc tả trong docs/features được nhắc trong docs/01", () => {
    const ov = read("docs/01-overview.md");
    for (const f of fs.readdirSync("docs/features")) {
      const m = read(`docs/features/${f}`).match(/FEAT-0\d{2}/);
      if (m) expect(ov, `${f} (${m[0]})`).toContain(m[0]);
    }
  });

  it("mọi thư mục handoff/tasks/TASK-NNN có trong docs/11", () => {
    const doc = read("docs/11-tasks.md");
    const ids = [...new Set(fs.readdirSync("handoff/tasks").map((d) => d.match(/^TASK-(\d{3})/)?.[1]).filter(Boolean))] as string[];
    expect(ids.filter((n) => !new RegExp(`^\\| ${n} \\|`, "m").test(doc))).toEqual([]);
  });
});

describe("docs/10 liệt kê mọi biến môi trường", () => {
  it("mỗi process.env.X trong app/ lib/ worker/ có trong .env.example của docs/10", () => {
    const doc = read("docs/10-env-and-security.md");
    const vars = new Set<string>();
    const scan = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) scan(p);
        else if (/\.(ts|tsx|js)$/.test(e.name)) for (const m of read(p).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) vars.add(m[1]);
      }
    };
    ["app", "lib", "worker"].forEach(scan);
    const ignore = new Set(["NODE_ENV", "NEXT_RUNTIME"]);
    expect([...vars].filter((v) => !ignore.has(v) && !new RegExp(`^${v}=`, "m").test(doc))).toEqual([]);
  });
});
