// TASK-036 — E2E luồng đăng ký phỏng vấn (FEAT-012) và đăng nhập bằng tên đăng nhập.
// File do trưởng phòng viết, bị khoá. Nhãn bám theo brief TASK-036 §3.6.
import { test, expect, type Page } from "@playwright/test";

const uniq = () => Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 90 + 10);
const next = (page: Page) => page.getByRole("button", { name: "Tiếp", exact: true }).click();

test.describe("Đăng ký học sinh kiểu phỏng vấn", () => {
  test("không có email: tạo tên đăng nhập, vào lớp bằng mã, quay lại không mất dữ liệu, đăng nhập lại bằng tên đăng nhập", async ({ page }) => {
    const username = `e2e.hs${uniq()}`;
    await page.goto("/register");
    await page.getByRole("button", { name: "Bắt đầu" }).click();

    await page.getByLabel("Tên của bạn", { exact: true }).fill("Trần Thị Na");
    await page.getByLabel("Tên của bạn", { exact: true }).press("Enter");
    // từ câu 2 mascot gọi theo tên
    await expect(page.getByText(/Na/).first()).toBeVisible();
    await page.getByRole("button", { name: "Lớp 3", exact: true }).click();

    await page.getByRole("button", { name: "Tiếng Anh" }).click();
    await next(page);
    await page.getByRole("button", { name: /Cambridge/ }).click();

    await page.getByRole("button", { name: "Có mã lớp" }).click();
    await page.getByLabel("Mã lớp", { exact: true }).fill("E2E3A");
    await expect(page.getByText("Lớp 3A E2E")).toBeVisible();
    await next(page);

    await page.getByRole("button", { name: "Không có", exact: true }).click();
    const u = page.getByLabel("Tên đăng nhập", { exact: true });
    await expect(u).not.toHaveValue(""); // có gợi ý điền sẵn
    await expect(page.getByText(/@kito\.io\.vn/)).toBeVisible();
    await u.fill(username);
    await expect(page.getByText("Tên này dùng được")).toBeVisible();
    await expect(page.getByText(`${username}@kito.io.vn`)).toBeVisible();
    await u.press("Enter");

    // quay lại một bước rồi đi tiếp: giá trị còn nguyên
    await page.getByRole("button", { name: "Quay lại" }).click();
    await expect(page.getByLabel("Tên đăng nhập", { exact: true })).toHaveValue(username);
    await page.getByLabel("Tên đăng nhập", { exact: true }).press("Enter");

    await page.getByLabel("Mật khẩu", { exact: true }).fill("matkhau1");
    await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");

    await expect(page.getByText(/Chào mừng/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(username).first()).toBeVisible();
    await expect(page.getByText("Lớp 3A E2E")).toBeVisible();
    await page.getByRole("button", { name: "Vào học thôi" }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/);

    // nháp không còn giữ mật khẩu
    const draft = await page.evaluate(() => JSON.stringify(sessionStorage));
    expect(draft).not.toContain("matkhau1");

    await page.request.post("/api/auth/logout");
    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByPlaceholder("Email hoặc tên đăng nhập").fill(username.toUpperCase());
    await page.getByPlaceholder("Mật khẩu").fill("matkhau1");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test("tên đăng nhập đã có người dùng → báo trùng và bấm gợi ý để dùng", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Bắt đầu" }).click();
    await page.getByLabel("Tên của bạn", { exact: true }).fill("Học Sinh Trùng");
    await page.getByLabel("Tên của bạn", { exact: true }).press("Enter");
    await page.getByRole("button", { name: "Lớp 5", exact: true }).click();
    await page.getByRole("button", { name: "Tiếng Anh" }).click();
    await next(page);
    await page.getByRole("button", { name: "Chưa rõ" }).click();
    await page.getByRole("button", { name: "Chưa có, bỏ qua" }).click();
    await page.getByRole("button", { name: "Không có", exact: true }).click();
    await page.getByLabel("Tên đăng nhập", { exact: true }).fill("admin");
    await expect(page.getByText(/đặt trước|tên khác/i)).toBeVisible();
  });

  test("có email: đăng ký xong vào trang học sinh", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("button", { name: "Bắt đầu" }).click();
    await page.getByLabel("Tên của bạn", { exact: true }).fill("Trần Có Mail");
    await page.getByLabel("Tên của bạn", { exact: true }).press("Enter");
    await page.getByRole("button", { name: "Lớp 10", exact: true }).click();
    await page.getByRole("button", { name: "Tiếng Anh" }).click();
    await next(page);
    await page.getByRole("button", { name: "IELTS", exact: true }).click();
    await page.getByRole("button", { name: "Chưa có, bỏ qua" }).click();
    await page.getByRole("button", { name: "Có", exact: true }).click();
    await page.getByLabel("Email", { exact: true }).fill(`co.mail.${uniq()}@e2e.test`);
    await page.getByLabel("Email", { exact: true }).press("Enter");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("matkhau1");
    await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
    await expect(page.getByText(/Chào mừng/)).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Vào học thôi" }).click();
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });
});

test.describe("Đăng ký giáo viên dùng thử", () => {
  test("đi trọn khảo sát → vào /teacher/classes", async ({ page }) => {
    await page.goto("/register/teacher");
    await page.getByRole("button", { name: "Bắt đầu" }).click();
    // chưa chọn danh xưng → mascot nhắc
    await page.getByLabel("Họ tên", { exact: true }).fill("Nguyễn Thị Hoa");
    await page.getByLabel("Họ tên", { exact: true }).press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: /thầy hay cô/i })).toBeVisible();
    await page.getByRole("button", { name: "Cô", exact: true }).click();
    await page.getByLabel("Họ tên", { exact: true }).press("Enter");
    // câu đầu gọi "cô + tên", câu sau chỉ gọi "cô"
    await expect(page.getByRole("status").first()).toContainText("cô Hoa", { timeout: 10_000 });
    await page.getByRole("button", { name: "Tiếng Anh" }).click();
    await next(page);
    await page.getByRole("button", { name: "Tiểu học" }).click();
    await next(page);
    await page.getByRole("button", { name: "Trung tâm", exact: true }).click();
    const wp = page.getByLabel("Tên trường hoặc trung tâm", { exact: true });
    if (await wp.isVisible().catch(() => false)) {
      await wp.fill("Trung tâm E2E");
      await next(page);
    }
    await page.getByRole("button", { name: "10–50" }).click();
    // không còn câu hỏi tính năng mong muốn
    await expect(page.getByRole("button", { name: "AI chấm Writing/Speaking" })).toHaveCount(0);
    await expect(page.getByRole("status").first()).toContainText("Cô biết KitoKit qua đâu", { timeout: 10_000 });
    // nút Quay lại nằm cùng hàng dưới vùng trả lời
    await expect(page.getByRole("button", { name: "Quay lại" })).toBeVisible();
    await page.getByRole("button", { name: "Facebook" }).click();
    await page.getByLabel("Số điện thoại", { exact: true }).fill("0912345678");
    await page.getByLabel("Số điện thoại", { exact: true }).press("Enter");
    // email đã có người dùng → cảnh báo ngay khi gõ, không cho sang bước mật khẩu
    await page.getByLabel("Email", { exact: true }).fill("teacher@e2e.test");
    await expect(page.getByText(/đã được dùng để đăng ký/).first()).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Email", { exact: true }).press("Enter");
    await expect(page.getByLabel("Mật khẩu", { exact: true })).toHaveCount(0);
    await page.getByLabel("Email", { exact: true }).fill(`co.hoa.${uniq()}@e2e.test`);
    await expect(page.getByText("Email này dùng được")).toBeVisible({ timeout: 10_000 });
    await page.getByLabel("Email", { exact: true }).press("Enter");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("matkhau123");
    await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
    await expect(page.getByText(/dùng thử/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/1 lớp/).first()).toBeVisible();
    await page.getByRole("button", { name: "Vào không gian dạy học" }).click();
    await expect(page).toHaveURL(/\/teacher\/classes/);
  });
});

test.describe("Trang đăng nhập", () => {
  test("có 2 lối đăng ký, không điền sẵn, chặn next ra ngoài", async ({ page }) => {
    await page.goto("/login?next=https://evil.example.com");
    await expect(page.getByPlaceholder("Email hoặc tên đăng nhập")).toHaveValue("");
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();
    await expect(page.locator('a[href="/register/teacher"]').first()).toBeVisible();
    await page.getByPlaceholder("Email hoặc tên đăng nhập").fill("student@e2e.test");
    await page.getByPlaceholder("Mật khẩu").fill("E2e@Pass123");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(/localhost:\d+\/student\/dashboard/);
  });

  test("/teacher/login chuyển về /login", async ({ page }) => {
    await page.goto("/teacher/login");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("màn 375px không cuộn ngang ở /login, /register, /register/teacher", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const p of ["/login", "/register", "/register/teacher"]) {
      await page.goto(p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, p).toBeLessThanOrEqual(1);
    }
  });
});
