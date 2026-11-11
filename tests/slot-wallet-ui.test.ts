// tests/slot-wallet-ui.test.ts
// TASK-054 — Hợp đồng nghiệm thu giao diện Ví slot (FEAT-015):
// 1. Trang ví GV (/teacher/slots - SCR-29)
// 2. Cài đặt & banner lớp (/teacher/classes/[classId] - SCR-21)
// 3. Khối ví ở chi tiết GV admin (/admin/teachers/[id] - SCR-44)
// 4. Banner lớp khoá ở HS (/student/class/[classId] - SCR-11)
// 5. Component SlotLedgerTable & ClassBillingBanner
// Hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, bị khoá trong tests.lock.
// Người code KHÔNG được sửa file này.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (relPath: string) =>
  fs.existsSync(path.join(ROOT, relPath))
    ? fs.readFileSync(path.join(ROOT, relPath), "utf8")
    : "";
const exists = (relPath: string) => fs.existsSync(path.join(ROOT, relPath));

const TEACHER_SLOTS_PAGE = "app/teacher/slots/page.tsx";
const TEACHER_CLASS_PAGE = "app/teacher/classes/[classId]/page.tsx";
const ADMIN_TEACHER_PAGE = "app/admin/teachers/[id]/page.tsx";
const STUDENT_CLASS_PAGE = "app/student/class/[classId]/page.tsx";
const COMP_LEDGER_TABLE = "components/slots/SlotLedgerTable.tsx";
const COMP_BILLING_BANNER = "components/slots/ClassBillingBanner.tsx";

