# TASK-009 — Cài đặt lớp, mở/khoá mục lộ trình, tiến độ học sinh (lib/roadmap)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Backend phía lớp học của FEAT-010: giáo viên gắn khóa học cho lớp, chọn chế độ mở bài (`MANUAL` / `ALL_OPEN` / `SEQUENTIAL`), ngưỡng hoàn thành, mở/khoá từng unit/mục (cả lớp hoặc riêng học sinh), xem tiến độ. Kèm hai module dùng chung cho API học sinh (TASK-012): `lib/roadmap.ts` (hàm thuần tính trạng thái mục) và `lib/roadmap-data.ts` (đọc DB để biết mục nào đã hoàn thành).

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 2, 5, 6 (phần **Lớp**), 7 (BR-L04, BR-L05, BR-L08, BR-L10)
- `docs/14-decisions.md` DEC-007, DEC-008, DEC-010
- `docs/db-migration-004-*.sql` (`enrollments`), `docs/db-migration-006-lessons.sql` (`class_unlocks`, `lesson_attempts`, cột mới của `classes`)
- `lib/api-auth.ts`; quy tắc sở hữu khóa học trong `app/api/teacher/curriculum/route.ts`
- Test: `tests/roadmap.test.ts`, `tests/class-roadmap-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa (tất cả là file mới):**
- `lib/roadmap.ts`, `lib/roadmap-data.ts`
- `app/api/teacher/classes/[classId]/settings/route.ts` (PUT)
- `app/api/teacher/classes/[classId]/unlocks/route.ts` (POST, DELETE)
- `app/api/teacher/classes/[classId]/roadmap/route.ts` (GET)
- `app/api/teacher/classes/[classId]/progress/route.ts` (GET)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`, `docs/db-migration-00*.sql`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/db-pg.ts`, `lib/grading.ts`, mọi route/trang đã có
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết

### 4.1 `lib/roadmap.ts` — hàm thuần (không import DB/React/next)
```ts
export type UnlockMode = "MANUAL" | "ALL_OPEN" | "SEQUENTIAL";
export type ItemState = "LOCKED" | "OPEN" | "COMPLETED";
export interface RoadmapItem { id: string; parent_id: string | null; type: "UNIT" | "LESSON" | "EXAM" | string; order_index: number; lesson_id?: string | null; exam_id?: string | null; [k: string]: unknown }
export interface UnlockRow { curriculum_item_id: string; student_id: string | null; due_date?: string | null }

