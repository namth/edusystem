import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";

test.describe("Admin", () => {
  test.beforeEach(async ({ page }) => { await loginApi(page, ACC.admin); });

  test("các trang chính tải được, không lỗi", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const p of ["/admin/requests", "/admin/accounts", "/admin/teachers", "/admin/students", "/admin/rubrics", "/admin/scoring-standards", "/admin/settings"]) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBeLessThan(400);
      await expect(page, p).toHaveURL(new RegExp(p));
    }
    expect(errors).toEqual([]);
  });

  test("danh sách người dùng có tài khoản seed", async ({ page }) => {
    const res = await page.request.get("/api/admin/users");
    expect(res.status()).toBe(200);
    expect(JSON.stringify(await res.json())).toContain("student@e2e.test");
  });
});
