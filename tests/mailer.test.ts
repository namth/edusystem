// TASK-048 — Gửi email qua Resend: quên mật khẩu, đơn hàng, thông báo admin
// Hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết, bị khoá (tests.lock).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFakePg } from "./helpers/pg-fake";
import { BRAND } from "@/lib/brand";

const h = vi.hoisted(() => {
  process.env.JWT_SECRET = "test_secret_for_vitest_only_0123456789abcdef";
  return { pg: null as any };
});

vi.mock("@/lib/db-pg", () => ({
  queryPg: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  getPgPool: () => ({
    connect: async () => ({
      query: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
      release: () => {},
    }),
    query: (sql: string, params?: unknown[]) => h.pg.queryPg(sql, params),
  }),
  ensureSchema: async () => {},
}));

// Loaders dynamically import target modules so tests fail clearly when modules are missing
async function loadMailer() {
  // @ts-ignore
  return (await import("@/lib/mailer")) as {
    isMailerConfigured: () => boolean;
    sendEmail: (m: {
      to: string;
      subject: string;
      html: string;
      text: string;
    }) => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
  };
}

async function loadTemplates() {
  // @ts-ignore
  return (await import("@/lib/email-templates")) as {
    resetPasswordEmail: (opts: { name?: string; url: string }) => {
      subject: string;
      html: string;
      text: string;
    };
    notificationEmail: (opts: { title: string; body?: string | null; url?: string | null }) => {
      subject: string;
      html: string;
      text: string;
    };
  };
}

const callForgotPassword = async (email: string) =>
  (await import("@/app/api/auth/forgot-password/route")).POST(
    new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
      body: JSON.stringify({ email }),
    })
  );

