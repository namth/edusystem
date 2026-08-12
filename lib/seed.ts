import { syncTeacherManagesClass, syncStudentEnrolledInClass, recordStudentSkillScore } from "./neo4j";
import { supabase } from "./supabase";

let isSeeded = false;

export async function runStartupSeed() {
  if (isSeeded) return;
  isSeeded = true;

  try {
    const { data: users } = await supabase.from("users").select("id, role");
    if (users && users.length > 0) {
      const teacher = users.find((u) => u.role === "TEACHER");
      const student = users.find((u) => u.role === "STUDENT");

      if (teacher) {
        await syncTeacherManagesClass(teacher.id, "cls_101");
        await syncTeacherManagesClass(teacher.id, "cls_102");
      }

      if (student) {
        await syncStudentEnrolledInClass(student.id, "cls_101");
        await recordStudentSkillScore(student.id, "Reading", 8.5);
        await recordStudentSkillScore(student.id, "Listening", 7.5);
        await recordStudentSkillScore(student.id, "Writing", 7.0);
        await recordStudentSkillScore(student.id, "Speaking", 7.5);
      }
    }
  } catch (error) {
    console.warn("⚠️ Seed warning (Neo4j connection pending):", error);
  }
}
