// TASK-047 — UI học sinh: tab Bảng điểm, điểm/nhận xét giáo viên, bài học chờ chấm.
// Hợp đồng nghiệm thu do kỹ sư kiểm thử viết (kiểm thử chéo).
// Người code KHÔNG được sửa file này.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), "utf8");
const exists = (relPath: string) => fs.existsSync(path.join(ROOT, relPath));

const GRADEBOOK_COMP = "components/student/ClassGradebook.tsx";
const CLASS_PAGE = "app/student/class/[classId]/page.tsx";
const EXAM_REVIEW_PAGE = "app/student/exam/review/[submissionId]/page.tsx";
const LESSON_PAGE = "app/student/lesson/[lessonId]/page.tsx";
const LESSON_PLAYER_COMP = "components/lesson-player/LessonPlayer.tsx";

const FORBIDDEN_IMPORTS = ['"@/lib/supabase"', '"@/lib/neo4j"', '"@/lib/db-pg"', '"@/lib/mock-data"', "supabase."];

describe("1. Component Bảng điểm học sinh — components/student/ClassGradebook.tsx (SCR-11)", () => {
  it("file components/student/ClassGradebook.tsx phải tồn tại", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} phải tồn tại`).toBe(true);
  });

  it("là Client Component, export component nhận prop classId", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toMatch(/export\s+(?:default\s+)?function\s+ClassGradebook\s*\(\s*\{[^}]*classId/);
  });

  it("gọi API GET /api/student/classes/[classId]/gradebook", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src).toContain("/api/student/classes/");
    expect(src).toContain("/gradebook");
  });

  it("bảng có đủ các cột: Bài, Loại, Điểm, Thang 10, Nhận xét, Ngày chốt", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src).toMatch(/Bài|Tên bài/);
    expect(src).toContain("Loại");
    expect(src).toContain("Điểm");
    expect(src).toMatch(/Thang 10|Thang điểm 10/);
    expect(src).toMatch(/Nhận xét|Ghi chú/);
    expect(src).toMatch(/Ngày chốt/);
  });

  it("phân biệt loại Bài học và Đề thi; bài học hiện dạng %, đề thi hiện raw_score/raw_max", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src).toMatch(/Bài học/);
    expect(src).toMatch(/Đề thi/);
    expect(src).toMatch(/LESSON/);
    expect(src).toMatch(/EXAM/);
    expect(src).toContain("%");
    expect(src).toMatch(/raw_score/);
    expect(src).toMatch(/raw_max/);
    expect(src).toMatch(/score10/);
  });

  it("dòng cuối hiển thị 'Trung bình' với average10, nếu null hiển thị '—'", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src).toMatch(/Trung bình/);
    expect(src).toMatch(/average10/);
    expect(src).toMatch(/["']—["']/);
  });

  it("đủ 4 trạng thái: Đang tải, Rỗng ('Giáo viên chưa chốt bài nào'), Lỗi ('Thử lại'), Có dữ liệu", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    // Loading
    expect(src).toMatch(/Loader2|animate-spin|skeleton|Đang tải/i);
    // Empty: đúng chính xác câu theo brief mục 4
    expect(src).toContain("Giáo viên chưa chốt bài nào");
    // Error
    expect(src).toMatch(/Thử lại/);
    // Success / Table
    expect(src).toMatch(/<table|<div[^>]*grid/);
  });

  it("xử lý phân quyền 403 (chưa ghi danh hoặc không có quyền)", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src).toMatch(/403/);
  });

  it("không gọi trực tiếp DB/Supabase/mock", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    for (const bad of FORBIDDEN_IMPORTS) {
      expect(src, bad).not.toContain(bad);
    }
  });

  it("tuân thủ DEC-022 và DEC-035: không màu hex viết cứng, không nút có dấu '+'", () => {
    expect(exists(GRADEBOOK_COMP), `${GRADEBOOK_COMP} chưa được tạo`).toBe(true);
    const src = read(GRADEBOOK_COMP);
    expect(src).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/);
    expect(src).not.toMatch(/(?:<span>|["'`{>])\+\s+[A-ZĐÀ-Ỹ]/);
  });
});

