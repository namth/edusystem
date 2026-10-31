import { queryPg } from "@/lib/db-pg";
import {
  type ScoringStandard,
  type StandardSection,
  scoreSection,
  roundToStep,
} from "@/lib/exam-scoring";
import { type GradeResult } from "@/lib/grading";
import { loadStudentRoadmap } from "@/lib/lesson-access";

export async function ensureAttemptsSchema(): Promise<void> {
  try {
    await queryPg("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS teacher_feedback TEXT;");
  } catch (err) {
    console.warn("Failed to alter submissions teacher_feedback:", err);
  }
}

function parseJsonField<T>(field: unknown, defaultValue: T): T {
  if (field == null) return defaultValue;
  if (typeof field === "string") {
    try {
      return JSON.parse(field) as T;
    } catch {
      return defaultValue;
    }
  }
  return field as T;
}

export function formatStandardRow(row: any): ScoringStandard {
  return {
    id: row.id,
    name: row.name,
    framework: row.framework || undefined,
    description: row.description || undefined,
    sections: parseJsonField<StandardSection[]>(row.sections, []),
    aggregation: parseJsonField<any>(row.aggregation, { method: "AVERAGE", round_step: 0.5 }),
    is_system: Boolean(row.is_system),
  };
}

/**
 * BR-E01: Chọn chuẩn áp dụng theo thứ tự:
 * 1. exams.scoring_standard_id
 * 2. courses.default_scoring_standard_id của khóa chứa đề qua curriculum_items.exam_id (lấy khóa đầu tiên có chuẩn)
 * 3. std_internal_10
 */
export async function resolveStandardForExam(examId: string): Promise<ScoringStandard> {
  const examRes = await queryPg(
    "SELECT scoring_standard_id FROM exams WHERE id = $1 LIMIT 1",
    [examId]
  );
  const examStandardId = examRes.rows[0]?.scoring_standard_id;
  if (examStandardId) {
    const stdRes = await queryPg(
      "SELECT id, name, framework, description, sections, aggregation, is_system FROM scoring_standards WHERE id = $1 LIMIT 1",
      [examStandardId]
    );
    if (stdRes.rows.length > 0) {
      return formatStandardRow(stdRes.rows[0]);
    }
  }

  const courseRes = await queryPg(
    `SELECT c.default_scoring_standard_id
     FROM curriculum_items ci
     JOIN courses c ON c.id = ci.course_id
     WHERE ci.exam_id = $1 AND c.default_scoring_standard_id IS NOT NULL AND c.default_scoring_standard_id <> ''
     LIMIT 1`,
    [examId]
  );
  const courseStandardId = courseRes.rows[0]?.default_scoring_standard_id;
  if (courseStandardId) {
    const stdRes = await queryPg(
      "SELECT id, name, framework, description, sections, aggregation, is_system FROM scoring_standards WHERE id = $1 LIMIT 1",
      [courseStandardId]
    );
    if (stdRes.rows.length > 0) {
      return formatStandardRow(stdRes.rows[0]);
    }
  }

  const fallbackRes = await queryPg(
    "SELECT id, name, framework, description, sections, aggregation, is_system FROM scoring_standards WHERE id = 'std_internal_10' LIMIT 1"
  );
  if (fallbackRes.rows.length > 0) {
    return formatStandardRow(fallbackRes.rows[0]);
  }

  return {
    id: "std_internal_10",
    name: "Thang điểm 10",
    framework: "INTERNAL",
    sections: [
      { skill: "Reading", min: 0, max: 10, step: 0.25, conversion: "LINEAR" },
      { skill: "Listening", min: 0, max: 10, step: 0.25, conversion: "LINEAR" },
      { skill: "Writing", min: 0, max: 10, step: 0.25, conversion: "LINEAR", rubric_id: "rubric_internal_10" },
      { skill: "Speaking", min: 0, max: 10, step: 0.25, conversion: "LINEAR", rubric_id: "rubric_internal_10" },
    ],
    aggregation: { method: "AVERAGE", round_step: 0.25 },
  };
}

export interface ExamAccessCheck {
  allowed: boolean;
  status?: number;
  error?: string;
  limit: number | null;
  used: number;
}

/**
 * BR-E03, BR-E04: Kiểm tra quyền làm đề và đếm số lượt đã dùng
 */
