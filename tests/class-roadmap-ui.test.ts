// TASK-012 — Giao diện lộ trình lớp: tab "Lộ trình" cho giáo viên (SCR-L5) và học sinh (SCR-L6). Kiểm tra tĩnh.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect } from "vitest";
import fs from "fs";

const read = (p: string) => fs.readFileSync(p, "utf8");
const TEACHER_COMP = "components/class-roadmap/TeacherClassRoadmap.tsx";
const STUDENT_COMP = "components/class-roadmap/StudentRoadmap.tsx";
const TEACHER_PAGE = "app/teacher/classes/[classId]/page.tsx";
const STUDENT_PAGE = "app/student/class/[classId]/page.tsx";

const FORBIDDEN = ['"@/lib/supabase"', '"@/lib/neo4j"', '"@/lib/db-pg"', '"@/lib/mock-data"', "supabase."];

describe("TeacherClassRoadmap (SCR-L5)", () => {
  const src = () => read(TEACHER_COMP);

  it("client component, export default nhận classId", () => {
    expect(src().trimStart().startsWith('"use client"')).toBe(true);
    expect(src()).toMatch(/export default function TeacherClassRoadmap\s*\(\s*\{\s*classId/);
  });

  it("gọi đủ API: roadmap, settings, unlocks (POST + DELETE), progress, danh sách khóa học", () => {
    const s = src();
    for (const ep of ["/roadmap", "/settings", "/unlocks", "/progress", "/api/teacher/courses", "/api/teacher/classes/"]) expect(s, ep).toContain(ep);
    expect(s).toMatch(/method:\s*"PUT"/);
    expect(s).toMatch(/method:\s*"POST"/);
    expect(s).toMatch(/method:\s*"DELETE"/);
  });

  it("cho chọn đủ 3 chế độ mở bài và ngưỡng hoàn thành", () => {
    const s = src();
    for (const m of ["MANUAL", "ALL_OPEN", "SEQUENTIAL", "pass_percent"]) expect(s, m).toContain(m);
  });

  it("có hạn nộp (due_date) và trạng thái lỗi / rỗng", () => {
    const s = src();
    expect(s).toContain("due_date");
    expect(s).toMatch(/Thử lại/);
    expect(s).toMatch(/chưa gắn khóa học/i);
  });

  it("không truy cập DB/Neo4j/mock trực tiếp", () => {
    for (const bad of FORBIDDEN) expect(src(), bad).not.toContain(bad);
  });
});

describe("StudentRoadmap (SCR-L6)", () => {
  const src = () => read(STUDENT_COMP);

  it("client component, export default nhận classId, gọi /api/student/classes/{id}/roadmap", () => {
    expect(src().trimStart().startsWith('"use client"')).toBe(true);
    expect(src()).toMatch(/export default function StudentRoadmap\s*\(\s*\{\s*classId/);
    expect(src()).toContain("/api/student/classes/");
    expect(src()).toContain("/roadmap");
  });

  it("hiển thị 3 trạng thái, % tiến độ, điểm cao nhất, hạn", () => {
    const s = src();
    for (const k of ["LOCKED", "OPEN", "COMPLETED", "progress_percent", "best_percent", "due_date"]) expect(s, k).toContain(k);
  });

  it("bài học mở/hoàn thành dẫn tới trang làm bài kèm classId; đề thi dẫn tới trang thi", () => {
    const s = src();
    expect(s).toMatch(/\/student\/lesson\/\$\{[^}]*lesson_id[^}]*\}\?classId=\$\{[^}]*classId[^}]*\}/);
    expect(s).toMatch(/\/student\/exam\/\$\{[^}]*exam_id[^}]*\}/);
  });

  it("có trạng thái lỗi + Thử lại và trạng thái rỗng", () => {
    expect(src()).toMatch(/Thử lại/);
    expect(src()).toMatch(/chưa gắn khóa học|chưa có lộ trình/i);
  });

  it("không truy cập DB/Neo4j/mock trực tiếp", () => {
    for (const bad of FORBIDDEN) expect(src(), bad).not.toContain(bad);
  });
});

describe("Gắn tab 'Lộ trình' vào trang lớp", () => {
  it("trang lớp giáo viên có tab roadmap dùng TeacherClassRoadmap", () => {
    const s = read(TEACHER_PAGE);
    expect(s).toContain("@/components/class-roadmap/TeacherClassRoadmap");
    expect(s).toMatch(/"roadmap"/);
    expect(s).toContain("Lộ trình");
  });

  it("trang lớp học sinh có tab roadmap dùng StudentRoadmap", () => {
    const s = read(STUDENT_PAGE);
    expect(s).toContain("@/components/class-roadmap/StudentRoadmap");
    expect(s).toMatch(/"roadmap"/);
    expect(s).toContain("Lộ trình");
  });
});
