// Dựng lại DB E2E từ schema thật (e2e/schema.sql, pg_dump --schema-only) và nạp dữ liệu mẫu.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Client } from "pg";
import { E2E_ENV, E2E_PASSWORD } from "./env";

function hashPassword(plain: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(plain, salt, 64).toString("hex")}`;
}

const MC = (answers: string[]) =>
  JSON.stringify({
    sub_questions: answers.map((a, i) => ({
      id: `q${i + 1}`, text: `Câu hỏi số ${i + 1}?`, option_a: "Táo", option_b: "Cam", option_c: "Chuối", option_d: "Nho", correct_answer: a,
    })),
  });

export async function seedE2E() {
  const db = new Client({ connectionString: E2E_ENV.DATABASE_URL });
  await db.connect();
  try {
    await db.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await db.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
    await db.query("SET search_path TO public"); // pg_dump đặt search_path rỗng cho phiên
    // FEAT-012: schema.sql dump trước migration 013 → áp thêm (ensureSchema cũng chạy, nhưng seed cần cột ngay)
    await db.query(fs.readFileSync(path.join(__dirname, "..", "docs", "db-migration-013-onboarding.sql"), "utf8"));
    const pw = hashPassword(E2E_PASSWORD);
    await db.query(
      `INSERT INTO users (id,name,email,role,password,must_change_password,slot_limit) VALUES
        ('e2e_admin','Admin E2E','admin@e2e.test','ADMIN',$1,FALSE,0),
        ('e2e_t1','Cô Lan','teacher@e2e.test','TEACHER',$1,FALSE,50),
        ('e2e_t2','Thầy Minh','teacher2@e2e.test','TEACHER',$1,FALSE,10),
        ('e2e_tmp','GV mật khẩu tạm','temp@e2e.test','TEACHER',$1,TRUE,10),
        ('e2e_s1','Học sinh Một','student@e2e.test','STUDENT',$1,FALSE,0),
        ('e2e_s2','Học sinh Hai','student2@e2e.test','STUDENT',$1,FALSE,0)`,
      [pw]
    );
    await db.query(`UPDATE users SET teacher_status = 'VERIFIED' WHERE role = 'TEACHER'`);
    await db.query(`
      INSERT INTO courses (id,title,description,created_by) VALUES
        ('e2e_co1','Khoá Starters E2E','Khoá của cô Lan','e2e_t1'),
        ('e2e_co2','Khoá của thầy Minh','','e2e_t2');
      INSERT INTO classes (id,name,code,teacher_id,course_id,unlock_mode) VALUES
        ('e2e_c1','Lớp 3A E2E','E2E3A','e2e_t1','e2e_co1','ALL_OPEN');
      INSERT INTO enrollments (id,student_id,class_id) VALUES ('e2e_en1','e2e_s1','e2e_c1');
    `);
    await db.query(
      `INSERT INTO questions (id,skill,category,prompt,content) VALUES
        ('e2e_q1','Reading','READING_MC','Chọn đáp án đúng',$1)`,
      [MC(["A", "B", "C"])]
    );
    await db.query(`
      INSERT INTO exams (id,title,duration_minutes,skills,question_ids,created_by) VALUES
        ('e2e_exObj','Đề trắc nghiệm E2E',15,ARRAY['Reading'],'["e2e_q1"]','e2e_t1'),
        ('e2e_exT2','Đề riêng thầy Minh',15,ARRAY['Reading'],'["e2e_q1"]','e2e_t2');
      INSERT INTO class_assignments (id,class_id,exam_id,max_attempts) VALUES ('e2e_as1','e2e_c1','e2e_exObj',3);
      INSERT INTO curriculum_items (id,course_id,parent_id,title,type,exam_id,order_index,created_by) VALUES
        ('e2e_ci1','e2e_co1',NULL,'Đề trắc nghiệm E2E','EXAM','e2e_exObj',1,'e2e_t1');
    `);
  } finally {
    await db.end();
  }
}
