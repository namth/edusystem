// lib/roadmap-data.ts — đọc dữ liệu tiến độ và hoàn thành mục lộ trình (FEAT-010 BR-L04, BR-L10, DEC-008)
import { queryPg } from "@/lib/db-pg";
import { flattenRoadmap, type RoadmapItem } from "@/lib/roadmap";

export interface StudentProgressInfo {
  id: string;
  name: string;
}

export interface ItemProgressInfo {
  id: string;
  title: string;
  type: string;
}

export interface ProgressCell {
  best_percent: number | null;
  attempts: number;
  completed: boolean;
}

export interface ClassProgressResult {
  students: StudentProgressInfo[];
  items: ItemProgressInfo[];
  cells: Record<string, Record<string, ProgressCell>>;
}

/**
 * loadCompletedItemIds:
 * Trả về Set các curriculum_item.id mà học sinh đã hoàn thành trong lớp học.
 * Lớp không có course_id -> tập rỗng.
 * - Mục LESSON: MAX(score_percent) của lesson_attempts cùng class_id, student_id, lesson_id, status IN ('GRADED','AI_SKIPPED') >= pass_percent
 * - Mục EXAM: có submissions của học sinh cho exam_id với final_score >= exams.passing_score; nếu passing_score NULL -> chỉ cần có bài nộp.
 */
export async function loadCompletedItemIds(
  classId: string,
  studentId: string
): Promise<Set<string>> {
  const completed = new Set<string>();

  const classRes = await queryPg(
    "SELECT id, course_id, pass_percent FROM classes WHERE id = $1",
    [classId]
  );
  if (classRes.rows.length === 0) return completed;
  const cls = classRes.rows[0];
  if (!cls.course_id) return completed;

  const passPercent = cls.pass_percent != null ? Number(cls.pass_percent) : 70;

  const itemsRes = await queryPg(
    "SELECT id, type, lesson_id, exam_id FROM curriculum_items WHERE course_id = $1",
    [cls.course_id]
  );
  const items = itemsRes.rows.filter((r: any) => r.type !== "UNIT");
  if (items.length === 0) return completed;

  const lessonItems = items.filter((r: any) => r.type === "LESSON" && r.lesson_id);
  const examItems = items.filter((r: any) => r.type === "EXAM" && r.exam_id);

  if (lessonItems.length > 0) {
    const lessonIds = [...new Set(lessonItems.map((i: any) => i.lesson_id))];
    const attemptsRes = await queryPg(
      `SELECT lesson_id, MAX(score_percent) as best_percent
       FROM lesson_attempts
       WHERE class_id = $1 AND student_id = $2 AND lesson_id = ANY($3) AND status IN ('GRADED', 'AI_SKIPPED')
       GROUP BY lesson_id`,
      [classId, studentId, lessonIds]
    );

    const scoreMap = new Map<string, number>();
    for (const row of attemptsRes.rows) {
      if (row.best_percent !== null && row.best_percent !== undefined) {
        scoreMap.set(row.lesson_id, Number(row.best_percent));
      }
    }

    for (const item of lessonItems) {
      const best = scoreMap.get(item.lesson_id);
      if (best !== undefined && best >= passPercent) {
        completed.add(item.id);
      }
    }
  }

  if (examItems.length > 0) {
    const examIds = [...new Set(examItems.map((i: any) => i.exam_id))];
    const examsRes = await queryPg(
      "SELECT id, passing_score FROM exams WHERE id = ANY($1)",
      [examIds]
    );
    const examPassingMap = new Map<string, number | null>();
    for (const row of examsRes.rows) {
      examPassingMap.set(
        row.id,
        row.passing_score !== null && row.passing_score !== undefined
          ? Number(row.passing_score)
          : null
      );
    }

    const subRes = await queryPg(
      `SELECT exam_id, COUNT(*)::int as sub_count, MAX(final_score) as max_score
       FROM submissions
       WHERE student_id = $1 AND exam_id = ANY($2)
       GROUP BY exam_id`,
      [studentId, examIds]
    );
    const subMap = new Map<string, { count: number; maxScore: number | null }>();
    for (const row of subRes.rows) {
      subMap.set(row.exam_id, {
        count: Number(row.sub_count),
        maxScore: row.max_score !== null && row.max_score !== undefined ? Number(row.max_score) : null,
      });
    }

    for (const item of examItems) {
      const sub = subMap.get(item.exam_id);
      if (!sub || sub.count === 0) continue;
      const passingScore = examPassingMap.get(item.exam_id);
      if (passingScore === null || passingScore === undefined) {
        completed.add(item.id);
      } else if (sub.maxScore !== null && sub.maxScore >= passingScore) {
        completed.add(item.id);
      }
    }
  }

  return completed;
}

/**
 * loadClassProgress:
 * Trả về danh sách học sinh, danh sách mục học và bảng tiến độ cells[studentId][itemId].
 */
