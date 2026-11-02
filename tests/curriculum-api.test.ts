// TASK-006 — API lộ trình khóa học /api/teacher/curriculum (GET/POST/PUT/DELETE) trên pg.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
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
  getPgPool: () => ({
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => h.pg!.queryPg(sql, params),
      release: () => {},
    }),
  }),
  ensureSchema: async () => {},
}));

import { signJwtToken } from "@/lib/jwt";

type Role = "ADMIN" | "TEACHER" | "STUDENT";
async function loginAs(role: Role | null, userId?: string) {
  h.token = role ? await signJwtToken({ userId: userId!, email: `${userId}@x.vn`, role }) : undefined;
}
const req = (method: string, url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const api = () => import("@/app/api/teacher/curriculum/route");
const rows = async (sql: string) => (await h.pg!.db.query<any>(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.pg = await createFakePg();
  await h.pg.db.exec(`
    CREATE TABLE courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), description TEXT, created_by VARCHAR(50), created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE curriculum_items (
      id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50) NOT NULL, parent_id VARCHAR(50), title VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL, exam_id VARCHAR(50), order_index INT DEFAULT 0, created_by VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, lesson_id VARCHAR(50)
    );
    CREATE TABLE lessons (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255) NOT NULL, description TEXT, skills TEXT[] NOT NULL DEFAULT '{}',
      question_ids JSONB NOT NULL DEFAULT '[]', created_by VARCHAR(50) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
    INSERT INTO lessons (id,title,question_ids,created_by) VALUES ('lsn_t1','Bài của t1','["q1"]','t1');
    INSERT INTO courses (id,title,created_by) VALUES ('co1','Khóa t1','t1'), ('co2','Khóa t2','t2'), ('coSys','Khóa chung',NULL);
    INSERT INTO exams (id,title) VALUES ('e1','Đề Một');
    INSERT INTO curriculum_items (id,course_id,parent_id,title,type,exam_id,order_index,created_by) VALUES
      ('U1','co1',NULL,'Unit 1','UNIT',NULL,1,'t1'),
      ('U2','co1',NULL,'Unit 2','UNIT',NULL,2,'t1'),
      ('L1','co1','U1','Bài 1','LESSON',NULL,1,'t1'),
      ('L2','co1','U1','Bài 2','LESSON',NULL,2,'t1'),
      ('X1','co2',NULL,'Unit t2','UNIT',NULL,1,'t2');
  `);
});

describe("Phân quyền chung", () => {
  it("chưa đăng nhập → 401; STUDENT → 403 cho mọi method", async () => {
    const { GET, POST, PUT, DELETE } = await api();
    for (const role of [null, "STUDENT"] as const) {
      await loginAs(role, "s1");
      const expected = role ? 403 : 401;
      expect((await GET(req("GET", "/api/teacher/curriculum?courseId=co1"))).status).toBe(expected);
      expect((await POST(req("POST", "/api/teacher/curriculum", { course_id: "co1", title: "x", type: "UNIT" }))).status).toBe(expected);
      expect((await PUT(req("PUT", "/api/teacher/curriculum", { items: [{ id: "L1", title: "y" }] }))).status).toBe(expected);
      expect((await DELETE(req("DELETE", "/api/teacher/curriculum?id=L1"))).status).toBe(expected);
    }
    expect((await rows(`SELECT COUNT(*)::int n FROM curriculum_items`))[0].n).toBe(5);
  });
});

describe("GET /api/teacher/curriculum?courseId=", () => {
  it("thiếu courseId → 400 (không còn mặc định crs_01); khóa không tồn tại → 404", async () => {
    const { GET } = await api();
    await loginAs("TEACHER", "t1");
    expect((await GET(req("GET", "/api/teacher/curriculum"))).status).toBe(400);
    expect((await GET(req("GET", "/api/teacher/curriculum?courseId=coX"))).status).toBe(404);
  });

  it("TEACHER xem khóa của mình → đủ mục, sắp theo order_index", async () => {
    const { GET } = await api();
    await loginAs("TEACHER", "t1");
    const json = await (await GET(req("GET", "/api/teacher/curriculum?courseId=co1"))).json();
    expect(json.success).toBe(true);
    expect(json.items.map((i: any) => i.id)).toEqual(expect.arrayContaining(["U1", "U2", "L1", "L2"]));
    expect(json.items).toHaveLength(4);
    expect(json.items.find((i: any) => i.id === "L1")).toMatchObject({ course_id: "co1", parent_id: "U1", type: "LESSON", order_index: 1 });
  });

  it("TEACHER xem khóa của giáo viên khác → 403; khóa chung (created_by NULL) → 200", async () => {
    const { GET } = await api();
    await loginAs("TEACHER", "t1");
    expect((await GET(req("GET", "/api/teacher/curriculum?courseId=co2"))).status).toBe(403);
    expect((await GET(req("GET", "/api/teacher/curriculum?courseId=coSys"))).status).toBe(200);
  });

  it("ADMIN xem mọi khóa", async () => {
    const { GET } = await api();
    await loginAs("ADMIN", "a1");
    expect((await GET(req("GET", "/api/teacher/curriculum?courseId=co2"))).status).toBe(200);
  });
});

describe("POST — tạo mục, trả về đầy đủ mục vừa tạo", () => {
  const post = async (body: unknown) => (await api()).POST(req("POST", "/api/teacher/curriculum", body));

  it("tạo bài học trong unit: 201, trả item đủ trường, order_index = cuối nhóm anh em", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ course_id: "co1", parent_id: "U1", title: "  Bài 3 ", type: "LESSON", lesson_id: "lsn_t1" });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.item).toMatchObject({ course_id: "co1", parent_id: "U1", title: "Bài 3", type: "LESSON", order_index: 3, exam_id: null });
    expect(typeof json.item.id).toBe("string");
    const db = await rows(`SELECT * FROM curriculum_items WHERE id = '${json.item.id}'`);
    expect(db[0]).toMatchObject({ course_id: "co1", parent_id: "U1", created_by: "t1" });
  });

  it("tạo unit mới ở gốc: order_index = số unit + 1", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await post({ course_id: "co1", parent_id: null, title: "Unit 3", type: "UNIT" })).json();
    expect(json.item).toMatchObject({ parent_id: null, type: "UNIT", order_index: 3 });
  });

  it("tạo đề thi gắn exam_id có thật", async () => {
    await loginAs("TEACHER", "t1");
    const res = await post({ course_id: "co1", parent_id: "U2", title: "Kiểm tra", type: "EXAM", exam_id: "e1" });
    expect(res.status).toBe(201);
    expect((await res.json()).item).toMatchObject({ type: "EXAM", exam_id: "e1", order_index: 1 });
  });

  it("id sinh ra không trùng khi tạo liên tiếp", async () => {
    await loginAs("TEACHER", "t1");
    const a = await (await post({ course_id: "co1", parent_id: "U1", title: "A", type: "LESSON", lesson_id: "lsn_t1" })).json();
    const b = await (await post({ course_id: "co1", parent_id: "U1", title: "B", type: "LESSON", lesson_id: "lsn_t1" })).json();
    expect(a.item.id).not.toBe(b.item.id);
  });

  it("dữ liệu sai → 400 và không ghi DB", async () => {
    await loginAs("TEACHER", "t1");
    const bad = [
      { course_id: "co1", parent_id: "U1", title: "  ", type: "LESSON", lesson_id: "lsn_t1" },          // thiếu tiêu đề
      { course_id: "co1", parent_id: "U1", title: "x", type: "QUIZ" },             // loại không hợp lệ
      { course_id: "co1", parent_id: "U1", title: "x", type: "UNIT" },             // unit không được có cha
      { course_id: "co1", parent_id: "L1", title: "x", type: "LESSON", lesson_id: "lsn_t1" },           // cha không phải UNIT
      { course_id: "co1", parent_id: "X1", title: "x", type: "LESSON", lesson_id: "lsn_t1" },           // cha thuộc khóa khác
      { course_id: "co1", parent_id: "U1", title: "x", type: "EXAM" },             // EXAM thiếu exam_id
      { course_id: "co1", parent_id: "U1", title: "x", type: "EXAM", exam_id: "eX" }, // đề không tồn tại
      { parent_id: null, title: "x", type: "UNIT" },                               // thiếu course_id
    ];
    for (const body of bad) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect((await rows(`SELECT COUNT(*)::int n FROM curriculum_items`))[0].n).toBe(5);
  });

  it("TEACHER thêm vào khóa của người khác hoặc khóa chung → 403; khóa không tồn tại → 404", async () => {
    await loginAs("TEACHER", "t1");
    expect((await post({ course_id: "co2", parent_id: null, title: "x", type: "UNIT" })).status).toBe(403);
    expect((await post({ course_id: "coSys", parent_id: null, title: "x", type: "UNIT" })).status).toBe(403);
    expect((await post({ course_id: "coX", parent_id: null, title: "x", type: "UNIT" })).status).toBe(404);
  });

  it("ADMIN thêm được vào mọi khóa", async () => {
    await loginAs("ADMIN", "a1");
    expect((await post({ course_id: "co2", parent_id: null, title: "x", type: "UNIT" })).status).toBe(201);
  });
});

