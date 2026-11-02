import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";

test.describe("Admin", () => {
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => { await loginApi(page, ACC.admin); });

  test("các trang chính tải được, không lỗi", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const p of ["/admin/requests", "/admin/accounts", "/admin/teachers", "/admin/students", "/admin/rubrics", "/admin/scoring-standards", "/admin/settings"]) {
      // Lần đầu next dev biên dịch trang có thể tự tải lại → chờ ổn định rồi mới kiểm.
      await page.goto(p).catch(async () => { await page.goto(p); });
      await expect(page, p).toHaveURL(new RegExp(p));
      await expect(page.locator("body"), p).not.toContainText(/Application error|Unhandled Runtime Error/);
    }
    expect(errors).toEqual([]);
  });

  test("danh sách người dùng có tài khoản seed", async ({ page }) => {
    const res = await page.request.get("/api/admin/users");
    expect(res.status()).toBe(200);
    expect(JSON.stringify(await res.json())).toContain("student@e2e.test");
  });
});
