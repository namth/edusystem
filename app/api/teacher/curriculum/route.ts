import { NextResponse } from "next/server";
import crypto from "crypto";
import { queryPg, getPgPool } from "@/lib/db-pg";
import { requireRole } from "@/lib/api-auth";

async function checkCourseAccess(
  courseId: string,
  authUser: { userId: string; role: string },
  mode: "read" | "write"
): Promise<{ ok: boolean; status: number; error: string; course?: any }> {
  const res = await queryPg("SELECT * FROM courses WHERE id = $1", [courseId]);
  if (res.rows.length === 0) {
    return { ok: false, status: 404, error: "Khóa học không tồn tại." };
  }
  const course = res.rows[0];

  if (authUser.role === "ADMIN") {
    return { ok: true, status: 200, error: "", course };
  }

  if (mode === "read") {
    if (course.created_by === authUser.userId || course.created_by === null) {
      return { ok: true, status: 200, error: "", course };
    }
    return { ok: false, status: 403, error: "Bạn không có quyền truy cập khóa học này." };
  } else {
    if (course.created_by === authUser.userId) {
      return { ok: true, status: 200, error: "", course };
    }
    return { ok: false, status: 403, error: "Bạn không có quyền chỉnh sửa khóa học này." };
  }
}

async function validateLessonForCurriculum(
  lessonId: unknown,
  authUser: { userId: string; role: string }
): Promise<{ ok: boolean; error: string; lessonId?: string }> {
  if (!lessonId || typeof lessonId !== "string" || !lessonId.trim()) {
    return { ok: false, error: "LESSON bắt buộc phải có lesson_id." };
  }
  const cleanId = lessonId.trim();
  const res = await queryPg("SELECT id, created_by, question_ids FROM lessons WHERE id = $1", [cleanId]);
  if (res.rows.length === 0) {
    return { ok: false, error: "Bài học không tồn tại." };
  }
  const lesson = res.rows[0];
  if (authUser.role === "TEACHER" && lesson.created_by !== authUser.userId) {
    return { ok: false, error: "Bạn không có quyền sử dụng bài học này." };
  }
  const qIds = Array.isArray(lesson.question_ids)
    ? lesson.question_ids
    : (typeof lesson.question_ids === "string" ? JSON.parse(lesson.question_ids) : []);
  if (!Array.isArray(qIds) || qIds.length < 1) {
    return { ok: false, error: "Bài học chưa có câu hỏi nào." };
  }
  return { ok: true, error: "", lessonId: cleanId };
}