describe("PUT — sửa tên / đổi thứ tự hàng loạt (giao dịch)", () => {
  const put = async (body: unknown) => (await api()).PUT(req("PUT", "/api/teacher/curriculum", body));

  it("sửa tiêu đề một mục → 200, trả items đã cập nhật, lưu DB", async () => {
    await loginAs("TEACHER", "t1");
    const res = await put({ items: [{ id: "L1", title: "Bài 1 (mới)" }] });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items[0]).toMatchObject({ id: "L1", title: "Bài 1 (mới)", parent_id: "U1", order_index: 1 });
    expect((await rows(`SELECT title FROM curriculum_items WHERE id='L1'`))[0].title).toBe("Bài 1 (mới)");
  });

  it("đổi thứ tự + chuyển unit hàng loạt → lưu đúng parent_id và order_index", async () => {
    await loginAs("TEACHER", "t1");
    const res = await put({
      items: [
        { id: "L2", parent_id: "U1", order_index: 1 },
        { id: "L1", parent_id: "U2", order_index: 1 },
      ],
    });
    expect(res.status).toBe(200);
    const db = await rows(`SELECT id, parent_id, order_index FROM curriculum_items WHERE id IN ('L1','L2') ORDER BY id`);
    expect(db).toEqual([
      { id: "L1", parent_id: "U2", order_index: 1 },
      { id: "L2", parent_id: "U1", order_index: 1 },
    ]);
  });

  it("chỉ cập nhật trường được gửi (không xoá exam_id/tiêu đề khi chỉ đổi thứ tự)", async () => {
    await h.pg!.db.exec(`UPDATE curriculum_items SET type='EXAM', exam_id='e1' WHERE id='L2'`);
    await loginAs("TEACHER", "t1");
    await put({ items: [{ id: "L2", order_index: 5 }] });
    expect((await rows(`SELECT title, exam_id, order_index FROM curriculum_items WHERE id='L2'`))[0]).toEqual({ title: "Bài 2", exam_id: "e1", order_index: 5 });
  });

  it("một mục không hợp lệ → cả lô không được ghi (giao dịch)", async () => {
    await loginAs("TEACHER", "t1");
    const res = await put({ items: [{ id: "L1", order_index: 9 }, { id: "L2", parent_id: "L1" }] }); // cha không phải UNIT
    expect(res.status).toBe(400);
    expect((await rows(`SELECT order_index FROM curriculum_items WHERE id='L1'`))[0].order_index).toBe(1);
  });

  it("id không tồn tại → 404; mục của khóa người khác → 403; trộn mục 2 khóa → 400", async () => {
    await loginAs("TEACHER", "t1");
    expect((await put({ items: [{ id: "NOPE", title: "x" }] })).status).toBe(404);
    expect((await put({ items: [{ id: "X1", title: "x" }] })).status).toBe(403);
    await loginAs("ADMIN", "a1");
    expect((await put({ items: [{ id: "L1", order_index: 1 }, { id: "X1", order_index: 1 }] })).status).toBe(400);
  });

  it("items rỗng / thiếu → 400; tiêu đề rỗng → 400; unit không được gán cha", async () => {
    await loginAs("TEACHER", "t1");
    expect((await put({ items: [] })).status).toBe(400);
    expect((await put({})).status).toBe(400);
    expect((await put({ items: [{ id: "L1", title: "  " }] })).status).toBe(400);
    expect((await put({ items: [{ id: "U2", parent_id: "U1" }] })).status).toBe(400);
  });
});

