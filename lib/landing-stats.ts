import { queryPg } from "@/lib/db-pg";

export interface LandingStats {
  exams: number;
  questions: number;
  students: number;
}

export async function getLandingStats(): Promise<LandingStats | null> {
  try {
    const [examsRes, questionsRes, studentsRes] = await Promise.all([
      queryPg("SELECT COUNT(*)::int AS count FROM exams"),
      queryPg("SELECT COUNT(*)::int AS count FROM questions"),
      queryPg("SELECT COUNT(*)::int AS count FROM users WHERE role = 'STUDENT'"),
    ]);

    const exams = Number(examsRes.rows[0]?.count ?? 0);
    const questions = Number(questionsRes.rows[0]?.count ?? 0);
    const students = Number(studentsRes.rows[0]?.count ?? 0);

    return { exams, questions, students };
  } catch {
    return null;
  }
}
