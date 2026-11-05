import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";
import { createFakePg } from "./helpers/pg-fake";
import {
  GradebookError,
  ItemKind,
  AttemptLite,
  TeacherEdit,
  mergeClassItems,
  pickCountedAttempt,
  round1,
  lessonScore10,
  examScore10,
  isPendingReview,
  applyExamTeacherEdits,
  applyLessonTeacherEdits,
  checkFinalize,
  average10,
} from "@/lib/gradebook";
import type { ScoringStandard } from "@/lib/exam-scoring";

// Hoisted state for DB & external mocks
const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  process.env.INTERNAL_API_TOKEN = "internal_test_token_gradebook_xyz";
  return {
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    aiCalls: [] as any[],
    aiError: null as Error | null,
    aiBand: 7.5,
  };
});

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
      release: () => {},
    }),
  }),
  ensureSchema: async () => {},
}));

vi.mock("@/lib/lesson-ai-grading", () => ({
  gradeOpenAnswer: async (input: any) => {
    h.aiCalls.push(input);
    if (h.aiError) throw h.aiError;
    return h.aiBand;
  },
}));

vi.mock("@/lib/exam-ai-grading", () => ({
  gradeExamOpenAnswer: async (input: any) => {
    h.aiCalls.push(input);
    if (h.aiError) throw h.aiError;
    return { score: h.aiBand, feedback: "AI feedback text" };
  },
}));

