// TASK-046 — UI giáo viên: hub Chấm & Bảng điểm (SCR-31), bảng điểm một bài & ngăn chấm (SCR-51),
// cập nhật trang lớp (SCR-21), đổi nhãn menu TeacherLayout.
// Hợp đồng nghiệm thu do tài khoản kiểm chéo viết, bị khoá (tests.lock).
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
const exists = (p: string) => fs.existsSync(p);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

const LAYOUT = "components/TeacherLayout.tsx";
const CLASS_PAGE = "app/teacher/classes/[classId]/page.tsx";
const HUB_PAGE = "app/teacher/grading/page.tsx";
const DETAIL_PAGE = "app/teacher/grading/[classId]/[kind]/[itemId]/page.tsx";
const GRADING_COMP_DIR = "components/teacher/grading";
const DOCS_03 = "docs/03-screens-and-ui.md";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Menu giáo viên (components/TeacherLayout.tsx)
// ─────────────────────────────────────────────────────────────────────────────
describe("1. Menu giáo viên (components/TeacherLayout.tsx)", () => {
  it("đổi nhãn menu '/teacher/grading' thành 'Chấm & Bảng điểm', không còn 'Duyệt Điểm AI'", () => {
    const s = read(LAYOUT);
    expect(s, "Thiếu TeacherLayout.tsx").toBeTruthy();
    expect(s).toContain("/teacher/grading");
    expect(s).toContain("Chấm & Bảng điểm");
    expect(s).not.toContain("Duyệt Điểm AI");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. SCR-21 Trang lớp (app/teacher/classes/[classId]/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
describe("2. SCR-21 Trang lớp (app/teacher/classes/[classId]/page.tsx)", () => {
  const s = () => read(CLASS_PAGE);

  it("bỏ tab 'Sổ điểm' và ma trận điểm cũ, thêm tab 'Đề giao'", () => {
    const src = s();
    expect(src).not.toMatch(/activeTab\s*===\s*["']gradebook["']/);
    expect(src).not.toMatch(/>\s*Sổ điểm\s*</i);
    expect(src).toMatch(/Đề giao/);
  });

  it("thêm nút/liên kết 'Mở bảng điểm' trỏ tới /teacher/grading?class=<classId>", () => {
    const src = s();
    expect(src).toMatch(/Mở bảng điểm/);
    expect(src).toMatch(/\/teacher\/grading\?class=/);
  });

  it("gỡ bỏ modal duyệt bài nộp cũ và không còn gọi /api/exam/grade-override hay /api/teacher/submissions", () => {
    const src = s();
    expect(src).not.toContain("openSubmissionReviewModal");
    expect(src).not.toContain("handleSaveTeacherReview");
    expect(src).not.toContain("/api/exam/grade-override");
    expect(src).not.toContain("/api/teacher/submissions");
  });

  it("không đọc các trường di sản final_score, ai_score, ai_feedback trong bảng điểm", () => {
    const src = s();
    expect(src).not.toMatch(/sub\.(?:final_score|ai_score|ai_feedback)/);
    expect(src).not.toMatch(/submission\.(?:final_score|ai_score|ai_feedback)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. SCR-31 Hub Chấm & Bảng điểm (app/teacher/grading/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
describe("3. SCR-31 Hub Chấm & Bảng điểm (app/teacher/grading/page.tsx)", () => {
  const s = () => read(HUB_PAGE);

  it("là client component và dùng các hook điều hướng Next.js", () => {
    const src = s();
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toMatch(/useRouter/);
    expect(src).toMatch(/useSearchParams/);
  });

  it("trạng thái nằm trên URL (?class=&tab=items|summary), đổi lựa chọn dùng router.replace, mặc định lớp đầu tiên", () => {
    const src = s();
    expect(src).toMatch(/router\.replace\(/);
    expect(src).toMatch(/[?&]class=/);
    expect(src).toMatch(/[?&]tab=/);
    expect(src).toMatch(/summary/);
  });

  it("gọi đúng API lớp, bài và tổng kết; không gọi /api/teacher/submissions cũ", () => {
    const src = s();
    expect(src).toContain("/api/teacher/grading/classes");
    expect(src).toMatch(/\/api\/teacher\/grading\/classes\/\$\{?[a-zA-Z0-9_]+\}?\/summary/);
    expect(src).not.toContain("/api/teacher/submissions");
  });

  it("tab Bài: có bộ lọc loại (Tất cả / Bài học / Đề thi) và ô 'Chỉ bài còn việc' (lọc client)", () => {
    const src = s();
    expect(src).toMatch(/Tất cả/);
    expect(src).toMatch(/Bài học/);
    expect(src).toMatch(/Đề thi/);
    expect(src).toMatch(/Chỉ bài còn việc/);
  });

  it("tab Bài: hiển thị đủ các cột thông tin bài và điều hướng sang SCR-51 khi bấm dòng bài", () => {
    const src = s();
    // Nhãn loại câu KQ hoặc AI
    expect(src).toMatch(/\bKQ\b/);
    expect(src).toMatch(/\bAI\b/);
    // Bấm dòng bài chuyển sang SCR-51: /teacher/grading/<classId>/<kind>/<itemId>
    expect(src).toMatch(/\/teacher\/grading\/\$\{?[^}]*class[^}]*\}\/\$\{?[^}]*kind[^}]*\}\/\$\{?[^}]*id/);
  });

  it("tab Tổng kết lớp: hiển thị học sinh × bài đã chốt, điểm gốc + thang 10, trung bình, ô trống ghi 'Chưa nộp'", () => {
    const src = s();
    expect(src).toMatch(/Chưa nộp/);
    expect(src).toMatch(/average10/);
    expect(src).toMatch(/score10/);
  });

  it("đủ 4 trạng thái UI: loading skeleton, empty ('Bạn chưa có lớp nào', 'Lớp chưa có bài học/đề nào trong lộ trình hoặc được giao'), error ('Thử lại')", () => {
    const src = s();
    expect(src).toMatch(/Bạn chưa có lớp nào/);
    expect(src).toMatch(/Lớp chưa có bài học\/đề nào trong lộ trình hoặc được giao/);
    expect(src).toMatch(/Thử lại/);
    // Khi chưa có lớp thì không link ra trang ngoài ngoài /teacher/classes
    expect(src).not.toMatch(/href=["']\/(?!teacher\/classes)[\w\-/]+["']/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SCR-51 Bảng điểm một bài & Ngăn chấm (app/teacher/grading/[classId]/[kind]/[itemId]/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
describe("4. SCR-51 Bảng điểm một bài & Ngăn chấm", () => {
  it("tồn tại file page.tsx cho dynamic route [classId]/[kind]/[itemId] và là client component", () => {
    expect(exists(DETAIL_PAGE), `Thiếu file ${DETAIL_PAGE}`).toBe(true);
    const src = read(DETAIL_PAGE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("gọi GET /api/teacher/grading/classes/[classId]/items/[kind]/[itemId] để lấy bảng điểm", () => {
    const src = read(DETAIL_PAGE);
    expect(src).toMatch(/\/api\/teacher\/grading\/classes\/\$\{?[^}]*\}\/items\/\$\{?[^}]*\}\/\$\{?[^}]*\}/);
  });

  it("header trang: hiển thị tên bài, loại, chuẩn chấm, nút 'Chốt bảng điểm' / 'Mở chốt', link về hub", () => {
    const src = read(DETAIL_PAGE);
    expect(src).toMatch(/Chốt bảng điểm/);
    expect(src).toMatch(/Mở chốt/);
    expect(src).toMatch(/\/teacher\/grading\?class=/);
  });

  it("bảng học sinh: render theo columns từ API, cột thang 10, học sinh 'Chưa nộp' cho nhập tay điểm 10 và ghi chú", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/columns/);
    expect(all).toMatch(/manual_score10/);
    expect(all).toMatch(/Chưa nộp/);
    // PUT cập nhật học sinh
    expect(all).toMatch(/\/students\/\$\{?[^}]*student/);
  });

  it("ngăn chấm (Drawer): mở khi bấm dòng, gọi GET attempt, danh sách lượt có ★ cho lượt đang tính, nút 'Tính lượt này' và 'Bỏ chọn'", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/\/api\/teacher\/grading\/attempts\/\$\{?[^}]*kind[^}]*\}\/\$\{?[^}]*attempt/);
    expect(all).toMatch(/★/);
    expect(all).toMatch(/Tính lượt này/);
    expect(all).toMatch(/Bỏ chọn/);
  });

  it("ngăn chấm: câu khách quan chỉ xem; câu Speaking có ghi âm phát bằng <audio>; câu AI có ô điểm GV và nhận xét GV", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/<audio/);
    expect(all).toMatch(/teacher_score/);
    expect(all).toMatch(/teacher_feedback/);
    expect(all).toMatch(/Lưu & đánh dấu đã duyệt/);
  });

  it("ngăn chấm: gửi PUT attempt với items (kèm item_key cho bài học), lưu xong cập nhật và hiện toast", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/method:\s*["']PUT["']/);
    expect(all).toMatch(/item_key/);
  });

  it("client validate: điểm số phải trong [min, max], đúng bước (step); nhận xét tối đa 2000 ký tự; sai thì báo lỗi dưới ô và chặn gửi", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/2000/);
    expect(all).toMatch(/step|bước/i);
    expect(all).toMatch(/min|max/);
  });

  it("quy trình Chốt & Mở chốt: xử lý 409 UNREVIEWED (hộp xác nhận gửi lại confirmUnreviewed: true) và 409 GRADING_PENDING", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/\/finalize/);
    expect(all).toMatch(/UNREVIEWED/);
    expect(all).toMatch(/confirmUnreviewed/);
    expect(all).toMatch(/GRADING_PENDING/);
    expect(all).toMatch(/Còn\s+(?:\$\{.*\}|\d+)\s+bài AI chưa xem\.\s*Vẫn chốt theo điểm hiện tại\?/);
  });

  it("bài đã chốt: hiện băng thông báo 'Đã chốt', khoá mọi ô và nút sửa, có nút 'Mở chốt' gọi POST reopen", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/Đã chốt/);
    expect(all).toMatch(/\/reopen/);
    expect(all).toMatch(/reopen/i);
  });

  it("đủ 4 trạng thái UI: loading skeleton, empty ('Lớp chưa có học sinh'), error 403/404 ('Không tìm thấy bài trong lớp của bạn', nút 'Thử lại')", () => {
    const all = read(DETAIL_PAGE) + "\n" + walk(GRADING_COMP_DIR).map(read).join("\n");
    expect(all).toMatch(/Lớp chưa có học sinh/);
    expect(all).toMatch(/Không tìm thấy bài trong lớp của bạn/);
    expect(all).toMatch(/Thử lại/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Bảo mật & Cách ly điều hướng giữa các vai trò (Cross-role isolation)
// ─────────────────────────────────────────────────────────────────────────────
describe("5. An toàn cách ly vai trò (Cross-role navigation isolation)", () => {
  it("không file nào trong app/teacher/** và components/teacher/grading/** chứa link hoặc router.push tới /student hoặc /admin", () => {
    const files = [
      ...walk("app/teacher"),
      ...walk(GRADING_COMP_DIR),
    ].filter((f) => !f.includes("StudentPreviewModal.tsx"));

    const badPatterns = [
      /href=["']\/student[/"']/i,
      /href=["']\/admin[/"']/i,
      /router\.(?:push|replace)\(["']\/student[/"']/i,
      /router\.(?:push|replace)\(["']\/admin[/"']/i,
      /window\.location(?:\.href)?\s*=\s*["']\/(?:student|admin)[/"']/i,
    ];

    const violations: string[] = [];
    for (const file of files) {
      const content = read(file);
      for (const pat of badPatterns) {
        if (pat.test(content)) {
          violations.push(`${file} chứa điều hướng vi phạm: ${pat.source}`);
        }
      }
    }

    expect(violations, `Phát hiện link/push vi phạm cách ly vai trò: ${violations.join(", ")}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Quy ước Design System & Token màu (DEC-022, DEC-035)
// ─────────────────────────────────────────────────────────────────────────────
describe("6. Quy ước Design System & Token màu (DEC-022, DEC-035)", () => {
  it("các component mới trong components/teacher/grading và app/teacher/grading không dùng màu hex tuỳ tiện bg-[#...]", () => {
    const files = [...walk("app/teacher/grading"), ...walk(GRADING_COMP_DIR)];
    const hexViolations: string[] = [];
    for (const f of files) {
      const src = read(f);
      if (/-\[#[0-9a-fA-F]{3,8}\]/.test(src)) {
        hexViolations.push(f);
      }
    }
    expect(hexViolations, `Chứa màu hex cứng thay vì token brand/accent/surface: ${hexViolations.join(", ")}`).toEqual([]);
  });

  it("nhãn nút không bắt đầu bằng dấu '+ ' (DEC-035)", () => {
    const files = [...walk("app/teacher/grading"), ...walk(GRADING_COMP_DIR)];
    const buttonViolations: string[] = [];
    for (const f of files) {
      const lines = read(f).split("\n");
      lines.forEach((line, idx) => {
        if (/(<span>|["'`{>])\+ [A-ZĐÀ-Ỹ]/.test(line)) {
          buttonViolations.push(`${f}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    expect(buttonViolations, `Nút có dấu '+ ' ở đầu: ${buttonViolations.join(", ")}`).toEqual([]);
  });

  it("các component phụ trợ được chia tách trong components/teacher/grading, mỗi file khuyến nghị dưới 450 dòng", () => {
    expect(exists(GRADING_COMP_DIR), `Thư mục ${GRADING_COMP_DIR} phải tồn tại`).toBe(true);
    const files = walk(GRADING_COMP_DIR);
    expect(files.length, "Cần có các component trong components/teacher/grading").toBeGreaterThan(0);
    const longFiles: string[] = [];
    for (const f of files) {
      const lines = read(f).split("\n").length;
      if (lines > 450) longFiles.push(`${f} (${lines} dòng)`);
    }
    expect(longFiles, `File component quá dài, nên tách nhỏ dưới 400 dòng: ${longFiles.join(", ")}`).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Đồng bộ tài liệu chuẩn (docs/03-screens-and-ui.md)
// ─────────────────────────────────────────────────────────────────────────────
describe("7. Đồng bộ tài liệu chuẩn docs/03-screens-and-ui.md", () => {
  it("SCR-31, SCR-51, SCR-21 được đánh dấu là hoàn thành (Code: DONE)", () => {
    const doc = read(DOCS_03);
    expect(doc).toMatch(/SCR-31.*DONE/);
    expect(doc).toMatch(/SCR-51.*DONE/);
    expect(doc).toMatch(/SCR-21.*DONE/);
  });
});
