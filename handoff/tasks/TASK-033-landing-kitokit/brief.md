# TASK-033 — Landing KitoKit ở "/", form liên hệ lưu khách hàng tiềm năng, làm mới trang đăng nhập

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity
> Chạy **song song** với TASK-034 (đa môn) trên worktree khác — không chạm file của task đó.

## 1. Mục tiêu
Thương hiệu mới **KitoKit** (token màu đã có ở `app/globals.css` `@theme`: `brand-*` xanh, `accent-*` vàng/cam, `ink*`, `line*`, `surface*`; font tiêu đề `font-display` = Baloo 2). Định hướng: cổng bài học & đề thi **đa môn**, khách hàng chính là **học sinh / phụ huynh**, có khu riêng cho **giáo viên / trung tâm**. Cần landing mới ở `/` (SEO tốt), form liên hệ thật (đang giả `setTimeout`), admin xem được khách hàng tiềm năng.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3; `lib/api-auth.ts`, `lib/auth.ts` (`getAuthenticatedUserFromCookie`), `lib/rate-limit.ts` (dùng lại)
- Landing cũ `app/student/landing/page.tsx` (lấy ý FAQ/chương trình nếu hữu ích, rồi thay bằng chuyển hướng)
- Logo: `public/brand/kitokit-logo-horizontal.png`, `public/brand/kitokit-mark.png` (mascot), `public/brand/kitokit-logo-full.webp`
- Test: `tests/landing.test.ts` (mới), `tests/api-auth.test.ts` (không đổi — phân quyền admin/leads nằm trong landing.test.ts). Toàn bộ test khác (trừ `tests/subjects.test.ts` của TASK-034) phải xanh.

## 3. Phạm vi file
**Được tạo/sửa:** `app/page.tsx`, `components/landing/*` (mới, ≥ 6 file section), `lib/landing-stats.ts`, `lib/leads.ts`, `app/api/leads/route.ts`, `app/api/admin/leads/route.ts`, `app/api/admin/leads/[id]/route.ts`, `app/admin/leads/page.tsx`, `components/AdminLayout.tsx` (chỉ thêm mục menu), `app/student/landing/page.tsx` (thành chuyển hướng), `app/login/page.tsx`, `app/register/page.tsx` (chỉ phần nội dung giới thiệu bên trái), `docs/db-migration-011-leads.sql`.
**Không được sửa:** `tests.lock`, `lib/db-pg.ts`, `middleware.ts`, `components/TeacherLayout.tsx`, mọi file `subjects`, `package*.json`.

## 4. Đặc tả chi tiết
### 4.1 Dữ liệu
- `docs/db-migration-011-leads.sql`: `CREATE TABLE IF NOT EXISTS leads (id VARCHAR(50) PRIMARY KEY, name VARCHAR(120) NOT NULL, phone VARCHAR(20), email VARCHAR(150), role VARCHAR(20) NOT NULL, message TEXT, status VARCHAR(20) NOT NULL DEFAULT 'NEW', source VARCHAR(50) DEFAULT 'landing', ip VARCHAR(64), created_at TIMESTAMPTZ DEFAULT NOW())` + index `created_at DESC`.
- `lib/leads.ts`: `ensureLeadsTable()` chạy đúng DDL trên (một lần / tiến trình) — gọi trong 3 route leads trước truy vấn. Không sửa `lib/db-pg.ts`.
### 4.2 API
- `POST /api/leads` (công khai): body `{ name, phone?, email?, role, message?, website? }`.
  - `website` (bẫy bot, input ẩn) có giá trị → 200 `{success:true}`, **không lưu**.
  - Giới hạn **5 lần / giờ / IP** (IP = phần đầu `x-forwarded-for`, không có → `"unknown"`) qua `lib/rate-limit.ts` → 429 + `Retry-After`. Đếm trước khi validate.
  - Validate → 400 `{success:false,error}`: `name` trim 1–120; cần **ít nhất một** trong `phone` (sau khi bỏ khoảng trắng/dấu chấm/gạch: `^(\+84|0)\d{9,10}$`) hoặc `email` (dạng `x@y.z`, ≤150); `role` ∈ `PARENT|STUDENT|TEACHER|CENTER`; `message` ≤ 1000.
  - Lưu với id `lead_<random>`, status `NEW`, ip → 201 `{success:true}`.
