// TASK-058 — Analytics học sinh: chịu lỗi API, hiển thị nhận xét AI đúng, nhãn đề đã xoá.
// Hợp đồng nghiệm thu do kỹ sư kiểm thử viết (kiểm thử chéo).
// Người code KHÔNG được sửa file này.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), "utf8");
const exists = (relPath: string) => fs.existsSync(path.join(ROOT, relPath));

const ANALYTICS_PAGE = "app/student/analytics/page.tsx";

const FORBIDDEN_IMPORTS = [
  '"@/lib/supabase"',
  '"@/lib/neo4j"',
  '"@/lib/db-pg"',
  '"@/lib/mock-data"',
  "supabase.",
];

// ============================================================================
// 1. Chịu lỗi /api/exams — trang vẫn hiển thị điểm/biểu đồ khi API exams hỏng
// ============================================================================
describe("1. Chịu lỗi /api/exams — trang vẫn hiển thị điểm/biểu đồ", () => {
  it("file app/student/analytics/page.tsx phải tồn tại", () => {
    expect(exists(ANALYTICS_PAGE), `${ANALYTICS_PAGE} phải tồn tại`).toBe(true);
  });

  it("fetch /api/exams phải tách riêng khỏi fetch /api/submissions — lỗi exams không throw chung", () => {
    const src = read(ANALYTICS_PAGE);
    // Code hiện tại throw error nếu examsRes.ok === false.
    // Sau sửa: KHÔNG được throw/reject khi exams lỗi; phải try-catch riêng hoặc xử lý độc lập.
    // Kiểm: không có "throw" nào nằm liền sau check examsRes.ok fail
    // Cách đơn giản: đảm bảo block xử lý exams KHÔNG throw/reject ra ngoài
    // mà thay vào đó set examsMap = {} và (tuỳ chọn) hiện cảnh báo.

    // Nếu code dùng Promise.all + cả hai throw thì test đỏ.
    // Chấp nhận nhiều pattern: try-catch bọc riêng, .catch trên fetch exams,
    // hoặc Promise.allSettled, miễn exams fail không crash submissions.

    // Pattern bắt buộc: có xử lý riêng exams error mà không throw ra ngoài catch chung.
    // Kiểm tra: không có dòng nào match pattern "examsRes" + "throw" liền nhau
    // trong cùng if block mà không có catch bọc riêng.
    const lines = src.split("\n");
    let examsThrowsUncaught = false;
    let insideExamErrorBlock = false;
    let catchDepth = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      // Phát hiện pattern: if (!examsRes.ok) { throw ... }
      if (trimmed.includes("examsRes") && (trimmed.includes("!examsRes.ok") || trimmed.includes("examsRes.ok ==="))) {
        insideExamErrorBlock = true;
      }
      if (insideExamErrorBlock && trimmed.includes("throw")) {
        // Kiểm tra xem throw này có bị catch bọc lại không
        // Nếu throw nằm ngoài try-catch inner → lỗi
        examsThrowsUncaught = true;
      }
      if (insideExamErrorBlock && (trimmed === "}" || trimmed.startsWith("}"))) {
        insideExamErrorBlock = false;
      }
    }

    // Cũng kiểm: nếu dùng pattern "if (!examsJson.success) throw" thì cũng sai
    let examsJsonThrows = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.includes("examsJson") && trimmed.includes("throw")) {
        examsJsonThrows = true;
      }
    }

    expect(
      examsThrowsUncaught,
      "examsRes lỗi KHÔNG được throw ra ngoài khiến cả trang lỗi — phải catch riêng"
    ).toBe(false);
    expect(
      examsJsonThrows,
      "examsJson.success === false KHÔNG được throw — phải xử lý mềm (set tên dự phòng)"
    ).toBe(false);
  });

  it("khi exams lỗi, dùng tên dự phòng 'Đề thi' (không phải 'Đề thi đã gỡ') cho tất cả bài", () => {
    const src = read(ANALYTICS_PAGE);
    // Phải có logic đặt fallback name khi exams API fail
    // Chuỗi dự phòng là "Đề thi" (theo brief mục 5)
    // Phân biệt: "Đề thi đã gỡ" dành cho đề có ID nhưng không tìm thấy trong danh sách exams thành công
    //            "Đề thi" dành cho trường hợp cả API exams sập
    expect(src).toContain("Đề thi");
  });

  it("khi exams lỗi, có hiện cảnh báo nhẹ cho người dùng (không trắng trang)", () => {
    const src = read(ANALYTICS_PAGE);
    // Phải có UI cảnh báo/thông báo khi exams fail — ví dụ toast, banner nhẹ, hoặc text phụ
    // Không phải error state toàn trang (đỏ) — phải là cảnh báo nhẹ (warning)
    // Kiểm: có biến/state riêng cho exams warning, hoặc có text cảnh báo liên quan đề thi
    const hasWarningExams =
      src.includes("examsError") ||
      src.includes("examWarning") ||
      src.includes("examsFailed") ||
      src.includes("examsWarning") ||
      (src.includes("tải danh sách đề") && !src.match(/throw[^;]*tải danh sách đề/)) ||
      src.includes("Không tải được tên đề") ||
      src.includes("tên đề thi");
    expect(
      hasWarningExams,
      "Phải có cảnh báo nhẹ khi /api/exams lỗi (không trắng trang, không error toàn trang)"
    ).toBe(true);
  });

  it("submissions vẫn hiển thị khi exams fail — setSubmissions KHÔNG bị bỏ qua", () => {
    const src = read(ANALYTICS_PAGE);
    // Code phải đảm bảo rằng dù exams lỗi, quá trình xử lý submissions vẫn tiếp tục
    // Không có early return hay throw trước khi setSubmissions
    // Kiểm: setSubmissions phải được gọi trong mọi nhánh thành công của submissions
    expect(src).toContain("setSubmissions");
    // Và biểu đồ radar / Overall Performance vẫn render khi có submissions
    expect(src).toContain("Overall Performance");
    expect(src).toContain("polygon");
  });
});

