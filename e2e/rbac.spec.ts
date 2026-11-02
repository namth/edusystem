import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";

test.describe("Phân quyền qua API thật", () => {
  test("học sinh không gọi được API khoá học của giáo viên", async ({ page }) => {
    await loginApi(page, ACC.student);
    expect((await page.request.get("/api/teacher/courses")).status()).toBe(403);
    expect((await page.request.post("/api/teacher/courses", { data: { title: "Hack" } })).status()).toBe(403);
  });

  test("học sinh vào trang admin → bị chặn", async ({ page }) => {
    await loginApi(page, ACC.student);
    await page.goto("/admin/requests");
    await expect(page).not.toHaveURL(/\/admin\/requests/);
  });

  test("giáo viên không xem được đề + đáp án của giáo viên khác", async ({ page }) => {
    await loginApi(page, ACC.teacher);
    expect((await page.request.get("/api/exams/e2e_exObj")).status()).toBe(200);
    expect((await page.request.get("/api/exams/e2e_exT2")).status()).toBe(403);
    expect((await page.request.get("/api/exams/e2e_exT2/content")).status()).toBe(403);
  });

  test("học sinh không đọc được bài nộp của học sinh khác", async ({ page }) => {
    await loginApi(page, ACC.student2);
    const list = await page.request.get("/api/submissions");
    expect(list.status()).toBe(200);
    const body = await list.json();
    for (const s of body.submissions ?? []) expect(s.student_id).toBe("e2e_s2");
  });
});
