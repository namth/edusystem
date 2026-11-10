// TASK-055 — Khung học sinh: sửa menu cls_101, điều hướng mobile, bỏ ô tìm kiếm chết.
// Hợp đồng nghiệm thu do kỹ sư kiểm thử viết (kiểm thử chéo).
// Người code KHÔNG được sửa file này.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string) => fs.existsSync(path.join(ROOT, rel));

const STUDENT_LAYOUT = "components/StudentLayout.tsx";
const TEACHER_CLASS_PAGE = "app/teacher/classes/[classId]/page.tsx";

/** Walk files in a directory */
function walk(dir: string, ext = [".ts", ".tsx"], out: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel, ext, out);
    else if (ext.some((x) => e.name.endsWith(x))) out.push(rel);
  }
  return out;
}

// ────────────────────────────────────────────────
// 1. cls_101 phải biến mất hoàn toàn trong giao diện
// ────────────────────────────────────────────────
describe("1. Không còn chuỗi cls_101 trong UI components và pages", () => {
  it("components/StudentLayout.tsx không chứa 'cls_101'", () => {
    expect(read(STUDENT_LAYOUT)).not.toContain("cls_101");
  });

  it("app/teacher/classes/[classId]/page.tsx không chứa 'cls_101'", () => {
    expect(read(TEACHER_CLASS_PAGE)).not.toContain("cls_101");
  });

  it("toàn bộ thư mục components/ không còn file nào chứa 'cls_101'", () => {
    const compFiles = walk("components");
    const bad = compFiles.filter((f) => read(f).includes("cls_101"));
    expect(bad, `Các component còn cls_101: ${bad.join(", ")}`).toEqual([]);
  });

  it("toàn bộ các trang UI (page.tsx) trong app/ không còn file nào chứa 'cls_101'", () => {
    const pageFiles = walk("app").filter((f) => f.endsWith("page.tsx"));
    const bad = pageFiles.filter((f) => read(f).includes("cls_101"));
    expect(bad, `Các trang còn cls_101: ${bad.join(", ")}`).toEqual([]);
  });

  it("trang giáo viên dùng params.classId trực tiếp, không fallback || 'cls_101'", () => {
    const src = read(TEACHER_CLASS_PAGE);
    expect(src).not.toMatch(/\|\|\s*["']cls_101["']/);
    expect(src).not.toMatch(/params\?\.\s*classId\s*\|\|\s*["']/);
  });
});

// ────────────────────────────────────────────────
// 2. Menu sidebar chính xác 5 mục, đường dẫn đúng
// ────────────────────────────────────────────────
describe("2. Menu sidebar học sinh — đúng 5 mục và đường dẫn", () => {
  const REQUIRED_HREFS = [
    "/student/dashboard",
    "/student/dashboard#classes",
    "/student/analytics",
    "/profile",
    "/change-password",
  ];

  it("StudentLayout.tsx tồn tại và là Client Component", () => {
    expect(exists(STUDENT_LAYOUT)).toBe(true);
    expect(read(STUDENT_LAYOUT).trimStart().startsWith('"use client"')).toBe(true);
  });

  it("navItems chứa đúng 5 mục bắt buộc — không thừa, không thiếu", () => {
    const src = read(STUDENT_LAYOUT);
    const navMatch = src.match(/(?:const|let|var)\s+navItems(?:\s*:\s*[^=]+)?\s*=\s*\[([\s\S]*?)\];/);
    expect(navMatch, "Phải khai báo mảng navItems").toBeTruthy();
    const navBlock = navMatch![1];
    const entries = navBlock.match(/[{,]\s*["']?href["']?\s*:/g);
    expect(entries?.length, "navItems phải có đúng 5 mục").toBe(5);
  });

  it("navItems có đủ 5 đường dẫn bắt buộc", () => {
    const src = read(STUDENT_LAYOUT);
    const navMatch = src.match(/(?:const|let|var)\s+navItems(?:\s*:\s*[^=]+)?\s*=\s*\[([\s\S]*?)\];/);
    expect(navMatch).toBeTruthy();
    const navBlock = navMatch![1];
    for (const href of REQUIRED_HREFS) {
      expect(navBlock, `Thiếu href "${href}" trong navItems`).toContain(href);
    }
  });

  it("navItems KHÔNG chứa đường dẫn /student/class/ (đã loại bỏ menu cls_101)", () => {
    const src = read(STUDENT_LAYOUT);
    const navMatch = src.match(/(?:const|let|var)\s+navItems(?:\s*:\s*[^=]+)?\s*=\s*\[([\s\S]*?)\];/);
    expect(navMatch).toBeTruthy();
    expect(navMatch![1]).not.toContain("/student/class/");
  });

  it("nhãn menu tiếng Việt hoàn toàn, không lẫn tiếng Anh", () => {
    const src = read(STUDENT_LAYOUT);
    // Dashboard → Tổng quan
    expect(src).toMatch(/Tổng quan/i);
    expect(src).not.toMatch(/label:\s*["']Dashboard["']/);
    // Analytics → Phân tích...
    expect(src).toMatch(/Phân tích/i);
    expect(src).not.toMatch(/label:\s*["']Analytics/i);
    // Đăng xuất không kèm (Log Out)
    expect(src).not.toContain("Log Out");
    expect(src).not.toContain("log out");
  });
});

// ────────────────────────────────────────────────
// 3. Active state: chỉ MỘT mục tô sáng, xét hash
// ────────────────────────────────────────────────
describe("3. Active state: chỉ MỘT mục tô sáng, Dashboard không sáng khi ở #classes", () => {
  it("có cơ chế theo dõi hash fragment (location.hash hoặc hashchange)", () => {
    const src = read(STUDENT_LAYOUT);
    const hasHash =
      src.includes("location.hash") ||
      src.includes("hashchange") ||
      src.includes("window.location.hash");
    expect(hasHash, "Cần theo dõi hash để phân biệt Dashboard và #classes").toBe(true);
  });

  it("logic isActive phân biệt rõ #classes và /student/dashboard thuần", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).toMatch(/#classes/);
  });
});

// ────────────────────────────────────────────────
// 4. Điều hướng mobile
// ────────────────────────────────────────────────
describe("4. Điều hướng mobile (dưới md) cho học sinh", () => {
  it("có phần tử điều hướng mobile hiển thị dưới md, ẩn trên md (md:hidden)", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).toMatch(/md:hidden/);
  });

  it("có thanh điều hướng cố định phía dưới hoặc nút mở menu ngăn kéo", () => {
    const src = read(STUDENT_LAYOUT);
    const hasFixedBottom = /fixed[^"]*bottom|bottom[^"]*fixed/.test(src);
    const hasDrawer = /menuOpen|mobileMenu|showMobile|isMenuOpen|isMobileNav|Sheet|Drawer/i.test(src);
    expect(hasFixedBottom || hasDrawer, "Cần thanh cố định đáy hoặc nút mở ngăn menu").toBe(true);
  });

  it("điều hướng mobile có aria-label cho accessibility", () => {
    const src = read(STUDENT_LAYOUT);
    const count = (src.match(/aria-label/g) || []).length;
    expect(count, "Cần ít nhất 1 thuộc tính aria-label").toBeGreaterThanOrEqual(1);
  });

  it("nội dung trang có padding đáy (pb-) trên mobile để không bị thanh đáy che", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src, "Cần pb-16/pb-20/pb-... để nội dung không bị che").toMatch(/pb-\d{2,}|pb-\[.+?\]/);
  });

  it("mobile nav dùng cùng các mục navItems (tái sử dụng, đồng bộ)", () => {
    const src = read(STUDENT_LAYOUT);
    const usages = (src.match(/navItems\b/g) || []).length;
    expect(usages, "navItems phải được tham chiếu ≥ 2 lần (sidebar và mobile)").toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────
// 5. Bỏ ô tìm kiếm chết
// ────────────────────────────────────────────────
describe("5. Bỏ ô tìm kiếm không hoạt động ở header", () => {
  it("không còn input tìm kiếm trong StudentLayout", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).not.toMatch(/placeholder=["'][^"']*[Tt]ìm[^"']*["']/);
  });

  it("không còn render icon Search trong header", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).not.toMatch(/<Search[\s/]/);
  });
});

// ────────────────────────────────────────────────
// 6. Nhãn vai trò 'Học sinh' — không 'IELTS Student'
// ────────────────────────────────────────────────
describe("6. Nhãn vai trò 'Học sinh' — không 'IELTS Student'", () => {
  it("không chứa chuỗi 'IELTS Student'", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).not.toContain("IELTS Student");
  });

  it("hiển thị nhãn 'Học sinh'", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).toContain("Học sinh");
  });
});

// ────────────────────────────────────────────────
// 7. An toàn & phân quyền
// ────────────────────────────────────────────────
describe("7. An toàn: không import DB, không link /teacher hay /admin", () => {
  it("không import trực tiếp DB/Supabase/mock trong layout", () => {
    const src = read(STUDENT_LAYOUT);
    for (const bad of ['"@/lib/supabase"', '"@/lib/neo4j"', '"@/lib/db-pg"', '"@/lib/mock-data"']) {
      expect(src, `Không được import ${bad}`).not.toContain(bad);
    }
  });

  it("không có liên kết dẫn sang /teacher hay /admin trong layout học sinh", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).not.toMatch(/href=["'][/]?teacher/);
    expect(src).not.toMatch(/href=["'][/]?admin/);
  });
});

// ────────────────────────────────────────────────
// 8. Tuân thủ design system DEC-022/035
// ────────────────────────────────────────────────
describe("8. Tuân thủ DEC-022/035", () => {
  it("không dùng mã màu hex viết cứng trong className", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("nhãn nút không bắt đầu bằng dấu '+ '", () => {
    const src = read(STUDENT_LAYOUT);
    expect(src).not.toMatch(/(?:<span>|["'`{>])\+\s+[A-ZĐÀ-Ỹ]/);
  });
});
