# TASK-039 — Slot = học sinh: bỏ trừ slot khi chấm AI, chặn ghi danh vượt slot

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/quan-tri-he-thong.md` (FEAT-013) §3.4, §7 quy tắc 6–8 · Quyết định **DEC-031**. Quyết định này thay phần "trừ slot / hết slot / hoàn slot" của DEC-009, DEC-018, DEC-021.
> Chạy **song song** với TASK-038 (token AI) và TASK-040 (rubric). TASK-038 cũng sửa `app/api/exam/grade-async/route.ts` nhưng chỉ bọc ngữ cảnh quanh đoạn gọi chấm. Task này chỉ xoá **đoạn hoàn slot**, không đụng đoạn gọi chấm.

## 1. Tài liệu bắt buộc đọc
- Đặc tả nêu trên, `CONTEXT.md` §3, `lib/teacher-trial.ts` (cách đếm học sinh dùng thử, giữ nguyên).
- Test:
  - `tests/student-slots.test.ts` (mới).
  - Đã sửa theo DEC-031: `tests/exam-attempts-api.test.ts`, `tests/student-lessons-api.test.ts`, `tests/notifications-api.test.ts`.
  - Mọi test khác phải xanh.
- `docs/db-migration-015-student-slots.sql` do Claude viết, chạy tay khi deploy. **Không** đưa vào `ensureSchema`.

## 2. Phạm vi file
**Được tạo/sửa:**
- `lib/student-slots.ts` (mới), `lib/enrollment.ts`
- `app/api/student/exam-attempts/[id]/submit/route.ts`, `app/api/student/lessons/[lessonId]/attempts/route.ts`
- `app/api/exam/grade-async/route.ts` (chỉ xoá đoạn hoàn slot), `worker/grading-worker.js` (chỉ sửa chú thích/hành vi hoàn slot nếu có)
- `app/api/teacher/classes/[classId]/students/route.ts`, `app/api/admin/create-user/route.ts`, `app/api/admin/users/[id]/route.ts`
- `app/api/teacher/slot-requests/route.ts` (chỉ GET thêm `usage`), `app/teacher/slots/page.tsx` (hiển thị số thật)
- `app/api/student/enroll/route.ts`, `app/api/auth/register/route.ts` (nếu cần chuyển lỗi 409 từ `enrollStudentByCode`)

**Không được sửa:**
- `tests/**`, `e2e/**`, `docs/**`, `package*.json`, `lib/db-pg.ts`, `lib/teacher-trial.ts`
- file của TASK-038: `lib/ai-*.ts`, `lib/document-parser.ts`, `lib/portkey.ts`, `app/api/lessons/grade-async/**`, `app/api/teacher/exams/**`, `app/admin/settings/**`
- file của TASK-040: `app/admin/rubrics/**`, `app/admin/scoring-standards/**`, `components/**`

## 3. Đặc tả
### 3.1 `lib/student-slots.ts`
```ts
export async function getStudentSlotUsage(teacherId: string): Promise<{ used: number; limit: number }>;
// used = COUNT(DISTINCT e.student_id) trên enrollments JOIN classes c WHERE c.teacher_id = teacherId
// limit = COALESCE(users.slot_limit, 0)
export async function assertStudentSlotAvailable(teacherId: string, studentId: string): Promise<{ ok: true } | { ok: false; status: 409; error: string }>;
```
- Chủ lớp có `role = 'ADMIN'` → luôn `ok`.
- Học sinh đã có trong **bất kỳ** lớp nào của giáo viên → `ok`, vì không tốn thêm slot.
- Còn lại: `used >= limit` → `{ ok:false, status:409, error:"Thầy cô đã dùng hết slot học sinh. Vui lòng mua thêm slot." }`. Lỗi phải chứa chữ "slot".
- Đọc từ DB ở mỗi lần gọi, không cache.

### 3.2 Chặn ghi danh — kiểm tra **trước** khi ghi bất cứ thứ gì
Thứ tự kiểm tra: quyền → giới hạn dùng thử (giữ nguyên, 403 `TRIAL_LIMIT`) → **slot học sinh (409)** → sĩ số lớp (`max_slots`, giữ nguyên).

| Đường ghi danh | Yêu cầu |
| :--- | :--- |
| `lib/enrollment.ts` `enrollStudentByCode` | trả `{ ok:false, status:409, error }`. Route `student/enroll` và đăng ký kèm mã lớp dùng lại kết quả này |
| `teacher/classes/[classId]/students` POST, học sinh có sẵn | 409, không ghi `enrollments` |
| `teacher/classes/[classId]/students` POST, tạo học sinh mới | kiểm tra **trước** khi `INSERT INTO users`. Bị chặn thì không tạo tài khoản |
| `admin/create-user` có `classIds` | kiểm tra mọi lớp **trước** khi tạo user. Học sinh mới luôn tính là 1 slot cho mỗi giáo viên khác nhau |
| `admin/users/[id]` PUT `class_ids` | với mỗi lớp **mới thêm**, gọi `assertStudentSlotAvailable(teacher của lớp, id học sinh)`. Học sinh đang có trong lớp khác của cùng giáo viên → ok. Có lớp bị chặn → 409, **không** xoá hay thay ghi danh cũ |

Thân lỗi luôn là `{ success:false, error }`.

### 3.3 Chấm AI không còn liên quan slot
- `submit` (đề thi) bỏ `UPDATE users SET slot_limit = slot_limit - 1` và nhánh "hết slot → NEEDS_REVIEW". Có mục AI thì luôn `GRADING` và đẩy sự kiện chấm. Đẩy sự kiện lỗi thì vẫn `NEEDS_REVIEW` và báo giáo viên như cũ, nhưng **không** hoàn slot.
- `lessons/[lessonId]/attempts` bỏ trừ slot và trạng thái `AI_SKIPPED`. Có tự luận thì luôn `GRADING` và đẩy `LESSON_GRADING_REQUESTED`. Giao diện vẫn hiển thị được `AI_SKIPPED` của các lượt cũ, không cần sửa.
- `exam/grade-async` bỏ `slot_limit + 1` (hoàn slot) ở nhánh AI lỗi và nhánh `giveUp`. `NEEDS_REVIEW` và thông báo giữ nguyên.
- Không còn chuỗi `slot_limit - 1`, `slot_limit + 1`, "hoàn slot" ở `app/`, `lib/`, `worker/`.

### 3.4 Số slot thật cho giáo viên
- `GET /api/teacher/slot-requests` trả thêm `usage: { used, limit }` lấy từ `getStudentSlotUsage(user)`.
- `app/teacher/slots/page.tsx`:
  - bỏ `useState(218)` / `useState(250)` viết cứng;
  - hiển thị "Đang dùng {used} / {limit} slot học sinh" từ `usage`;
  - chữ trên trang nói rõ 1 slot = 1 học sinh (học sinh học nhiều lớp của thầy cô chỉ tính 1);
  - giữ nguyên form gửi yêu cầu hiện có, vì TASK-041 sẽ làm lại trang này.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-039` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Giới hạn chặn ở server, trước mọi lệnh INSERT. Không tạo user "mồ côi" rồi mới báo lỗi.
- Không chặn ADMIN là chủ lớp. Không đổi giới hạn dùng thử (DEC-027).
- `requireRole` trước mọi truy vấn. Danh tính học sinh lấy từ token khi người gọi là STUDENT.
