import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";
import { E2E_PASSWORD } from "./env";

test.describe("Xác thực", () => {
  test("khách vào / thấy trang công khai, không bị đòi đăng nhập", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("link", { name: /đăng nhập/i }).first()).toBeVisible();
  });

  test("học sinh đăng nhập qua form → vào dashboard; sai mật khẩu báo lỗi", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email hoặc tên đăng nhập").fill(ACC.student);
    await page.getByPlaceholder("Mật khẩu").fill("Sai@12345");
    await page.getByPlaceholder("Mật khẩu").press("Enter");
    await expect(page.getByText(/không chính xác/i)).toBeVisible();
    await page.getByPlaceholder("Mật khẩu").fill(E2E_PASSWORD);
    await page.getByPlaceholder("Mật khẩu").press("Enter");
    await expect(page).toHaveURL(/\/student\/dashboard/);
  });

  test("mật khẩu tạm: mọi trang bị đưa về /change-password", async ({ page }) => {
    await loginApi(page, ACC.temp);
    await page.goto("/teacher/classes");
    await expect(page).toHaveURL(/\/change-password/);
  });

  test("chưa đăng nhập vào trang giáo viên / admin → /login", async ({ page }) => {
    for (const p of ["/teacher/classes", "/admin/requests", "/student/dashboard"]) {
      await page.goto(p);
      await expect(page, p).toHaveURL(/\/login/);
    }
  });
});

test.describe("Đăng xuất bỏ hẳn phiên cũ", () => {
  test("admin đăng xuất → về /login, vào /register và / không bị đưa ngược vào trang quản trị", async ({ page }) => {
    await loginApi(page, ACC.admin);
    await page.goto("/admin/requests");
    await page.getByRole("button", { name: /Đăng Xuất Admin/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    // trang đăng nhập không tự chuyển vào trang quản trị của tài khoản cũ
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.context().cookies()).find((c) => c.name === "auth_token")?.value || "").toBe("");
    await page.goto("/register");
    await expect(page).toHaveURL(/\/register$/);
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/admin/);
  });
});