describe("2. Tab Bảng điểm trên trang chi tiết lớp — app/student/class/[classId]/page.tsx", () => {
  const src = () => read(CLASS_PAGE);

  it("kiểu activeTab có thêm 'gradebook'", () => {
    expect(src()).toMatch(/activeTab[^\n]*"gradebook"|"gradebook"[^\n]*activeTab/);
  });

  it("thanh điều hướng tab có nút 'Bảng điểm' dẫn tới activeTab gradebook", () => {
    const s = src();
    expect(s).toContain("Bảng điểm");
    expect(s).toMatch(/setActiveTab\(\s*["']gradebook["']\s*\)/);
  });

  it("khi tab là 'gradebook' thì hiển thị component ClassGradebook", () => {
    const s = src();
    expect(s).toMatch(/import\s+ClassGradebook\s+from\s+["']@\/components\/student\/ClassGradebook["']/);
    expect(s).toMatch(/activeTab\s*===\s*["']gradebook["']\s*&&\s*<ClassGradebook/);
  });

  it("đọc và ghi ?tab=gradebook qua router/searchParams để link thông báo mở đúng tab", () => {
    const s = src();
    expect(s).toMatch(/useSearchParams/);
    expect(s).toMatch(/tab/);
    expect(s).toMatch(/router\.(?:replace|push)/);
  });

  it("bọc Suspense nếu dùng useSearchParams theo chuẩn Next.js 16", () => {
    const s = src();
    if (s.includes("useSearchParams(")) {
      expect(s).toMatch(/<Suspense/);
    }
  });

  it("giữ nguyên các tab cũ: roadmap, pending, graded, practice", () => {
    const s = src();
    for (const tab of ["roadmap", "pending", "graded", "practice"]) {
      expect(s).toContain(`"${tab}"`);
    }
  });

  it("không import Supabase hay DB trực tiếp", () => {
    for (const bad of FORBIDDEN_IMPORTS) {
      expect(src(), bad).not.toContain(bad);
    }
  });
});

describe("3. Xem lại đề — app/student/exam/review/[submissionId]/page.tsx (SCR-14)", () => {
  const src = () => read(EXAM_REVIEW_PAGE);

  it("câu AI hiển thị điểm hiệu lực score", () => {
    const s = src();
    expect(s).toMatch(/score/);
  });

  it("khi có teacher_score thì hiển thị nhãn 'Giáo viên chấm' và nhận xét teacher_feedback", () => {
    const s = src();
    expect(s).toContain("Giáo viên chấm");
    expect(s).toMatch(/teacher_score/);
    expect(s).toMatch(/teacher_feedback/);
  });

  it("nhận xét AI vẫn hiển thị và ghi rõ 'Nhận xét AI'", () => {
    const s = src();
    expect(s).toMatch(/Nhận xét AI|Đánh giá & Nhận xét từ AI/);
    expect(s).toMatch(/ai_feedback|feedback/);
  });

  it("vẫn giữ hiển thị nhận xét chung của giáo viên cho cả bài (teacher_feedback)", () => {
    const s = src();
    expect(s).toMatch(/submission\.teacher_feedback|teacherFeedback/);
  });
});

describe("4. Kết quả bài học & NEEDS_REVIEW — app/student/lesson/[lessonId]/page.tsx (SCR-12)", () => {
  const src = () => read(LESSON_PAGE);

  it("kiểu status của AttemptItem có thêm 'NEEDS_REVIEW'", () => {
    expect(src()).toMatch(/status:[^\n]*["']NEEDS_REVIEW["']/);
  });

  it("lượt ở trạng thái NEEDS_REVIEW hiển thị 'Đang chờ giáo viên chấm phần tự luận'", () => {
    expect(src()).toContain("Đang chờ giáo viên chấm phần tự luận");
  });

  it("polling chỉ chạy khi GRADING, KHÔNG polling khi NEEDS_REVIEW", () => {
    const s = src();
    // Đảm bảo điều kiện kích hoạt polling chỉ check GRADING hoặc loại trừ NEEDS_REVIEW
    expect(s).toMatch(/status\s*!==\s*["']GRADING["']|status\s*===\s*["']GRADING["']/);
    expect(s).not.toMatch(/status\s*===\s*["']NEEDS_REVIEW["'][^;{]*setInterval/);
  });

  it("hiển thị nhận xét chung của giáo viên nếu attempt có teacher_feedback", () => {
    const s = src();
    expect(s).toMatch(/teacher_feedback/);
  });
});

describe("5. Kết quả từng câu bài học — components/lesson-player/LessonPlayer.tsx", () => {
  const src = () => read(LESSON_PLAYER_COMP);

  it("mỗi mục AI hiển thị band điểm hiệu lực", () => {
    const s = src();
    expect(s).toMatch(/band/);
  });

  it("mục AI có điểm/nhận xét giáo viên thì hiển thị nhãn 'Giáo viên chấm' và teacher_feedback", () => {
    const s = src();
    expect(s).toContain("Giáo viên chấm");
    expect(s).toMatch(/teacher_feedback/);
  });
});

describe("6. An toàn phân quyền & không có liên kết sang /teacher hay /admin", () => {
  const TARGET_FILES = [
    CLASS_PAGE,
    EXAM_REVIEW_PAGE,
    LESSON_PAGE,
    LESSON_PLAYER_COMP,
  ];

  it("không có file nào trong phạm vi task dẫn link tới /teacher hay /admin", () => {
    const filesToCheck = [...TARGET_FILES];
    if (exists(GRADEBOOK_COMP)) {
      filesToCheck.push(GRADEBOOK_COMP);
    }

    const badLinks: string[] = [];
    for (const f of filesToCheck) {
      const s = read(f);
      if (s.includes('href="/teacher') || s.includes("href='/teacher") || s.includes('href={`/teacher')) {
        badLinks.push(`${f} có link tới /teacher`);
      }
      if (s.includes('href="/admin') || s.includes("href='/admin") || s.includes('href={`/admin')) {
        badLinks.push(`${f} có link tới /admin`);
      }
    }
    expect(badLinks).toEqual([]);
  });
});