const req = (method: string, url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("1. Migration 017: DDL & ensureSchema idempotency", () => {
  const MIGRATION = fs.readFileSync("docs/db-migration-017-gradebook.sql", "utf8");

  async function setupDb() {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE users (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), role VARCHAR(20));
      CREATE TABLE classes (id VARCHAR(50) PRIMARY KEY, teacher_id VARCHAR(50));
      CREATE TABLE submissions (
        id VARCHAR(50) PRIMARY KEY,
        exam_id VARCHAR(50),
        student_id VARCHAR(50),
        status VARCHAR(30)
      );
      CREATE TABLE lesson_attempts (
        id VARCHAR(50) PRIMARY KEY,
        lesson_id VARCHAR(50),
        class_id VARCHAR(50),
        student_id VARCHAR(50),
        status VARCHAR(30)
      );
    `);
    return db;
  }

  it("chạy 2 lần không lỗi và tạo đúng class_grade_items, class_grades, các cột mới", async () => {
    const db = await setupDb();
    // Chạy lần 1
    await db.exec(MIGRATION);
    // Chạy lần 2 (idempotent)
    await db.exec(MIGRATION);

    const getCols = async (tbl: string) =>
      (
        await db.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [tbl]
        )
      ).rows.map((r) => r.column_name);

    expect(await getCols("class_grade_items")).toEqual(
      expect.arrayContaining([
        "id",
        "class_id",
        "item_kind",
        "item_id",
        "finalized_at",
        "finalized_by",
        "reopened_at",
        "created_at",
      ])
    );

    expect(await getCols("class_grades")).toEqual(
      expect.arrayContaining([
        "id",
        "class_id",
        "item_kind",
        "item_id",
        "student_id",
        "chosen_attempt_id",
        "manual_score10",
        "note",
        "attempt_id",
        "raw_score",
        "raw_max",
        "score10",
        "passed",
        "finalized_at",
        "updated_at",
      ])
    );

    expect(await getCols("submissions")).toEqual(
      expect.arrayContaining(["reviewed_at", "reviewed_by"])
    );

    expect(await getCols("lesson_attempts")).toEqual(
      expect.arrayContaining([
        "reviewed_at",
        "reviewed_by",
        "teacher_feedback",
        "last_grading_error",
      ])
    );
  });
});

describe("2. pickCountedAttempt (BR-B03)", () => {
  const att1: AttemptLite = {
    id: "att_1",
    status: "GRADED",
    score: 80,
    submitted_at: "2026-11-06T08:00:00Z",
    has_ai: false,
    reviewed_at: null,
  };
  const att2: AttemptLite = {
    id: "att_2",
    status: "GRADED",
    score: 90,
    submitted_at: "2026-11-06T09:00:00Z",
    has_ai: true,
    reviewed_at: null,
  };
  const att3SameScoreEarlier: AttemptLite = {
    id: "att_3",
    status: "GRADED",
    score: 90,
    submitted_at: "2026-11-06T07:00:00Z",
    has_ai: true,
    reviewed_at: null,
  };
  const attGrading: AttemptLite = {
    id: "att_g",
    status: "GRADING",
    score: null,
    submitted_at: "2026-11-06T10:00:00Z",
    has_ai: true,
    reviewed_at: null,
  };
  const attNeedsReview: AttemptLite = {
    id: "att_nr",
    status: "NEEDS_REVIEW",
    score: null,
    submitted_at: "2026-11-06T11:00:00Z",
    has_ai: true,
    reviewed_at: null,
  };

  it("thứ tự ưu tiên: MANUAL thắng CHOSEN và BEST", () => {
    const res = pickCountedAttempt([att1, att2], {
      manualScore10: 8.5,
      chosenAttemptId: "att_1",
    });
    expect(res).toEqual({
      source: "MANUAL",
      attempt: null,
      state: "GRADED",
    });
  });

  it("thứ tự ưu tiên: CHOSEN thắng BEST nếu lượt chosen đang GRADED", () => {
    const res = pickCountedAttempt([att1, att2], {
      chosenAttemptId: "att_1",
    });
    expect(res).toEqual({
      source: "CHOSEN",
      attempt: att1,
      state: "GRADED",
    });
  });

  it("lượt chosen chưa GRADED thì bị bỏ qua, rơi về BEST", () => {
    const res = pickCountedAttempt([att1, attGrading], {
      chosenAttemptId: "att_g",
    });
    expect(res).toEqual({
      source: "BEST",
      attempt: att1,
      state: "GRADED",
    });
  });

  it("chọn BEST: lấy điểm cao nhất, hoà điểm thì lấy lượt sớm hơn", () => {
    // att2 và att3 đều có score = 90, nhưng att3 nộp lúc 07:00 sớm hơn att2 (09:00)
    const res = pickCountedAttempt([att1, att2, att3SameScoreEarlier], {});
    expect(res).toEqual({
      source: "BEST",
      attempt: att3SameScoreEarlier,
      state: "GRADED",
    });
  });

  it("AI_SKIPPED cũ cũng được xét là GRADED", () => {
    const attSkipped: AttemptLite = {
      id: "att_skip",
      status: "AI_SKIPPED",
      score: 95,
      submitted_at: "2026-11-06T06:00:00Z",
      has_ai: false,
      reviewed_at: null,
    };
    const res = pickCountedAttempt([att1, attSkipped], {});
    expect(res).toEqual({
      source: "BEST",
      attempt: attSkipped,
      state: "GRADED",
    });
  });

  it("không có lượt nào -> NOT_SUBMITTED", () => {
    const res = pickCountedAttempt([], {});
    expect(res).toEqual({
      source: "NONE",
      attempt: null,
      state: "NOT_SUBMITTED",
    });
  });

  it("chỉ có lượt GRADING -> state GRADING", () => {
    const res = pickCountedAttempt([attGrading], {});
    expect(res).toEqual({
      source: "NONE",
      attempt: null,
      state: "GRADING",
    });
  });

  it("không có GRADED, lượt mới nhất là NEEDS_REVIEW -> state NEEDS_REVIEW", () => {
    const res = pickCountedAttempt([attGrading, attNeedsReview], {});
    expect(res).toEqual({
      source: "NONE",
      attempt: null,
      state: "NEEDS_REVIEW",
    });
  });
});

describe("3. round1, lessonScore10, examScore10 (BR-B04)", () => {
  it("round1 làm tròn 0.1 chính xác", () => {
    expect(round1(8.24)).toBe(8.2);
    expect(round1(8.25)).toBe(8.3);
    expect(round1(8.26)).toBe(8.3);
  });

  it("lessonScore10(82.5) cho 8.3", () => {
    expect(lessonScore10(82.5)).toBe(8.3);
  });

  it("examScore10 với IELTS 6.5/9 cho 7.2", () => {
    const snapshot = {
      name: "IELTS",
      sections: [{ skill: "All", min: 0, max: 9, step: 0.5 }],
      aggregation: { method: "AVERAGE", round_step: 0.5 },
    };
    const res = examScore10({
      total_score: 6.5,
      standard_snapshot: snapshot,
    });
    // 6.5/9 = 72.2% -> 7.22 -> round1 = 7.2
    expect(res).toBe(7.2);
  });

  it("null/undefined vào thì null ra", () => {
    expect(lessonScore10(null)).toBeNull();
    expect(lessonScore10(undefined as any)).toBeNull();
    expect(examScore10(null as any)).toBeNull();
    expect(examScore10({ total_score: null, standard_snapshot: null })).toBeNull();
  });
});

describe("4. isPendingReview & mergeClassItems (BR-B01, BR-B05)", () => {
  it("isPendingReview: GRADED + has_ai + reviewed_at null -> true; bài không có AI không bao giờ chờ duyệt", () => {
    expect(
      isPendingReview({
        id: "1",
        status: "GRADED",
        score: 8,
        submitted_at: new Date(),
        has_ai: true,
        reviewed_at: null,
      })
    ).toBe(true);

    // Không có AI: luôn false
    expect(
      isPendingReview({
        id: "2",
        status: "GRADED",
        score: 8,
        submitted_at: new Date(),
        has_ai: false,
        reviewed_at: null,
      })
    ).toBe(false);

    // Đã duyệt: false
    expect(
      isPendingReview({
        id: "3",
        status: "GRADED",
        score: 8,
        submitted_at: new Date(),
        has_ai: true,
        reviewed_at: new Date(),
      })
    ).toBe(false);

    // Chưa GRADED: false
    expect(
      isPendingReview({
        id: "4",
        status: "GRADING",
        score: null,
        submitted_at: new Date(),
        has_ai: true,
        reviewed_at: null,
      })
    ).toBe(false);
  });

  it("mergeClassItems gộp lộ trình và đề giao, loại bỏ trùng lặp, giữ thứ tự lộ trình trước", () => {
    const roadmap = [
      { kind: "LESSON" as ItemKind, id: "l1", title: "Bài 1" },
      { kind: "EXAM" as ItemKind, id: "e1", title: "Đề 1" },
    ];
    const assignments = [
      { exam_id: "e1", title: "Đề 1 trùng" },
      { exam_id: "e2", title: "Đề 2" },
    ];

    const merged = mergeClassItems(roadmap, assignments);
    expect(merged).toEqual([
      { kind: "LESSON", id: "l1", title: "Bài 1", source: "ROADMAP" },
      { kind: "EXAM", id: "e1", title: "Đề 1", source: "ROADMAP" },
      { kind: "EXAM", id: "e2", title: "Đề 2", source: "ASSIGNMENT" },
    ]);
  });
});

describe("5. applyExamTeacherEdits (BR-B06, BR-B07)", () => {
  const snapshot: ScoringStandard = {
    id: "std_ielts",
    name: "IELTS",
    sections: [
      { skill: "Reading", min: 0, max: 9, step: 0.5, conversion: "LINEAR" },
      { skill: "Writing", min: 0, max: 9, step: 0.5, conversion: "LINEAR" },
    ],
    aggregation: { method: "AVERAGE", round_step: 0.5 },
  };

  const initialResults = [
    {
      question_id: "q_mc",
      kind: "OBJECTIVE",
      skill: "Reading",
      earned: 1,
      max: 1,
      score: 9.0,
    },
    {
      question_id: "q_essay",
      kind: "AI",
      skill: "Writing",
      score: 6.0,
      feedback: "AI feedback",
    },
  ];

  it("giữ nguyên ai_score, tính lại section_scores và total_score", () => {
    const inputResults = JSON.parse(JSON.stringify(initialResults));
    const edits: TeacherEdit[] = [
      {
        question_id: "q_essay",
        teacher_score: 7.5,
        teacher_feedback: "Giáo viên nhận xét tốt",
      },
    ];
    const now = new Date("2026-11-06T10:00:00Z");

    const res = applyExamTeacherEdits(inputResults, snapshot, edits, "teacher_1", now);

    const essayRes = res.results.find((r) => r.question_id === "q_essay");
    expect(essayRes.ai_score).toBe(6.0); // Giữ nguyên bản gốc
    expect(essayRes.ai_feedback).toBe("AI feedback");
    expect(essayRes.teacher_score).toBe(7.5);
    expect(essayRes.score).toBe(7.5);
    expect(essayRes.teacher_by).toBe("teacher_1");
    expect(essayRes.teacher_at).toBe(now.toISOString());
    expect(res.allAiScored).toBe(true);
    expect(res.total_score).toBeDefined();

    // Kiểm tra tính bất biến (đầu vào không bị biến đổi)
    expect(inputResults[1].teacher_score).toBeUndefined();
  });

  it("teacher_score: null trả về điểm AI và xóa teacher_*", () => {
    const resultsWithTeacher = [
      {
        question_id: "q_essay",
        kind: "AI",
        skill: "Writing",
        ai_score: 6.0,
        ai_feedback: "AI initial",
        teacher_score: 8.0,
        teacher_feedback: "GV cũ",
        teacher_by: "t1",
        teacher_at: "2026-11-05T00:00:00Z",
        score: 8.0,
      },
    ];

    const edits: TeacherEdit[] = [
      {
        question_id: "q_essay",
        teacher_score: null,
      },
    ];

    const res = applyExamTeacherEdits(resultsWithTeacher, snapshot, edits, "teacher_1", new Date());
    const essay = res.results.find((r) => r.question_id === "q_essay");
    expect(essay.score).toBe(6.0);
    expect(essay.teacher_score).toBeUndefined();
    expect(essay.teacher_by).toBeUndefined();
  });

  it("sửa câu khách quan -> GradebookError 400 NOT_AI_ITEM", () => {
    const edits: TeacherEdit[] = [{ question_id: "q_mc", teacher_score: 8.0 }];
    expect(() => applyExamTeacherEdits(initialResults, snapshot, edits, "t1", new Date())).toThrow(
      GradebookError
    );
    try {
      applyExamTeacherEdits(initialResults, snapshot, edits, "t1", new Date());
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.code).toBe("NOT_AI_ITEM");
    }
  });

  it("điểm ngoài thang hoặc sai bước -> GradebookError 400 OUT_OF_SCALE", () => {
    // Ngoài thang: 10 (max là 9)
    expect(() =>
      applyExamTeacherEdits(
        initialResults,
        snapshot,
        [{ question_id: "q_essay", teacher_score: 10 }],
        "t1",
        new Date()
      )
    ).toThrow(GradebookError);

    // Sai bước: 7.3 (bước là 0.5)
    expect(() =>
      applyExamTeacherEdits(
        initialResults,
        snapshot,
        [{ question_id: "q_essay", teacher_score: 7.3 }],
        "t1",
        new Date()
      )
    ).toThrow(GradebookError);
  });
});

describe("6. applyLessonTeacherEdits (BR-B06, BR-B07, BR-L08)", () => {
  const initialLessonResults = [
    {
      question_id: "q_essay",
      kind: "AI",
      category: "WRITING_ESSAY",
      earned: 0.7,
      max: 1,
      items: [{ key: "essay", band: 6.3, correct: true }],
    },
  ];
  const attMeta = { objective_earned: 2, objective_max: 2, ai_max: 1 };

  it("band -> earned = band / 9, tính lại score_percent theo BR-L08", () => {
    const inputResults = JSON.parse(JSON.stringify(initialLessonResults));
    const edits: TeacherEdit[] = [
      {
        question_id: "q_essay",
        item_key: "essay",
        teacher_score: 7.0,
        teacher_feedback: "Khá hơn",
      },
    ];
    const now = new Date("2026-11-06T11:00:00Z");

    const res = applyLessonTeacherEdits(inputResults, attMeta, edits, "teacher_1", now);
    const item = res.results[0].items[0];
    expect(item.ai_score).toBe(6.3); // Giữ điểm gốc
    expect(item.band).toBe(7.0);
    expect(item.correct).toBe(true);
    expect(res.allAiScored).toBe(true);

    // earned = 7.0 / 9 = 0.7777...
    expect(res.ai_earned).toBeCloseTo(7.0 / 9, 4);
    // score_percent: (2 + 7/9) / 3 * 100 = 92.6%
    expect(res.score_percent).toBe(92.6);

    // Đầu vào không bị biến đổi
    expect(inputResults[0].items[0].teacher_score).toBeUndefined();
  });

  it("thiếu mục chấm -> allAiScored = false và score_percent = null", () => {
    const unScoredResults = [
      {
        question_id: "q_essay",
        kind: "AI",
        category: "WRITING_ESSAY",
        earned: 0,
        max: 1,
        items: [{ key: "essay" }], // Không có band
      },
    ];

    const res = applyLessonTeacherEdits(unScoredResults, attMeta, [], "t1", new Date());
    expect(res.allAiScored).toBe(false);
    expect(res.ai_earned).toBeNull();
    expect(res.score_percent).toBeNull();
  });

  it("sai bước hoặc ngoài thang -> GradebookError 400 OUT_OF_SCALE", () => {
    expect(() =>
      applyLessonTeacherEdits(
        initialLessonResults,
        attMeta,
        [{ question_id: "q_essay", teacher_score: 9.5 }],
        "t1",
        new Date()
      )
    ).toThrow(GradebookError);

    expect(() =>
      applyLessonTeacherEdits(
        initialLessonResults,
        attMeta,
        [{ question_id: "q_essay", teacher_score: 7.2 }],
        "t1",
        new Date()
      )
    ).toThrow(GradebookError);
  });
});

describe("7. checkFinalize (BR-B08)", () => {
  const attGrading: AttemptLite = {
    id: "a_g",
    status: "GRADING",
    score: null,
    submitted_at: new Date(),
    has_ai: true,
    reviewed_at: null,
  };
  const attNeedsReview: AttemptLite = {
    id: "a_nr",
    status: "NEEDS_REVIEW",
    score: null,
    submitted_at: new Date(),
    has_ai: true,
    reviewed_at: null,
  };
  const attPendingReview: AttemptLite = {
    id: "a_pr",
    status: "GRADED",
    score: 8,
    submitted_at: new Date(),
    has_ai: true,
    reviewed_at: null,
  };
  const attReviewed: AttemptLite = {
    id: "a_rv",
    status: "GRADED",
    score: 8,
    submitted_at: new Date(),
    has_ai: true,
    reviewed_at: new Date(),
  };

  it("nhánh GRADING_PENDING: còn lượt GRADING hoặc NEEDS_REVIEW", () => {
    const rows = [
      { student_id: "s1", attempts: [attGrading], counted: null },
      { student_id: "s2", attempts: [attNeedsReview], counted: null },
      { student_id: "s1", attempts: [attGrading], counted: null }, // Trùng student_id
    ];

    const res = checkFinalize(rows, false);
    expect(res).toEqual({
      ok: false,
      code: "GRADING_PENDING",
      students: ["s1", "s2"],
    });
  });

  it("nhánh UNREVIEWED: còn bài AI chưa xem mà confirmUnreviewed = false", () => {
    const rows = [
      { student_id: "s1", attempts: [attPendingReview], counted: attPendingReview },
      { student_id: "s2", attempts: [attReviewed], counted: attReviewed },
    ];

    const res = checkFinalize(rows, false);
    expect(res).toEqual({
      ok: false,
      code: "UNREVIEWED",
      count: 1,
    });
  });

  it("nhánh ok kèm markReviewedIds: confirmUnreviewed = true hoặc mọi bài đã duyệt", () => {
    const rows = [
      { student_id: "s1", attempts: [attPendingReview], counted: attPendingReview },
      { student_id: "s2", attempts: [attReviewed], counted: attReviewed },
    ];

    const res = checkFinalize(rows, true);
    expect(res).toEqual({
      ok: true,
      markReviewedIds: ["a_pr"],
    });
  });
});

describe("8. average10 (BR-B10)", () => {
  it("bỏ qua null, làm tròn 0.1", () => {
    expect(average10([8.0, 9.0, null])).toBe(8.5);
    expect(average10([8.2, 8.5])).toBe(8.4); // 8.35 -> 8.4
  });

  it("mảng rỗng hoặc toàn null -> null", () => {
    expect(average10([])).toBeNull();
    expect(average10([null, null])).toBeNull();
  });
});

describe("9. Grade-async đề thi: ghi ai_score / ai_feedback", () => {
  const gradeExam = async (body: unknown, token = "internal_test_token_gradebook_xyz") => {
    const { POST } = await import("@/app/api/exam/grade-async/route");
    return POST(req("POST", "/api/exam/grade-async", body, token ? { "x-internal-token": token } : {}));
  };

  beforeEach(async () => {
    h.aiCalls.length = 0;
    h.aiError = null;
    h.aiBand = 7.5;
    h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
    await h.pg.db.exec(`
      CREATE TABLE IF NOT EXISTS courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
      CREATE TABLE IF NOT EXISTS curriculum_items (
        id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-017-gradebook.sql", "utf8"));
    await h.pg.db.exec(`
      INSERT INTO users (id, name, email, role) VALUES ('t1', 'GV', 't1@x.vn', 'TEACHER'), ('s1', 'HS', 's1@x.vn', 'STUDENT');
      INSERT INTO classes (id, name, code, teacher_id) VALUES ('c1', 'Lớp 1', 'C1', 't1');
      INSERT INTO exams (id, title, duration_minutes, created_by) VALUES ('e1', 'Đề thi 1', 60, 't1');
      INSERT INTO questions (id, skill, category, prompt) VALUES ('q_essay', 'Writing', 'WRITING_ESSAY', 'Viết bài');
    `);
  });

  it("chấm AI đề thi ghi ai_score và ai_feedback cạnh score và feedback", async () => {
    const initialResults = [
      {
        question_id: "q_essay",
        kind: "AI",
        skill: "Writing",
      },
    ];
    await h.pg!.db.exec(`
      INSERT INTO submissions (id, exam_id, student_id, class_ref, status, results, answers, standard_snapshot)
      VALUES (
        'sub_1', 'e1', 's1', 'c1', 'GRADING',
        '${JSON.stringify(initialResults)}',
        '{"q_essay": "Bài văn"}',
        '{"name": "IELTS", "sections": [{"skill": "Writing", "min": 0, "max": 9, "step": 0.5}], "aggregation": {"method": "AVERAGE", "round_step": 0.5}}'
      );
    `);

    const res = await gradeExam({ submissionId: "sub_1" });
    expect(res.status).toBe(200);

    const sub = (await h.pg!.db.query<any>("SELECT results, status FROM submissions WHERE id = 'sub_1'")).rows[0];
    expect(sub.status).toBe("GRADED");
    const results = typeof sub.results === "string" ? JSON.parse(sub.results) : sub.results;
    expect(results[0].score).toBe(7.5);
    expect(results[0].ai_score).toBe(7.5);
    expect(results[0].ai_feedback).toBe("AI feedback text");
  });
});

