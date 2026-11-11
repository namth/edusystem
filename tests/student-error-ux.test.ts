// TASK-057 — Trang làm bài học sinh: bỏ alert, thông báo lớp khoá và lỗi thân thiện.
// Hợp đồng nghiệm thu do kỹ sư kiểm thử viết (kiểm thử chéo).
// Người code KHÔNG được sửa file này.

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), "utf8");

const LESSON_PAGE = "app/student/lesson/[lessonId]/page.tsx";
const EXAM_PAGE = "app/student/exam/[examId]/page.tsx";
const BOTH_PAGES = [LESSON_PAGE, EXAM_PAGE];

// ═══════════════════════════════════════════════════════════════════════════
// 1. Không còn alert() / confirm() — lỗi hiển thị trong khung role="alert"
// ═══════════════════════════════════════════════════════════════════════════

describe("1. Bỏ alert() và confirm() — dùng khung thông báo trên trang", () => {
  for (const page of BOTH_PAGES) {
    const label = path.basename(path.dirname(page));

    it(`[${label}] không còn lời gọi alert(`, () => {
      const src = read(page);
      // Loại trừ comment — kiểm tra trên các dòng không phải comment
      const lines = src.split("\n").filter(
        (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
      );
      const code = lines.join("\n");
      expect(code).not.toMatch(/\balert\s*\(/);
    });

    it(`[${label}] không còn lời gọi confirm(`, () => {
      const src = read(page);
      const lines = src.split("\n").filter(
        (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
      );
      const code = lines.join("\n");
      expect(code).not.toMatch(/\bconfirm\s*\(/);
    });

    it(`[${label}] không còn window.alert hay window.confirm`, () => {
      const src = read(page);
      const lines = src.split("\n").filter(
        (l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")
      );
      const code = lines.join("\n");
      expect(code).not.toMatch(/window\.alert\s*\(/);
      expect(code).not.toMatch(/window\.confirm\s*\(/);
    });

    it(`[${label}] lỗi nộp bài / lỗi phản hồi hiển thị trong phần tử có role="alert"`, () => {
      const src = read(page);
      // Phải có ít nhất một phần tử role="alert" để hiển thị thông báo lỗi
      expect(src).toMatch(/role\s*=\s*["']alert["']/);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. CLASS_LOCKED: thông báo thân thiện, có liên kết về dashboard
// ═══════════════════════════════════════════════════════════════════════════

describe("2. Phản hồi CLASS_LOCKED — khung cảnh báo thân thiện", () => {
  for (const page of BOTH_PAGES) {
    const label = path.basename(path.dirname(page));

    it(`[${label}] kiểm tra code === "CLASS_LOCKED" trong phản hồi API`, () => {
      const src = read(page);
      // Phải parse response để đọc trường `code` (không chỉ dựa vào HTTP status)
      expect(src).toMatch(/CLASS_LOCKED/);
    });

    it(`[${label}] hiện câu "Lớp học đang bị khoá" khi CLASS_LOCKED`, () => {
      const src = read(page);
      // Thông báo phải chứa cụm từ chỉ rõ lớp bị khoá
      expect(src).toMatch(/Lớp học đang bị khoá/);
    });

    it(`[${label}] hướng dẫn "liên hệ giáo viên" khi CLASS_LOCKED`, () => {
      const src = read(page);
      expect(src).toMatch(/liên hệ giáo viên/i);
    });

    it(`[${label}] có liên kết về /student/dashboard khi CLASS_LOCKED`, () => {
      const src = read(page);
      // Khi lớp khoá, phải có link/button dẫn về dashboard
      expect(src).toContain("/student/dashboard");
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Không hiện mã HTTP thô cho người dùng
// ═══════════════════════════════════════════════════════════════════════════

describe("3. Không hiện mã HTTP thô — chuỗi người dùng thấy không chứa (403)/(409)/(400)", () => {
  for (const page of BOTH_PAGES) {
    const label = path.basename(path.dirname(page));

    it(`[${label}] không có chuỗi "(403)" trong text/JSX hiển thị cho người dùng`, () => {
      const src = read(page);
      // Loại trừ comment và kiểm tra chuỗi literal / JSX text
      // Chuỗi "(403)" xuất hiện trong message string hoặc JSX text content
      const noComments = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      // Kiểm tra trong chuỗi literal (string template, quote)
      expect(noComments).not.toMatch(/["'`][^"'`]*\(403\)[^"'`]*["'`]/);
    });

    it(`[${label}] không có chuỗi "(409)" trong text/JSX hiển thị cho người dùng`, () => {
      const src = read(page);
      const noComments = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(noComments).not.toMatch(/["'`][^"'`]*\(409\)[^"'`]*["'`]/);
    });

    it(`[${label}] không có chuỗi "(400)" trong text/JSX hiển thị cho người dùng`, () => {
      const src = read(page);
      const noComments = src
        .split("\n")
        .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
        .join("\n");
      expect(noComments).not.toMatch(/["'`][^"'`]*\(400\)[^"'`]*["'`]/);
    });
  }

  it("[exam] 403 không ghi danh có câu tiếng Việt riêng, không dùng chuỗi chung chung + mã lỗi", () => {
    const src = read(EXAM_PAGE);
    // Khi xử lý 403 (không ghi danh), phải set message tiếng Việt cụ thể
    // mà KHÔNG kèm số "(403)" hay bất cứ mã HTTP nào
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Tìm nơi xử lý res.status === 403 -> phải đọc body.code để phân biệt CLASS_LOCKED vs khác
    // Nếu không phải CLASS_LOCKED, phải có message tiếng Việt mà không kèm "(403)"
    // Regex kiểm tra: tồn tại xử lý 403 nhưng message KHÔNG chứa "(403)"
    expect(noComments).not.toMatch(/["'`][^"'`]*\(403\)/);
  });

  it("[exam] 409 hết lượt có câu tiếng Việt riêng, không hiện mã HTTP", () => {
    const src = read(EXAM_PAGE);
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(noComments).not.toMatch(/["'`][^"'`]*\(409\)/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Trang bài học: lỗi nộp bài hiện trong trang, không dùng alert
// ═══════════════════════════════════════════════════════════════════════════

describe("4. Trang bài học — lỗi nộp bài không dùng alert mà hiện inline", () => {
  it("handleSubmit khi API trả lỗi phải set state lỗi (không gọi alert)", () => {
    const src = read(LESSON_PAGE);
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Trong hàm submit, khi !res.ok, KHÔNG được gọi alert(...)
    // Phải dùng useState / set state để hiển thị lỗi trên trang
    expect(noComments).not.toMatch(/\balert\s*\(/);
    // Phải có state lỗi chuyên dụng cho submit hoặc dùng lại state errorMessage
    // Kiểm tra: có set biến lỗi khi nộp bài thất bại
    expect(noComments).toMatch(/set\w*[Ee]rror\w*\s*\(/);
  });

  it("lỗi từ catch (err) khi nộp bài KHÔNG dùng alert, mà hiện trên trang", () => {
    const src = read(LESSON_PAGE);
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Không có alert(err.message...) mà phải set error state
    expect(noComments).not.toMatch(/\balert\s*\(\s*err/);
  });

  it("khi nộp bài CLASS_LOCKED, hiện thông báo thân thiện (không alert)", () => {
    const src = read(LESSON_PAGE);
    // Kiểm tra rằng submit handler parse code từ response body
    expect(src).toMatch(/CLASS_LOCKED/);
  });

  it("xác nhận nộp khi chưa trả lời hết dùng modal/dialog thay cho confirm()", () => {
    const src = read(LESSON_PAGE);
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Không còn window.confirm
    expect(noComments).not.toMatch(/\bconfirm\s*\(/);
    // Phải có cơ chế xác nhận khác: modal hoặc state showConfirm
    // Kiểm tra có state/biến liên quan đến xác nhận nộp bài
    expect(noComments).toMatch(/[Cc]onfirm|[Xx]ác nhận/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Trang đề thi: lỗi tạo lượt làm bài báo ngay, không rơi xuống "Bắt đầu"
// ═══════════════════════════════════════════════════════════════════════════

describe("5. Trang đề thi — lỗi tạo lượt làm bài báo ngay đúng nguyên nhân", () => {
  it("checkInitialStatus: lỗi tạo attempt ở bước khởi tạo phải đặt phase='error' và hiện thông báo", () => {
    const src = read(EXAM_PAGE);
    // Khi POST /attempts thất bại ở bước checkInitialStatus, phải KHÔNG rơi xuống "start"
    // mà phải set errorMessage + phase = "error"
    // Tìm nơi gọi /attempts trong checkInitialStatus — nếu lỗi, phải xử lý ngay
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    
    // Kiểm tra: khi attemptsRes không ok (hoặc contentRes tạo attempt fail),
    // phải set error message, không được rơi xuống phase "start" mà bỏ qua lỗi
    // checkInitialStatus phải parse response body khi lỗi và hiện message
    
    // Đặc biệt: 403 CLASS_LOCKED ở bước tạo attempt ở checkInitialStatus
    // phải đọc body.code để phân biệt và hiển thị thông báo phù hợp
    expect(noComments).toMatch(/CLASS_LOCKED/);
  });

  it("handleStartExam: xử lý 403 CLASS_LOCKED kèm message thân thiện (không có mã HTTP thô)", () => {
    const src = read(EXAM_PAGE);
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Phải check code === "CLASS_LOCKED" (không chỉ check status 403)
    expect(noComments).toMatch(/CLASS_LOCKED/);
    // Chuỗi lỗi cho 403 không chứa "(403)"
    expect(noComments).not.toMatch(/["'`][^"'`]*\(403\)[^"'`]*["'`]/);
  });

  it("handleStartExam: 409 hết lượt hiện câu tiếng Việt thân thiện (không chứa mã HTTP)", () => {
    const src = read(EXAM_PAGE);
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Chuỗi lỗi 409 KHÔNG chứa "(409)"
    expect(noComments).not.toMatch(/["'`][^"'`]*\(409\)[^"'`]*["'`]/);
  });

  it("lỗi từ bước tạo lượt làm bài trong checkInitialStatus KHÔNG bị nuốt", () => {
    const src = read(EXAM_PAGE);
    // Hàm checkInitialStatus gọi POST /attempts.
    // Nếu POST trả lỗi (403/409/500), phải read body, set errorMessage, set phase="error".
    // KHÔNG ĐƯỢC bỏ qua lỗi rồi chuyển sang phase "start" bình thường.
    
    // Cách kiểm tra: khi POST thất bại mà contentRes ok, phải parse error body
    // Phải có đoạn xử lý attRes không ok → setErrorMessage + setPhase("error")
    // (không phải chỉ "rơi xuống" examRes phía dưới)
    
    // Kiểm tra: trong checkInitialStatus, khi POST attempt trả !ok,
    // có xử lý lỗi ngay (parse body, set errorMessage, set error phase)
    const checkInitBlock = extractFunctionBody(src, "checkInitialStatus");
    if (checkInitBlock) {
      // Sau khi gọi POST attempts, nếu !attRes.ok hoặc res lỗi, phải set error
      // Không được rơi xuống fetch examRes khi lỗi phải được catch
      const hasAttemptErrorHandling = 
        // Kiểm tra parse body khi POST attempts lỗi
        checkInitBlock.includes("setErrorMessage") &&
        checkInitBlock.includes("setPhase");
      expect(hasAttemptErrorHandling).toBe(true);
    } else {
      // Nếu không tìm thấy function body, kiểm tra tổng thể
      expect(src).toMatch(/checkInitialStatus/);
      expect(src).toMatch(/setErrorMessage/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. Phản hồi 403 không phải CLASS_LOCKED và 409 — câu tiếng Việt riêng
// ═══════════════════════════════════════════════════════════════════════════

describe("6. 403 khác (không ghi danh) và 409 có câu tiếng Việt riêng", () => {
  it("[lesson] xử lý 403 khi tải bài học phân biệt CLASS_LOCKED vs. lỗi khác", () => {
    const src = read(LESSON_PAGE);
    // Phải check body.code === "CLASS_LOCKED" để phân biệt 403 lớp khoá vs. 403 khác
    expect(src).toMatch(/CLASS_LOCKED/);
    // 403 khác (ví dụ: chưa ghi danh) cần câu riêng — đã có sẵn trước task
    // Nhưng bây giờ phải có nhánh phân biệt rõ ràng
  });

  it("[exam] phân biệt 403 CLASS_LOCKED vs 403 chưa ghi danh ở handleStartExam", () => {
    const src = read(EXAM_PAGE);
    // Khi gọi POST /attempts trả 403:
    //   - Nếu body.code === "CLASS_LOCKED" → hiện "Lớp học đang bị khoá..."
    //   - Nếu không → hiện "Bạn chưa ghi danh..." hoặc message từ body.error
    // Phải đọc response body, không chỉ check status
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    
    // handleStartExam phải parse JSON body cho mọi lỗi 403
    // Không được chỉ check status mà bỏ qua body
    expect(noComments).toMatch(/CLASS_LOCKED/);
    // Phải có xử lý riêng cho CLASS_LOCKED vs 403 khác
    expect(noComments).toMatch(/code\s*[=!]==?\s*["']CLASS_LOCKED["']|["']CLASS_LOCKED["']\s*[=!]==?\s*code/);
  });

  it("[exam] 409 hiện thông báo tiếng Việt mà không kèm mã HTTP", () => {
    const src = read(EXAM_PAGE);
    // Kiểm tra: xử lý 409 hiện message tiếng Việt chuyên biệt
    // Phải có tiếng Việt (dấu) cho 409 — ví dụ "hết lượt" hoặc message từ API
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // 409 → phải parse body và hiện body.error (tiếng Việt từ API) hoặc câu mặc định tiếng Việt
    expect(noComments).toMatch(/409/); // vẫn check HTTP 409
    expect(noComments).not.toMatch(/["'`][^"'`]*\(409\)[^"'`]*["'`]/); // nhưng không hiện "(409)" cho user
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. Bảo vệ: không hard-code — anti-cheat
// ═══════════════════════════════════════════════════════════════════════════

describe("7. Chống lách test: không hard-code kết quả", () => {
  it("[lesson] phải thực sự parse JSON response body khi nộp bài thất bại (không bỏ qua)", () => {
    const src = read(LESSON_PAGE);
    // handleSubmit: khi !res.ok, phải parse data = await res.json() rồi dùng data.error / data.code
    // Không phải chỉ set chuỗi cố định mà phải đọc từ response
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Kiểm tra: khi submit thất bại, có parse body (res.json()) và dùng data.error hoặc data.code
    expect(noComments).toMatch(/\.json\s*\(\s*\)/); // gọi .json()
    expect(noComments).toMatch(/\.error|\.code/);    // đọc trường error/code từ body
  });

  it("[exam] phải parse body.code khi POST /attempts trả 403 (không chỉ check status)", () => {
    const src = read(EXAM_PAGE);
    // handleStartExam: khi 403, phải parse body rồi check code
    const noComments = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    // Phải gọi res.json() rồi check data.code
    expect(noComments).toMatch(/\.json\s*\(\s*\)/);
    expect(noComments).toMatch(/\.code/);
  });

  it("cả hai trang đều giữ đủ 4 trạng thái UI: loading, empty/start, error, data/running", () => {
    // Trang bài học
    const lessonSrc = read(LESSON_PAGE);
    expect(lessonSrc).toMatch(/loading/i);
    expect(lessonSrc).toMatch(/error/i);
    // Trang đề thi
    const examSrc = read(EXAM_PAGE);
    expect(examSrc).toMatch(/loading/i);
    expect(examSrc).toMatch(/error/i);
    expect(examSrc).toMatch(/start/i);
    expect(examSrc).toMatch(/running/i);
  });

  it("[lesson] số lượng role='alert' >= 1 (thay cho alert() đã bỏ)", () => {
    const src = read(LESSON_PAGE);
    const matches = src.match(/role\s*=\s*["']alert["']/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("[exam] số lượng role='alert' >= 1 (thay cho lỗi inline)", () => {
    const src = read(EXAM_PAGE);
    const matches = src.match(/role\s*=\s*["']alert["']/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. Giao diện tiếng Việt, không lộ thông tin kỹ thuật
// ═══════════════════════════════════════════════════════════════════════════

describe("8. Giao diện tiếng Việt có dấu, không lộ thông tin kỹ thuật", () => {
  it("[exam] errorMessage hiển thị cho phase='error' không chứa stack trace", () => {
    const src = read(EXAM_PAGE);
    // Phase error hiện errorMessage — kiểm tra không lộ stack/trace kỹ thuật
    expect(src).not.toMatch(/["'`]Error:\s/);
    expect(src).not.toMatch(/["'`]TypeError/);
  });

  it("cả hai trang không import console-only logger hoặc gọi console.log cho lỗi user-facing", () => {
    for (const page of BOTH_PAGES) {
      const src = read(page);
      // console.error cho debug OK, nhưng không được dùng console.log để "hiển thị" lỗi
      // Lỗi phải đi qua state → render, không qua console
      // Kiểm tra: không có pattern alert(... console hoặc console.log thay alert
      expect(src).not.toMatch(/console\.log\s*\(\s*["'].*[Ll]ỗi/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. Không sửa file ngoài phạm vi
// ═══════════════════════════════════════════════════════════════════════════

describe("9. Phạm vi: chỉ sửa 2 file trong brief", () => {
  it("hai file phạm vi đều tồn tại", () => {
    for (const page of BOTH_PAGES) {
      expect(fs.existsSync(path.join(ROOT, page)), `${page} phải tồn tại`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Helper
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trích xuất phần body thô (xấp xỉ) của một hàm/callback theo tên.
 * Không cần AST — chỉ dùng braces-counter đủ cho kiểm thử hợp đồng.
 */
function extractFunctionBody(src: string, fnName: string): string | null {
  const idx = src.indexOf(fnName);
  if (idx < 0) return null;
  // Tìm dấu { mở đầu tiên sau tên hàm
  let braceStart = src.indexOf("{", idx);
  if (braceStart < 0) return null;
  let depth = 0;
  let end = braceStart;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return src.slice(braceStart, end + 1);
}
