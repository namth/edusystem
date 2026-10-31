// TASK-005 — Luồng làm bài / xem lại bài / tham gia lớp qua link trên API pg.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (n === "auth_token" && h.token ? { value: h.token } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
  ensureSchema: async () => {},
}));
const forbidSupabase = () =>
  new Proxy({}, { get() { throw new Error("Route không được dùng Supabase client — dùng queryPg"); } });
vi.mock("@/lib/supabase", () => ({ supabase: forbidSupabase() }));
vi.mock("@/lib/supabase-server", () => ({ createClient: forbidSupabase, getServerSupabaseClient: forbidSupabase }));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (url: string) => new Request(`http://localhost${url}`);
const ctx = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg(["db-migration-004-enrollments-assignments.sql"]);
  await h.pg.db.exec(`
    INSERT INTO users (id,name,email,role) VALUES
      ('s1','HS Một','s1@x.vn','STUDENT'), ('s2','HS Hai','s2@x.vn','STUDENT'),
      ('t1','Cô Lan','t1@x.vn','TEACHER'), ('a1','Admin','a1@x.vn','ADMIN');
    INSERT INTO classes (id,name,code,teacher_id,max_slots,schedule) VALUES
      ('c1','Lớp IELTS A','ABC123','t1',30,'T2-T4'), ('c2','Lớp B','XYZ999','t1',10,NULL);
    INSERT INTO enrollments (id,student_id,class_id) VALUES ('en1','s1','c1'), ('en2','s2','c1');
    INSERT INTO questions (id,skill,category,prompt,content) VALUES
      ('q1','Reading','READING_MC','Câu 1','{"options":["A","B"],"correctAnswer":"A"}'),
      ('q2','Listening','LISTENING_MC','Câu 2','{"options":["C","D"]}'),
      ('q3','Reading','READING_FLASHCARD_SET','Thẻ','{"flashcard_ids":["f1","f2"]}'),
      ('q4','Writing','WRITING_TASK','Câu lạc','{}');
    INSERT INTO flashcards (id,vietnamese_name,correct_english_word,options) VALUES
      ('f1','con mèo','cat','["cat","dog"]'), ('f2','con chó','dog','["dog","cow"]'), ('f9','khác','other','[]');
    INSERT INTO exams (id,title,duration_minutes,skills,question_ids,created_by) VALUES
      ('e1','Đề Một',60,ARRAY['Reading'],'["q3","q1","q2","qMissing"]','t1'),
      ('e2','Đề Rỗng',30,ARRAY['Writing'],NULL,'t1');
    INSERT INTO submissions (id,exam_id,student_id,answers,final_score,status) VALUES
      ('sub1','e1','s1','{"q1":"A"}',6.5,'AI_GRADED'), ('sub2','e1','s2','{}',5.0,'AI_GRADED'),
      ('sub3','eGone','s1','{}',NULL,'PENDING_GRADING');
  `);
});

describe("GET /api/exams/[id]/content — đề + câu hỏi + flashcard", () => {
  const get = async (id: string) => {
    const { GET } = await import("@/app/api/exams/[id]/content/route");
    return GET(req(`/api/exams/${id}/content`), ctx({ id }));
  };

  it("chưa đăng nhập → 401; không có đề → 404", async () => {
    expect((await get("e1")).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await get("eX")).status).toBe(404);
  });

  it("câu hỏi theo đúng thứ tự question_ids, bỏ qua id không tồn tại", async () => {
    await loginAs("STUDENT", "s1");
    const json = await (await get("e1")).json();
    expect(json.success).toBe(true);
    expect(json.exam).toMatchObject({ id: "e1", title: "Đề Một", duration_minutes: 60 });
    expect(json.questions.map((q: any) => q.id)).toEqual(["q3", "q1", "q2"]);
    expect(json.questions[1]).toMatchObject({ skill: "Reading", category: "READING_MC", prompt: "Câu 1" });
  });

  it("không có question_ids → questions rỗng (không trả toàn bộ ngân hàng câu hỏi)", async () => {
    await loginAs("STUDENT", "s1");
    const json = await (await get("e2")).json();
    expect(json.questions).toEqual([]);
    expect(json.flashcards).toEqual([]);
  });

  it("flashcards: chỉ các thẻ được câu hỏi FLASHCARD tham chiếu", async () => {
    await loginAs("STUDENT", "s1");
    const json = await (await get("e1")).json();
    expect(json.flashcards.map((f: any) => f.id).sort()).toEqual(["f1", "f2"]);
  });
});

