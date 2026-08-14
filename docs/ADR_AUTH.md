# 🏛️ ADR 001: Authentication & Authorization Architecture via Supabase Auth SSR

- **Status**: APPROVED
- **Date**: 2026-07-26
- **Architect**: Lead Architect & Engineering Team
- **Deciders**: Lead Architect & USER

---

## Context & Problem Statement
Hệ thống EdTech hiện tại đang sử dụng cơ chế Auth thử nghiệm (Mock Authentication) trong `context/AuthContext.tsx` với mật khẩu dạng plain-text lưu trong bảng `users` và lưu session ở `localStorage`.
Cần chuyển đổi sang một **Hệ thống Xác thực & Phân quyền Chuyên nghiệp (Production-Ready)**, đáp ứng các tiêu chuẩn bảo mật, phân quyền 3 tầng (`STUDENT`, `TEACHER`, `ADMIN`), bảo vệ Route ở cấp Edge Runtime (Next.js Middleware) và tương thích với mô hình dữ liệu hybrid PostgreSQL + Neo4j DB.

---

## Decision Drivers
1. **Security**: Mật khẩu phải được băm an toàn (Bcrypt), Session lưu trữ qua HTTP-Only Cookies an toàn trước XSS.
2. **Access Control (RBAC)**: Ngăn chặn triệt để nguy cơ người dùng tự phong quyền (Role Escalation). Trang đăng ký công khai chỉ cho phép tạo tài khoản `STUDENT`.
3. **Data Integrity**: Dữ liệu người dùng giữa Supabase Auth (`auth.users`), PostgreSQL (`public.users`) và Neo4j DB phải luôn nhất quán 100%.
4. **User Experience (UX)**: Chuyển hướng không nhấp nháy UI (No FOUC), tự động khôi phục session, hỗ trợ quên mật khẩu và đổi mật khẩu lần đầu.

---

## Considered Options
- **Option A (CHỌN)**: **Supabase Auth Native + `@supabase/ssr` Middleware Cookie Session + PostgreSQL Trigger Sync 1-to-1 (`auth.users` $\rightarrow$ `public.users`) + Neo4j Graph DB Sync**.
- **Option B**: Custom JWT Auth tự dựng với Node.js API Routes (Phải tự làm Token rotation, RLS không tích hợp sẵn).
- **Option C**: NextAuth.js / Auth.js v5 (Thừa thãi vì đã dùng hệ sinh thái Supabase làm Backend chính).

---

## Decision Outcome
Chấp thuận **Option A**.

### Technical Architectural Details:
1. **Password Hash**: Đặt toàn bộ trong `auth.users` của Supabase. Loại bỏ cột `password` ở `public.users`.
2. **PostgreSQL Trigger**: Sử dụng Trigger `on_auth_user_created` trên `auth.users` để tự động tạo profile ở `public.users` trong cùng 1 Transaction.
3. **Next.js Middleware**: Đọc Supabase Auth Cookie tại `middleware.ts` để thực hiện Route Guarding & Redirection trước khi render Server Components.
4. **Multi-Tab Sync**: Dùng `supabase.auth.onAuthStateChange` trong `AuthContext.tsx` để đồng bộ trạng thái đăng xuất/đăng nhập tức thì trên tất cả các tab trình duyệt.
5. **Neo4j DB Sync**: Đồng bộ Node `(u:User)` trên Neo4j DB khi user khởi tạo tài khoản hoặc đăng nhập lần đầu.

---

## Consequences

### Positive:
- Bảo mật tuyệt đối: Không còn mật khẩu dạng text, Cookie HTTP-Only mã hóa chống XSS.
- Quản lý RLS (Row Level Security) trên PostgreSQL sẵn sàng cho mọi bảng dữ liệu.
- Phân quyền mượt mà, chuyển hướng trước khi render UI.

### Negative / Trade-offs:
- Cần chạy Migration SQL trên Supabase để tạo Trigger `on_auth_user_created` và xóa cột `password` ở `public.users`.
- Cần cài đặt gói `@supabase/ssr` và cấu hình `@supabase/supabase-js`.

---

## 5. Production Service Role Key & Strict RBAC Audit (2026-08-13)

1. **Strict Service Role Enforcement:** Loại bỏ 100% fallback sang `NEXT_PUBLIC_SUPABASE_ANON_KEY` tại các Server Admin API (`/api/admin/create-user`, `/api/admin/delete-user`) và `getServerSupabaseClient()`. Yêu cầu bắt buộc biến `SUPABASE_SERVICE_ROLE_KEY` chuẩn trong môi trường server.
2. **Strict RBAC Enforcement:**
   - `ADMIN`: Phân quyền tuyệt đối.
   - `TEACHER`: Chỉ được phép tạo/xóa tài khoản Học viên (`STUDENT`).
   - `STUDENT`: Bị chặn hoàn toàn (HTTP 403) tại các Admin API Routes.
3. **Mở rộng tương lai (Roadmap):** Đã thiết lập hook phân quyền chuẩn bị cho nhóm vai trò Trợ giảng (`TUTOR` / `TA`).

