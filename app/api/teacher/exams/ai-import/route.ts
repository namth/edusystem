import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getPgPool, queryPg } from "@/lib/db-pg";
import { assertTrialAllows, trialLimitResponse } from "@/lib/teacher-trial";
import { validateQuestionContent, skillOfCategory } from "@/lib/question-conversion";
import { serverError } from "@/lib/api-errors";
import { importToSections, saveTreeInTx, type Queryable } from "@/lib/exam-structure";
import { treeErrorResponse } from "@/lib/sections-db";

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  const body = await req.json().catch(() => ({}));
  const { examTitle, durationMinutes = 60, destination, questions = [] } = body;

  if (!examTitle || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      { success: false, error: "Dữ liệu đề thi hoặc danh sách câu hỏi không hợp lệ." },
      { status: 400 }
    );
  }

  // FEAT-015 §6.2: nhận câu đã chuyển dạng, kiểm content từng câu trước khi chạm DB
  const invalid: { index: number; tempId?: string; reason: string }[] = [];
  const normalized = questions.map((q: Record<string, unknown>, index: number) => {
    const category = typeof q?.category === "string" ? q.category : "";
    const content = q?.content && typeof q.content === "object" && !Array.isArray(q.content) ? { ...(q.content as Record<string, unknown>) } : null;
    const check = validateQuestionContent(category, content);
    if (!check.ok) invalid.push({ index, tempId: typeof q?.tempId === "string" ? q.tempId : undefined, reason: check.reason });
    const meta = content?.import_meta && typeof content.import_meta === "object" ? (content.import_meta as Record<string, unknown>) : {};
    return {
      // FEAT-017 BR-P14: nhóm đề giấy (tempId "<nhóm>_<n>") → một phần
      group: typeof q?.tempId === "string" ? q.tempId.replace(/_\d+$/, "") : `g${index}`,
      // BR-I23: không tin nhãn kỹ năng client gửi ("Phonetics"…) — suy từ dạng câu để thứ tự màn thi giữ nguyên đề giấy
      skill: skillOfCategory(category),
      category,
      prompt: typeof q?.prompt === "string" ? q.prompt : "",
      stimulus_text: typeof q?.stimulus_text === "string" && q.stimulus_text ? q.stimulus_text : null,
      content: { ...(content || {}), import_meta: { ...meta, source: "AI_IMPORT" } },
    };
  });
  if (invalid.length > 0) {
    const labels = [...new Set(invalid.map((x) => x.index + 1))].join(", ");
    return NextResponse.json(
      { success: false, error: `Câu hỏi số ${labels} có nội dung không hợp lệ.`, code: "INVALID_CONTENT", invalid },
      { status: 400 }
    );
  }

  const trial = await assertTrialAllows(authUser.userId, "contents");
  if (!trial.ok) {
    return trialLimitResponse("contents", trial.error);
  }

  // TEACHER chỉ được gắn đề vào lộ trình khóa học do mình tạo (CONTEXT.md bất biến 4)
  if (destination?.type === "COURSE_CURRICULUM" && destination?.courseId) {
    const ownerRes = await queryPg(`SELECT created_by FROM courses WHERE id = $1`, [destination.courseId]);
    if (ownerRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Không tìm thấy khóa học đích." }, { status: 404 });
    }
    if (authUser.role === "TEACHER" && ownerRes.rows[0].created_by !== authUser.userId) {
      return NextResponse.json(
        { success: false, error: "Bạn không có quyền gắn đề vào khóa học này." },
        { status: 403 }
      );
    }
  }

  const pool = getPgPool();
  const client = await pool.connect();

  try {
    // Business Rule BR-INGEST-05: PostgreSQL Transaction boundary
    await client.query("BEGIN");

    // FEAT-017 (BR-P14): nhóm đề giấy → phần; trắc nghiệm tách mỗi ý một câu; lưu cả cây như trình soạn
    const sections = importToSections(normalized);
    const examId = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const examRes = await client.query(
      `INSERT INTO exams (id, title, duration_minutes, skills, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING id`,
      [examId, examTitle, Number(durationMinutes) || 60, [], authUser.userId]
    );
    const db: Queryable = { query: async (t, p) => ({ rows: (await client.query(t, p as unknown[])).rows }) };
    try {
      await saveTreeInTx(db, { kind: "exam", id: examId, userId: authUser.userId, sections, allowMissingAudio: true });
    } catch (e) {
      const res = treeErrorResponse(e);
      if (res) {
        await client.query("ROLLBACK");
        return res;
      }
      throw e;
    }
    const importedCount = sections.reduce((n, s) => n + s.questions.length, 0);

    const finalExamId = examRes.rows[0]?.id || examId;
    let curriculumItemId: string | null = null;

    // 3. Bind to Course Curriculum if destination is COURSE_CURRICULUM
    if (destination?.type === "COURSE_CURRICULUM" && destination?.courseId) {
      const courseRes = await client.query(
        `SELECT id, title, curriculum FROM courses WHERE id = $1`,
        [destination.courseId]
      );

      if (courseRes.rows.length > 0) {
        const courseTitle = courseRes.rows[0].title || "Khóa học";
        let curriculum = courseRes.rows[0].curriculum || [];
        if (!Array.isArray(curriculum)) {
          curriculum = [];
        }

        curriculumItemId = `curr_exam_${Date.now().toString().slice(-6)}`;
        const newExamItem = {
          id: curriculumItemId,
          title: examTitle,
          type: "EXAM",
          exam_id: finalExamId,
          duration: `${durationMinutes} phút`,
          is_unlocked: false,
        };

        let targetUnitFound = false;
        if (destination.unitId) {
          curriculum = curriculum.map((unit: any) => {
            if (unit.id === destination.unitId) {
              targetUnitFound = true;
              const children = Array.isArray(unit.children)
                ? [...unit.children, newExamItem]
                : Array.isArray(unit.items)
                ? [...unit.items, newExamItem]
                : [newExamItem];
              return {
                ...unit,
                children,
                items: children,
              };
            }
            return unit;
          });
        }

        // If unitId not found or not provided, push to first unit or create new unit
        if (!targetUnitFound) {
          if (curriculum.length > 0) {
            const firstChildren = Array.isArray(curriculum[0].children)
              ? [...curriculum[0].children, newExamItem]
              : Array.isArray(curriculum[0].items)
              ? [...curriculum[0].items, newExamItem]
              : [newExamItem];
            curriculum[0].children = firstChildren;
            curriculum[0].items = firstChildren;
          } else {
            curriculum.push({
              id: `curr_unit_${Date.now().toString().slice(-6)}`,
              title: "Unit 1: Bài Học & Đề Thi Mới",
              type: "UNIT",
              children: [newExamItem],
              items: [newExamItem],
            });
          }
        }

        await client.query(
          `UPDATE courses SET curriculum = $1 WHERE id = $2`,
          [JSON.stringify(curriculum), destination.courseId]
        );

        // Sync to Neo4j Course-Exam Graph
        try {
          const { syncCourseExam } = await import("@/lib/neo4j");
          await syncCourseExam(destination.courseId, courseTitle, finalExamId, examTitle);
        } catch (neoErr) {
          console.warn("Neo4j syncCourseExam warning:", neoErr);
        }
      }
    }

    // Commit Transaction
    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        examId: finalExamId,
        courseId: destination?.courseId || null,
        curriculumItemId,
        importedQuestionsCount: importedCount,
        message: destination?.type === "COURSE_CURRICULUM"
          ? "Đã tạo đề thi và liên kết thành công vào lộ trình khóa học!"
          : "Đã lưu đề thi thành công vào Kho Đề Thi!",
      },
      { status: 201 }
    );
  } catch (error: any) {
    await client.query("ROLLBACK");
    return serverError(error, { route: "/api/teacher/exams/ai-import", method: "POST", message: error.message || "Lỗi giao dịch khi lưu câu hỏi vào hệ thống." });
  } finally {
    client.release();
  }
}