describe("10. Grade-async bài học: giveUp, NEEDS_REVIEW, LESSON_NEEDS_REVIEW", () => {
  const gradeLesson = async (body: unknown, token = "internal_test_token_gradebook_xyz") => {
    const { POST } = await import("@/app/api/lessons/grade-async/route");
    return POST(req("POST", "/api/lessons/grade-async", body, token ? { "x-internal-token": token } : {}));
  };

  beforeEach(async () => {
    h.aiCalls.length = 0;
    h.aiError = null;
    h.aiBand = 7.0;
    h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
    await h.pg.db.exec(`
      CREATE TABLE IF NOT EXISTS courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), created_by VARCHAR(50));
      CREATE TABLE IF NOT EXISTS curriculum_items (
        id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-006-lessons.sql", "utf8"));
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-009-scoring-standards.sql", "utf8"));
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-010-notifications.sql", "utf8"));
    await h.pg.db.exec(fs.readFileSync("docs/db-migration-017-gradebook.sql", "utf8"));
    await h.pg.db.exec(`
      INSERT INTO users (id, name, email, role) VALUES ('t1', 'GV', 't1@x.vn', 'TEACHER'), ('s1', 'HS', 's1@x.vn', 'STUDENT');
      INSERT INTO classes (id, name, code, teacher_id) VALUES ('c1', 'Lớp 1', 'C1', 't1');
      INSERT INTO lessons (id, title, question_ids, created_by) VALUES ('l1', 'Bài học 1', '["q_essay"]', 't1');
      INSERT INTO questions (id, skill, category, prompt) VALUES ('q_essay', 'Writing', 'WRITING_ESSAY', 'Viết bài');
    `);
  });

  it("thiếu token nội bộ -> 401", async () => {
    const res = await gradeLesson({ attemptId: "att_1" }, "");
    expect(res.status).toBe(401);
  });

  it("giveUp: true kèm token nội bộ chuyển GRADING -> NEEDS_REVIEW, chỉ đổi 1 lần và gửi LESSON_NEEDS_REVIEW", async () => {
    await h.pg!.db.exec(`
      INSERT INTO lesson_attempts (id, lesson_id, class_id, student_id, status)
      VALUES ('att_giveup', 'l1', 'c1', 's1', 'GRADING');
    `);

    // Lần 1: chuyển sang NEEDS_REVIEW
    const res1 = await gradeLesson({ attemptId: "att_giveup", giveUp: true });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.status).toBe("NEEDS_REVIEW");
    expect(json1.gaveUp).toBe(true);

    const att1 = (await h.pg!.db.query<any>("SELECT status, last_grading_error FROM lesson_attempts WHERE id = 'att_giveup'")).rows[0];
    expect(att1.status).toBe("NEEDS_REVIEW");
    expect(att1.last_grading_error).toContain("Worker chấm AI thất bại");

    // Kiểm tra thông báo LESSON_NEEDS_REVIEW đã được gửi tới giáo viên chủ lớp
    const notifs = (await h.pg!.db.query<any>("SELECT * FROM notifications WHERE user_id = 't1'")).rows;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("LESSON_NEEDS_REVIEW");
    expect(notifs[0].link).toBe("/teacher/grading/c1/lesson/l1");

    // Lần 2: gọi lại khi không còn GRADING -> skipped
    const res2 = await gradeLesson({ attemptId: "att_giveup", giveUp: true });
    expect(res2.status).toBe(200);
    const json2 = await res2.json();
    expect(json2.skipped).toBe(true);
  });

  it("AI lỗi 3 lần -> chuyển NEEDS_REVIEW, ai_earned và score_percent = null, gửi thông báo cho giáo viên", async () => {
    const initialResults = [
      {
        question_id: "q_essay",
        kind: "AI",
        category: "WRITING_ESSAY",
        earned: 0,
        max: 1,
        items: [{ key: "essay" }],
      },
    ];

    await h.pg!.db.exec(`
      INSERT INTO lesson_attempts (id, lesson_id, class_id, student_id, status, results, answers, objective_earned, objective_max, ai_max)
      VALUES ('att_fail', 'l1', 'c1', 's1', 'GRADING', '${JSON.stringify(initialResults)}', '{"q_essay": "Bài nộp"}', 1, 1, 1);
    `);

    h.aiError = new Error("AI service temporary failure");
    const res = await gradeLesson({ attemptId: "att_fail" });
    expect(res.status).toBe(200);

    const att = (await h.pg!.db.query<any>("SELECT status, ai_earned, score_percent, last_grading_error FROM lesson_attempts WHERE id = 'att_fail'")).rows[0];
    expect(att.status).toBe("NEEDS_REVIEW");
    expect(att.ai_earned).toBeNull();
    expect(att.score_percent).toBeNull();
    expect(att.last_grading_error).toContain("AI service temporary failure");

    // Đã thử 3 lần
    expect(h.aiCalls.length).toBe(3);

    // Thông báo cho giáo viên
    const notifs = (await h.pg!.db.query<any>("SELECT * FROM notifications WHERE user_id = 't1'")).rows;
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("LESSON_NEEDS_REVIEW");
    expect(notifs[0].link).toBe("/teacher/grading/c1/lesson/l1");
  });
});