export async function GET(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");

    if (!courseId) {
      return NextResponse.json({ success: false, error: "Thiếu courseId." }, { status: 400 });
    }

    const access = await checkCourseAccess(courseId, authUser, "read");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const result = await queryPg(
      `SELECT id, course_id, parent_id, title, type, exam_id, lesson_id, order_index
       FROM curriculum_items
       WHERE course_id = $1
       ORDER BY order_index ASC;`,
      [courseId]
    );

    const items = result.rows.map((r: any) => ({
      id: r.id,
      course_id: r.course_id,
      parent_id: r.parent_id,
      title: r.title,
      type: r.type,
      exam_id: r.exam_id,
      lesson_id: r.lesson_id ?? null,
      order_index: r.order_index ?? 0,
    }));

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error("API /api/teacher/curriculum GET Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi nạp chương trình học." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Dữ liệu không hợp lệ." }, { status: 400 });
    }

    const { course_id, parent_id, title, type, exam_id, lesson_id } = body;

    if (!course_id || typeof course_id !== "string" || !course_id.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu course_id." }, { status: 400 });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập tiêu đề." }, { status: 400 });
    }

    if (!type || !["UNIT", "LESSON", "EXAM"].includes(type)) {
      return NextResponse.json({ success: false, error: "Loại mục không hợp lệ." }, { status: 400 });
    }

    const access = await checkCourseAccess(course_id, authUser, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    const normParentId = parent_id || null;

    if (type === "UNIT") {
      if (normParentId !== null) {
        return NextResponse.json({ success: false, error: "UNIT không được có cha." }, { status: 400 });
      }
    } else {
      if (normParentId !== null) {
        const parentRes = await queryPg("SELECT * FROM curriculum_items WHERE id = $1", [normParentId]);
        if (parentRes.rows.length === 0) {
          return NextResponse.json({ success: false, error: "Mục cha không tồn tại." }, { status: 400 });
        }
        const parentItem = parentRes.rows[0];
        if (parentItem.course_id !== course_id) {
          return NextResponse.json({ success: false, error: "Mục cha thuộc khóa học khác." }, { status: 400 });
        }
        if (parentItem.type !== "UNIT") {
          return NextResponse.json({ success: false, error: "Mục cha phải là UNIT." }, { status: 400 });
        }
      }
    }

    let finalExamId: string | null = null;
    let finalLessonId: string | null = null;

    if (type === "EXAM") {
      if (!exam_id || typeof exam_id !== "string" || !exam_id.trim()) {
        return NextResponse.json({ success: false, error: "EXAM thiếu exam_id." }, { status: 400 });
      }
      const examRes = await queryPg("SELECT id FROM exams WHERE id = $1", [exam_id.trim()]);
      if (examRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Đề thi không tồn tại." }, { status: 400 });
      }
      finalExamId = exam_id.trim();
    } else if (exam_id) {
      finalExamId = exam_id;
    }

    if (type === "LESSON") {
      const vLesson = await validateLessonForCurriculum(lesson_id, authUser);
      if (!vLesson.ok) {
        return NextResponse.json({ success: false, error: vLesson.error }, { status: 400 });
      }
      finalLessonId = vLesson.lessonId!;
    }

    let maxOrderSql = "SELECT COALESCE(MAX(order_index), 0) AS max_order FROM curriculum_items WHERE course_id = $1 AND parent_id IS NULL";
    let maxOrderParams: any[] = [course_id];
    if (normParentId !== null) {
      maxOrderSql = "SELECT COALESCE(MAX(order_index), 0) AS max_order FROM curriculum_items WHERE course_id = $1 AND parent_id = $2";
      maxOrderParams = [course_id, normParentId];
    }
    const orderRes = await queryPg(maxOrderSql, maxOrderParams);
    const orderIndex = Number(orderRes.rows[0]?.max_order || 0) + 1;

    const newId = "curr_" + crypto.randomUUID();
    const cleanTitle = title.trim();

    const insertRes = await queryPg(
      `INSERT INTO curriculum_items (id, course_id, parent_id, title, type, exam_id, lesson_id, order_index, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, course_id, parent_id, title, type, exam_id, lesson_id, order_index;`,
      [newId, course_id, normParentId, cleanTitle, type, finalExamId, finalLessonId, orderIndex, authUser.userId]
    );

    const inserted = insertRes.rows[0];
    return NextResponse.json(
      {
        success: true,
        item: {
          id: inserted.id,
          course_id: inserted.course_id,
          parent_id: inserted.parent_id,
          title: inserted.title,
          type: inserted.type,
          exam_id: inserted.exam_id,
          lesson_id: inserted.lesson_id ?? null,
          order_index: inserted.order_index,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("API /api/teacher/curriculum POST Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi tạo bài học/đề thi." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, error: "items thiếu hoặc rỗng." }, { status: 400 });
    }

    const ids: string[] = [];
    for (const item of body.items) {
      if (!item.id || typeof item.id !== "string") {
        return NextResponse.json({ success: false, error: "Mục thiếu id." }, { status: 400 });
      }
      ids.push(item.id);
    }

    const existingRes = await queryPg("SELECT * FROM curriculum_items WHERE id = ANY($1)", [ids]);
    const existingMap = new Map(existingRes.rows.map((r: any) => [r.id, r]));

    for (const id of ids) {
      if (!existingMap.has(id)) {
        return NextResponse.json({ success: false, error: "Mục không tồn tại." }, { status: 404 });
      }
    }

    const courseIds = new Set(existingRes.rows.map((r: any) => r.course_id));
    if (courseIds.size > 1) {
      return NextResponse.json({ success: false, error: "Các mục phải cùng một khóa học." }, { status: 400 });
    }

    const courseId = [...courseIds][0];
    const access = await checkCourseAccess(courseId, authUser, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    for (const item of body.items) {
      const existing = existingMap.get(item.id);

      if (item.title !== undefined) {
        if (typeof item.title !== "string" || !item.title.trim()) {
          return NextResponse.json({ success: false, error: "Tiêu đề không được để trống." }, { status: 400 });
        }
      }

      if (item.parent_id !== undefined) {
        const targetParent = item.parent_id;
        if (existing.type === "UNIT") {
          if (targetParent !== null) {
            return NextResponse.json({ success: false, error: "UNIT không được có cha." }, { status: 400 });
          }
        } else {
          if (targetParent !== null) {
            if (targetParent === item.id) {
              return NextResponse.json({ success: false, error: "Không thể chọn chính mình làm cha." }, { status: 400 });
            }
            const pRes = await queryPg("SELECT * FROM curriculum_items WHERE id = $1", [targetParent]);
            if (pRes.rows.length === 0) {
              return NextResponse.json({ success: false, error: "Mục cha không tồn tại." }, { status: 400 });
            }
            const pRow = pRes.rows[0];
            if (pRow.course_id !== courseId || pRow.type !== "UNIT") {
              return NextResponse.json({ success: false, error: "Mục cha phải là UNIT cùng khóa học." }, { status: 400 });
            }
          }
        }
      }

      if (item.order_index !== undefined) {
        if (typeof item.order_index !== "number") {
          return NextResponse.json({ success: false, error: "order_index không hợp lệ." }, { status: 400 });
        }
      }

      if (item.exam_id !== undefined && item.exam_id !== null) {
        const eRes = await queryPg("SELECT id FROM exams WHERE id = $1", [item.exam_id]);
        if (eRes.rows.length === 0) {
          return NextResponse.json({ success: false, error: "Đề thi không tồn tại." }, { status: 400 });
        }
      }

      if (item.lesson_id !== undefined) {
        if (existing.type !== "LESSON") {
          return NextResponse.json({ success: false, error: "Chỉ mục loại LESSON mới được gắn lesson_id." }, { status: 400 });
        }
        const vLesson = await validateLessonForCurriculum(item.lesson_id, authUser);
        if (!vLesson.ok) {
          return NextResponse.json({ success: false, error: vLesson.error }, { status: 400 });
        }
      }
    }

    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const updatedList: any[] = [];

      for (const item of body.items) {
        const sets: string[] = [];
        const params: any[] = [];
        let pIdx = 1;

        if (item.title !== undefined) {
          sets.push(`title = $${pIdx++}`);
          params.push(item.title.trim());
        }
        if (item.parent_id !== undefined) {
          sets.push(`parent_id = $${pIdx++}`);
          params.push(item.parent_id || null);
        }
        if (item.order_index !== undefined) {
          sets.push(`order_index = $${pIdx++}`);
          params.push(item.order_index);
        }
        if (item.exam_id !== undefined) {
          sets.push(`exam_id = $${pIdx++}`);
          params.push(item.exam_id || null);
        }
        if (item.lesson_id !== undefined) {
          sets.push(`lesson_id = $${pIdx++}`);
          params.push(item.lesson_id ? item.lesson_id.trim() : null);
        }

        if (sets.length > 0) {
          params.push(item.id);
          const q = `UPDATE curriculum_items SET ${sets.join(", ")} WHERE id = $${pIdx} RETURNING id, course_id, parent_id, title, type, exam_id, lesson_id, order_index;`;
          const uRes = await client.query(q, params);
          if (uRes.rows[0]) {
            updatedList.push({
              ...uRes.rows[0],
              lesson_id: uRes.rows[0].lesson_id ?? null,
            });
          }
        } else {
          const sRes = await client.query(
            "SELECT id, course_id, parent_id, title, type, exam_id, lesson_id, order_index FROM curriculum_items WHERE id = $1",
            [item.id]
          );
          if (sRes.rows[0]) {
            updatedList.push({
              ...sRes.rows[0],
              lesson_id: sRes.rows[0].lesson_id ?? null,
            });
          }
        }
      }

      await client.query("COMMIT");
      return NextResponse.json({ success: true, items: updatedList });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("API /api/teacher/curriculum PUT Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi cập nhật chương trình học." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireRole(["ADMIN", "TEACHER"]);
  if (auth.error) return auth.error;
  const authUser = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Thiếu id." }, { status: 404 });
    }

    const itemRes = await queryPg("SELECT * FROM curriculum_items WHERE id = $1", [id]);
    if (itemRes.rows.length === 0) {
      return NextResponse.json({ success: false, error: "Mục không tồn tại." }, { status: 404 });
    }

    const item = itemRes.rows[0];
    const access = await checkCourseAccess(item.course_id, authUser, "write");
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error }, { status: access.status });
    }

    if (item.type === "UNIT") {
      const childRes = await queryPg("SELECT id FROM curriculum_items WHERE parent_id = $1", [id]);
      const childIds = childRes.rows.map((r: any) => r.id);
      const deletedIds = [id, ...childIds];
      await queryPg("DELETE FROM curriculum_items WHERE id = ANY($1)", [deletedIds]);
      return NextResponse.json({ success: true, deletedIds });
    } else {
      await queryPg("DELETE FROM curriculum_items WHERE id = $1", [id]);
      return NextResponse.json({ success: true, deletedIds: [id] });
    }
  } catch (err: any) {
    console.error("API /api/teacher/curriculum DELETE Error:", err);
    return NextResponse.json({ success: false, error: err.message || "Lỗi xóa mục." }, { status: 500 });
  }
}
