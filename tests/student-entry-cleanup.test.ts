// TASK-059 — Dọn lối vào học sinh: /student, /student/landing, nhãn vai trò hồ sơ.
// Hợp đồng nghiệm thu do kỹ sư kiểm thử chéo viết; người code KHÔNG được sửa file này.
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({
  user: {
    name: "Nguyễn Văn A",
    email: "test@kitokit.edu.vn",
    role: "STUDENT" as "STUDENT" | "TEACHER" | "ADMIN",
    emailIsPlaceholder: false,
  },
  forceLoaded: true,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: h.user }),
}));

vi.mock("@/components/AdminLayout", () => ({
  default: ({ children }: any) => createElement("div", { "data-testid": "admin-layout" }, children),
}));
vi.mock("@/components/TeacherLayout", () => ({
  default: ({ children }: any) => createElement("div", { "data-testid": "teacher-layout" }, children),
}));
vi.mock("@/components/StudentLayout", () => ({
  default: ({ children }: any) => createElement("div", { "data-testid": "student-layout" }, children),
}));

// Mock react useState để khi render static markup, trang /profile không bị kẹt ở trạng thái isLoading=true
vi.mock("react", async (orig) => {
  const actual: any = await orig();
  const useState = (init: any) => {
    if (h.forceLoaded && init === true) {
      return actual.useState(false);
    }
    // Đảm bảo role được khởi tạo đúng theo h.user.role khi render từng ca test
    if (init === "STUDENT" || init === "TEACHER" || init === "ADMIN") {
      return actual.useState(h.user.role);
    }
    return actual.useState(init);
  };
  return { ...actual, useState, default: { ...actual.default, useState } };
});

// Mock global fetch for profile
global.fetch = vi.fn().mockImplementation(async (url: string) => {
  if (url === "/api/profile") {
    return {
      ok: true,
      json: async () => ({
        success: true,
        user: {
          name: h.user.name,
          email: h.user.email,
          role: h.user.role,
          phone: "0912345678",
          target_band: "6.5",
        },
      }),
    };
  }
  return { ok: false, json: async () => ({}) };
});

// redirect() của Next ném lỗi có digest "NEXT_REDIRECT;<type>;<url>;..."
async function redirectTarget(fn: () => unknown): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e: any) {
    const d = String(e?.digest || "");
    if (!d.startsWith("NEXT_REDIRECT")) throw e;
    return d.split(";")[2] ?? null;
  }
}

describe("TASK-059: Student Entry Cleanup & Profile Role Label", () => {
  describe("1. /student/page.tsx — lối vào /student", () => {
    it("là Server Component và chuyển hướng tới /student/dashboard", async () => {
      const src = fs.readFileSync("app/student/page.tsx", "utf8");
      expect(src.trimStart().startsWith('"use client"')).toBe(false);

      const Page = (await import("@/app/student/page")).default as any;
      const target = await redirectTarget(() => Page());
      expect(target).toBe("/student/dashboard");
    });

    it("không còn mã form cũ, join code hay giao diện cũ", () => {
      const src = fs.readFileSync("app/student/page.tsx", "utf8");
      expect(src).not.toContain("handleJoinClass");
      expect(src).not.toContain("Tham Gia Lớp Bằng Mã");
      expect(src).not.toContain("Student Workspace Portal");
      expect(src).not.toContain("StudentHomePage");
      expect(src).not.toContain("useState");
      expect(src.split("\n").length).toBeLessThan(30);
    });
  });

  describe("2. /student/landing/page.tsx — trang chờ học sinh", () => {
    it("chuyển về / (trang giới thiệu công khai)", async () => {
      const Page = (await import("@/app/student/landing/page")).default as any;
      const target = await redirectTarget(() => Page());
      expect(target).toBe("/");
    });

    it("là Server Component, không dùng 'use client'", () => {
      const src = fs.readFileSync("app/student/landing/page.tsx", "utf8");
      expect(src.trimStart().startsWith('"use client"')).toBe(false);
    });
  });

  describe("3. /profile/page.tsx — nhãn vai trò tiếng Việt", () => {
    it("không in {role} thô trực tiếp trong giao diện và có từ điển/ánh xạ vai trò tiếng Việt", () => {
      const src = fs.readFileSync("app/profile/page.tsx", "utf8");
      expect(src).not.toMatch(/>\s*\{\s*role\s*\}\s*</);
      expect(src).not.toMatch(/\{\s*role\s*\}\s*<\/span>/);
      expect(src).toMatch(/Học sinh/);
      expect(src).toMatch(/Giáo viên/);
      expect(src).toMatch(/Quản trị viên/);
    });

    it("hiển thị 'Học sinh' khi role là STUDENT", async () => {
      h.user.role = "STUDENT";
      const Page = (await import("@/app/profile/page")).default as any;
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain("Học sinh");
      expect(html).not.toMatch(/>STUDENT</);
    });

    it("hiển thị 'Giáo viên' khi role là TEACHER", async () => {
      h.user.role = "TEACHER";
      const Page = (await import("@/app/profile/page")).default as any;
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain("Giáo viên");
      expect(html).not.toMatch(/>TEACHER</);
    });

    it("hiển thị 'Quản trị viên' khi role là ADMIN", async () => {
      h.user.role = "ADMIN";
      const Page = (await import("@/app/profile/page")).default as any;
      const html = renderToStaticMarkup(createElement(Page));
      expect(html).toContain("Quản trị viên");
      expect(html).not.toMatch(/>ADMIN</);
    });
  });

  describe("4. Ràng buộc & bất biến liên quan", () => {
    it("không sửa middleware.ts", () => {
      const mw = fs.readFileSync("middleware.ts", "utf8");
      expect(mw).toContain("/student/:path*");
    });
  });
});
