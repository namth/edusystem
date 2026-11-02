// Gia cố sanitizeQuestionForStudent (BR-L09): đáp án nằm ngoài content hoặc dùng tên trường cũ.
import { describe, it, expect } from "vitest";
import { sanitizeQuestionForStudent } from "@/lib/grading";

describe("Không lọt đáp án qua stimulus_text (AI Import lưu đoạn văn điền ô vào cả cột này)", () => {
  it("READING_FILL_IN: stimulus_text có ngoặc đáp án → thay bằng ô trống", () => {
    const s = sanitizeQuestionForStudent({
      id: "q", category: "READING_FILL_IN", prompt: "Điền",
      stimulus_text: "I (am) a student and she (is) a teacher.",
      content: { fill_subtype: "INLINE_SELECT", passage: "I (am) a student and she (is) a teacher." },
    });
    const json = JSON.stringify(s);
    expect(json).not.toContain("(am)");
    expect(json).not.toContain("(is)");
    expect(s.stimulus_text).toBe("I ____ a student and she ____ a teacher.");
  });

  it("WRITING_FREE_TYPING_BLANKS với ngoặc vuông trong stimulus_text", () => {
    const s = sanitizeQuestionForStudent({
      id: "q", category: "WRITING_FREE_TYPING_BLANKS",
      stimulus_text: "Yesterday I [went] home.",
      content: { passage: "Yesterday I [went] home." },
    });
    expect(s.stimulus_text).toBe("Yesterday I ____ home.");
  });

  it("dạng khác giữ nguyên stimulus_text (ngoặc là nội dung bình thường)", () => {
    const s = sanitizeQuestionForStudent({
      id: "q", category: "READING_MC", stimulus_text: "The (old) house.", content: { sub_questions: [] },
    });
    expect(s.stimulus_text).toBe("The (old) house.");
  });
});

describe("Không lọt đáp án qua tên trường cũ / camelCase", () => {
  it("xoá correctAnswer / correct_answer / correctAnswers / answer(s) / sampleAnswer ở content và câu con, mọi dạng", () => {
    for (const category of ["READING_MC", "LISTENING_FILL_IN", "READING_ORDERING", "WRITING_ESSAY", "SOMETHING_NEW"]) {
      const s = sanitizeQuestionForStudent({
        id: "q", category,
        content: {
          correctAnswer: "SECRET1", correct_answer: "SECRET2", correctAnswers: ["SECRET3"], answers: ["SECRET4"],
          answer: "SECRET5", sampleAnswer: "SECRET6", passage: "x", correct_text: "SECRET7 words",
          sub_questions: [{ id: "s1", text: "t", correctAnswer: "SECRET8", answer: "SECRET9" }],
        },
      });
      const json = JSON.stringify(s);
      for (let i = 1; i <= 9; i++) {
        // Dạng sắp xếp hiển thị các mảnh của correct_text (đã xáo) — đó là nội dung bài, không phải lộ đáp án
        if (i === 7 && category.endsWith("_ORDERING")) continue;
        expect(json, `${category} SECRET${i}`).not.toContain(`SECRET${i}`);
      }
    }
  });

  it("vẫn giữ các trường hiển thị cần thiết", () => {
    const s = sanitizeQuestionForStudent({
      id: "q", category: "READING_MC", prompt: "P",
      content: { stimulus_audio_text: "audio", sub_questions: [{ id: "s1", text: "t", option_a: "a", correctAnswer: "A" }] },
    });
    expect(s.content.stimulus_audio_text).toBe("audio");
    expect(s.content.sub_questions[0]).toEqual({ id: "s1", text: "t", option_a: "a" });
  });
});
