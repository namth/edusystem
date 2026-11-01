// Biến môi trường dùng chung cho server Next.js chạy E2E và script seed.
export const E2E_PORT = 3100;
export const E2E_ENV = {
  DATABASE_URL: "postgres://e2e:e2e@127.0.0.1:55432/kitokit_e2e",
  REDIS_URL: "redis://127.0.0.1:56379",
  JWT_SECRET: "e2e_secret_only_for_playwright_0123456789abcdef",
  INTERNAL_API_TOKEN: "e2e_internal_token",
};
// Mật khẩu chung cho mọi tài khoản seed E2E (chỉ tồn tại trong DB tạm của docker-compose.e2e.yml).
export const E2E_PASSWORD = "E2e@Pass123";
