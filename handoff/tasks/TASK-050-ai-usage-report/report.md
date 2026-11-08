# Báo cáo TASK-050

## Đã làm
- `getAiUsageReport`: mỗi giáo viên một dòng (kể cả không có log → 0), GROUP BY (không N+1), `students_used` theo BR-S01 (COUNT DISTINCT học sinh), doanh thu chỉ đơn APPROVED có `decided_at` trong tháng, `by_purpose`, `margin_vnd`, `unattributed`, sắp giảm dần theo `cost_vnd`; tiền VND quy đổi một lần từ tổng USD.
- `GET /api/admin/ai-usage`: chỉ ADMIN, `month` sai → 400, `format=csv` (BOM, cột tiếng Việt, Content-Disposition).
- Trang `/admin/ai-usage` (4 trạng thái, 4 thẻ tổng, tìm kiếm, chọn tháng, Xuất CSV) và menu "Chi phí AI" (Coins) sau "Tổng quan".
- API chi tiết giáo viên trả `ai_totals` (SQL SUM trên toàn bộ log của giáo viên) và `students_used`; `slot_limit` không fallback 250. Trang chi tiết dùng `ai_totals`/`students_used`, bỏ "100% REAL".

## File đã tạo/sửa
- `lib/ai-usage-report.ts`: hàm tính toán báo cáo AI theo giáo viên và unattributed
- `app/api/admin/ai-usage/route.ts`: API GET báo cáo JSON/CSV cho ADMIN
- `app/admin/ai-usage/page.tsx`: Giao diện báo cáo chi phí AI theo giáo viên
- `components/AdminLayout.tsx`: Thêm mục menu "Chi phí AI" (icon Coins) sau "Tổng quan"
- `app/api/admin/teachers/[id]/route.ts`: Bổ sung `ai_totals` (SQL SUM) và `students_used` (BR-S01), bỏ fallback slot_limit || 250
- `app/admin/teachers/[id]/page.tsx`: Dùng `ai_totals` và `students_used` từ server, bỏ fallback 250, bỏ "100% REAL"

## Kết quả tự kiểm
```
$ bash handoff/tasks/TASK-050-ai-usage-report/verify.sh
      Tests  11 passed (11)
   Start at  12:33:05
   Duration  5.72s (transform 91ms, setup 0ms, collect 66ms, tests 5.46s, environment 0ms, prepare 46ms)

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
- Route mới `GET /api/admin/ai-usage` và trang mới `/admin/ai-usage` cần được Trưởng phòng bổ sung vào tài liệu `docs/03-api-contracts.md` và `docs/07-navigation.md`.
