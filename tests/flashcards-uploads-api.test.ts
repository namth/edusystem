// TASK-015 — API thư viện flashcard + API upload file qua server; gỡ Supabase phía trình duyệt cho flashcard/upload.
// File do trưởng phòng viết, bị khoá.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createFakePg } from "./helpers/pg-fake";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return {
    token: undefined as string | undefined,
    pg: null as null | Awaited<ReturnType<typeof import("./helpers/pg-fake").createFakePg>>,
    uploads: [] as { bucket: string; path: string; size: number; contentType?: string }[],
    uploadError: null as null | string,
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
vi.mock("@/lib/supabase-server", () => ({
  createClient: () => { throw new Error("dùng getServerSupabaseClient (service role)"); },
  getServerSupabaseClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: any, opts: any) => {
          if (h.uploadError) return { data: null, error: { message: h.uploadError } };
          const size = body?.byteLength ?? body?.size ?? body?.length ?? 0;
          h.uploads.push({ bucket, path, size, contentType: opts?.contentType });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
      }),
    },
  }),
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
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const rows = async (sql: string) => (await h.pg!.db.query<any>(sql)).rows;

beforeEach(async () => {
  h.token = undefined;
  h.uploads.length = 0;
  h.uploadError = null;
  h.pg = await createFakePg(["db-migration-008-flashcard-owner.sql"]);
  await h.pg.db.exec(`
    INSERT INTO flashcards (id,vietnamese_name,correct_english_word,options,image_url,created_by) VALUES
      ('f1','quả táo','apple','["apple","pear"]','a.png','t1'),
      ('f2','con cá','fish','["fish"]',NULL,'t2'),
      ('fOld','cũ','old','[]',NULL,NULL);
    INSERT INTO questions (id,skill,category,prompt,content) VALUES
      ('qF','Reading','READING_FLASHCARD_SET','Thẻ','{"flashcard_ids":["f1"]}');
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
describe("/api/teacher/flashcards", () => {
  const api = () => import("@/app/api/teacher/flashcards/route");
  const idApi = () => import("@/app/api/teacher/flashcards/[id]/route");

  it("chưa đăng nhập 401; STUDENT 403", async () => {
    const { GET } = await api();
    expect((await GET(req("GET", "/x"))).status).toBe(401);
    await loginAs("STUDENT", "s1");
    expect((await GET(req("GET", "/x"))).status).toBe(403);
  });

  it("GET: mọi giáo viên thấy cả thư viện (dùng chung), có tìm theo từ/nghĩa, có cờ can_edit", async () => {
    await loginAs("TEACHER", "t1");
    const { GET } = await api();
    const all = (await (await GET(req("GET", "/x"))).json()).flashcards;
    expect(all.map((f: any) => f.id).sort()).toEqual(["f1", "f2", "fOld"]);
    expect(all.find((f: any) => f.id === "f1")).toMatchObject({ correct_english_word: "apple", can_edit: true });
    expect(all.find((f: any) => f.id === "f2").can_edit).toBe(false);
    expect(all.find((f: any) => f.id === "fOld").can_edit).toBe(true);
    const found = (await (await GET(req("GET", "/x?q=T%C3%81O"))).json()).flashcards;
    expect(found.map((f: any) => f.id)).toEqual(["f1"]);
  });

  it("POST: 201, id 'fc_' + uuid, created_by, trim; thiếu từ/nghĩa → 400; options tự thêm từ đúng nếu thiếu", async () => {
    await loginAs("TEACHER", "t1");
    const { POST } = await api();
    const res = await POST(req("POST", "/x", { vietnamese_name: " con chó ", correct_english_word: " dog ", options: ["cat"] }));
    expect(res.status).toBe(201);
    const { flashcard } = await res.json();
    expect(flashcard.id).toMatch(/^fc_[0-9a-f-]{36}$/);
    expect(flashcard).toMatchObject({ vietnamese_name: "con chó", correct_english_word: "dog", created_by: "t1", image_url: null });
    expect(flashcard.options).toEqual(expect.arrayContaining(["cat", "dog"]));
    expect((await POST(req("POST", "/x", { vietnamese_name: "", correct_english_word: "x" }))).status).toBe(400);
    expect((await POST(req("POST", "/x", { vietnamese_name: "x", correct_english_word: " " }))).status).toBe(400);
  });

  it("PUT: thẻ của mình hoặc thẻ chung (NULL) → 200; thẻ của GV khác → 403; không có → 404; ADMIN sửa mọi thẻ", async () => {
    await loginAs("TEACHER", "t1");
    const { PUT } = await idApi();
    expect((await PUT(req("PUT", "/x", { correct_english_word: "apples" }), ctx("f1"))).status).toBe(200);
    expect((await rows(`SELECT correct_english_word FROM flashcards WHERE id='f1'`))[0].correct_english_word).toBe("apples");
    expect((await PUT(req("PUT", "/x", { vietnamese_name: "cũ 2" }), ctx("fOld"))).status).toBe(200);
    expect((await PUT(req("PUT", "/x", { vietnamese_name: "x" }), ctx("f2"))).status).toBe(403);
    expect((await PUT(req("PUT", "/x", { vietnamese_name: "x" }), ctx("fX"))).status).toBe(404);
    await loginAs("ADMIN", "a1");
    expect((await PUT(req("PUT", "/x", { vietnamese_name: "admin" }), ctx("f2"))).status).toBe(200);
  });

  it("DELETE: thẻ đang được câu hỏi dùng → 409 kèm question_ids; thẻ không dùng → 200; GV khác → 403", async () => {
    await loginAs("TEACHER", "t1");
    const { DELETE } = await idApi();
    const res = await DELETE(req("DELETE", "/x"), ctx("f1"));
    expect(res.status).toBe(409);
    expect((await res.json()).question_ids).toEqual(["qF"]);
    expect((await DELETE(req("DELETE", "/x"), ctx("f2"))).status).toBe(403);
    expect((await DELETE(req("DELETE", "/x"), ctx("fOld"))).status).toBe(200);
    expect(await rows(`SELECT id FROM flashcards WHERE id='fOld'`)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/uploads — upload qua server (service role)", () => {
  const post = async (fd: FormData) =>
    (await import("@/app/api/uploads/route")).POST(new Request("http://localhost/api/uploads", { method: "POST", body: fd }));
  const form = (kind: string, file?: File) => {
    const fd = new FormData();
    fd.append("kind", kind);
    if (file) fd.append("file", file);
    return fd;
  };
  const audio = (size = 100, name = "a.webm", type = "audio/webm") => new File([new Uint8Array(size)], name, { type });
  const image = (size = 100, name = "x.png", type = "image/png") => new File([new Uint8Array(size)], name, { type });

  it("chưa đăng nhập → 401", async () => {
    expect((await post(form("audio", audio()))).status).toBe(401);
  });

  it("GV upload audio → bucket audio-assets, trả url công khai; ảnh → flashcard-assets", async () => {
    await loginAs("TEACHER", "t1");
    const r1 = await post(form("audio", audio()));
    expect(r1.status).toBe(201);
    const j1 = await r1.json();
    expect(j1.url).toMatch(/^https:\/\/cdn\.test\/audio-assets\//);
    const r2 = await post(form("image", image()));
    expect((await r2.json()).url).toMatch(/^https:\/\/cdn\.test\/flashcard-assets\//);
    expect(h.uploads.map((u) => u.bucket)).toEqual(["audio-assets", "flashcard-assets"]);
    expect(h.uploads[0].path).not.toContain("..");
  });

  it("HS chỉ được upload loại speaking (bucket speaking-recordings); loại khác → 403", async () => {
    await loginAs("STUDENT", "s1");
    const r = await post(form("speaking", audio()));
    expect(r.status).toBe(201);
    expect(h.uploads[0].bucket).toBe("speaking-recordings");
    expect((await post(form("audio", audio()))).status).toBe(403);
    expect((await post(form("image", image()))).status).toBe(403);
  });

  it("sai loại file / quá dung lượng / thiếu file / kind lạ → 400, không upload", async () => {
    await loginAs("TEACHER", "t1");
    expect((await post(form("audio", image()))).status).toBe(400);
    expect((await post(form("image", new File(["x"], "x.exe", { type: "application/octet-stream" })))).status).toBe(400);
    expect((await post(form("image", image(5 * 1024 * 1024 + 1)))).status).toBe(400);
    expect((await post(form("audio", audio(15 * 1024 * 1024 + 1)))).status).toBe(400);
    expect((await post(form("audio"))).status).toBe(400);
    expect((await post(form("video", audio()))).status).toBe(400);
    expect(h.uploads).toEqual([]);
  });

  it("lỗi Storage → 502", async () => {
    h.uploadError = "bucket not found";
    vi.spyOn(console, "error").mockImplementation(() => {});
    await loginAs("TEACHER", "t1");
    expect((await post(form("audio", audio()))).status).toBe(502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Gỡ Supabase phía trình duyệt cho flashcard/upload", () => {
  const read = (p: string) => fs.readFileSync(p, "utf8");
  for (const file of ["app/teacher/flashcards/page.tsx", "components/question-builder/QuestionSetEditor.tsx", "lib/audio-storage.ts"]) {
    it(file, () => {
      const s = read(file);
      expect(s).not.toContain('"@/lib/supabase"');
      expect(s).not.toContain("supabase.");
    });
  }
  it("trang flashcard và QuestionSetEditor dùng /api/teacher/flashcards và /api/uploads", () => {
    for (const file of ["app/teacher/flashcards/page.tsx", "components/question-builder/QuestionSetEditor.tsx"]) {
      expect(read(file), file).toContain("/api/teacher/flashcards");
      expect(read(file), file).toContain("/api/uploads");
    }
    expect(read("lib/audio-storage.ts")).toContain("/api/uploads");
  });
  it("không còn ảnh mặc định viết cứng từ Unsplash cho flashcard", () => {
    expect(read("app/teacher/flashcards/page.tsx")).not.toContain("images.unsplash.com");
  });
  it("QuestionSetEditor: sau khi POST câu hỏi mới, cập nhật id cục bộ để lần lưu sau dùng PUT (không tạo trùng)", () => {
    const s = read("components/question-builder/QuestionSetEditor.tsx");
    expect(s).toMatch(/savedIdByLocalId|idMap|setQuestions\(\s*\(?prev/);
  });
});
