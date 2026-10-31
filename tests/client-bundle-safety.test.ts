// Chặn client component ("use client") import module chỉ chạy server (pg, AI, Neo4j, Supabase service role).
// Import dạng `import type` được phép. Lỗi này từng làm hỏng next build (pg kéo dns/net/tls vào bundle trình duyệt).
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SERVER_ONLY = ["@/lib/db-pg", "@/lib/ai-engine", "@/lib/rubric-resolver", "@/lib/neo4j", "@/lib/supabase-server",
  "@/lib/exam-attempts", "@/lib/exam-ai-grading", "@/lib/lesson-ai-grading", "@/lib/lesson-access", "@/lib/roadmap-data",
  "@/lib/redis-queue", "@/lib/kafka", "@/lib/portkey", "@/lib/document-parser", "@/lib/ai-model-resolver"];

function walk(dir: string, out: string[] = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("Client component không import module chỉ chạy server", () => {
  const files = [...walk("app"), ...walk("components")].filter((f) => {
    const src = fs.readFileSync(f, "utf8").trimStart();
    return src.startsWith('"use client"') || src.startsWith("'use client'");
  });

  it("có client component để kiểm tra", () => expect(files.length).toBeGreaterThan(10));

  for (const f of files) {
    it(f, () => {
      const src = fs.readFileSync(f, "utf8");
      const offenders = SERVER_ONLY.filter((m) => {
        const re = new RegExp(`^\\s*import\\s+(?!type\\s)[^;]*from\\s+["']${m.replace(/[/@-]/g, (c) => "\\" + c)}["']`, "m");
        return re.test(src);
      });
      expect(offenders).toEqual([]);
    });
  }
});