export async function loadClassProgress(classId: string): Promise<ClassProgressResult> {
  const classRes = await queryPg(
    "SELECT id, course_id, pass_percent FROM classes WHERE id = $1",
    [classId]
  );
  if (classRes.rows.length === 0) {
    return { students: [], items: [], cells: {} };
  }
  const cls = classRes.rows[0];
  const passPercent = cls.pass_percent != null ? Number(cls.pass_percent) : 70;

  // 1. Lấy danh sách học sinh ghi danh
  const studentsRes = await queryPg(
    `SELECT DISTINCT u.id, u.name
     FROM users u
     JOIN enrollments e ON e.student_id = u.id
     WHERE e.class_id = $1
     ORDER BY u.name ASC, u.id ASC`,
    [classId]
  );
  const students: StudentProgressInfo[] = studentsRes.rows.map((r: any) => ({
    id: r.id,
    name: r.name,
  }));

  if (!cls.course_id) {
    const cells: Record<string, Record<string, ProgressCell>> = {};
    for (const student of students) {
      cells[student.id] = {};
    }
    return { students, items: [], cells };
  }

  // 2. Lấy các mục học của khóa theo thứ tự flattenRoadmap
  const itemsRes = await queryPg(
    `SELECT id, course_id, parent_id, title, type, exam_id, lesson_id, order_index
     FROM curriculum_items
     WHERE course_id = $1
     ORDER BY order_index ASC`,
    [cls.course_id]
  );
  const flattened = flattenRoadmap(itemsRes.rows as RoadmapItem[]);
  const learningItems = flattened.filter((i) => i.type !== "UNIT");
  const items: ItemProgressInfo[] = learningItems.map((i) => ({
    id: i.id,
    title: (i as any).title ?? "",
    type: i.type,
  }));

  // 3. Tra cứu lượt làm bài học
  const lessonItems = learningItems.filter((i) => i.type === "LESSON" && i.lesson_id);
  const attemptsMap = new Map<string, { attempts: number; bestPercent: number | null }>();

  if (lessonItems.length > 0) {
    const lessonIds = [...new Set(lessonItems.map((i) => i.lesson_id))];
    const attemptsRes = await queryPg(
      `SELECT student_id, lesson_id,
              COUNT(*)::int as total_attempts,
              MAX(CASE WHEN status IN ('GRADED', 'AI_SKIPPED') THEN score_percent ELSE NULL END) as best_percent
       FROM lesson_attempts
       WHERE class_id = $1 AND lesson_id = ANY($2)
       GROUP BY student_id, lesson_id`,
      [classId, lessonIds]
    );

    for (const row of attemptsRes.rows) {
      attemptsMap.set(`${row.student_id}:${row.lesson_id}`, {
        attempts: Number(row.total_attempts),
        bestPercent:
          row.best_percent !== null && row.best_percent !== undefined
            ? Number(row.best_percent)
            : null,
      });
    }
  }

  // 4. Tra cứu bài nộp đề thi
  const examItems = learningItems.filter((i) => i.type === "EXAM" && i.exam_id);
  const submissionsMap = new Map<string, { attempts: number; maxScore: number | null }>();
  const examPassingMap = new Map<string, number | null>();

  if (examItems.length > 0) {
    const examIds = [...new Set(examItems.map((i) => i.exam_id))];
    const examsRes = await queryPg(
      "SELECT id, passing_score FROM exams WHERE id = ANY($1)",
      [examIds]
    );
    for (const row of examsRes.rows) {
      examPassingMap.set(
        row.id,
        row.passing_score !== null && row.passing_score !== undefined
          ? Number(row.passing_score)
          : null
      );
    }

    const subRes = await queryPg(
      `SELECT student_id, exam_id,
              COUNT(*)::int as total_subs,
              MAX(final_score) as max_score
       FROM submissions
       WHERE exam_id = ANY($1)
       GROUP BY student_id, exam_id`,
      [examIds]
    );
    for (const row of subRes.rows) {
      submissionsMap.set(`${row.student_id}:${row.exam_id}`, {
        attempts: Number(row.total_subs),
        maxScore:
          row.max_score !== null && row.max_score !== undefined
            ? Number(row.max_score)
            : null,
      });
    }
  }

  // 5. Tổng hợp cells[studentId][itemId]
  const cells: Record<string, Record<string, ProgressCell>> = {};
  for (const student of students) {
    cells[student.id] = {};
    for (const item of learningItems) {
      if (item.type === "LESSON") {
        const data = item.lesson_id
          ? attemptsMap.get(`${student.id}:${item.lesson_id}`)
          : undefined;
        const attempts = data ? data.attempts : 0;
        const bestPercent = data && data.bestPercent !== null ? data.bestPercent : null;
        const completed = bestPercent !== null && bestPercent >= passPercent;
        cells[student.id][item.id] = {
          best_percent: bestPercent,
          attempts,
          completed,
        };
      } else if (item.type === "EXAM") {
        const data = item.exam_id
          ? submissionsMap.get(`${student.id}:${item.exam_id}`)
          : undefined;
        const attempts = data ? data.attempts : 0;
        const passingScore = item.exam_id ? examPassingMap.get(item.exam_id) : undefined;
        let completed = false;
        if (passingScore !== null && passingScore !== undefined) {
          completed = data && data.maxScore !== null ? data.maxScore >= passingScore : false;
        } else {
          completed = attempts > 0;
        }
        cells[student.id][item.id] = {
          best_percent: null,
          attempts,
          completed,
        };
      } else {
        cells[student.id][item.id] = {
          best_percent: null,
          attempts: 0,
          completed: false,
        };
      }
    }
  }

  return { students, items, cells };
}
