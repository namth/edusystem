// TASK-053 · FEAT-015 §4 (TC-I16, TC-I17) — Review Studio chuyển dạng & LessonPlayer hiển thị thẻ inline (kiểm mã nguồn).
import { describe, it, expect } from "vitest";
import fs from "fs";

const STUDIO = "components/teacher/AiExamIngestionStudio.tsx";
const PLAYER = "components/lesson-player/LessonPlayer.tsx";
const read = (f: string) => fs.readFileSync(f, "utf8");

describe("Review Studio (TC-I16)", () => {
  const s = read(STUDIO);

  it("giữ dữ liệu gốc và chuyển đổi lại trên trình duyệt bằng convertGroup (không gọi lại API khi Đổi dạng)", () => {
    expect(s).toContain('from "@/lib/question-conversion"');
    expect(s).toMatch(/convertGroup\(g, \{ override: overrides\[g\.tempId\] \}\)/);
    expect(s).toContain("switchableFormats(group)");
    // chỉ có 2 lời gọi API: ai-parse và ai-import
    expect((s.match(/fetch\("\/api\/teacher\/exams\//g) || []).length).toBe(2);
  });

  it("nhãn Trên giấy → Hệ thống, độ tin cậy, danh sách cảnh báo; nút Đổi dạng / Xem như học sinh / Sửa", () => {
    for (const t of ["Trên giấy:", "Hệ thống:", "Độ tin cậy", "cảnh báo", "Đổi dạng", "Xem như học sinh", "PAPER_FORMAT_LABELS", "CATEGORY_LABELS"]) {
      expect(s).toContain(t);
    }
  });

  it("thiếu đáp án (NO_ANSWER) khoá nút tạo đề; còn cảnh báo khác thì hộp thoại Quay lại sửa / Vẫn tạo đề", () => {
    expect(s).toContain('w.code === "NO_ANSWER"');
    expect(s).toMatch(/disabled=\{isImporting \|\| blockingNumbers\.size > 0\}/);
    expect(s).toContain("Chọn đáp án cho");
    expect(s).toContain("Quay lại sửa");
    expect(s).toContain("Vẫn tạo đề");
  });

  it("tổng mục chấm khác số câu giấy thì hiện chú thích; gửi câu đã chuyển dạng; 400 INVALID_CONTENT đánh dấu nhóm lỗi", () => {
    expect(s).toContain("scoreItems !== paperQuestions");
    expect(s).toContain("mục chấm (đề giấy:");
    expect(s).toContain("questions: allQuestions");
    expect(s).toContain('result.code === "INVALID_CONTENT"');
    expect(s).toContain("scrollIntoView");
  });

  it("bước tải có 'Đang chuyển đổi dạng câu…'; xem trước dùng LessonPlayer với câu đã ẩn đáp án", () => {
    expect(s).toContain("Đang chuyển đổi dạng câu…");
    expect(s).toContain("<LessonPlayer");
    expect(s).toContain("sanitizeQuestionForStudent(");
  });

  it("không còn tự gán đáp án 'A' cho câu mới; chữ câu/phương án hiển thị qua sanitizeInlineHtml", () => {
    expect(s).not.toMatch(/correct_answer:\s*"A"/);
    expect(s).toContain("sanitizeInlineHtml(sub.text_html)");
    expect(s).toContain("sanitizeInlineHtml(opt.text_html)");
  });
});

describe("LessonPlayer thẻ inline (TC-I17)", () => {
  it("câu con và phương án trắc nghiệm đi qua sanitizeInlineHtml", () => {
    const p = read(PLAYER);
    expect(p).toContain("sanitizeInlineHtml(sub.text)");
    expect(p).toContain("sanitizeInlineHtml(optText)");
  });
});
