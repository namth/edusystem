import { expect, type Page } from "@playwright/test";
import { E2E_PASSWORD } from "./env";

export const ACC = {
  admin: "admin@e2e.test",
  teacher: "teacher@e2e.test",
  teacher2: "teacher2@e2e.test",
  temp: "temp@e2e.test",
  student: "student@e2e.test",
  student2: "student2@e2e.test",
};

// Đăng nhập qua API: cookie auth_token nằm chung kho cookie của page.
export async function loginApi(page: Page, email: string, password = E2E_PASSWORD) {
  const res = await page.request.post("/api/auth/login", { data: { identifier: email, password } });
  expect(res.status(), `đăng nhập ${email}`).toBe(200);
}