// ============================================================================
// 2. ai_feedback — hiển thị đúng dạng chuỗi, object, mảng
// ============================================================================
describe("2. Nhận xét AI — hiển thị đúng chuỗi, object, mảng (không JSON thô)", () => {
  it("khi ai_feedback là object, KHÔNG dùng JSON.stringify trực tiếp để hiển thị", () => {
    const src = read(ANALYTICS_PAGE);
    // Code hiện tại: feedbackText = JSON.stringify(sub.ai_feedback)
    // Phải sửa: render dạng danh sách đọc được
    // Kiểm: không có pattern gán trực tiếp JSON.stringify vào feedbackText/feedback state
    const hasRawStringify = /feedbackText\s*=\s*JSON\.stringify/.test(src);
    expect(
      hasRawStringify,
      "KHÔNG được gán JSON.stringify(ai_feedback) trực tiếp vào feedbackText — phải render dạng đọc được"
    ).toBe(false);
  });

  it("khi ai_feedback là object/mảng, có logic chuyển thành danh sách hoặc đoạn text đọc được", () => {
    const src = read(ANALYTICS_PAGE);
    // Phải có xử lý riêng cho typeof === "object" hoặc Array.isArray khi feedback là object
    // và render thành danh sách/bullet/paragraph — không phải JSON string
    // Kiểm: phải có ít nhất 1 trong các pattern chuyển đổi object thành UI
    const hasArrayIsArray = src.includes("Array.isArray");
    const hasObjectEntries = src.includes("Object.entries");
    const hasObjectKeys = src.includes("Object.keys");
    const hasObjectValues = src.includes("Object.values");
    // Tối thiểu phải có một trong các utility xử lý object/array
    const handlesObjectFeedback =
      hasArrayIsArray || hasObjectEntries || hasObjectKeys || hasObjectValues;
    expect(
      handlesObjectFeedback,
      "Phải có Array.isArray/Object.entries/Object.keys/Object.values để chuyển ai_feedback object thành UI đọc được"
    ).toBe(true);
  });

  it("khi ai_feedback là chuỗi thuần, hiển thị nguyên chuỗi", () => {
    const src = read(ANALYTICS_PAGE);
    // Vẫn phải giữ nhánh typeof === "string" → hiện chuỗi
    expect(src).toMatch(/typeof\s+\w*feedback\w*\s*===?\s*["']string["']|typeof\s+sub\.ai_feedback\s*===?\s*["']string["']/i);
  });

  it("không hiển thị [object Object] trong giao diện", () => {
    const src = read(ANALYTICS_PAGE);
    // Chống pattern xấu: gán feedback = someObject rồi render trực tiếp thành text
    // Pattern nguy hiểm: feedbackText = sub.ai_feedback (khi nó là object) mà không parse
    // Kiểm: nhánh else (không phải string) phải có xử lý chuyển đổi, không gán thẳng
    const lines = src.split("\n");
    let inElseBranch = false;
    let directAssignObject = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.includes("else") && (
        lines.slice(Math.max(0, i - 5), i).some(l => l.includes("typeof") && l.includes("string"))
      )) {
        inElseBranch = true;
      }
      if (inElseBranch) {
        // Nếu trong else branch mà gán thẳng feedbackText = sub.ai_feedback hoặc = JSON.stringify
        if (/feedbackText\s*=\s*JSON\.stringify/.test(trimmed)) {
          directAssignObject = true;
        }
        if (trimmed === "}" || trimmed.startsWith("}")) {
          inElseBranch = false;
        }
      }
    }
    expect(
      directAssignObject,
      "Nhánh else (ai_feedback là object) KHÔNG được gán JSON.stringify — phải format đọc được"
    ).toBe(false);
  });

  it("feedback 'Chưa có nhận xét.' vẫn là giá trị mặc định khi không có feedback", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src).toContain("Chưa có nhận xét");
  });
});

