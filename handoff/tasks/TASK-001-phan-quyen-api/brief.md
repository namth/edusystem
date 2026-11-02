# TASK-001 — Bắt buộc xác thực & phân quyền cho toàn bộ API route

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Hiện `middleware.ts` chỉ bảo vệ trang `/admin`, `/teacher`; mọi API ngoài `app/api/auth/*` và `app/api/teacher/*` đều gọi được mà không đăng nhập (ai cũng tạo/xoá được tài khoản, sửa điểm…). Task này thêm một helper phân quyền dùng chung, gắn vào từng route theo ma trận quyền bên dưới, bảo vệ trang `/student`, và cho worker chấm bài gọi nội bộ bằng token riêng.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 2 (vai trò) và mục 3 (bất biến 1–5)
- `lib/auth.ts` (`getAuthenticatedUserFromCookie`), `lib/jwt.ts` (`TokenPayload`)
- `app/api/teacher/exams/route.ts` — mẫu kiểm tra quyền hiện có
- Test: `tests/api-auth.test.ts` (đọc kỹ ma trận `CASES`)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/api-auth.ts` (mới)
- `middleware.ts`
- `app/api/admin/create-user/route.ts`, `app/api/admin/delete-user/route.ts`, `app/api/admin/teachers/[id]/route.ts`
- `app/api/admin/test-db/route.ts`, `app/api/admin/test-portkey/route.ts`, `app/api/admin/test-supabase/route.ts`
- `app/api/events/route.ts`, `app/api/tts/route.ts`, `app/api/submissions/route.ts`
- `app/api/exam/bind-lesson/route.ts`, `app/api/exam/categories/route.ts`, `app/api/exam/grade-async/route.ts`, `app/api/exam/grade-override/route.ts`, `app/api/exam/rubrics/route.ts`
- `worker/grading-worker.js` (chỉ thêm header token nội bộ)
- `docker-compose.yml` (chỉ thêm biến `INTERNAL_API_TOKEN` cho `nextjs` và `grading-worker`)
- `app/student/exam/review/[submissionId]/page.tsx` (chỉ bỏ `?student_id=student_01` khỏi URL fetch)

**Không được sửa:**
- Mọi file trong `tests.lock` (test do trưởng phòng viết), `vitest.config.ts`, `package.json`
- `docs/`, `CONTEXT.md`
- `app/api/auth/*`, `app/api/teacher/*`, `lib/jwt.ts`, `lib/auth.ts` (TASK-002 sẽ xử lý `lib/jwt.ts`/`lib/auth.ts`)
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết

### 4.1 `lib/api-auth.ts`
```ts
import { NextResponse } from "next/server";
import type { TokenPayload } from "@/lib/auth";

export type Role = "ADMIN" | "TEACHER" | "STUDENT";

export type AuthResult =
  | { user: TokenPayload; error: null }
  | { user: null; error: NextResponse };

// Đọc phiên từ cookie (dùng getAuthenticatedUserFromCookie).
// Không có phiên/token hỏng → error 401 { success:false, error:"Bạn cần đăng nhập." }
// Có phiên nhưng role không thuộc `allowed` → error 403 { success:false, error:"Bạn không có quyền thực hiện thao tác này." }
// `allowed` bỏ trống = mọi vai trò đã đăng nhập.
export async function requireRole(allowed?: Role[]): Promise<AuthResult>;

// true khi process.env.INTERNAL_API_TOKEN khác rỗng VÀ header `x-internal-token` bằng đúng giá trị đó
// (so sánh thời gian hằng, vd crypto.timingSafeEqual sau khi kiểm độ dài).
export function hasValidInternalToken(req: Request): boolean;
```
Cách dùng trong route — **dòng đầu tiên của handler, trước khi đọc body hay chạm DB/AI/queue**:
```ts
const auth = await requireRole(["ADMIN"]);
if (auth.error) return auth.error;
```

### 4.2 Ma trận quyền
| Route | Method | Vai trò được phép |
| :--- | :--- | :--- |
| `admin/create-user`, `admin/delete-user` | POST | ADMIN |
| `admin/teachers/[id]` | GET, PUT | ADMIN |
| `admin/test-db`, `admin/test-supabase` | GET | ADMIN |
| `admin/test-portkey` | POST | ADMIN |
| `events` | POST | ADMIN, TEACHER |
| `exam/bind-lesson` | POST | ADMIN, TEACHER |
| `exam/categories` | GET | mọi vai trò đã đăng nhập |
| `exam/grade-async` | POST | ADMIN, TEACHER **hoặc** `hasValidInternalToken(req)` |
| `exam/grade-override` | PUT | ADMIN, TEACHER |
| `exam/rubrics` | GET | ADMIN, TEACHER |
| `exam/rubrics` | POST, PUT, DELETE | ADMIN |
| `submissions` | POST, GET | mọi vai trò đã đăng nhập |
| `tts` | GET | mọi vai trò đã đăng nhập |

`grade-async`: nếu header token nội bộ hợp lệ thì cho qua không cần cookie; ngược lại áp `requireRole(["ADMIN","TEACHER"])` (không có phiên → 401).

### 4.3 `submissions` — sở hữu dữ liệu
- **POST:** nếu `role === "STUDENT"` thì `student_id = auth.user.userId`, bỏ qua `student_id` trong body. ADMIN/TEACHER giữ hành vi cũ (lấy từ body). Giá trị `student_id` trong bản ghi insert **và** trong `data` trả về phải là giá trị đã chốt này.
- **GET:** nếu `role === "STUDENT"` luôn `.eq("student_id", auth.user.userId)` và bỏ qua `student_id` trên query. ADMIN/TEACHER lọc theo query như cũ.
- Trang `app/student/exam/review/[submissionId]/page.tsx`: đổi `fetch(\`/api/submissions?student_id=student_01\`)` thành `fetch("/api/submissions")`.

### 4.4 `middleware.ts`
- Thêm bảo vệ `/student/:path*`: chưa đăng nhập → redirect `/login`; mọi vai trò đã đăng nhập đều vào được.
- Ngoại lệ công khai: `/student/landing` (và con của nó) không cần đăng nhập.
- Giữ nguyên luật `/admin`, `/teacher`. `config.matcher` thêm `"/student/:path*"`.

### 4.5 Worker & docker-compose
- `worker/grading-worker.js`: request tới `/api/exam/grade-async` thêm header `"x-internal-token": process.env.INTERNAL_API_TOKEN || ""`.
- `docker-compose.yml`: thêm `- INTERNAL_API_TOKEN=${INTERNAL_API_TOKEN}` vào `environment` của cả `nextjs` và `grading-worker` (theo đúng kiểu khai báo đang dùng trong file).

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (`tests/api-auth.test.ts` xanh toàn bộ + `tsc --noEmit` sạch)
- [ ] Mọi handler trong bảng 4.2 gọi kiểm tra quyền ở đầu hàm, trước mọi truy cập DB/AI/queue/body
- [ ] Không route nào đọc vai trò từ body/query
- [ ] `report.md` liệt kê từng file đã sửa và dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- **Không sửa test, không thêm điều kiện kiểu `process.env.VITEST`/`NODE_ENV === "test"`** để lách. Test giả lập cookie qua `next/headers` — chỉ cần dùng `getAuthenticatedUserFromCookie` là đúng.
- Không đổi định dạng phản hồi thành công hiện có của các route (chỉ thêm nhánh 401/403 ở đầu).
- Kiểm quyền **trước** `await req.json()`; với `admin/teachers/[id]` kiểm trước khi `await params`.
- Không thêm thư viện mới (không `jose`, `next-auth`…).
- Không xoá các route `test-*` — chỉ khoá ADMIN.
- ADMIN không được ngầm hiểu là có mọi quyền trong helper: truyền tường minh danh sách vai trò theo bảng 4.2.
- Không chạm `app/api/auth/*` và `app/api/teacher/*` (đã có kiểm tra quyền riêng).
- Đừng refactor ngoài phạm vi (các file trang lớn, mock-data…).
