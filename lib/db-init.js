const { Client } = require("pg");

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:qereQScNVoecP8Kd@db.owlvfznycutvkrvgbiot.supabase.co:5432/postgres";

async function initializeDatabase() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("🌱 Connecting to Supabase PostgreSQL database...");

  try {
    // 1. Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL,
        phone VARCHAR(20),
        target_band VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'users' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        teacher_id VARCHAR(50) NOT NULL,
        max_slots INTEGER DEFAULT 30,
        schedule VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'classes' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS enrollments (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        class_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(student_id, class_id)
      );
    `);
    console.log("Table 'enrollments' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(150) NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        skills TEXT[] NOT NULL,
        category_id VARCHAR(50),
        target_level VARCHAR(50) DEFAULT 'Intermediate',
        is_template BOOLEAN DEFAULT FALSE,
        reading_passage TEXT,
        reading_questions JSONB,
        listening_audio_url TEXT,
        listening_questions JSONB,
        writing_prompt TEXT,
        speaking_prompt TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'exams' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS exam_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'exam_categories' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS lesson_exams (
        id VARCHAR(50) PRIMARY KEY,
        lesson_id VARCHAR(50) NOT NULL,
        exam_id VARCHAR(50) NOT NULL,
        order_index INTEGER DEFAULT 1,
        is_required BOOLEAN DEFAULT TRUE,
        weight NUMERIC(3,2) DEFAULT 1.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(lesson_id, exam_id)
      );
    `);
    console.log("Table 'lesson_exams' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS course_exams (
        id VARCHAR(50) PRIMARY KEY,
        course_id VARCHAR(50) NOT NULL,
        exam_id VARCHAR(50) NOT NULL,
        exam_scope VARCHAR(50) DEFAULT 'FINAL_EXAM',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, exam_id)
      );
    `);
    console.log("Table 'course_exams' verified.");

    // Seed default categories
    await client.query(`
      INSERT INTO exam_categories (id, name, code, description, display_order)
      VALUES
        ('cat_placement', 'Bài Thi Đầu Vào (Placement Test)', 'PLACEMENT_TEST', 'Đánh giá trình độ học sinh khi nhập học', 1),
        ('cat_lesson_quiz', 'Bài Kiểm Tra Theo Bài Học (Lesson Quiz)', 'LESSON_QUIZ', 'Bài kiểm tra ngắn 10-15 phút sau mỗi bài học', 2),
        ('cat_unit_test', 'Bài Kiểm Tra Theo Chương (Unit Test)', 'UNIT_TEST', 'Kiểm tra tổng hợp cuối mỗi chủ đề/chương', 3),
        ('cat_mid_term', 'Bài Thi Giữa Kỳ (Mid-Term Exam)', 'MID_TERM', 'Đánh giá tiến độ giữa khóa học', 4),
        ('cat_final_exam', 'Bài Thi Cuối Khóa (Final Exam)', 'FINAL_EXAM', 'Đánh giá tổng kết kết quả khóa học', 5),
        ('cat_full_mock', 'Đề Thi Thử Chuẩn (Full Mock Exam)', 'MOCK_EXAM', 'Bộ đề mô phỏng cấu trúc thi thật (IELTS/TOEIC)', 6)
      ON CONFLICT (id) DO NOTHING;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS submissions (
        id VARCHAR(50) PRIMARY KEY,
        exam_id VARCHAR(50) NOT NULL,
        student_id VARCHAR(50) NOT NULL,
        answers JSONB NOT NULL,
        ai_score NUMERIC(3, 1),
        ai_feedback TEXT,
        final_score NUMERIC(3, 1),
        final_feedback TEXT,
        status VARCHAR(30) DEFAULT 'AI_GRADED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'submissions' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS slot_requests (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id VARCHAR(50) NOT NULL,
        teacher_name VARCHAR(100) NOT NULL,
        teacher_email VARCHAR(100) NOT NULL,
        requested_slots INTEGER NOT NULL,
        total_cost NUMERIC(12, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'slot_requests' verified.");

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL,
        student_name VARCHAR(100) NOT NULL,
        student_email VARCHAR(100) NOT NULL,
        course_title VARCHAR(150) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        transfer_code VARCHAR(50) NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Table 'orders' verified.");

    // 2. Seed initial data
    const userCount = await client.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCount.rows[0].count) === 0) {
      console.log("Seeds empty, injecting starter accounts & records...");
      
      // Admin, Teacher, Student
      await client.query(`
        INSERT INTO users (id, name, email, password, role, phone, target_band) VALUES
        ('admin_01', 'Admin Root', 'admin@edtech.edu.vn', '123456', 'ADMIN', '0900000001', 'N/A'),
        ('teacher_01', 'Thầy Nguyễn Văn Đức', 'teacher.duc@edtech.edu.vn', '123456', 'TEACHER', '0912345679', '8.5'),
        ('student_01', 'Trần Hoàng Nam', 'namtran.student@gmail.com', '123456', 'STUDENT', '0912345678', '7.5')
      `);

      // Classes
      await client.query(`
        INSERT INTO classes (id, name, code, teacher_id, max_slots, schedule) VALUES
        ('cls_101', 'IELTS Master 7.5 - K24', 'IELTS75K24', 'teacher_01', 35, 'Thứ 2 - Thứ 4 - Thứ 6 (19:30 - 21:30)'),
        ('cls_102', 'Academic Writing & Speaking Special', 'WRSPEAK2026', 'teacher_01', 20, 'Thứ 3 - Thứ 5 (18:00 - 20:00)')
      `);

      // Enrollments
      await client.query(`
        INSERT INTO enrollments (id, student_id, class_id) VALUES
        ('enr_01', 'student_01', 'cls_101')
      `);

      // Exams
      await client.query(`
        INSERT INTO exams (id, title, duration_minutes, skills, reading_passage, reading_questions, listening_audio_url, listening_questions, writing_prompt, speaking_prompt) VALUES
        ('test_01', 'Đề Thi Thử IELTS Mock Test Standard #01', 60, ARRAY['Reading', 'Listening', 'Writing', 'Speaking'], 
         'THE RISE OF ARTIFICIAL INTELLIGENCE IN LANGUAGE EDUCATION\\nArtificial Intelligence (AI) is fundamentally transforming the landscape of language pedagogy. Traditional classroom instruction often faces the challenge of providing individual feedback to large cohorts of students. However, modern Machine Learning models and Natural Language Processing (NLP) engines now allow for instant, hyper-personalized evaluations of complex student performances.\\n\\nIn the domain of writing, Large Language Models (LLMs) evaluate not only superficial grammatical correctness, but also semantic coherence, lexical diversity, and task fulfillment. Similarly, Speech-to-Text models enable automated assessment of oral fluency, pronunciation precision, and acoustic pauses. Consequently, educators are shifting from manual grading to strategic coaching, using AI analytics to identify student weaknesses in real time.',
         '[{"id": "rq_1", "question": "What is the main challenge faced by traditional classroom instruction according to paragraph 1?", "options": ["A. Lack of qualified English teachers.", "B. Difficulty in offering individual feedback to large classes.", "C. High cost of printed textbooks.", "D. Resistance to technology from students."], "correctAnswer": "B"}, {"id": "rq_2", "question": "According to the passage, how does Speech-to-Text technology assist language learning?", "options": ["A. By writing essays automatically for students.", "B. By translating lessons into native languages.", "C. By evaluating oral fluency, pronunciation, and pauses.", "D. By replacing human examiners completely."], "correctAnswer": "C"}]'::jsonb,
         'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=english-conversation-sample.mp3',
         '[{"id": "lq_1", "question": "What is the primary topic of the recorded discussion?", "options": ["A. Preparing for university entrance examinations.", "B. Selecting an online language certification course.", "C. Booking a international flight ticket.", "D. Interviewing for a software engineering role."], "correctAnswer": "B"}]'::jsonb,
         'Some people believe that studying online is more effective than traditional classroom learning. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your knowledge or experience.',
         'Describe an educational technology tool that has helped you improve your skills. You should say: what the tool is, how you discovered it, what features you use most often, and explain why it was beneficial to your learning.'
        )
      `);

      // Orders
      await client.query(`
        INSERT INTO orders (id, student_id, student_name, student_email, course_title, amount, transfer_code, status) VALUES
        ('ORD-98210', 'student_01', 'Trần Hoàng Nam', 'namtran.student@gmail.com', 'IELTS Intensive 7.5+ Masterclass', 2490000, 'EDTECH98210', 'PENDING')
      `);

      // Slot requests
      await client.query(`
        INSERT INTO slot_requests (id, teacher_id, teacher_name, teacher_email, requested_slots, total_cost, status) VALUES
        ('SLOT-501', 'teacher_01', 'Thầy Nguyễn Văn Đức', 'teacher.duc@edtech.edu.vn', 50, 5000000, 'PENDING')
      `);

      console.log("Seed data injected successfully.");
    }

    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Database migration error:", err);
  } finally {
    await client.end();
  }
}

initializeDatabase();
