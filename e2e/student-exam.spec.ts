import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";

test.describe("Học sinh làm đề", () => {
  test("đề chỉ trắc nghiệm: bắt đầu → trả lời → nộp → có điểm ngay", async ({ page }) => {
    await loginApi(page, ACC.student);
    await page.goto("/student/exam/e2e_exObj?classId=e2e_c1");
    await page.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
    await page.getByText("Táo").first().click();
    await page.getByRole("button", { name: /^Nộp bài$/ }).first().click();
    await page.getByRole("button", { name: /Xác nhận nộp bài/ }).click();
    await expect(page.getByText("Tổng điểm")).toBeVisible();
    await expect(page.getByText(/AI đang chấm/)).toHaveCount(0);
  });

  test("học sinh chưa ghi danh không bắt đầu được đề của lớp", async ({ page }) => {
    await loginApi(page, ACC.student2);
    const res = await page.request.post("/api/student/exams/e2e_exObj/attempts", { data: { classId: "e2e_c1" } });
    expect(res.status()).toBe(403);
  });

  test("lộ trình lớp vẫn hiển thị sau khi làm bài", async ({ page }) => {
    await loginApi(page, ACC.student);
    await page.goto("/student/class/e2e_c1");
    await expect(page.getByText("Đề trắc nghiệm E2E").first()).toBeVisible();
  });
});