describe("GET /api/submissions/[id] — xem lại một bài nộp", () => {
  const get = async (id: string) => {
    const { GET } = await import("@/app/api/submissions/[id]/route");
    return GET(req(`/api/submissions/${id}`), ctx({ id }));
  };

  it("chưa đăng nhập → 401; không có bài → 404", async () => {
    expect((await get("sub1")).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await get("subX")).status).toBe(404);
  });

  it("STUDENT xem bài của người khác → 403", async () => {
    await loginAs("STUDENT", "s2");
    expect((await get("sub1")).status).toBe(403);
  });

  it("STUDENT xem bài của mình → bài nộp + đề + câu hỏi theo thứ tự", async () => {
    await loginAs("STUDENT", "s1");
    const res = await get("sub1");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.submission).toMatchObject({ id: "sub1", exam_id: "e1", student_id: "s1" });
    expect(json.exam).toMatchObject({ id: "e1" });
    expect(json.questions.map((q: any) => q.id)).toEqual(["q3", "q1", "q2"]);
  });

  it("đề đã bị xoá → exam null, questions rỗng, vẫn 200", async () => {
    await loginAs("STUDENT", "s1");
    const json = await (await get("sub3")).json();
    expect(json.exam).toBeNull();
    expect(json.questions).toEqual([]);
  });

  it("TEACHER và ADMIN xem được", async () => {
    await loginAs("TEACHER", "t1");
    expect((await get("sub2")).status).toBe(200);
    await loginAs("ADMIN", "a1");
    expect((await get("sub2")).status).toBe(200);
  });
});

describe("GET /api/classes/lookup/[ref] — xem trước lớp qua link mời (công khai)", () => {
  const get = async (ref: string) => {
    const { GET } = await import("@/app/api/classes/lookup/[ref]/route");
    return GET(req(`/api/classes/lookup/${ref}`), ctx({ ref }));
  };

  it("không cần đăng nhập; tra theo id", async () => {
    const res = await get("c1");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.class).toMatchObject({
      id: "c1", name: "Lớp IELTS A", code: "ABC123", schedule: "T2-T4", max_slots: 30,
      teacher_name: "Cô Lan", enrolled_count: 2, is_enrolled: false,
    });
  });

  it("tra theo mã lớp, không phân biệt hoa thường", async () => {
    const json = await (await get("xyz999")).json();
    expect(json.class).toMatchObject({ id: "c2", enrolled_count: 0 });
  });

  it("không tìm thấy → 404 (không trả lớp khác thay thế)", async () => {
    const res = await get("NOPE");
    expect(res.status).toBe(404);
    expect((await res.json()).success).toBe(false);
  });

  it("chỉ trả các trường công khai (không lộ teacher_id, email…)", async () => {
    const json = await (await get("c1")).json();
    expect(Object.keys(json.class).sort()).toEqual(
      ["code", "enrolled_count", "id", "is_enrolled", "max_slots", "name", "schedule", "teacher_name"]
    );
  });

  it("STUDENT đã ghi danh → is_enrolled true; học sinh khác → false", async () => {
    await loginAs("STUDENT", "s1");
    expect((await (await get("c1")).json()).class.is_enrolled).toBe(true);
    await loginAs("STUDENT", "s1");
    expect((await (await get("c2")).json()).class.is_enrolled).toBe(false);
  });

  it("chuỗi ref độc hại không gây lỗi SQL", async () => {
    const res = await get("c1' OR '1'='1");
    expect(res.status).toBe(404);
  });
});

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

const PAGES: Record<string, string[]> = {
  "app/student/exam/[examId]/page.tsx": ["/content", "/api/submissions"],
  "app/student/exam/review/[submissionId]/page.tsx": ["/api/submissions/"],
  "app/join/[classId]/page.tsx": ["/api/classes/lookup/", "/api/student/enroll"],
};

describe("Trang làm bài / xem lại / tham gia lớp dùng API pg", () => {
  for (const [file, endpoints] of Object.entries(PAGES)) {
    describe(file, () => {
      const src = () => read(file);
      it("không import Supabase client, Neo4j, mock-data", () => {
        for (const imp of ["@/lib/supabase", "@/lib/neo4j", "@/lib/mock-data", "@/lib/db-pg"]) {
          expect(src(), imp).not.toContain(`"${imp}"`);
        }
        expect(src()).not.toContain("supabase.");
      });
      it("không còn dữ liệu giả / fallback", () => {
        for (const s of ["student_01", "teacher_01", "Thầy Nguyễn Văn Đức", "Fallback to first class"]) {
          expect(src(), s).not.toContain(s);
        }
      });
      it("gọi đúng endpoint", () => {
        for (const ep of endpoints) expect(src(), ep).toContain(ep);
      });
    });
  }

  it("trang làm bài không gửi student_id lên server", () => {
    expect(read("app/student/exam/[examId]/page.tsx")).not.toMatch(/student_id\s*:/);
  });

  it("trang xem lại xử lý 403/404", () => {
    const src = read("app/student/exam/review/[submissionId]/page.tsx");
    expect(src).toMatch(/403/);
    expect(src).toMatch(/404/);
  });

  it("trang tham gia lớp xử lý 409 (lớp đủ chỗ)", () => {
    expect(read("app/join/[classId]/page.tsx")).toMatch(/409/);
  });
});