describe("DELETE ?id=", () => {
  const del = async (id: string) => (await api()).DELETE(req("DELETE", `/api/teacher/curriculum?id=${id}`));

  it("xoá bài học → 200 { deletedIds }", async () => {
    await loginAs("TEACHER", "t1");
    const res = await del("L2");
    expect(res.status).toBe(200);
    expect((await res.json()).deletedIds).toEqual(["L2"]);
    expect(await rows(`SELECT id FROM curriculum_items WHERE id='L2'`)).toEqual([]);
  });

  it("xoá unit → xoá luôn các mục con, trả đủ id đã xoá", async () => {
    await loginAs("TEACHER", "t1");
    const json = await (await del("U1")).json();
    expect(json.deletedIds.sort()).toEqual(["L1", "L2", "U1"]);
    expect((await rows(`SELECT COUNT(*)::int n FROM curriculum_items WHERE course_id='co1'`))[0].n).toBe(1);
  });

  it("không tồn tại → 404; mục thuộc khóa người khác → 403", async () => {
    await loginAs("TEACHER", "t1");
    expect((await del("NOPE")).status).toBe(404);
    expect((await del("X1")).status).toBe(403);
    expect(await rows(`SELECT id FROM curriculum_items WHERE id='X1'`)).toHaveLength(1);
  });
});