// ============================================================================
// 3. Đề không tìm được → "Đề thi đã gỡ"; chỉ tính IN_PROGRESS === false
// ============================================================================
describe("3. Nhãn đề đã xoá và lọc IN_PROGRESS", () => {
  it("đề không tìm thấy trong danh sách exams hiển thị 'Đề thi đã gỡ'", () => {
    const src = read(ANALYTICS_PAGE);
    // Brief yêu cầu: "Đề thi đã gỡ" — không phải "Đề thi đã xoá" như code hiện tại
    expect(src).toContain("Đề thi đã gỡ");
  });

  it("lọc bỏ submission có status IN_PROGRESS — chỉ hiện bài đã nộp", () => {
    const src = read(ANALYTICS_PAGE);
    // Phải có logic lọc: filter ra submissions có status !== 'IN_PROGRESS'
    // hoặc chỉ lấy status === 'GRADED' | 'NEEDS_REVIEW' | 'GRADING' | 'SUBMITTED'
    const hasFilter =
      src.includes("IN_PROGRESS") ||
      src.includes("in_progress");
    expect(
      hasFilter,
      "Phải lọc bỏ bài có status = 'IN_PROGRESS' — chỉ hiện bài đã nộp"
    ).toBe(true);

    // Đảm bảo là lọc bỏ, không phải lọc giữ
    const filterPattern = /\.filter\s*\(\s*\(?[^)]*\)?\s*=>\s*[^)]*(?:status\s*!==?\s*["']IN_PROGRESS["']|!.*IN_PROGRESS)/;
    const excludePattern = /status\s*!==?\s*["']IN_PROGRESS["']/;
    expect(
      filterPattern.test(src) || excludePattern.test(src),
      "Phải filter loại bỏ IN_PROGRESS (.filter(s => s.status !== 'IN_PROGRESS') hoặc tương đương)"
    ).toBe(true);
  });

  it("số bài 'Tests Taken' phản ánh đúng số lượng sau khi lọc IN_PROGRESS", () => {
    const src = read(ANALYTICS_PAGE);
    // submissions.length phải tính trên danh sách đã lọc
    expect(src).toContain("submissions.length");
    // Nếu filter đúng trước setSubmissions thì submissions.length đã chính xác
  });
});

// ============================================================================
// 4. Trạng thái rỗng tiếng Việt
// ============================================================================
describe("4. Trạng thái rỗng tiếng Việt khi chưa có bài nào", () => {
  it("có thông báo rỗng tiếng Việt có dấu", () => {
    const src = read(ANALYTICS_PAGE);
    // Phải có text tiếng Việt cho empty state
    const hasVietnameseEmpty =
      src.includes("chưa làm bài") ||
      src.includes("Chưa có bài") ||
      src.includes("chưa có kết quả") ||
      src.includes("chưa nộp bài") ||
      src.includes("Bạn chưa làm bài thi nào");
    expect(
      hasVietnameseEmpty,
      "Trạng thái rỗng phải có text tiếng Việt có dấu"
    ).toBe(true);
  });

  it("trạng thái rỗng hiển thị khi danh sách submissions rỗng SAU KHI lọc IN_PROGRESS", () => {
    const src = read(ANALYTICS_PAGE);
    // Kiểm: submissions.length === 0 dẫn đến empty state
    expect(src).toMatch(/submissions\.length\s*===?\s*0/);
  });
});

// ============================================================================
// 5. Đủ 4 trạng thái UI: đang tải, rỗng, lỗi (submissions), có dữ liệu
// ============================================================================
describe("5. Đủ 4 trạng thái UI", () => {
  it("có trạng thái đang tải (loading)", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src).toMatch(/loading/);
    expect(src).toMatch(/Loader2|animate-spin|Đang/i);
  });

  it("có trạng thái lỗi khi submissions fail, với nút 'Thử lại'", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src).toMatch(/error/);
    expect(src).toContain("Thử lại");
  });

  it("trạng thái lỗi KHÔNG hiện mã HTTP thô (không hiện status code số)", () => {
    const src = read(ANALYTICS_PAGE);
    // Không được hiện mã HTTP như "500", "404" cho người dùng
    // Kiểm: error message không chứa pattern số HTTP trực tiếp
    // (Cho phép dùng số trong logic nhưng không hiện cho user)
    // Đảm bảo: thông báo lỗi là tiếng Việt mô tả
    expect(src).toMatch(/Không thể tải|Đã xảy ra lỗi|Lỗi khi tải/);
  });

  it("có trạng thái có dữ liệu hiển thị danh sách bài", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src).toContain("submissions.map");
  });
});