- `GET /api/admin/leads`: `requireRole(["ADMIN"])` trước mọi truy vấn; trả `{success, leads}` mới nhất trước (tối đa 500).
- `PATCH /api/admin/leads/[id]`: ADMIN; `status` ∈ `NEW|CONTACTED|DONE` (lạ → 400); không có → 404; 200 `{success, lead}`.
### 4.3 Landing `/` — `app/page.tsx` (Server Component, không `"use client"`)
- `export const metadata` (title/description KitoKit, openGraph dùng `/brand/kitokit-logo-full.webp`).
- Đã đăng nhập (đọc cookie qua `getAuthenticatedUserFromCookie`) → `redirect()` của `next/navigation`: ADMIN `/admin/requests`, TEACHER `/teacher/classes`, còn lại `/student/dashboard`. Khách → render landing.
- `lib/landing-stats.ts`: `getLandingStats(): Promise<{exams, questions, students} | null>` — 3 COUNT (students = users role STUDENT); lỗi → `null`, không ném.
- Section (mỗi section một file trong `components/landing/`, chỉ phần có tương tác mới `"use client"`):
  1. **Header** dính: logo ngang (`/brand/kitokit-logo-horizontal.png`), menu neo `#mon-hoc` `#tinh-nang` `#giao-vien` `#faq`, nút "Đăng nhập" `"/login"`, "Đăng ký" `"/register"`; menu thu gọn trên mobile.
  2. **Hero**: mascot, tiêu đề "Học vui – Thi chắc cùng KitoKit", mô tả ngắn; CTA chính "Làm bài thử miễn phí" → `"/register"`, CTA phụ "Tôi là giáo viên" → `#giao-vien`; dải số liệu thật (`getLandingStats`, ẩn khi `null`).
  3. **Môn học** `id="mon-hoc"`: lưới thẻ môn (danh sách tĩnh tạm thời: Tiếng Anh nổi bật với 4 kỹ năng Nghe–Nói–Đọc–Viết + AI chấm; Toán, Tiếng Việt, Khoa học, Lịch sử & Địa lý, Tin học — ghi "Đang mở rộng"); mỗi môn icon + màu riêng.
  4. **Cách hoạt động** (3 bước: Chọn môn → Làm đề → Xem điểm ngay / AI chấm Viết & Nói) và **Tính năng cho học sinh** `id="tinh-nang"` (chấm tức thì, lộ trình, thông báo có điểm, xem lại bài, thống kê tiến bộ).
  5. **Dành cho giáo viên / trung tâm** `id="giao-vien"`: quản lý lớp, kho bài học & đề thi, kéo thả lộ trình, AI nhập đề từ Word/PDF/ảnh, chấm tay + AI; CTA "Liên hệ dùng thử" → `#lien-he`.
  6. **FAQ** `id="faq"` (accordion, 5–7 câu, không hứa hẹn sai sự thật).
  7. **Liên hệ** `id="lien-he"`: form (họ tên, SĐT, email, vai trò Phụ huynh/Học sinh/Giáo viên/Trung tâm, lời nhắn, input ẩn `website`) → `fetch("/api/leads")`; đủ trạng thái đang gửi / thành công / lỗi (hiện `error` từ API, 429 báo thử lại sau).
  8. **Footer**: logo, liên kết, © KitoKit.
- **Không** bịa số liệu/đánh giá/đối tác (không "12.000+", không testimonial giả). Không còn link `test_01`. Ảnh bằng `next/image` hoặc `<img>` có `width/height`; không cuộn ngang ở 375px. Dùng token màu, không viết hex.
### 4.4 Khác
- `app/student/landing/page.tsx`: Server Component chỉ `redirect("/")`.
- `/admin/leads` (client, `AdminLayout`): bảng tên / liên hệ / vai trò / lời nhắn / thời gian / trạng thái (select đổi bằng `method: "PATCH"`), lọc theo trạng thái; tải / rỗng / lỗi. Menu admin thêm `{ href: "/admin/leads", label: "Khách hàng tiềm năng", ... }`.
- Trang đăng nhập / đăng ký: thay khối giới thiệu bên trái bằng nội dung KitoKit đa môn (không "Khảo Thí IELTS", không "12.000+"), giữ nguyên form và logic.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (`python3 scripts/handoff.py verify TASK-033`).
- Không thêm thư viện. Không nhánh riêng cho test. Không import module server (`@/lib/db-pg`, `@/lib/leads`…) vào component `"use client"`.
- `redirect()` phải gọi **ngoài** try/catch (nó ném lỗi đặc biệt).
