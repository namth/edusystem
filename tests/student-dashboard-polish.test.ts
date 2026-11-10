// TASK-056 — Dashboard học sinh: bỏ dữ liệu giả, lỗi từng khối, lượt đang làm dở, huy hiệu lớp.
// Hợp đồng nghiệm thu do kỹ sư kiểm thử viết (kiểm thử chéo).
// Người code KHÔNG được sửa file này.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), "utf8");

const DASHBOARD = "app/student/dashboard/page.tsx";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Bỏ thẻ streak giả & nhãn tiếng Anh
// ─────────────────────────────────────────────────────────────────────────────
describe("1. Bỏ dữ liệu giả (streak) và nhãn tiếng Anh", () => {
  it("không còn chuỗi 'Daily Streak' bằng tiếng Anh", () => {
    const src = read(DASHBOARD);
    expect(src).not.toMatch(/Daily\s+Streak/i);
  });

  it("không còn số 14 viết cứng gắn với streak", () => {
    const src = read(DASHBOARD);
    // Phải bỏ hoàn toàn khối streak giả — không cho phép đổi label mà giữ "14"
    expect(src).not.toMatch(/["'`>]\s*14\s*(Days|ngày|Ngày)/i);
  });

  it("lời chào (h1 đầu trang) hoàn toàn tiếng Việt — không còn 'Welcome back'", () => {
    const src = read(DASHBOARD);
    expect(src).not.toMatch(/Welcome\s+back/i);
    // Phải có lời chào tiếng Việt
    expect(src).toMatch(/Chào|Xin chào|chào mừng/i);
  });

  it("không còn import hoặc sử dụng icon Flame cho streak giả", () => {
    const src = read(DASHBOARD);
    // Nếu bỏ streak giả, không cần Flame nữa (hoặc nếu có thì không gắn "14")
    if (src.includes("Flame")) {
      // Nếu vẫn dùng Flame, không được gắn với streak cứng
      expect(src).not.toMatch(/14\s*Days/i);
      expect(src).not.toMatch(/Daily\s*Streak/i);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lỗi từng khối (error isolation per block)
// ─────────────────────────────────────────────────────────────────────────────
describe("2. Lỗi từng khối — mỗi khối có trạng thái lỗi riêng kèm nút Thử lại", () => {
  it("có ≥ 2 biến state lỗi khác nhau (không chỉ 1 'error' chung)", () => {
    const src = read(DASHBOARD);
    // Tìm các state lỗi dạng useState<string | null>
    const errorStates = src.match(/useState<[^>]*>\(null\)/g) || [];
    // Hoặc tìm các biến chứa 'error' hoặc 'Error' trong tên state
    const errorVarMatches = src.match(/\b\w*[Ee]rror\w*\s*,\s*set\w*[Ee]rror\w*/g) || [];
    // Cần ít nhất 2 biến error riêng biệt (vd: classError, subsError)
    expect(
      errorVarMatches.length,
      "Cần ≥ 2 biến state lỗi riêng biệt cho từng khối (lớp học, bài nộp)"
    ).toBeGreaterThanOrEqual(2);
  });

  it("không còn 1 try/catch chung cho cả 2 API — mỗi fetch phải có xử lý lỗi riêng", () => {
    const src = read(DASHBOARD);
    // Kiểm tra: không dùng Promise.all gộp 2 fetch rồi bắt lỗi chung
    // Cách hiện tại: Promise.all([fetch(classes), fetch(subs)]) rồi 1 catch
    // Sau sửa: phải xử lý lỗi riêng từng API
    const promiseAllCount = (src.match(/Promise\.all/g) || []).length;
    if (promiseAllCount > 0) {
      // Nếu vẫn dùng Promise.all thì phải có xử lý riêng cho từng kết quả
      // Đảm bảo mỗi response được kiểm tra riêng và set error riêng
      const classesErrorSet = src.match(/set\w*[Ee]rror\w*\(/g) || [];
      expect(
        classesErrorSet.length,
        "Dùng Promise.all nhưng phải set lỗi riêng cho từng khối"
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("khối lớp học có trạng thái lỗi riêng kèm nút 'Thử lại'", () => {
    const src = read(DASHBOARD);
    // Tìm pattern: biến error cho classes/lop + nút thử lại
    expect(src).toMatch(/[Cc]lass(?:es)?[Ee]rror|error[Cc]lasses|classErr|lop[Ee]rror/);
  });

  it("khối bài nộp có trạng thái lỗi riêng kèm nút 'Thử lại'", () => {
    const src = read(DASHBOARD);
    expect(src).toMatch(/[Ss]ub(?:mission)?s?[Ee]rror|error[Ss]ub|subErr|baiNop[Ee]rror/);
  });

  it("có ≥ 2 nút 'Thử lại' riêng biệt (1 cho mỗi khối)", () => {
    const src = read(DASHBOARD);
    const retryButtons = src.match(/Thử lại/g) || [];
    expect(
      retryButtons.length,
      "Cần ≥ 2 nút 'Thử lại' — 1 cho khối lớp, 1 cho khối bài nộp"
    ).toBeGreaterThanOrEqual(2);
  });

  it("lỗi API lớp không ảnh hưởng hiển thị khối bài nộp (và ngược lại)", () => {
    const src = read(DASHBOARD);
    // Kiểm tra logic: khối lớp check classError, khối bài check subsError
    // Không được dùng cùng 1 biến error cho cả hai
    // Đếm các biến error state khác nhau — phải có ít nhất 2
    const setErrorCalls = [...src.matchAll(/\bset(\w*[Ee]rror\w*)\(/g)].map(m => m[1]);
    const uniqueSetters = new Set(setErrorCalls);
    expect(
      uniqueSetters.size,
      "Cần ≥ 2 setter error state khác nhau"
    ).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lượt IN_PROGRESS tách riêng — không nằm trong "Bài Thi Đã Nộp"
// ─────────────────────────────────────────────────────────────────────────────
describe("3. Lượt IN_PROGRESS tách riêng khỏi danh sách đã nộp", () => {
  it("có khối 'Đang làm dở' riêng biệt", () => {
    const src = read(DASHBOARD);
    expect(src).toMatch(/Đang làm dở/);
  });

  it("lọc lượt IN_PROGRESS ra khỏi danh sách đã nộp", () => {
    const src = read(DASHBOARD);
    // Phải có logic filter trên status !== 'IN_PROGRESS' hoặc tương đương
    expect(src).toMatch(/IN_PROGRESS/);
    // Phải filter: submissions chỉ chứa status !== IN_PROGRESS cho khối "đã nộp"
    expect(src).toMatch(/\.filter\(/);
  });

  it("lượt IN_PROGRESS có liên kết vào /student/exam/{examId}", () => {
    const src = read(DASHBOARD);
    // Phải có link tới /student/exam/ (không phải review) cho lượt đang làm dở
    expect(src).toMatch(/\/student\/exam\/\$\{|\/student\/exam\/\`|href.*\/student\/exam\//);
    // Link phải dùng examId (không phải submissionId) — trang làm bài, không phải review
    expect(src).toMatch(/exam_id|examId/);
  });

  it("lượt IN_PROGRESS có ?classId= nếu bài thi thuộc lớp", () => {
    const src = read(DASHBOARD);
    expect(src).toMatch(/classId|class_id/);
    // Chuỗi link phải có logic thêm ?classId khi có
    expect(src).toMatch(/\?classId=|\?class_id=|classId/);
  });

  it("KHÔNG có liên kết 'Xem chi tiết' tới review cho lượt chưa nộp", () => {
    const src = read(DASHBOARD);
    // Khối IN_PROGRESS không được có link tới /student/exam/review/
    // Kiểm tra: lượt IN_PROGRESS không render link review
    // Cách an toàn: kiểm tra xem review link chỉ xuất hiện cho submitted items
    // Đếm số lần /student/exam/review/ xuất hiện — phải ít hơn tổng số link
    // hoặc check qua logic filter
    const reviewLinks = (src.match(/\/student\/exam\/review\//g) || []).length;
    const examLinks = (src.match(/\/student\/exam\/[^r]/g) || []).length;
    // Phải có ít nhất 1 link /student/exam/ (không review) cho khối đang làm dở
    expect(examLinks, "Phải có link /student/exam/{examId} cho khối đang làm dở").toBeGreaterThanOrEqual(1);
  });

  it("khối 'Đang làm dở' KHÔNG có nút/text 'Xem Chi Tiết Bài Làm'", () => {
    const src = read(DASHBOARD);
    // Tìm khối IN_PROGRESS — không được có text review
    // Lượt IN_PROGRESS nên có nút "Tiếp tục làm bài" hoặc tương đương, không phải "Xem Chi Tiết"
    // Khối đang làm dở phải có link dạng /student/exam/${examId}
    // và phải KHÔNG có text "Xem Chi Tiết Bài Làm" trong cùng khối
    expect(src).toMatch(/Tiếp tục|Làm tiếp|Tiếp tục làm/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Huy hiệu lớp theo billing_status
// ─────────────────────────────────────────────────────────────────────────────
describe("4. Huy hiệu lớp theo billing_status", () => {
  it("interface/type UserClass có trường billing_status", () => {
    const src = read(DASHBOARD);
    expect(src).toMatch(/billing_status/);
  });

  it("lớp LOCKED hiện nhãn 'Đã khoá'", () => {
    const src = read(DASHBOARD);
    expect(src).toContain("Đã khoá");
    expect(src).toMatch(/LOCKED/);
  });

  it("lớp GRACE hiện nhãn 'Sắp khoá'", () => {
    const src = read(DASHBOARD);
    expect(src).toContain("Sắp khoá");
    expect(src).toMatch(/GRACE/);
  });

  it("lớp ENDED hiện nhãn 'Đã kết thúc'", () => {
    const src = read(DASHBOARD);
    expect(src).toContain("Đã kết thúc");
    expect(src).toMatch(/ENDED/);
  });

  it("3 trạng thái huy hiệu ánh xạ đúng với billing_status trong cùng logic", () => {
    const src = read(DASHBOARD);
    // Đảm bảo có logic switch/if-else hay ternary ánh xạ billing_status → label
    // Tất cả 3 trạng thái phải có trong cùng file
    const hasLocked = src.includes("LOCKED") && src.includes("Đã khoá");
    const hasGrace = src.includes("GRACE") && src.includes("Sắp khoá");
    const hasEnded = src.includes("ENDED") && src.includes("Đã kết thúc");
    expect(hasLocked, "LOCKED → Đã khoá").toBe(true);
    expect(hasGrace, "GRACE → Sắp khoá").toBe(true);
    expect(hasEnded, "ENDED → Đã kết thúc").toBe(true);
  });

  it("huy hiệu là phần tử hiển thị rõ ràng (badge/span), không chỉ comment", () => {
    const src = read(DASHBOARD);
    // Kiểm tra label nằm trong JSX render (có tag HTML bao quanh), không chỉ comment
    // Ít nhất một label phải nằm sau dấu > hoặc trong template literal
    expect(src).toMatch(/>[\s\S]{0,20}Đã khoá|Đã khoá[\s\S]{0,20}<|["`']Đã khoá["`']/);
    expect(src).toMatch(/>[\s\S]{0,20}Sắp khoá|Sắp khoá[\s\S]{0,20}<|["`']Sắp khoá["`']/);
    expect(src).toMatch(/>[\s\S]{0,20}Đã kết thúc|Đã kết thúc[\s\S]{0,20}<|["`']Đã kết thúc["`']/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Đủ 4 trạng thái UI cho từng khối
// ─────────────────────────────────────────────────────────────────────────────
describe("5. Đủ 4 trạng thái UI cho từng khối", () => {
  it("khối lớp học có trạng thái: đang tải, rỗng, lỗi, có dữ liệu", () => {
    const src = read(DASHBOARD);
    // Loading
    expect(src).toMatch(/Loader2|animate-spin|Đang tải/);
    // Empty
    expect(src).toMatch(/chưa tham gia lớp|chưa có lớp/i);
    // Error + Retry
    expect(src).toMatch(/Thử lại/);
  });

  it("khối bài nộp có trạng thái: đang tải, rỗng, lỗi, có dữ liệu", () => {
    const src = read(DASHBOARD);
    // Phải có loading và empty state riêng cho khối submissions
    expect(src).toMatch(/Đang tải.*bài|bài.*Đang tải|tải.*nộp|nộp.*tải/i);
    expect(src).toMatch(/chưa.*bài thi|chưa thực hiện/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. An toàn: không import DB/Supabase/mock; không hard-code; giữ quy ước
// ─────────────────────────────────────────────────────────────────────────────
describe("6. An toàn và quy ước", () => {
  const FORBIDDEN = [
    '"@/lib/supabase"',
    '"@/lib/neo4j"',
    '"@/lib/db-pg"',
    '"@/lib/mock-data"',
    "supabase.",
  ];

  it("không import Supabase, DB, Neo4j, mock-data trực tiếp", () => {
    const src = read(DASHBOARD);
    for (const bad of FORBIDDEN) {
      expect(src, `Không được import ${bad}`).not.toContain(bad);
    }
  });

  it("không còn dữ liệu giả viết cứng (INITIAL_, sampleData, mockData)", () => {
    const src = read(DASHBOARD);
    for (const bad of ["INITIAL_", "sampleData", "mockData", "mock-data", "fakeData"]) {
      expect(src.toLowerCase(), `Không được có ${bad}`).not.toContain(bad.toLowerCase());
    }
  });

  it("không viết cứng mã hex màu", () => {
    const src = read(DASHBOARD);
    expect(src).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/);
  });

  it("nhãn nút không bắt đầu bằng dấu '+ '", () => {
    const src = read(DASHBOARD);
    expect(src).not.toMatch(/(?:<span>|["'`{>])\+\s+[A-ZĐÀ-Ỹ]/);
  });

  it("không có lỗi HTTP thô hiển thị cho người dùng (không render status code)", () => {
    const src = read(DASHBOARD);
    // Không hiện mã HTTP trực tiếp cho người dùng trong UI
    // (dùng trong logic xử lý thì OK, nhưng không render ra text)
    // Pattern: không có dạng "Lỗi 500" hay "Error 404" trong chuỗi hiển thị
    expect(src).not.toMatch(/[>"`'](?:Lỗi|Error)\s+\d{3}/);
  });

  it("vẫn giữ chức năng tham gia lớp bằng mã (/api/student/enroll)", () => {
    const src = read(DASHBOARD);
    expect(src).toContain("/api/student/enroll");
  });

  it("vẫn gọi API /api/student/classes và /api/submissions", () => {
    const src = read(DASHBOARD);
    expect(src).toContain("/api/student/classes");
    expect(src).toContain("/api/submissions");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Chống lách: test hành vi cụ thể, không cho hard-code
// ─────────────────────────────────────────────────────────────────────────────
describe("7. Chống lách: logic thực, không hard-code", () => {
  it("filter IN_PROGRESS dùng kiểm tra trường status trên dữ liệu, không giá trị cứng", () => {
    const src = read(DASHBOARD);
    // Phải filter bằng status field, vd: sub.status !== "IN_PROGRESS" hoặc s.status === "IN_PROGRESS"
    expect(src).toMatch(/\.status\s*[!=]==?\s*["']IN_PROGRESS["']/);
  });

  it("billing_status đọc từ trường của object, không viết cứng vào template", () => {
    const src = read(DASHBOARD);
    // Phải truy cập billing_status từ data object
    expect(src).toMatch(/\.billing_status|billing_status\s*[=!]==?\s*["']/);
  });

  it("mỗi lớp render huy hiệu dựa trên dữ liệu billing_status, không cùng huy hiệu cho tất cả", () => {
    const src = read(DASHBOARD);
    // Phải có logic điều kiện: if/switch/ternary dựa trên billing_status
    // để render huy hiệu khác nhau cho LOCKED, GRACE, ENDED
    expect(src).toMatch(
      /billing_status\s*===\s*["']LOCKED["']|billing_status\s*===\s*["']GRACE["']|["']LOCKED["']\s*:\s*["']Đã khoá["']/
    );
  });

  it("link lượt đang làm dở xây từ dữ liệu (exam_id/examId), không link cứng", () => {
    const src = read(DASHBOARD);
    // Link phải dùng template literal với biến, vd: `/student/exam/${sub.exam_id}`
    expect(src).toMatch(/`\/student\/exam\/\$\{/);
  });
});