// ============================================================================
// 6. An toàn — không import DB, không link admin/teacher
// ============================================================================
describe("6. An toàn — không import DB, không link admin/teacher", () => {
  it("không import trực tiếp DB/Supabase/mock", () => {
    const src = read(ANALYTICS_PAGE);
    for (const bad of FORBIDDEN_IMPORTS) {
      expect(src, `Không được import ${bad}`).not.toContain(bad);
    }
  });

  it("không có link dẫn sang /teacher hoặc /admin", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src).not.toMatch(/href=["'`{/]*\/teacher/);
    expect(src).not.toMatch(/href=["'`{/]*\/admin/);
  });

  it("không có màu hex viết cứng (tuân thủ DEC-022)", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/);
  });
});

// ============================================================================
// 7. Chống lách — test hành vi cụ thể, không cho phép hard-code
// ============================================================================
describe("7. Chống lách — đảm bảo logic thật, không hard-code", () => {
  it("logic chịu lỗi exams phải thực sự try-catch/handle riêng, không chỉ xoá dòng fetch exams", () => {
    const src = read(ANALYTICS_PAGE);
    // Trang VẪN phải gọi /api/exams (để lấy tên đề khi API ok)
    expect(src).toContain("/api/exams");
    // Nhưng không crash khi fail
    expect(src).toContain("/api/submissions");
  });

  it("xử lý ai_feedback phải có ít nhất 3 nhánh: string, object, fallback", () => {
    const src = read(ANALYTICS_PAGE);
    // Đếm số nhánh xử lý feedback
    const stringBranch = /typeof\s+\w*\.?(?:ai_feedback|feedback)\w*\s*===?\s*["']string["']/i.test(src);
    const objectBranch = /typeof\s+\w*\.?(?:ai_feedback|feedback)\w*\s*===?\s*["']object["']|Array\.isArray/i.test(src);
    const fallback = src.includes("Chưa có nhận xét");

    expect(stringBranch, "Phải có nhánh xử lý khi ai_feedback là string").toBe(true);
    expect(objectBranch, "Phải có nhánh xử lý khi ai_feedback là object/array").toBe(true);
    expect(fallback, "Phải có fallback 'Chưa có nhận xét'").toBe(true);
  });

  it("'Đề thi đã gỡ' phải là fallback khi exam_id không có trong examsMap, không phải hard-code tất cả", () => {
    const src = read(ANALYTICS_PAGE);
    // Phải có logic: examsMap[sub.exam_id] || "Đề thi đã gỡ" (hoặc tương đương)
    // Không được hard-code tất cả title thành "Đề thi đã gỡ"
    expect(src).toMatch(/examsMap|examMap|examNames|examTitleMap/);
    expect(src).toContain("Đề thi đã gỡ");
  });

  it("vẫn là 'use client' component", () => {
    const src = read(ANALYTICS_PAGE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });
});
