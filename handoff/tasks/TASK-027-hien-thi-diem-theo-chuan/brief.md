# TASK-027 — Hiển thị điểm theo chuẩn chấm ở analytics, dashboard, lớp, admin

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Từ FEAT-011, bài nộp đề thi có `total_score`, `section_scores`, `standard_snapshot` theo chuẩn chấm (IELTS 0–9, TOEIC 10–990, HSK 0–200…). Các trang vẫn đọc `final_score`/`ai_score` (thang 0–9 cũ) → điểm TOEIC/HSK hiển thị sai. Thêm module thuần `lib/score-display.ts` và cho 4 trang dùng nó (vẫn hiển thị đúng bài nộp cũ).

## 2. Tài liệu bắt buộc đọc
- `docs/features/exam-server-grading.md` mục 5 (cấu trúc `section_scores`, chuẩn), mục 7 (BR-E06)
- Trang hiện tại: `app/student/analytics/page.tsx`, `app/student/dashboard/page.tsx`, `app/student/class/[classId]/page.tsx`, `app/admin/students/[id]/page.tsx`
- Test: `tests/score-display.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:** `lib/score-display.ts` (mới), 4 trang trên (chỉ phần tính/hiển thị điểm).
**Không được sửa:** mọi file trong `tests.lock`, `package.json`, `package-lock.json`, `docs/`, `CONTEXT.md`, các `lib/` khác, route API, trang khác, `stitch_english_mock_exam_portal/`.

## 4. Đặc tả `lib/score-display.ts` (thuần, dùng được ở client)
```ts
export function submissionScore(sub: any): { value: number | null; min: number | null; max: number | null; percent: number | null; standard_name: string | null; status: string | null };
export function submissionSkillScores(sub: any): Record<"Listening"|"Reading"|"Writing"|"Speaking", { score: number | null; min: number; max: number }>;
export function formatScore(s: { value: number | null; max: number | null }): string;
```
- Số có thể là chuỗi (NUMERIC) → `Number`, không hợp lệ → null.
- **Có `standard_snapshot`**: `value = total_score`. `aggregation.method === "SUM"`: `min/max` = tổng `min`/`max` của các phần **có điểm** trong `section_scores` (không phần nào có điểm → tất cả phần của chuẩn); `AVERAGE`/`WEIGHTED`: `min/max` của phần đầu tiên. `standard_name = snapshot.name`.
- **Không có chuẩn** (bài cũ): `value = final_score ?? ai_score`, `min 0`, `max 9`, `standard_name null`.
- `percent = (value − min)/(max − min) × 100` làm tròn 1 chữ số (null khi value null). `status = sub.status ?? null`.
- `submissionSkillScores`: có chuẩn → mỗi kỹ năng lấy `section_scores[skill].score` và `min/max` của phần tương ứng (kỹ năng không có trong chuẩn: `min 0, max 9`); không chuẩn → cột `reading_score`, `listening_score`, `writing_score`, `speaking_score`, thang 0–9.
- `formatScore`: null → `"—"`, ngược lại `` `${value}/${max}` `` (số giữ nguyên, không thêm số 0 thừa).

## 5. Trang
- Thay mọi chỗ tự đọc `final_score`/`ai_score`/`*_score` để hiển thị bằng các hàm trên. Analytics: biểu đồ tiến bộ dùng `percent` (vì nhiều chuẩn khác thang), nhãn hiện `formatScore` + tên chuẩn; điểm kỹ năng theo `submissionSkillScores`; trung bình tính trên `percent`. Dashboard / trang lớp / admin chi tiết học sinh: hiện `formatScore` (+ tên chuẩn nếu có), `GRADING` → "Đang chấm", `NEEDS_REVIEW` → "Chờ giáo viên chấm".
- Không đổi giao diện ngoài phần điểm.

## 6. Ràng buộc
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-027`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không thêm thư viện mới.
