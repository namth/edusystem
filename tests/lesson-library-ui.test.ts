// TASK-013 — Giao diện Kho bài học (SCR-L1), soạn bài (SCR-L2), bộ chọn bài trong lộ trình (SCR-L4), menu giáo viên.
// Kiểm tra tĩnh. File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";

const read = (p: string) => fs.readFileSync(p, "utf8");
// TASK-031: danh sách kho bài học chuyển vào panel của trang /teacher/library
const LIST = "components/teacher/LessonLibraryPanel.tsx";
const EDIT = "app/teacher/lessons/[id]/page.tsx";
const CURRICULUM = "app/teacher/tests/page.tsx";
const LAYOUT = "components/TeacherLayout.tsx";
const FORBIDDEN = ['"@/lib/supabase"', '"@/lib/neo4j"', '"@/lib/db-pg"', '"@/lib/mock-data"', "supabase."];

describe("SCR-L1 Kho bài học — app/teacher/lessons/page.tsx", () => {
  const src = () => read(LIST);
  it("client component gọi GET /api/teacher/lessons có tìm kiếm và lọc kỹ năng", () => {
    expect(src().trimStart().startsWith('"use client"')).toBe(true);
    expect(src()).toContain("/api/teacher/lessons");
    expect(src()).toMatch(/[?&]q=|q:\s|URLSearchParams/);
    expect(src()).toMatch(/skill/);
  });
  it("hiện số khối, số khóa đang dùng; nút tạo bài học dẫn tới /teacher/lessons/new", () => {
    expect(src()).toContain("block_count");
    expect(src()).toContain("usage_count");
    expect(src()).toContain("/teacher/lessons/new");
  });
  it("xoá bài học xử lý 409 và hiện danh sách khóa đang dùng", () => {
    expect(src()).toMatch(/method:\s*"DELETE"/);
    expect(src()).toMatch(/409/);
    expect(src()).toContain("usages");
  });
  it("đủ trạng thái lỗi + Thử lại và rỗng", () => {
    expect(src()).toMatch(/Thử lại/);
    expect(src()).toMatch(/Chưa có bài học/);
  });
  it("không truy cập DB trực tiếp", () => {
    for (const bad of FORBIDDEN) expect(src(), bad).not.toContain(bad);
  });
});

describe("SCR-L2 Soạn bài học — app/teacher/lessons/[id]/page.tsx", () => {
  const src = () => read(EDIT);
  it("dùng QuestionSetEditor ở chế độ LESSON", () => {
    expect(src()).toContain("@/components/question-builder/QuestionSetEditor");
    expect(src()).toMatch(/mode=\{?["']LESSON["']\}?/);
  });
  it("id = new → POST /api/teacher/lessons rồi PUT question_ids; id có sẵn → GET rồi PUT", () => {
    const s = src();
    expect(s).toContain("/api/teacher/lessons");
    expect(s).toMatch(/"new"/);
    expect(s).toMatch(/method:\s*"POST"/);
    expect(s).toMatch(/method:\s*"PUT"/);
    expect(s).toContain("question_ids");
  });
  it("xử lý 403/404 và lỗi tải", () => {
    expect(src()).toMatch(/403/);
    expect(src()).toMatch(/404/);
    expect(src()).toMatch(/Thử lại/);
  });
  it("không truy cập DB trực tiếp", () => {
    for (const bad of FORBIDDEN) expect(src(), bad).not.toContain(bad);
  });
});

describe("SCR-L4 Bộ chọn bài học trong lộ trình — app/teacher/tests/page.tsx", () => {
  const src = () => read(CURRICULUM);
  it("thêm bài học = chọn từ kho (GET /api/teacher/lessons) và gửi lesson_id", () => {
    expect(src()).toContain("/api/teacher/lessons");
    expect(src()).toMatch(/lesson_id:/);
  });
  it("có lối tắt tạo bài học mới mở tab mới", () => {
    expect(src()).toContain("/teacher/lessons/new");
    expect(src()).toMatch(/target="_blank"|window\.open\(/);
  });
  it("nút LESSON trong cây có liên kết sửa bài học", () => {
    expect(src()).toMatch(/\/teacher\/lessons\/\$\{/);
  });
});

describe("Menu giáo viên", () => {
  it("TeacherLayout có mục 'Kho Bài Học' trỏ /teacher/lessons", () => {
    const s = read(LAYOUT);
    expect(s).toContain("/teacher/lessons");
    expect(s).toContain("Kho Bài Học");
  });
});
