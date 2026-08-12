export interface Course {
  id: string;
  title: string;
  description: string;
  level: "Beginner" | "Intermediate" | "Advanced";
  price: number;
  thumbnail: string;
  skillsCovered: string[];
}

export interface ExamTest {
  id: string;
  title: string;
  durationMinutes: number;
  skills: ("Reading" | "Listening" | "Writing" | "Speaking")[];
  readingPassage?: string;
  readingQuestions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
  }>;
  listeningAudioUrl?: string;
  listeningQuestions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
  }>;
  writingPrompt?: string;
  speakingPrompt?: string;
}

export interface UserClass {
  id: string;
  name: string;
  code: string;
  teacherName: string;
  studentCount: number;
  schedule: string;
}

export interface PurchaseOrder {
  id: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  amount: number;
  transferCode: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export interface AccountSlotRequest {
  id: string;
  teacherName: string;
  teacherEmail: string;
  requestedSlots: number;
  totalCost: number;
  status: "PENDING" | "APPROVED";
  createdAt: string;
}

export const INITIAL_COURSES: Course[] = [
  {
    id: "crs_01",
    title: "IELTS Intensive 7.5+ Masterclass",
    description: "Khóa học luyện thi 4 kỹ năng chuyên sâu với hệ thống AI chấm bài trực tiếp.",
    level: "Advanced",
    price: 2490000,
    thumbnail: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop",
    skillsCovered: ["Reading", "Listening", "Writing", "Speaking"],
  },
  {
    id: "crs_02",
    title: "English Academic Writing & Speaking Booster",
    description: "Tập trung nâng cao tư duy phản biện, từ vựng C1/C2 và phản xạ bài nói tự nhiên.",
    level: "Intermediate",
    price: 1890000,
    thumbnail: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop",
    skillsCovered: ["Writing", "Speaking"],
  },
  {
    id: "crs_03",
    title: "General English 4 Skills for Working Professionals",
    description: "Chương trình ứng dụng Tiếng Anh trong công sở và giao tiếp quốc tế.",
    level: "Beginner",
    price: 1290000,
    thumbnail: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop",
    skillsCovered: ["Reading", "Listening", "Writing", "Speaking"],
  },
];

export const INITIAL_TESTS: ExamTest[] = [
  {
    id: "test_01",
    title: "Đề Thi Thử IELTS Mock Test Standard #01",
    durationMinutes: 60,
    skills: ["Reading", "Listening", "Writing", "Speaking"],
    readingPassage: `THE RISE OF ARTIFICIAL INTELLIGENCE IN LANGUAGE EDUCATION
Artificial Intelligence (AI) is fundamentally transforming the landscape of language pedagogy. Traditional classroom instruction often faces the challenge of providing individual feedback to large cohorts of students. However, modern Machine Learning models and Natural Language Processing (NLP) engines now allow for instant, hyper-personalized evaluations of complex student performances.

In the domain of writing, Large Language Models (LLMs) evaluate not only superficial grammatical correctness, but also semantic coherence, lexical diversity, and task fulfillment. Similarly, Speech-to-Text models enable automated assessment of oral fluency, pronunciation precision, and acoustic pauses. Consequently, educators are shifting from manual grading to strategic coaching, using AI analytics to identify student weaknesses in real time.`,
    readingQuestions: [
      {
        id: "rq_1",
        question: "What is the main challenge faced by traditional classroom instruction according to paragraph 1?",
        options: [
          "A. Lack of qualified English teachers.",
          "B. Difficulty in offering individual feedback to large classes.",
          "C. High cost of printed textbooks.",
          "D. Resistance to technology from students."
        ],
        correctAnswer: "B"
      },
      {
        id: "rq_2",
        question: "According to the passage, how does Speech-to-Text technology assist language learning?",
        options: [
          "A. By writing essays automatically for students.",
          "B. By translating lessons into native languages.",
          "C. By evaluating oral fluency, pronunciation, and pauses.",
          "D. By replacing human examiners completely."
        ],
        correctAnswer: "C"
      }
    ],
    listeningAudioUrl: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=english-conversation-sample.mp3",
    listeningQuestions: [
      {
        id: "lq_1",
        question: "What is the primary topic of the recorded discussion?",
        options: [
          "A. Preparing for university entrance examinations.",
          "B. Selecting an online language certification course.",
          "C. Booking a international flight ticket.",
          "D. Interviewing for a software engineering role."
        ],
        correctAnswer: "B"
      }
    ],
    writingPrompt: "Some people believe that studying online is more effective than traditional classroom learning. To what extent do you agree or disagree? Give reasons for your answer and include any relevant examples from your knowledge or experience.",
    speakingPrompt: "Describe an educational technology tool that has helped you improve your skills. You should say: what the tool is, how you discovered it, what features you use most often, and explain why it was beneficial to your learning."
  }
];

export const INITIAL_CLASSES: UserClass[] = [
  {
    id: "cls_101",
    name: "IELTS Master 7.5 - K24",
    code: "IELTS75K24",
    teacherName: "Thầy Nguyễn Văn Đức (M.A TESOL)",
    studentCount: 28,
    schedule: "Thứ 2 - Thứ 4 - Thứ 6 (19:30 - 21:30)",
  },
  {
    id: "cls_102",
    name: "Academic Writing & Speaking Special",
    code: "WRSPEAK2026",
    teacherName: "Cô Lê Minh Anh (8.5 IELTS)",
    studentCount: 22,
    schedule: "Thứ 3 - Thứ 5 (18:00 - 20:00)",
  },
];

export const INITIAL_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "ORD-98210",
    studentName: "Trần Hoàng Nam",
    studentEmail: "namtran.tech@gmail.com",
    courseTitle: "IELTS Intensive 7.5+ Masterclass",
    amount: 2490000,
    transferCode: "EDTECH98210",
    status: "PENDING",
    createdAt: "2026-07-18 20:15",
  },
  {
    id: "ORD-98205",
    studentName: "Phạm Mỹ Duyên",
    studentEmail: "myduyen.english@gmail.com",
    courseTitle: "English Academic Writing & Speaking Booster",
    amount: 1890000,
    transferCode: "EDTECH98205",
    status: "APPROVED",
    createdAt: "2026-07-17 14:30",
  },
];

export const INITIAL_SLOT_REQUESTS: AccountSlotRequest[] = [
  {
    id: "SLOT-501",
    teacherName: "Thầy Nguyễn Văn Đức",
    teacherEmail: "duc.teacher@edtech.edu.vn",
    requestedSlots: 50,
    totalCost: 5000000,
    status: "PENDING",
    createdAt: "2026-07-18 19:00",
  },
];