export function flattenRoadmap<T extends RoadmapItem>(items: T[]): T[];
export function computeRoadmapStates(input: {
  items: RoadmapItem[]; mode: UnlockMode; unlocks: UnlockRow[]; completedItemIds: Set<string>; studentId: string;
}): Record<string, { state: ItemState; due_date: string | null }>;
export function computeProgressPercent(states: Record<string, { state: ItemState }>, items: RoadmapItem[]): number;
```
- **`flattenRoadmap`**: mục gốc (`parent_id` null — gồm unit và mục học đặt ở gốc) sắp theo `order_index`; ngay sau mỗi unit là các con của nó theo `order_index`.
- **Mục học** = mọi mục không phải `UNIT`. Mục học có id trong `completedItemIds` → `COMPLETED` ở **mọi** chế độ.
- `ALL_OPEN`: mục học còn lại `OPEN`.
- `MANUAL`: `OPEN` nếu có dòng mở (`student_id` null hoặc bằng `studentId`) cho chính mục **hoặc** unit cha; ngược lại `LOCKED`.
- `SEQUENTIAL`: duyệt theo `flattenRoadmap`, mục học chưa hoàn thành **đầu tiên** là `OPEN`, các mục học chưa hoàn thành sau nó `LOCKED`; ngoại lệ: dòng mở **riêng học sinh** (`student_id = studentId`) cho mục hoặc unit cha → `OPEN`. Dòng mở cả lớp bị bỏ qua (BR-L05).
- `due_date` (mọi chế độ): ưu tiên dòng riêng học sinh của chính mục → dòng cả lớp của chính mục → dòng riêng học sinh của unit cha → dòng cả lớp của unit cha → `null`.
- **Unit**: `COMPLETED` nếu có ≥ 1 con và mọi con `COMPLETED`; `OPEN` nếu có con `OPEN` hoặc `COMPLETED`; còn lại (kể cả unit rỗng) `LOCKED`. `due_date` của unit = dòng mở của chính unit (ưu tiên riêng học sinh) hoặc `null`.
- **`computeProgressPercent`**: `Math.round(số mục học COMPLETED / tổng mục học × 100)`; không có mục học → `0`.

### 4.2 `lib/roadmap-data.ts`
```ts
export async function loadCompletedItemIds(classId: string, studentId: string): Promise<Set<string>>;
export async function loadClassProgress(classId: string): Promise<{ students; items; cells }>; // dùng cho route progress
```
Dùng `queryPg`. Lớp không có `course_id` → tập rỗng. **Hoàn thành** (BR-L04, DEC-008):
- Mục `LESSON`: `MAX(score_percent)` của `lesson_attempts` cùng `class_id`, `student_id`, `lesson_id`, `status IN ('GRADED','AI_SKIPPED')` ≥ `classes.pass_percent`.
- Mục `EXAM`: có `submissions` của học sinh cho `exam_id` với `final_score ≥ exams.passing_score`; nếu `passing_score` NULL → chỉ cần có bài nộp.

### 4.3 Quyền chung cho 4 route
`requireRole(["ADMIN","TEACHER"])` dòng đầu, trước `await params`. Lớp không tồn tại → 404; TEACHER mà `classes.teacher_id !== userId` → 403; ADMIN mọi lớp. SQL tham số hoá; lỗi `{ success: false, error }`.

### 4.4 `PUT …/settings` body `{ course_id?, unlock_mode?, pass_percent? }`
- `course_id`: khóa tồn tại và TEACHER đọc được (`created_by = userId` hoặc `created_by IS NULL`), sai → 400. Cho phép `null` để bỏ gắn.
- `unlock_mode` ∈ `MANUAL|ALL_OPEN|SEQUENTIAL`; `pass_percent` số nguyên 1–100. Sai bất kỳ → 400, không ghi.
- Chỉ cập nhật trường gửi lên. `200 { success, class: { id, name, code, teacher_id, course_id, unlock_mode, pass_percent } }`.

### 4.5 `…/unlocks`
- **POST** `{ curriculum_item_id, student_id?, due_date? }`: lớp phải có `course_id` và mục thuộc khóa đó (sai → 400); `student_id` (nếu có) phải ghi danh lớp (`enrollments`) (sai → 400). Nếu đã có dòng cùng (lớp, mục, học sinh-hoặc-NULL) thì **cập nhật** `due_date`, `unlocked_by`, `unlocked_at`; ngược lại chèn mới (`unlocked_by = userId`). `201 { success, unlock }`.
- **DELETE** `?curriculum_item_id=&student_id=`: xoá đúng dòng (không có `student_id` → dòng cả lớp). `200 { success, deleted: <số dòng> }`.

### 4.6 `GET …/roadmap`
`200 { success, class: <như 4.4>, items, unlocks }` — `items` = mục của khóa theo `flattenRoadmap` (gồm `id, parent_id, type, title, order_index, lesson_id, exam_id`); lớp chưa gắn khóa → `items: []`. `unlocks` = mọi dòng `class_unlocks` của lớp.

### 4.7 `GET …/progress`
`200 { success, students: [{ id, name }], items: [{ id, title, type }], cells }` — `students` = học sinh ghi danh lớp; `items` = **mục học** (không gồm unit) theo thứ tự `flattenRoadmap`; `cells[studentId][itemId] = { best_percent, attempts, completed }`:
- `LESSON`: `attempts` = số lần làm (mọi trạng thái) ở lớp này; `best_percent` = `MAX(score_percent)` các lần `GRADED`/`AI_SKIPPED` (kiểu `number`, không có → `null`); `completed` theo 4.2.
- `EXAM`: `best_percent: null`, `attempts` = số bài nộp, `completed` theo 4.2.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] `lib/roadmap.ts` thuần (không import DB/React/next)
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách bằng nhánh `NODE_ENV`/`VITEST`.
- **Không chạy lệnh shell để dò/xoá file** — dùng công cụ đọc/ghi file; chỉ chạy `python3 scripts/handoff.py …`, `npx vitest`, `npx tsc`.
- `numeric`/`COUNT` trên pg thật trả chuỗi → `Number(...)`.
- Unique index `class_unlocks` là biểu thức `COALESCE(student_id, '')` — không dùng `ON CONFLICT (cột)`; kiểm tra tồn tại rồi UPDATE/INSERT.
- Đề trong lộ trình được tính hoàn thành qua `submissions` (không đụng logic chấm đề).
- Không thêm thư viện mới; không sửa `lib/db-pg.ts` (schema đã có).