const mockFetch = vi.fn();

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(
    new Response(JSON.stringify({ id: "resend_default_ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  vi.stubGlobal("fetch", mockFetch);

  (await import("@/lib/rate-limit")).resetRateLimits();

  h.pg = await createFakePg();
  await h.pg.db.exec(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_is_placeholder BOOLEAN DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS notifications (
      id VARCHAR(60) PRIMARY KEY,
      user_id VARCHAR(50) NOT NULL,
      type VARCHAR(40) NOT NULL,
      title VARCHAR(255) NOT NULL,
      body TEXT,
      link TEXT,
      ref_id VARCHAR(60) NOT NULL,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_user_type_ref ON notifications (user_id, type, ref_id);
  `);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("1. lib/mailer.ts: isMailerConfigured()", () => {
  it("trả false khi thiếu RESEND_API_KEY hoặc MAIL_FROM", async () => {
    const { isMailerConfigured } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");
    expect(isMailerConfigured()).toBe(false);

    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");
    vi.stubEnv("MAIL_FROM", "");
    expect(isMailerConfigured()).toBe(false);

    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");
    expect(isMailerConfigured()).toBe(false);
  });

  it("trả true khi có cả RESEND_API_KEY và MAIL_FROM hợp lệ", async () => {
    const { isMailerConfigured } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "re_test_key_123");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");
    expect(isMailerConfigured()).toBe(true);
  });
});

describe("2. lib/mailer.ts: sendEmail()", () => {
  it("chưa cấu hình: trả { ok: false, skipped: true } và không gọi fetch", async () => {
    const { sendEmail } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("MAIL_FROM", "");

    const res = await sendEmail({
      to: "teacher@example.com",
      subject: "Test unconfigured",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(res).toEqual({ ok: false, skipped: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("bỏ qua email tạm đuôi @kito.io.vn: trả { ok: false, skipped: true } và không gọi fetch", async () => {
    const { sendEmail } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "re_valid_key");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");

    const resLower = await sendEmail({
      to: "student_01@kito.io.vn",
      subject: "Test placeholder",
      html: "<p>Hello</p>",
      text: "Hello",
    });
    expect(resLower).toEqual({ ok: false, skipped: true });

    const resUpper = await sendEmail({
      to: "STUDENT_99@KITO.IO.VN",
      subject: "Test placeholder upper",
      html: "<p>Hello</p>",
      text: "Hello",
    });
    expect(resUpper).toEqual({ ok: false, skipped: true });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("có cấu hình: gọi fetch POST tới api.resend.com/emails kèm Authorization và body chuẩn", async () => {
    const { sendEmail } = await loadMailer();

    const apiKey = "re_live_test_key_xyz";
    const mailFrom = "KitoKit <no-reply@kitokit.edu.vn>";
    vi.stubEnv("RESEND_API_KEY", apiKey);
    vi.stubEnv("MAIL_FROM", mailFrom);

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "msg_success_123" }), { status: 200 })
    );

    const emailPayload = {
      to: "teacher1@example.com",
      subject: "Kích hoạt tài khoản",
      html: "<p>Chào mừng bạn</p>",
      text: "Chào mừng bạn",
    };

    const res = await sendEmail(emailPayload);
    expect(res).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [callUrl, callOpts] = mockFetch.mock.calls[0];
    expect(callUrl).toBe("https://api.resend.com/emails");
    expect(callOpts.method).toBe("POST");
    expect(callOpts.headers).toMatchObject({
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    });

    const body = JSON.parse(callOpts.body);
    expect(body).toEqual({
      from: mailFrom,
      to: ["teacher1@example.com"],
      subject: "Kích hoạt tài khoản",
      html: "<p>Chào mừng bạn</p>",
      text: "Chào mừng bạn",
    });
  });

  it("Resend trả HTTP lỗi (500, 400...): trả { ok: false, error }, không ném lỗi; console.warn không ghi nội dung email", async () => {
    const { sendEmail } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Internal server error" } }), { status: 500 })
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const secretContent = "SECRET_TOKEN_DO_NOT_LEAK_IN_LOGS";
    const res = await sendEmail({
      to: "admin@example.com",
      subject: "Báo cáo khẩn",
      html: `<p>${secretContent}</p>`,
      text: secretContent,
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();

    const loggedText = warnSpy.mock.calls.flatMap((c) => c.map(String)).join(" ");
    expect(loggedText).not.toContain(secretContent);
  });

  it("fetch ném lỗi mạng: trả { ok: false, error }, không ném lỗi ra ngoài", async () => {
    const { sendEmail } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");

    mockFetch.mockRejectedValueOnce(new Error("Connection reset by peer"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await sendEmail({
      to: "user@example.com",
      subject: "Test net error",
      html: "<p>test</p>",
      text: "test",
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("fetch được truyền AbortSignal timeout", async () => {
    const { sendEmail } = await loadMailer();

    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");

    await sendEmail({
      to: "teacher@example.com",
      subject: "Timeout test",
      html: "<p>test</p>",
      text: "test",
    });

    const [, callOpts] = mockFetch.mock.calls[0];
    expect(callOpts.signal).toBeDefined();
  });
});

describe("3. lib/email-templates.ts: Mẫu email & escape HTML", () => {
  it("resetPasswordEmail: tiếng Việt có dấu, hạn 15 phút, bỏ qua nếu không yêu cầu, có hotline thương hiệu", async () => {
    const { resetPasswordEmail } = await loadTemplates();

    const url = "https://kitokit.edu.vn/reset-password?token=tok_test_123&email=gv%40x.vn";
    const email = resetPasswordEmail({ name: "Thầy Hùng", url });

    expect(email.subject).toBeTruthy();
    expect(email.html).toContain("15 phút");
    expect(email.text).toContain("15 phút");
    expect(email.html.toLowerCase()).toContain("bỏ qua");
    expect(email.text.toLowerCase()).toContain("bỏ qua");
    expect(email.html).toContain(url);
    expect(email.text).toContain(url);
    expect(email.html).toContain(BRAND.company.hotline);
    expect(email.text).toContain(BRAND.company.hotline);
  });

  it("resetPasswordEmail: tên chứa ký tự HTML độc hại phải được escape trong HTML", async () => {
    const { resetPasswordEmail } = await loadTemplates();

    const maliciousName = `<script>alert("xss")</script> & "test"`;
    const email = resetPasswordEmail({
      name: maliciousName,
      url: "https://kitokit.edu.vn/reset-password",
    });

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("&amp;");
  });

  it("notificationEmail: mẫu thông báo chung có subject, html, text, hotline và escape HTML", async () => {
    const { notificationEmail } = await loadTemplates();

    const email = notificationEmail({
      title: "Đơn hàng <#KK8888> được duyệt",
      body: "Chúc mừng thầy/cô đã được cộng <b>50 slot</b>.",
      url: "https://kitokit.edu.vn/teacher/orders",
    });

    expect(email.subject).toContain("Đơn hàng");
    expect(email.html).not.toContain("<#KK8888>");
    expect(email.html).toContain("&lt;#KK8888&gt;");
    expect(email.html).not.toContain("<b>50 slot</b>");
    expect(email.html).toContain("&lt;b&gt;50 slot&lt;/b&gt;");
    expect(email.html).toContain("https://kitokit.edu.vn/teacher/orders");
    expect(email.html).toContain(BRAND.company.hotline);
  });
});

describe("4. lib/notifications.ts: createNotification gửi email Resend", () => {
  beforeEach(async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_notif");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");
    vi.stubEnv("APP_BASE_URL", "https://kitokit.edu.vn");

    await h.pg.db.exec(`
      INSERT INTO users (id, name, email, role) VALUES
        ('u_gv1', 'Giáo Viên 1', 'gv1@example.com', 'TEACHER'),
        ('u_admin', 'Admin Tổng', 'admin@example.com', 'ADMIN'),
        ('u_student', 'Học Sinh A', 'hs_temp@kito.io.vn', 'STUDENT');
    `);
  });

  it("gửi email tới users.email khi type thuộc 5 loại: TEACHER_SIGNUP, ORDER_PAID_REPORTED, ORDER_APPROVED, ORDER_REJECTED, TEACHER_VERIFIED", async () => {
    const { createNotification } = await import("@/lib/notifications");

    // Type 1: ORDER_APPROVED
    await createNotification({
      userId: "u_gv1",
      type: "ORDER_APPROVED",
      title: "Đơn hàng #KK123 đã được duyệt",
      body: "Đơn hàng đã được duyệt, bạn có thêm 20 slot.",
      link: "/teacher/orders",
      refId: "ord_101",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, opts1] = mockFetch.mock.calls[0];
    const body1 = JSON.parse(opts1.body);
    expect(body1.to).toEqual(["gv1@example.com"]);
    expect(body1.subject).toContain("Đơn hàng #KK123 đã được duyệt");
    expect(body1.html).toContain("https://kitokit.edu.vn/teacher/orders");

    // Type 2: ORDER_REJECTED
    mockFetch.mockClear();
    await createNotification({
      userId: "u_gv1",
      type: "ORDER_REJECTED",
      title: "Đơn hàng #KK102 bị từ chối",
      body: "Lý do: Chuyển khoản sai mã đơn.",
      link: "/teacher/orders",
      refId: "ord_102",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).to).toEqual(["gv1@example.com"]);

    // Type 3: ORDER_PAID_REPORTED
    mockFetch.mockClear();
    await createNotification({
      userId: "u_admin",
      type: "ORDER_PAID_REPORTED",
      title: "Đơn #KK103 đã báo chuyển khoản",
      body: "Kiểm tra sao kê ngân hàng.",
      link: "/admin/orders",
      refId: "ord_103",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).to).toEqual(["admin@example.com"]);

    // Type 4: TEACHER_SIGNUP
    mockFetch.mockClear();
    await createNotification({
      userId: "u_admin",
      type: "TEACHER_SIGNUP",
      title: "Có giáo viên đăng ký mới",
      body: "Giáo viên: Nguyễn Văn A.",
      link: "/admin/teachers",
      refId: "tch_104",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).to).toEqual(["admin@example.com"]);

    // Type 5: TEACHER_VERIFIED
    mockFetch.mockClear();
    await createNotification({
      userId: "u_gv1",
      type: "TEACHER_VERIFIED",
      title: "Hồ sơ giáo viên đã xác minh",
      body: "Bạn đã được nâng lên 250 slot.",
      link: "/teacher/classes",
      refId: "tch_105",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body).to).toEqual(["gv1@example.com"]);
  });

  it("KHÔNG gửi email với các type thông báo nội bộ: EXAM_GRADED, EXAM_NEEDS_REVIEW, ORDER_CREATED...", async () => {
    const { createNotification } = await import("@/lib/notifications");

    await createNotification({
      userId: "u_gv1",
      type: "EXAM_GRADED",
      title: "Bài thi có điểm",
      body: "Điểm: 8.0/10",
      link: "/student/exam/review/1",
      refId: "sub_graded_1",
    });

    await createNotification({
      userId: "u_gv1",
      type: "EXAM_NEEDS_REVIEW",
      title: "Có bài cần chấm",
      body: "Học sinh nộp bài viết",
      link: "/teacher/grading",
      refId: "sub_review_1",
    });

    await createNotification({
      userId: "u_gv1",
      type: "ORDER_CREATED",
      title: "Đơn hàng mới tạo",
      body: "Chờ thanh toán",
      link: "/orders/1",
      refId: "ord_created_1",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("không gửi lại email khi INSERT trúng ON CONFLICT (cùng user_id, type, ref_id)", async () => {
    const { createNotification } = await import("@/lib/notifications");

    // Lần 1: gửi email
    await createNotification({
      userId: "u_gv1",
      type: "ORDER_APPROVED",
      title: "Đơn hàng đã duyệt",
      body: "Nội dung ban đầu",
      link: "/teacher/orders",
      refId: "ord_dup_1",
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Lần 2: trùng khoá (user_id, type, ref_id) -> UPDATE, rowCount = 1 nhưng không phải dòng mới
    await createNotification({
      userId: "u_gv1",
      type: "ORDER_APPROVED",
      title: "Đơn hàng đã duyệt (cập nhật)",
      body: "Nội dung mới",
      link: "/teacher/orders",
      refId: "ord_dup_1",
    });

    // Vẫn chỉ gọi fetch đúng 1 lần
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("người nhận là email tạm @kito.io.vn thì không gửi email", async () => {
    const { createNotification } = await import("@/lib/notifications");

    await createNotification({
      userId: "u_student",
      type: "ORDER_APPROVED",
      title: "Duyệt slot",
      body: "Thông báo thử",
      link: "/student",
      refId: "ord_placeholder_1",
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("gặp lỗi Resend hoặc mạng: createNotification vẫn resolve bình thường, không ném ngoại lệ", async () => {
    const { createNotification } = await import("@/lib/notifications");

    mockFetch.mockRejectedValueOnce(new Error("Resend server down 503"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      createNotification({
        userId: "u_gv1",
        type: "ORDER_APPROVED",
        title: "Test resilience",
        body: "Duyệt slot",
        link: "/teacher/orders",
        refId: "ord_err_resilience",
      })
    ).resolves.toBeUndefined();

    // Dòng thông báo trong DB vẫn phải được tạo bình thường
    const check = await h.pg.db.query(
      `SELECT * FROM notifications WHERE user_id = 'u_gv1' AND ref_id = 'ord_err_resilience'`
    );
    expect(check.rows).toHaveLength(1);
  });
});

describe("5. POST /api/auth/forgot-password: Gửi email link đặt lại mật khẩu", () => {
  beforeEach(async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_forgot");
    vi.stubEnv("MAIL_FROM", "KitoKit <no-reply@kitokit.edu.vn>");
    vi.stubEnv("APP_BASE_URL", "https://kitokit.edu.vn");

    await h.pg.db.exec(`
      INSERT INTO users (id, name, email, role, email_is_placeholder) VALUES
        ('u_real', 'Thầy Tuấn', 'tuan.gv@example.com', 'TEACHER', FALSE),
        ('u_placeholder', 'HS Temp', 'student_tmp@kito.io.vn', 'STUDENT', TRUE);
    `);
  });

  it("email thật + có cấu hình: gửi đúng 1 email tới đúng địa chỉ, HTML chứa link kèm token trong DB, response không chứa token", async () => {
    const res = await callForgotPassword("tuan.gv@example.com");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resetUrl).toBeUndefined();

    // Lấy token thật từ DB
    const userRow = (
      await h.pg.db.query("SELECT reset_token FROM users WHERE email = 'tuan.gv@example.com'")
    ).rows[0];
    const token = userRow.reset_token;
    expect(token).toBeTruthy();

    // Response tuyệt đối không lộ token
    expect(JSON.stringify(body)).not.toContain(token);

    // Gửi đúng 1 email
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, callOpts] = mockFetch.mock.calls[0];
    const emailPayload = JSON.parse(callOpts.body);

    expect(emailPayload.to).toEqual(["tuan.gv@example.com"]);
    expect(emailPayload.html).toContain("/reset-password?token=" + token);
    expect(emailPayload.html).toContain("email=" + encodeURIComponent("tuan.gv@example.com"));
    expect(emailPayload.text).toContain("/reset-password?token=" + token);
  });

  it("email không tồn tại: không gửi email, response giống hệt ca có email (chống dò)", async () => {
    const res = await callForgotPassword("khong.ton.tai@example.com");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resetUrl).toBeUndefined();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("email tạm @kito.io.vn: không gửi email, response generic bình thường", async () => {
    const res = await callForgotPassword("student_tmp@kito.io.vn");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("khi chưa cấu hình Resend: vẫn trả 200 generic message bình thường, không ném lỗi", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    const res = await callForgotPassword("tuan.gv@example.com");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("khi Resend trả lỗi 500 hoặc mạng ngắt: forgot-password vẫn trả 200 generic message bình thường", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Resend unavailable"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await callForgotPassword("tuan.gv@example.com");
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("không log token hay link reset mật khẩu ra console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {})
    );

    await callForgotPassword("tuan.gv@example.com");

    const token = (
      await h.pg.db.query("SELECT reset_token FROM users WHERE email = 'tuan.gv@example.com'")
    ).rows[0]?.reset_token;

    const logged = spies.flatMap((s) => s.mock.calls.flat().map(String)).join("\n");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("reset-password?token");
  });
});
