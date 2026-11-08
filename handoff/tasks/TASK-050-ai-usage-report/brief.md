# TASK-050 — Báo cáo token & chi phí AI theo giáo viên, sửa số liệu trang chi tiết GV

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

## 1. Mục tiêu
Admin cần biết mỗi giáo viên tốn bao nhiêu token/tiền AI và đem lại bao nhiêu doanh thu, để chốt chính sách giá. Hiện chỉ có top 10 ở tổng quan, còn trang chi tiết giáo viên cộng tổng từ **50 dòng log gần nhất** (sai) và đếm slot đang dùng theo tổng sĩ số các lớp (đếm trùng, lệch BR-S01).

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` §3, `docs/12-business-rules.md` BR-S01, mục D (tổng quan), DEC-034 trong `docs/14-decisions.md`
- `lib/admin-dashboard.ts` (cách tính tháng theo UTC, quy đổi `usdToVnd`), `lib/ai-pricing.ts`, `lib/student-slots.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/ai-usage-report.ts` (mới)
- `app/api/admin/ai-usage/route.ts` (mới)
- `app/admin/ai-usage/page.tsx` (mới)
- `components/AdminLayout.tsx` (thêm 1 mục menu)
- `app/api/admin/teachers/[id]/route.ts`, `app/admin/teachers/[id]/page.tsx`
- `tests/ai-usage-report.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:** mọi file trong `tests.lock`; `lib/admin-dashboard.ts`; `docs/`

## 4. Đặc tả chi tiết
**`lib/ai-usage-report.ts`**
- `getAiUsageReport({ month: "YYYY-MM" }): Promise<AiUsageReport>` — kỳ tính giống `lib/admin-dashboard.ts` (UTC).
- Mỗi dòng = một giáo viên (`users.role = 'TEACHER'`, kể cả giáo viên không gọi AI trong tháng → số 0):
  `teacher_id, name, email, teacher_status, students_used` (BR-S01, dùng `getStudentSlotUsage` hoặc SQL tương đương), `slot_limit`, `requests`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_vnd`, `by_purpose: { EXAM_GRADING, LESSON_GRADING, EXAM_IMPORT, OTHER }` (mỗi mục `{ tokens, cost_vnd }`), `revenue_vnd` (tổng `total_cost` các đơn `slot_requests` `APPROVED` có `decided_at` trong tháng), `margin_vnd = revenue_vnd − cost_vnd`.
- Thêm một dòng tổng `unattributed` cho log có `teacher_id IS NULL` (tokens, cost_vnd).
- `cost_vnd` = `usdToVnd(SUM(cost_usd), usd_vnd_rate)` làm tròn số nguyên.
- Sắp giảm dần theo `cost_vnd`.

**`GET /api/admin/ai-usage?month=YYYY-MM[&format=csv]`** — chỉ ADMIN. `month` sai định dạng → 400; thiếu → tháng hiện tại (UTC). `format=csv` → `text/csv; charset=utf-8` có BOM, cột tiếng Việt, header `Content-Disposition: attachment; filename="ai-usage-YYYY-MM.csv"`.

**`/admin/ai-usage`** — menu "Chi phí AI" (icon `Coins`) đặt sau "Tổng quan". Chọn tháng, 4 thẻ tổng (token, chi phí, doanh thu, chênh lệch), bảng giáo viên (tên dẫn tới `/admin/teachers/[id]`), ô tìm theo tên/email, nút "Xuất CSV". Đủ 4 trạng thái: đang tải / lỗi / rỗng / có dữ liệu. Số tiền định dạng `vi-VN` + " đ". Chênh lệch âm tô màu cảnh báo.

**Trang chi tiết giáo viên**
- API `app/api/admin/teachers/[id]/route.ts` trả thêm `ai_totals: { requests, total_tokens, cost_vnd }` tính bằng **SQL SUM trên toàn bộ log** của giáo viên (không phải 50 dòng), và `students_used` theo BR-S01. Danh sách 50 log gần nhất giữ nguyên.
- Trang dùng `ai_totals` và `students_used` thay cho phép cộng ở client; bỏ fallback `|| 250` cho `slot_limit` (hiện đúng giá trị DB, 0 là 0); bỏ chú thích "100% REAL".

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0; `tests/docs-sync.test.ts` xanh hoặc chỉ đỏ vì thiếu route/trang mới trong docs 03/07 (ghi report, Claude bổ sung)
- [ ] Giáo viên có 60 log trong tháng → báo cáo và `ai_totals` cộng đủ 60 dòng
- [ ] Log tháng trước không tính vào tháng này; log `teacher_id NULL` vào `unattributed`
- [ ] Giáo viên không có log vẫn có dòng với số 0
- [ ] `revenue_vnd` chỉ gồm đơn `APPROVED` có `decided_at` trong tháng (đơn PENDING/REJECTED/CANCELLED không tính)
- [ ] Một học sinh trong 2 lớp của cùng giáo viên → `students_used` = 1
- [ ] `by_purpose` cộng lại bằng tổng
- [ ] `month=2026-13` → 400; không phải ADMIN → 401/403
- [ ] `format=csv` trả đúng content-type, có dòng tiêu đề và đủ số dòng giáo viên

## 6. Ràng buộc & bẫy cần tránh
- Tiền VND là số nguyên; không cộng số thực VND rồi làm tròn từng dòng lệch tổng (tính tổng từ USD rồi quy đổi một lần mỗi ô).
- Không N+1 truy vấn theo từng giáo viên; dùng GROUP BY.
- Không sửa `lib/admin-dashboard.ts` (top 10 tổng quan giữ nguyên).