describe("Trang lộ trình không tải lại cả cây sau thao tác", () => {
  const src = () => fs.readFileSync("app/teacher/tests/page.tsx", "utf8");

  it("dùng logic kéo thả từ lib/curriculum-dnd", () => {
    expect(src()).toContain("@/lib/curriculum-dnd");
    expect(src()).toMatch(/isNoopGap/);
    expect(src()).toMatch(/computeDrop/);
  });

  it("fetchCurriculum chỉ được gọi khi nạp/đổi khóa học (tối đa 1 lời gọi)", () => {
    const calls = src().match(/fetchCurriculum\(/g) || [];
    expect(calls.length).toBeLessThanOrEqual(1);
  });

  it("không mặc định khóa cố định crs_01; nhớ khóa đang chọn", () => {
    const s = src();
    expect(s).not.toContain("crs_01");
    expect(s).toMatch(/localStorage\.setItem\(SELECTED_COURSE_KEY/);
  });

  it("kéo bài tập chưa có lộ trình vào cây: chỉ nhận khi thả trong vùng cây, dời về đúng khe bằng computeDrop", () => {
    const s = src();
    expect(s).toContain("data-curriculum-tree");
    expect(s).toMatch(/onPointerDown=\{\(e\) => handleStartExamDrag\(e, ex\)\}/);
    expect(s).toMatch(/computeDrop\(withNew, newItem\.id, parentId, gapIndex\)/);
    expect(s).toMatch(/lg:sticky/);
  });

  it("gửi đúng tên trường snake_case khớp API (course_id, parent_id, exam_id)", () => {
    const s = src();
    expect(s).toMatch(/course_id:/);
    expect(s).toMatch(/parent_id:/);
    expect(s).not.toMatch(/courseId:\s*selectedCourseId/);
  });
});
