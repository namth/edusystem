import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite khởi tạo Postgres WASM mỗi test; máy bận (nhiều phiên/agent chạy cùng lúc) có thể > 20s
    testTimeout: 60000,
    hookTimeout: 90000,
    // Giới hạn số worker để bộ test không tranh CPU khi chạy song song với build / agent khác
    maxWorkers: 4,
  },
});
