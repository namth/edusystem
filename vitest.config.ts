import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite khởi tạo Postgres WASM mỗi test; chạy song song cả bộ có thể > 5s
    testTimeout: 20000,
  },
});