export async function checkExamAccess(
  examId: string,
  studentId: string,
  classId?: string | null
): Promise<ExamAccessCheck> {
  if (!classId) {
    // Ngân hàng đề tự do / luyện tập: không giới hạn số lần
    const usedRes = await queryPg(
      "SELECT COUNT(*)::int AS count FROM submissions WHERE student_id = $1 AND exam_id = $2 AND class_ref IS NULL AND status <> 'IN_PROGRESS'",
      [studentId, examId]
    );
    const used = Number(usedRes.rows[0]?.count || 0);
    return { allowed: true, limit: null, used };
  }

  // 1. Kiểm tra ghi danh lớp
  const enrollRes = await queryPg(
    "SELECT 1 FROM enrollments WHERE class_id = $1 AND student_id = $2 LIMIT 1",
    [classId, studentId]
  );
  if (enrollRes.rows.length === 0) {
    return {
      allowed: false,
      status: 403,
      error: "Học sinh chưa ghi danh vào lớp học này.",
      limit: null,
      used: 0,
    };
  }

  // 2. Kiểm tra giao bài hoặc lộ trình lớp
  const assignRes = await queryPg(
    "SELECT max_attempts FROM class_assignments WHERE class_id = $1 AND exam_id = $2 LIMIT 1",
    [classId, examId]
  );

  let limit: number | null = null;
  if (assignRes.rows.length > 0) {
    limit = assignRes.rows[0].max_attempts != null ? Number(assignRes.rows[0].max_attempts) : 1;
  } else {
    const roadmapRes = await loadStudentRoadmap(classId, studentId);
    if (!roadmapRes.ok) {
      return {
        allowed: false,
        status: roadmapRes.status,
        error: roadmapRes.error,
        limit: null,
        used: 0,
      };
    }
    const examItem = roadmapRes.items.find(
      (item) => item.type === "EXAM" && item.exam_id === examId
    );
    if (!examItem) {
      return {
        allowed: false,
        status: 403,
        error: "Đề thi không nằm trong bài tập hoặc lộ trình của lớp.",
        limit: null,
        used: 0,
      };
    }
    const itemState = roadmapRes.states[examItem.id]?.state;
    if (itemState !== "OPEN" && itemState !== "COMPLETED") {
      return {
        allowed: false,
        status: 403,
        error: "Đề thi chưa được mở trong lộ trình.",
        limit: null,
        used: 0,
      };
    }
    limit = 1;
  }

  // 3. Đếm số lượt đã nộp của học sinh cho đề ở lớp này
  const usedRes = await queryPg(
    "SELECT COUNT(*)::int AS count FROM submissions WHERE student_id = $1 AND exam_id = $2 AND class_ref = $3 AND status <> 'IN_PROGRESS'",
    [studentId, examId, classId]
  );
  const used = Number(usedRes.rows[0]?.count || 0);

  return { allowed: true, limit, used };
}

export interface SectionScoreEntry {
  score: number | null;
  earned: number;
  max: number;
  override?: boolean;
}

export interface ExamQuestionResult extends GradeResult {
  skill?: string;
  score?: number;
}

/**
 * BR-E02: Nhóm results theo skill -> tally mỗi kỹ năng và tính điểm phần theo chuẩn.
 * Điểm phần do giáo viên chấm tay (override: true) được giữ nguyên.
 */
export function tallyAndScoreSections(
  snapshot: ScoringStandard,
  results: ExamQuestionResult[],
  existingSectionScores?: Record<string, any>
): Record<string, SectionScoreEntry> {
  const sections = snapshot.sections || [];
  const sectionScores: Record<string, SectionScoreEntry> = {};

  const existingMap = existingSectionScores || {};

  for (const section of sections) {
    const skillName = String(section.skill);
    const skillResults = results.filter((r) => String(r.skill) === skillName);

    // Chỉ cho kỹ năng có trong chuẩn và có câu
    if (skillResults.length === 0) {
      continue;
    }

    // Nếu giáo viên đã chấm tay, giữ nguyên
    const existingEntry = existingMap[skillName];
    if (existingEntry && existingEntry.override === true) {
      sectionScores[skillName] = { ...existingEntry };
      continue;
    }

    let objective_earned = 0;
    let objective_max = 0;
    let ai_earned = 0;
    let ai_max = 0;
    let hasUngradedAi = false;

    for (const r of skillResults) {
      if (r.kind === "OBJECTIVE") {
        objective_earned += r.earned;
        objective_max += r.max;
      } else if (r.kind === "AI") {
        ai_max += r.max;
        if (typeof r.score === "number" && !isNaN(r.score)) {
          const min = section.min;
          const max = section.max;
          const ratio = max > min ? Math.max(0, Math.min(1, (r.score - min) / (max - min))) : 0;
          ai_earned += ratio * r.max;
        } else {
          hasUngradedAi = true;
        }
      }
    }

    const earned = objective_earned + ai_earned;
    const max = objective_max + ai_max;

    if (hasUngradedAi) {
      sectionScores[skillName] = {
        score: null,
        earned,
        max,
      };
    } else {
      const tally = {
        objective_earned,
        objective_max,
        ai_earned,
        ai_max,
      };
      const score = scoreSection(section, tally);
      sectionScores[skillName] = {
        score,
        earned,
        max,
      };
    }
  }

  return sectionScores;
}

export function formatAttemptResponse(sub: any) {
  return {
    id: sub.id,
    exam_id: sub.exam_id,
    student_id: sub.student_id,
    answers: parseJsonField<Record<string, any>>(sub.answers, {}),
    status: sub.status,
    started_at: sub.started_at,
    deadline_at: sub.deadline_at,
    submitted_at: sub.submitted_at || null,
    graded_at: sub.graded_at || null,
    is_late: Boolean(sub.is_late),
    results: parseJsonField<any[]>(sub.results, []),
    section_scores: parseJsonField<Record<string, any>>(sub.section_scores, {}),
    total_score: sub.total_score != null ? Number(sub.total_score) : null,
    passed: sub.passed != null ? Boolean(sub.passed) : null,
    class_ref: sub.class_ref || null,
    teacher_feedback: sub.teacher_feedback || null,
    standard_snapshot: parseJsonField<any>(sub.standard_snapshot, null),
  };
}
