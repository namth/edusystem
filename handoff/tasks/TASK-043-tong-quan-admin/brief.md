# TASK-043 — Trang tổng quan admin & sắp lại menu

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/quan-tri-he-thong.md` (FEAT-013) §3.5, §4 (bảng menu), §7 quy tắc 10–12 · DEC-034.
> Dữ liệu nguồn đã có: `ai_usage_logs` (TASK-038, `lib/ai-usage.ts`, `lib/ai-pricing.ts`), `slot_requests` có cột đơn hàng (TASK-041), `GET /api/admin/orders` trả `counts`.
> Chạy **song song** với TASK-042 (giao diện đơn hàng). Không chạm file của TASK-042: `app/admin/orders/**`, `app/admin/requests/**`, `app/teacher/**`, `components/orders/**`, `components/TeacherLayout.tsx`, `app/admin/teachers/**`.

## 1. Tài liệu bắt buộc đọc
- Đặc tả nêu trên, `CONTEXT.md` §3.
- Test:
  - `tests/admin-dashboard.test.ts` (mới).
  - `tests/landing.test.ts`, `tests/onboarding-ui.test.ts`: đã đổi trang đích của ADMIN thành `/admin`.
  - Mọi test khác phải xanh.

## 2. Phạm vi file
**Được tạo/sửa:**
- `lib/admin-dashboard.ts` (mới, server), `app/api/admin/dashboard/route.ts` (mới)
- `app/admin/page.tsx` (mới)
- `components/AdminLayout.tsx`
- `components/onboarding/redirect.ts`, `app/page.tsx`, `components/Navbar.tsx`, `app/change-password/page.tsx` (chỉ đổi đường dẫn `/admin/requests` thành `/admin`)

**Không được sửa:** `tests/**`, `e2e/**`, `docs/**`, `package*.json`, các API khác, file của TASK-042.

## 3. Đặc tả
### 3.1 `lib/admin-dashboard.ts` + `GET /api/admin/dashboard?month=YYYY-MM`
- `requireRole(["ADMIN"])` **trước** mọi truy vấn.
- `month` phải khớp `/^\d{4}-(0[1-9]|1[0-2])$/`, sai thì 400. Không truyền thì lấy tháng hiện tại theo giờ VN.
- Kỳ tháng tính theo `Asia/Ho_Chi_Minh` (UTC+7): `[YYYY-MM-01 00:00 VN, tháng sau 00:00 VN)`. Truyền mốc dạng `timestamptz` (ISO kèm `+07:00`) vào tham số SQL, không cộng chuỗi.

Trả về:
```ts
{
  success: true,
  month: "YYYY-MM",
  totals: { teachers_verified, teachers_trial, students, lessons, exams },
  pending_orders: number,
  monthly: { submissions, ai_graded, ai_tokens, ai_cost_vnd, revenue_vnd, unpriced_calls },
  daily: Array<{ date: "YYYY-MM-DD", submissions, ai_cost_vnd }>,
  top_teachers: Array<{ teacher_id, name, ai_graded, tokens, cost_vnd }>
}
```

**`totals`** (toàn thời gian):

| Trường | Cách tính |
| :--- | :--- |
| `teachers_verified` | `role='TEACHER' AND (teacher_status='VERIFIED' OR teacher_status IS NULL)` |
| `teachers_trial` | `teacher_status='TRIAL'` |
| `students` | `role='STUDENT'` |
| `lessons`, `exams` | `COUNT(*)` |

**`pending_orders`:** số `slot_requests` có `status='PENDING'`.

**`monthly`** (trong kỳ):

| Trường | Cách tính |
| :--- | :--- |
| `submissions` | `submissions.submitted_at` trong kỳ + `lesson_attempts.created_at` trong kỳ |
| `ai_graded` | số `submission_id` khác nhau + số `lesson_attempt_id` khác nhau trong `ai_usage_logs`, với `purpose IN ('EXAM_GRADING','LESSON_GRADING')`, `created_at` trong kỳ |
| `ai_tokens` | `SUM(total_tokens)` mọi purpose trong kỳ |
| `ai_cost_vnd` | `usdToVnd(SUM(cost_usd), rate)`. Dùng **`cost_usd` đã lưu**, không tính lại; `rate` lấy từ `getAiPricing()` |
| `revenue_vnd` | `SUM(total_cost)` các đơn `status='APPROVED'` có `decided_at` trong kỳ |
| `unpriced_calls` | số dòng log trong kỳ có `findModelPrice(model, pricing) === null` |

**`daily`:** đủ mọi ngày của tháng, kể cả ngày 0. Ngày lấy theo giờ VN: `(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`, hoặc nhóm trong JS sau khi cộng 7 giờ.

**`top_teachers`:** nhóm log trong kỳ theo `teacher_id` (bỏ NULL), mọi purpose, `JOIN users` lấy tên. Sắp theo `cost_vnd` giảm dần, tối đa 10. `ai_graded` của từng giáo viên đếm theo quy tắc của `monthly.ai_graded`.

Tiền trả về là số nguyên, token là `number` (không phải chuỗi).

### 3.2 `app/admin/page.tsx` (client, `AdminLayout`)
- Ô chọn tháng: 12 tháng gần nhất, mặc định tháng hiện tại. Đổi tháng thì gọi `/api/admin/dashboard?month=…`.
- Hàng thẻ **Tổng**: Giáo viên (đã xác minh, kèm "N dùng thử"), Học sinh, Bài học, Đề thi.
- Hàng thẻ **Trong tháng**: Bài đã nộp, Bài chấm bằng AI, Token đã dùng (định dạng `vi-VN`), Chi phí AI (VND), Doanh thu slot (VND), Đơn chờ xử lý (link `/admin/orders?status=PENDING`).
- `unpriced_calls > 0` → dòng cảnh báo amber: "N lần gọi AI chưa có giá model — vào Cấu hình AI để thêm giá", link `/admin/settings`.
- Biểu đồ cột theo ngày (`recharts`, `ResponsiveContainer`): chi phí AI (VND) và số bài nộp, hai trục hoặc hai biểu đồ. Màu dùng token `brand`/`accent` qua biến CSS, không viết mã hex trong class.
- Bảng "Top giáo viên dùng AI": tên (link `/admin/teachers/${teacher_id}`), số bài AI chấm, token, chi phí.
- Đủ trạng thái tải (skeleton), lỗi (Thử lại), dữ liệu rỗng.

### 3.3 `components/AdminLayout.tsx`
- `navItems` theo đúng thứ tự §4: Tổng quan `/admin` (`LayoutDashboard`), Đơn hàng `/admin/orders` (`Receipt`), Quản lý giáo viên, Quản lý học sinh, Quản lý tài khoản, Chuẩn chấm điểm, Liên hệ từ website, Cấu hình AI & hệ thống.
- Giữ nhãn hiện có của các mục cũ ("Chuẩn Chấm Điểm", "Liên Hệ Từ Website"…).
- Mục đang chọn: `/admin` chỉ sáng khi `pathname === "/admin"`; các mục khác sáng khi `pathname.startsWith(href)`.
- **Huy hiệu Đơn hàng:** gọi `GET /api/admin/orders?status=PENDING` một lần khi mount, lấy `counts.PENDING`. Lớn hơn 0 thì hiện huy hiệu số cạnh mục. Lỗi thì bỏ qua.
- Icon menu và các quy tắc DEC-035 giữ nguyên.

### 3.4 Điều hướng
Đổi `/admin/requests` thành `/admin` ở `roleHomePath` (`components/onboarding/redirect.ts`), `app/page.tsx`, `components/Navbar.tsx`, `app/change-password/page.tsx`.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-043` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.** Không chạy git, npm hay shell khác.
- Không bịa hay viết cứng số liệu. Không thêm nhánh dự phòng kiểu "bảng/cột chưa có thì…", vì schema đã có migration.
- Ranh giới tháng tính theo giờ VN. Đây là chỗ dễ sai nhất, test kiểm các mốc 00:30 và 23:30.
- `lib/admin-dashboard.ts` là module server, không import vào trang client.