const FORBIDDEN_SERVER_MODULES = [
  "@/lib/db-pg",
  "@/lib/slot-wallet",
  "@/lib/class-billing",
  "@/lib/slot-orders",
  "@/lib/ai-engine",
  "@/lib/supabase",
  "@/lib/mock-data",
  "@/lib/audio-storage",
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Kiểm tra tồn tại file & Kiến trúc Client Components
// ─────────────────────────────────────────────────────────────────────────────
describe("1. Kiểm tra tồn tại file & Kiến trúc Client Components", () => {
  it("components/slots/ClassBillingBanner.tsx phải tồn tại và là Client Component", () => {
    expect(
      exists(COMP_BILLING_BANNER),
      `${COMP_BILLING_BANNER} phải tồn tại`
    ).toBe(true);
    const src = read(COMP_BILLING_BANNER);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toMatch(
      /export\s+(?:default\s+)?(?:function|const)\s+ClassBillingBanner/
    );
  });

  it("components/slots/SlotLedgerTable.tsx phải tồn tại và là Client Component", () => {
    expect(
      exists(COMP_LEDGER_TABLE),
      `${COMP_LEDGER_TABLE} phải tồn tại`
    ).toBe(true);
    const src = read(COMP_LEDGER_TABLE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
    expect(src).toMatch(
      /export\s+(?:default\s+)?(?:function|const)\s+SlotLedgerTable/
    );
  });

  it("app/teacher/slots/page.tsx là Client Component", () => {
    expect(exists(TEACHER_SLOTS_PAGE), `${TEACHER_SLOTS_PAGE} phải tồn tại`).toBe(true);
    const src = read(TEACHER_SLOTS_PAGE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("app/teacher/classes/[classId]/page.tsx là Client Component", () => {
    expect(exists(TEACHER_CLASS_PAGE), `${TEACHER_CLASS_PAGE} phải tồn tại`).toBe(true);
    const src = read(TEACHER_CLASS_PAGE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("app/admin/teachers/[id]/page.tsx là Client Component", () => {
    expect(exists(ADMIN_TEACHER_PAGE), `${ADMIN_TEACHER_PAGE} phải tồn tại`).toBe(true);
    const src = read(ADMIN_TEACHER_PAGE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("app/student/class/[classId]/page.tsx là Client Component", () => {
    expect(exists(STUDENT_CLASS_PAGE), `${STUDENT_CLASS_PAGE} phải tồn tại`).toBe(true);
    const src = read(STUDENT_CLASS_PAGE);
    expect(src.trimStart().startsWith('"use client"')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Component ClassBillingBanner (components/slots/ClassBillingBanner.tsx)
// ─────────────────────────────────────────────────────────────────────────────
describe("2. Component ClassBillingBanner (components/slots/ClassBillingBanner.tsx)", () => {
  const getSrc = () => {
    expect(exists(COMP_BILLING_BANNER), `${COMP_BILLING_BANNER} chưa được tạo`).toBe(true);
    return read(COMP_BILLING_BANNER);
  };

  it("nhận prop billing_status hoặc status xử lý các trạng thái ACTIVE, GRACE, LOCKED, ENDED", () => {
    const src = getSrc();
    expect(src).toMatch(/billing_status|status/);
    expect(src).toMatch(/ACTIVE/);
    expect(src).toMatch(/GRACE/);
    expect(src).toMatch(/LOCKED/);
    expect(src).toMatch(/ENDED/);
  });

  it("trạng thái ACTIVE không hiển thị banner (trả về null)", () => {
    const src = getSrc();
    expect(src).toMatch(/(?:billing_status|status)\s*===\s*["']ACTIVE["'][^;{]*return\s+null|return\s+null/);
  });

  it("trạng thái GRACE hiển thị cảnh báo vàng, đếm ngày còn lại và nút Mua slot trỏ tới /teacher/slots", () => {
    const src = getSrc();
    // Màu vàng: amber hoặc yellow
    expect(src).toMatch(/amber|yellow/);
    // Nội dung cảnh báo theo brief mục 4
    expect(src).toContain("Lớp không đủ slot cho tháng mới");
    expect(src).toMatch(/Còn\s+.*ngày trước khi tạm khoá/i);
    // Nút/link "Mua slot" dẫn tới /teacher/slots
    expect(src).toContain("Mua slot");
    expect(src).toMatch(/\/teacher\/slots/);
  });

  it("trạng thái LOCKED hiển thị thông báo đỏ: 'Lớp đang tạm khoá: học sinh chỉ xem được bài cũ.'", () => {
    const src = getSrc();
    // Màu đỏ: rose hoặc red
    expect(src).toMatch(/rose|red/);
    expect(src).toContain("Lớp đang tạm khoá: học sinh chỉ xem được bài cũ.");
  });

  it("trạng thái ENDED hiển thị thông báo xám: 'Lớp đã kết thúc'", () => {
    const src = getSrc();
    // Màu xám: slate, gray, zinc, neutral, stone
    expect(src).toMatch(/slate|gray|zinc|neutral|stone/);
    expect(src).toContain("Lớp đã kết thúc");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Component SlotLedgerTable (components/slots/SlotLedgerTable.tsx)
// ─────────────────────────────────────────────────────────────────────────────
describe("3. Component SlotLedgerTable (components/slots/SlotLedgerTable.tsx)", () => {
  const getSrc = () => {
    expect(exists(COMP_LEDGER_TABLE), `${COMP_LEDGER_TABLE} chưa được tạo`).toBe(true);
    return read(COMP_LEDGER_TABLE);
  };

  it("có đủ 6 cột dữ liệu theo đặc tả: thời gian, loại, lớp, thay đổi, số dư sau, ghi chú", () => {
    const src = getSrc();
    expect(src).toMatch(/Thời gian|Ngày/i);
    expect(src).toMatch(/Loại/i);
    expect(src).toMatch(/Lớp/i);
    expect(src).toMatch(/Thay đổi|\+\/\-/i);
    expect(src).toMatch(/Số dư sau|Số dư/i);
    expect(src).toMatch(/Ghi chú/i);
  });

  it("ánh xạ đúng 5 loại reason nghiệp vụ FEAT-015 sang tiếng Việt", () => {
    const src = getSrc();
    // PURCHASE -> Mua slot
    expect(src).toContain("PURCHASE");
    expect(src).toContain("Mua slot");

    // ADMIN_ADJUST -> Admin điều chỉnh
    expect(src).toContain("ADMIN_ADJUST");
    expect(src).toContain("Admin điều chỉnh");

    // ENROLL -> Học sinh vào lớp
    expect(src).toContain("ENROLL");
    expect(src).toContain("Học sinh vào lớp");

    // CYCLE -> Trừ theo tháng
    expect(src).toContain("CYCLE");
    expect(src).toContain("Trừ theo tháng");

    // MIGRATION -> Chuyển đổi
    expect(src).toContain("MIGRATION");
    expect(src).toContain("Chuyển đổi");
  });

  it("hiển thị delta: số dương màu xanh (+xanh) và số âm màu đỏ (−đỏ)", () => {
    const src = getSrc();
    // Dương: emerald hoặc green
    expect(src).toMatch(/emerald|green/);
    // Âm: rose hoặc red
    expect(src).toMatch(/rose|red/);
    // Ký tự dấu + cho số dương
    expect(src).toMatch(/delta\s*>\s*0|delta\s*>=?\s*0|\+/);
  });

  it("số dư sau được định dạng theo chuẩn vi-VN", () => {
    const src = getSrc();
    expect(src).toMatch(/toLocaleString\(["']vi-VN["']\)|Intl\.NumberFormat/);
  });

  it("hỗ trợ lọc theo lớp và nút Xem thêm theo next_cursor", () => {
    const src = getSrc();
    // Lọc theo lớp
    expect(src).toMatch(/class_id|classFilter|selectedClass|<select/i);
    // Xem thêm theo next_cursor
    expect(src).toMatch(/next_cursor|nextCursor/);
    expect(src).toContain("Xem thêm");
  });

  it("đủ 4 trạng thái UI: đang tải, lỗi + 'Thử lại', rỗng hiện chính xác 'Chưa có giao dịch', có dữ liệu", () => {
    const src = getSrc();
    // Đang tải
    expect(src).toMatch(/Loader2|animate-spin|loading|skeleton/i);
    // Lỗi + Thử lại
    expect(src).toContain("Thử lại");
    // Rỗng: đúng câu chữ trong brief
    expect(src).toContain("Chưa có giao dịch");
    // Bảng dữ liệu
    expect(src).toMatch(/<table|<div[^>]*grid/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Trang Ví slot giáo viên (app/teacher/slots/page.tsx - SCR-29)
// ─────────────────────────────────────────────────────────────────────────────
describe("4. Trang Ví slot giáo viên (app/teacher/slots/page.tsx - SCR-29)", () => {
  const getSrc = () => read(TEACHER_SLOTS_PAGE);

  it("đổi tiêu đề trang thành 'Ví slot', không còn tiêu đề cũ 'Slot học sinh & đơn hàng'", () => {
    const src = getSrc();
    expect(src).toContain("Ví slot");
    expect(src).not.toContain("Slot học sinh & đơn hàng");
  });

  it("bỏ hoàn toàn hiển thị 'slot đang dùng / tổng' kiểu cũ", () => {
    const src = getSrc();
    expect(src).not.toMatch(/Đang dùng\s+\{?usage\.used\}?\s*\/\s*\{?usage\.limit\}?\s+slot/i);
    expect(src).not.toContain("Tổng Hạn Mức Slots Được Cấp");
  });

  it("gọi API GET /api/teacher/slot-wallet để nạp dữ liệu ví", () => {
    const src = getSrc();
    expect(src).toContain("/api/teacher/slot-wallet");
  });

  it("thẻ lớn hiển thị số dư 'N slot' và dòng phụ '1 slot = 1 học sinh × 1 tháng trong một lớp'", () => {
    const src = getSrc();
    expect(src).toMatch(/balance/);
    expect(src).toMatch(/slot/i);
    expect(src).toContain("1 slot = 1 học sinh × 1 tháng trong một lớp");
  });

  it("cảnh báo vàng khi balance < total_next_needed kèm nút 'Mua slot' cuộn tới form mua", () => {
    const src = getSrc();
    // Điều kiện cảnh báo thiếu slot
    expect(src).toMatch(/balance\s*<\s*total_next_needed|total_next_needed\s*>\s*balance/);
    expect(src).toContain("Còn thiếu");
    expect(src).toContain("slot cho các lần trừ trong 31 ngày tới");
    // Nút cuộn tới form mua
    expect(src).toMatch(/Mua slot/);
    expect(src).toMatch(/scrollIntoView|#buy-slots|form|buyRef/i);
  });

  it("bảng 'Lớp & lần trừ tới' hiển thị tên lớp kèm link, 4 trạng thái, ngày khai giảng, ngày trừ tới, sĩ số, Đủ/Thiếu", () => {
    const src = getSrc();
    // Tiêu đề bảng
    expect(src).toMatch(/Lớp\s*&\s*lần trừ tới|Lớp học\s*&\s*lần trừ tới/i);
    // Link tới chi tiết lớp
    expect(src).toMatch(/\/teacher\/classes\/\$\{?[a-zA-Z0-9_.]+\}?/);
    // 4 trạng thái lớp: Đang chạy, Ân hạn, Tạm khoá, Đã kết thúc
    expect(src).toContain("Đang chạy");
    expect(src).toContain("Ân hạn");
    expect(src).toContain("Tạm khoá");
    expect(src).toContain("Đã kết thúc");
    // Các thông tin bắt buộc
    expect(src).toMatch(/start_date|ngày khai giảng/i);
    expect(src).toMatch(/next_charge_at|ngày trừ/i);
    expect(src).toMatch(/student_count|sĩ số/i);
    // Đánh giá đủ / thiếu slot
    expect(src).toContain("Đủ");
    expect(src).toContain("Thiếu");
  });

  it("tích hợp component SlotLedgerTable hiển thị lịch sử giao dịch", () => {
    const src = getSrc();
    expect(src).toMatch(/import\s+(?:SlotLedgerTable|\{\s*SlotLedgerTable\s*\})\s+from\s+["']@\/components\/slots\/SlotLedgerTable["']/);
    expect(src).toMatch(/<SlotLedgerTable/);
  });

  it("giữ nguyên form tạo đơn mua slot và danh sách đơn mua slot hiện có", () => {
    const src = getSrc();
    expect(src).toContain("/api/teacher/slot-requests");
    expect(src).toMatch(/router\.push\(`\/teacher\/orders\/\$\{/);
  });

  it("đáp ứng đủ 4 trạng thái UI: đang tải, lỗi + 'Thử lại', rỗng, có dữ liệu", () => {
    const src = getSrc();
    expect(src).toMatch(/Loader2|animate-spin|loading|skeleton/i);
    expect(src).toContain("Thử lại");
    expect(src).toMatch(/toLocaleString\(["']vi-VN["']\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Trang chi tiết lớp học giáo viên (app/teacher/classes/[classId]/page.tsx - SCR-21)
// ─────────────────────────────────────────────────────────────────────────────
describe("5. Trang chi tiết lớp học giáo viên (app/teacher/classes/[classId]/page.tsx - SCR-21)", () => {
  const getSrc = () => read(TEACHER_CLASS_PAGE);

  it("import và đặt ClassBillingBanner trên đầu trang", () => {
    const src = getSrc();
    expect(src).toMatch(/import\s+(?:ClassBillingBanner|\{\s*ClassBillingBanner\s*\})\s+from\s+["']@\/components\/slots\/ClassBillingBanner["']/);
    expect(src).toMatch(/<ClassBillingBanner/);
  });

  it("khối 'Tính phí' cho phép sửa ngày khai giảng qua PUT /api/teacher/classes/[classId]/billing", () => {
    const src = getSrc();
    expect(src).toMatch(/Tính phí|Khai giảng & Tính phí/i);
    expect(src).toMatch(/\/api\/teacher\/classes\/\$\{?[a-zA-Z0-9_.]+\}?\/billing/);
    expect(src).toMatch(/start_date/);
    expect(src).toMatch(/next_charge_at/);
  });

  it("xử lý lỗi 409 khi đổi ngày khai giảng: hiển thị thông điệp từ server", () => {
    const src = getSrc();
    expect(src).toMatch(/409/);
  });

  it("nút 'Kết thúc lớp' yêu cầu qua hộp xác nhận 'Không hoàn tác được, không hoàn slot' trước khi gọi POST /end", () => {
    const src = getSrc();
    expect(src).toContain("Kết thúc lớp");
    expect(src).toContain("Không hoàn tác được, không hoàn slot");
    expect(src).toMatch(/\/api\/teacher\/classes\/\$\{?[a-zA-Z0-9_.]+\}?\/end/);
  });

  it("khi thêm học sinh gặp lỗi 409 hết slot: hiện thông điệp server kèm link 'Mua slot'", () => {
    const src = getSrc();
    expect(src).toContain("Mua slot");
    expect(src).toMatch(/\/teacher\/slots/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Trang chi tiết giáo viên admin (app/admin/teachers/[id]/page.tsx - SCR-44)
// ─────────────────────────────────────────────────────────────────────────────
describe("6. Trang chi tiết giáo viên admin (app/admin/teachers/[id]/page.tsx - SCR-44)", () => {
  const getSrc = () => read(ADMIN_TEACHER_PAGE);

  it("gỡ bỏ hoàn toàn ô sửa slot_limit và thẻ 'Slot Capacity' cũ", () => {
    const src = getSrc();
    expect(src).not.toContain("Slot Capacity");
    // Không còn state hay input sửa slot_limit
    expect(src).not.toMatch(/name=["']slot_limit["']/);
    expect(src).not.toMatch(/setSlotLimit\(/);
  });

  it("không còn gửi slot_limit trong payload PUT cập nhật giáo viên", () => {
    const src = getSrc();
    // Bỏ slot_limit trong JSON.stringify gửi đi
    expect(src).not.toMatch(/JSON\.stringify\(\{[^}]*\bslot_limit\b/);
  });

  it("gọi API GET /api/admin/teachers/[id]/slot-wallet để hiển thị số dư và nhúng SlotLedgerTable", () => {
    const src = getSrc();
    expect(src).toMatch(/\/api\/admin\/teachers\/\$\{?[a-zA-Z0-9_.]+\}?\/slot-wallet/);
    expect(src).toMatch(/import\s+(?:SlotLedgerTable|\{\s*SlotLedgerTable\s*\})\s+from\s+["']@\/components\/slots\/SlotLedgerTable["']/);
    expect(src).toMatch(/<SlotLedgerTable/);
  });

  it("form 'Điều chỉnh' cho phép nhập delta (nguyên dương/âm) và note bắt buộc <= 500 ký tự", () => {
    const src = getSrc();
    expect(src).toMatch(/Điều chỉnh|Điều chỉnh ví slot/i);
    expect(src).toMatch(/delta/);
    expect(src).toMatch(/note|lý do/i);
    // Gọi đúng API slot-adjust
    expect(src).toMatch(/\/api\/admin\/teachers\/\$\{?[a-zA-Z0-9_.]+\}?\/slot-adjust/);
  });

  it("form điều chỉnh chặn lý do trống ở client trước khi gọi API", () => {
    const src = getSrc();
    // Kiểm tra chặn note rỗng / whitespace ở client
    expect(src).toMatch(/!note(?:\.trim\(\))?|note(?:\.trim\(\))?\s*===\s*["']["']|trim\(\)\.length\s*===?\s*0|disabled=\{[^}]*!note/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Trang lớp học phía học sinh (app/student/class/[classId]/page.tsx - SCR-11)
// ─────────────────────────────────────────────────────────────────────────────
describe("7. Trang lớp học phía học sinh (app/student/class/[classId]/page.tsx - SCR-11)", () => {
  const getSrc = () => read(STUDENT_CLASS_PAGE);

  it("khi lớp bị LOCKED/ENDED hoặc nhận mã CLASS_LOCKED: hiển thị banner 'Lớp đang tạm khoá, vui lòng liên hệ giáo viên'", () => {
    const src = getSrc();
    expect(src).toMatch(/CLASS_LOCKED|LOCKED|ENDED/);
    expect(src).toContain("Lớp đang tạm khoá, vui lòng liên hệ giáo viên");
  });

  it("khi lớp LOCKED hoặc ENDED: ẩn hoặc vô hiệu hoá nút bắt đầu làm bài / nộp bài mới", () => {
    const src = getSrc();
    // Phải kiểm tra điều kiện khoá lớp đối với nút làm bài/nộp bài
    expect(src).toMatch(/isLocked|billing_status\s*===?\s*["']LOCKED["']|CLASS_LOCKED/);
  });

  it("học sinh vẫn xem được điểm số và bài cũ khi lớp bị khoá", () => {
    const src = getSrc();
    // Tab hoặc khu vực bài đã làm / bảng điểm vẫn tồn tại
    expect(src).toMatch(/graded|gradebook|Điểm/);
  });

  it("an toàn phân quyền: trang học sinh không có link dẫn tới /teacher hay /admin", () => {
    const src = getSrc();
    expect(src).not.toMatch(/href=["'`]\/teacher/);
    expect(src).not.toMatch(/href=["'`]\/admin/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Ràng buộc hệ thống: DEC-035, Design Rules, Client Bundle Safety & Formats
// ─────────────────────────────────────────────────────────────────────────────
describe("8. Ràng buộc hệ thống: DEC-035, Design Rules, Client Bundle Safety & Formats", () => {
  const TARGET_FILES = [
    TEACHER_SLOTS_PAGE,
    TEACHER_CLASS_PAGE,
    ADMIN_TEACHER_PAGE,
    STUDENT_CLASS_PAGE,
    COMP_LEDGER_TABLE,
    COMP_BILLING_BANNER,
  ];

  it("DEC-035: nhãn nút không bắt đầu bằng '+ ' trong các file thuộc phạm vi task", () => {
    const badButtons: string[] = [];
    for (const f of TARGET_FILES) {
      if (!exists(f)) continue;
      const lines = read(f).split("\n");
      lines.forEach((line, idx) => {
        if (/(?:<span>|["'`{>])\+\s+[A-ZĐÀ-Ỹ]/.test(line)) {
          badButtons.push(`${f}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
    expect(badButtons).toEqual([]);
  });

  it("Client Bundle Safety: không import module chỉ chạy server trong client components", () => {
    const violations: string[] = [];
    for (const f of TARGET_FILES) {
      if (!exists(f)) continue;
      const src = read(f);
      for (const mod of FORBIDDEN_SERVER_MODULES) {
        const re = new RegExp(
          `^\\s*import\\s+(?!type\\s)[^;]*from\\s+["']${mod.replace(/[/@-]/g, (c) => "\\" + c)}["']`,
          "m"
        );
        if (re.test(src)) {
          violations.push(`${f} import server module ${mod}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("không tự tính toán số dư/kỳ ở client mà chỉ hiển thị số API trả (BR-W03)", () => {
    const src = read(TEACHER_SLOTS_PAGE);
    // Không tự tính cộng trừ balance từ danh sách ledger ở client
    expect(src).not.toMatch(/ledger\.reduce\([^)]*balance/);
  });

  it("định dạng số tiếng Việt (vi-VN) trong các giao diện ví slot", () => {
    for (const f of [TEACHER_SLOTS_PAGE, ADMIN_TEACHER_PAGE]) {
      const src = read(f);
      expect(src).toMatch(/toLocaleString\(["']vi-VN["']\)|Intl\.NumberFormat/);
    }
  });
});
