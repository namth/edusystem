# TASK-037 — Giới hạn giáo viên dùng thử, banner dùng thử, admin xác minh giáo viên

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/dang-ky-phong-van.md` (FEAT-012) §2, §6 · Quyết định DEC-027, DEC-028.
> Dựa trên migration 013 + `lib/onboarding.ts` + `lib/enrollment.ts` của TASK-035. Chạy **song song** với TASK-036, không chạm file của task đó.

## 1. Tài liệu bắt buộc đọc
- Đặc tả §6 (bảng giới hạn), §2 (phân quyền); `CONTEXT.md` §3.
- Điểm gắn kiểm tra:
  - `lib/enrollment.ts` (`enrollStudentByCode`)
  - `lib/exam-attempts.ts` (`checkExamAccess`)
  - `app/api/student/lessons/[lessonId]/attempts/route.ts`
  - các route tạo lớp, bài học, đề, AI nhập đề, thêm/tạo học sinh, giao bài, mua slot (mục 2)
- Test: `tests/teacher-trial.test.ts` (mới). Mọi test cũ phải xanh.

## 2. Phạm vi file
**Được tạo/sửa:**
- `lib/teacher-trial.ts` (mới), `lib/enrollment.ts`, `lib/exam-attempts.ts`, `lib/notifications.ts` (chỉ thêm loại `TEACHER_VERIFIED`)
- `app/api/teacher/classes/route.ts`, `app/api/teacher/lessons/route.ts`, `app/api/teacher/exams/route.ts`, `app/api/teacher/exams/ai-import/route.ts`
- `app/api/teacher/classes/[classId]/students/route.ts`, `app/api/teacher/classes/[classId]/assignments/route.ts`, `app/api/teacher/slot-requests/route.ts`
- `app/api/admin/create-user/route.ts`, `app/api/student/lessons/[lessonId]/attempts/route.ts`
- `app/api/teacher/trial-usage/route.ts` (mới), `app/api/admin/teachers/[id]/verify/route.ts` (mới), `app/api/admin/teachers/[id]/route.ts`, `app/api/admin/users/route.ts`
- `components/TeacherLayout.tsx` (chỉ thêm banner), `components/teacher/TrialBanner.tsx` (mới)
- `app/admin/teachers/page.tsx`, `app/admin/teachers/[id]/page.tsx`

**Không được sửa:** `tests/**`, `e2e/**`, `tests.lock`, `lib/onboarding.ts`, `context/AuthContext.tsx`, `app/login/**`, `app/register/**`, `components/onboarding/**`, `app/api/auth/**` (thuộc TASK-036), `package*.json`.

## 3. Đặc tả
### 3.1 `lib/teacher-trial.ts`
```ts
export const TRIAL_LIMITS = { classes: 1, contents: 3, students: 3, attemptsPerItem: 1 } as const;
export type TrialKind = "classes" | "contents" | "students";
export async function isTrialTeacher(teacherId: string): Promise<boolean>;       // users.teacher_status = 'TRIAL' (role TEACHER)
export async function getTrialUsage(teacherId: string): Promise<{ classes: number; contents: number; students: number }>;
export async function assertTrialAllows(teacherId: string, kind: TrialKind, adding?: number): Promise<{ ok: true } | { ok: false; error: string }>;
export async function isTrialClass(classId: string): Promise<boolean>;            // giáo viên của lớp đang TRIAL
export function trialLimitResponse(kind: TrialKind | "attempts" | "slots", error: string): NextResponse; // 403 { success:false, error, code:"TRIAL_LIMIT", limit: kind }
// Lớp dùng thử: học sinh đã có ≥ 1 lượt nộp (lesson_attempts / submissions khác IN_PROGRESS, đúng class) cho bài/đề đó → ok:false
export async function assertTrialAttemptAllowed(a: { studentId: string; classId: string; kind: "lesson" | "exam"; itemId: string }): Promise<{ ok: true } | { ok: false; error: string }>;
```
- **Cách đếm:**
  - `classes`: `COUNT(*) FROM classes WHERE teacher_id`.
  - `contents`: số `lessons` cộng số `exams` có `created_by` là giáo viên.
  - `students`: `COUNT(DISTINCT e.student_id)` trên `enrollments` join `classes` của giáo viên.
- **Đọc trạng thái từ DB ở mọi request**, không lấy từ JWT, để admin xác minh là có hiệu lực ngay.
- Bị giới hạn khi `teacher_status IN ('TRIAL','REJECTED')` (REJECTED giữ giới hạn, DEC-028). ADMIN, giáo viên `VERIFIED` hoặc `teacher_status` NULL → luôn `ok`.
- Thông điệp lỗi tiếng Việt, có số giới hạn, ví dụ: "Tài khoản dùng thử chỉ tạo được 1 lớp. Vui lòng chờ KitoKit xác minh để mở đủ tính năng."

### 3.2 Gắn vào các route (chặn **trước** khi ghi DB)
| Route | Kiểm tra |
| :--- | :--- |
| `POST teacher/classes` | `classes`; lớp tạo khi đang dùng thử có `max_slots = LEAST(max_slots, 3)` |
| `POST teacher/lessons`, `POST teacher/exams`, `POST teacher/exams/ai-import` | `contents` |
| `teacher/classes/[classId]/students` (thêm học sinh có sẵn hoặc tạo mới) | `students` (kiểm **trước** kiểm tra lớp đầy → 403 `TRIAL_LIMIT`); học sinh đã thuộc lớp khác của chính giáo viên đó thì không tính thêm |
| `admin/create-user` khi người gọi là TEACHER và có gắn lớp | `students` |
| `lib/enrollment.ts` `enrollStudentByCode` | giáo viên của lớp đang dùng thử mà đã đủ 3 học sinh → `{ ok:false, status:409, error }` (dùng chung cho link mời, mã lớp và đăng ký kèm mã) |
| `teacher/classes/[classId]/assignments` (POST/PUT) | lớp dùng thử → ép `max_attempts = 1` |
| `lib/exam-attempts.ts` `checkExamAccess` | đề trong lớp dùng thử → `limit = 1` |
| `student/lessons/[lessonId]/attempts` POST | gọi `assertTrialAttemptAllowed({ kind:"lesson" })` sau `checkLessonAccess` → không ok thì `trialLimitResponse("attempts", …)` |
| `teacher/slot-requests` POST | giáo viên dùng thử → 403 `TRIAL_LIMIT` (`limit: "slots"`) |

### 3.3 API mới / sửa
- **`GET /api/teacher/trial-usage`** (TEACHER):
  - Giáo viên dùng thử: `{ success, status, limits: TRIAL_LIMITS, used, reviewNote }`.
  - Giáo viên đã xác minh: `limits: null`, `used: null`.
- **`GET /api/admin/users`:** nhận thêm `?teacherStatus=TRIAL|VERIFIED|REJECTED` (giá trị lạ → 400); mỗi dòng có `teacher_status`.
- **`GET /api/admin/teachers/[id]`:** trả thêm `teacher_status` và `profile` (`answers`, `reviewed_at`, `review_note`, `created_at` của `teacher_profiles`; không có thì `null`).
- **`POST /api/admin/teachers/[id]/verify`** (chỉ ADMIN):
  - Body `{ decision: "VERIFIED" | "REJECTED", note? }`, `note` ≤ 500 ký tự.
  - Không phải giáo viên → 404. Quyết định lạ → 400.
  - `VERIFIED` → `slot_limit = GREATEST(slot_limit, 250)`.
  - Ghi `teacher_profiles.reviewed_by/at/note` (chưa có hồ sơ thì tạo với `answers = '{}'`).
  - Gửi thông báo cho giáo viên: `type:"TEACHER_VERIFIED"`, `refId` = id giáo viên, `link:"/teacher/classes"`, tiêu đề tuỳ theo quyết định.
  - Trả `{ success, teacher: { id, teacher_status } }`.

### 3.4 Giao diện
- **`components/teacher/TrialBanner.tsx`** (client): gọi `trial-usage`.
  - Có `limits` → dải màu `accent` ở đầu nội dung: "Đang dùng thử · {used.classes}/1 lớp · {contents}/3 bài học & đề · {students}/3 học sinh — KitoKit sẽ liên hệ xác minh để mở đủ tính năng".
  - `REJECTED` → hiện `reviewNote`.
  - `limits = null` hoặc lỗi → không hiện gì.
- **`components/TeacherLayout.tsx`:** chèn `<TrialBanner />` phía trên `children`, **không** đổi menu (`tests/exam-library.test.ts` đang kiểm menu).
- **`/admin/teachers`:**
  - Có tab hoặc bộ lọc "Chờ xác minh" (gọi `?role=TEACHER&teacherStatus=TRIAL`, hiện số đếm), đọc `?status=TRIAL` trên URL để mở sẵn tab (link trong thông báo).
  - Mỗi dòng có huy hiệu trạng thái: Dùng thử / Đã xác minh / Từ chối.
- **`/admin/teachers/[id]`:**
  - Khối "Khảo sát đăng ký" hiển thị câu trả lời bằng **nhãn tiếng Việt** (lấy từ các enum trong `lib/onboarding.ts`).
  - Hai nút "Xác minh" / "Từ chối" kèm ô ghi chú, gọi route verify, làm mới sau khi xong.
  - Đủ trạng thái tải / lỗi.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-037` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Giới hạn chặn ở **server**. Giao diện chỉ hiển thị, không thay thế việc chặn.
- Không chặn ADMIN. Không đổi hành vi với giáo viên đã xác minh (mọi test cũ phải xanh).
- `lib/teacher-trial.ts` là module server: không import vào component `"use client"`.
- Kiểm tra quyền (`requireRole`) **trước** mọi truy vấn.
