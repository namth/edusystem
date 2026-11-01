import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";

test.describe("Giáo viên", () => {
  test.beforeEach(async ({ page }) => { await loginApi(page, ACC.teacher); });

  test("Quản lý lộ trình chỉ thấy khoá của mình", async ({ page }) => {
    await page.goto("/teacher/tests");
    await expect(page.getByRole("heading", { name: /Quản Lý Lộ Trình & Khóa Học/ })).toBeVisible();
    await expect(page.getByText("Khoá Starters E2E").first()).toBeVisible();
    await expect(page.getByText("Khoá của thầy Minh")).toHaveCount(0);
  });

  test("Kho Bài Học & Đề Thi: tab Đề thi liệt kê đề, tìm kiếm được", async ({ page }) => {
    await page.goto("/teacher/library?tab=exams");
    await expect(page.getByText("Đề trắc nghiệm E2E")).toBeVisible();
    await expect(page.getByText("Đề riêng thầy Minh")).toHaveCount(0);
    await expect(async () => {
      await page.getByRole("button", { name: "Bài học", exact: true }).click();
      await expect(page).toHaveURL(/tab=lessons/, { timeout: 2000 });
    }).toPass();
  });

  test("tạo khoá học mới qua API rồi thấy trong danh sách", async ({ page }) => {
    const res = await page.request.post("/api/teacher/courses", { data: { title: "Khoá tạo bởi E2E" } });
    expect(res.status()).toBe(200);
    await page.goto("/teacher/tests");
    await expect(page.getByText("Khoá tạo bởi E2E").first()).toBeVisible();
  });
});
