import { test, expect } from "@playwright/test";
import { ACC, loginApi } from "./helpers";

test.describe("Màn hình điện thoại", () => {
  test("trang công khai và dashboard học sinh không cuộn ngang", async ({ page }) => {
    for (const p of ["/", "/login"]) {
      await page.goto(p);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, p).toBeLessThanOrEqual(1);
    }
    await loginApi(page, ACC.student);
    await page.goto("/student/dashboard");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
