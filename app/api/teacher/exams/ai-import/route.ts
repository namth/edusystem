import { NextResponse } from "next/server";
import { requireRole } from "@/lib/api-auth";
import { getPgPool, queryPg } from "@/lib/db-pg";

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

    const createdQuestionIds: string[] = [];
    const detectedSkills = new Set<string>();
    let primaryStimulusText = "";

    // 1. Insert each question into `questions` table
    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const qSkill = q.skill || "Reading";
      detectedSkills.add(qSkill);

      if (q.stimulus_text && !primaryStimulusText) {
        primaryStimulusText = q.stimulus_text;
      }

      const qId = `q_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
      
      let formattedSubQuestions = [];
      if (Array.isArray(q.sub_questions) && q.sub_questions.length > 0) {
        formattedSubQuestions = q.sub_questions.map((sub: any, sIdx: number) => {
          const optMap: Record<string, string> = {};
          if (Array.isArray(sub.options)) {
            sub.options.forEach((o: any) => {
              const k = (o.key || "").toLowerCase();
              if (["a", "b", "c", "d"].includes(k)) {
                optMap[`option_${k}`] = o.text || "";
              }
            });
          }
          return {
            id: sub.id || `sub_${idx + 1}_${sIdx + 1}`,
            number: Number(sub.number) || sIdx + 1,
            text: sub.text || `Câu ${sub.number || sIdx + 1}`,
            option_a: optMap.option_a || sub.option_a || "",
            option_b: optMap.option_b || sub.option_b || "",
            option_c: optMap.option_c || sub.option_c || "",
            option_d: optMap.option_d || sub.option_d || "",
            options: sub.options || [],
            correct_answer: (sub.correct_answer || "A").toUpperCase(),
          };
        });
      } else {
        const optMap: Record<string, string> = {};
        if (Array.isArray(q.options)) {
          q.options.forEach((o: any) => {
            const k = (o.key || "").toLowerCase();
            if (["a", "b", "c", "d"].includes(k)) {
              optMap[`option_${k}`] = o.text || "";
            }
          });
        }
        formattedSubQuestions = [
          {
            id: `sub_${idx + 1}_1`,
            number: Number(q.number) || idx + 1,
            text: q.prompt || `Câu ${q.number || idx + 1}`,
            option_a: optMap.option_a || "",
            option_b: optMap.option_b || "",
            option_c: optMap.option_c || "",
            option_d: optMap.option_d || "",
            options: q.options || [],
            correct_answer: (q.content?.correct_answer || "A").toUpperCase(),
          },
        ];
      }

      const qContent: any = {
        ...(q.content || {}),
        sub_questions: formattedSubQuestions,
      };

      if (q.category === "READING_FILL_IN" && q.stimulus_text) {
        qContent.fill_subtype = "INLINE_SELECT";
        qContent.passage = q.stimulus_text;
      }

      const qRes = await client.query(
        `INSERT INTO questions (
          id, skill, category, prompt, stimulus_text, content, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        RETURNING id`,
        [
          qId,
          qSkill,
          q.category || "READING_MULTIPLE_CHOICE",
          q.prompt,
          q.stimulus_text || null,
          JSON.stringify(qContent),
        ]
      );

      createdQuestionIds.push(qRes.rows[0].id);
    }

    const skillsArray = Array.from(detectedSkills);
    if (skillsArray.length === 0) skillsArray.push("Reading");

    // 2. Insert into `exams` table
    const examId = `exam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const examRes = await client.query(
      `INSERT INTO exams (
        id, title, duration_minutes, skills, question_ids, stimulus_text, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      RETURNING id`,
      [
        examId,
        examTitle,
        Number(durationMinutes) || 60,
        skillsArray,
        JSON.stringify(createdQuestionIds),
        primaryStimulusText || null,
        authUser.userId,
      ]
    );

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

    // 4. Record usage in `ai_usage_logs` (non-blocking for exam creation)
    // SAVEPOINT: lỗi ghi log không được làm hỏng cả giao dịch tạo đề
    await client.query("SAVEPOINT usage_log");
    try {
      const logId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const completionTokens = createdQuestionIds.length * 150;
      await client.query(
        `INSERT INTO ai_usage_logs (
          id, teacher_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
        [
          logId,
          authUser.userId,
          "gemini-flash-lite-latest",
          1200,
          completionTokens,
          1200 + completionTokens,
          0.005,
        ]
      );
      await client.query("RELEASE SAVEPOINT usage_log");
    } catch (logErr) {
      await client.query("ROLLBACK TO SAVEPOINT usage_log");
      console.warn("AI usage log insert skipped:", logErr);
    }

    // Commit Transaction
    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        examId: finalExamId,
        courseId: destination?.courseId || null,
        curriculumItemId,
        importedQuestionsCount: createdQuestionIds.length,
        message: destination?.type === "COURSE_CURRICULUM"
          ? "Đã tạo đề thi và liên kết thành công vào lộ trình khóa học!"
          : "Đã lưu đề thi thành công vào Kho Đề Thi!",
      },
      { status: 201 }
    );
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("AI Exam Import transaction error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi giao dịch khi lưu câu hỏi vào hệ thống." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
