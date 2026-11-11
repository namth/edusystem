# Báo cáo TASK-056

## Đã làm
- Bỏ widget streak giả (không còn "14", "Daily Streak", icon Flame); lời chào chuyển hoàn toàn sang tiếng Việt ("Xin chào, {user?.name || 'bạn'}!").
- Tách riêng trạng thái tải, dữ liệu và lỗi độc lập cho khối Lớp học (`classesError`) và khối Bài nộp (`subsError`), mỗi khối có nút "Thử lại" riêng; lỗi một khối không làm mất hay ảnh hưởng tới khối kia.
- Tách lượt thi `IN_PROGRESS` ra khỏi danh sách bài thi đã nộp:
  - Hiển thị riêng tại khối "Đang làm dở" với nút "Tiếp tục làm bài →" dẫn tới `/student/exam/{examId}` (kèm `?classId=` nếu bài thi thuộc lớp).
  - Không có liên kết xem chi tiết (review) đối với các lượt chưa nộp.
- Thêm huy hiệu trạng thái lớp học theo trường `billing_status`:
  - `LOCKED`: hiển thị huy hiệu "Đã khoá".
  - `GRACE`: hiển thị huy hiệu "Sắp khoá".
  - `ENDED`: hiển thị huy hiệu "Đã kết thúc".
- Đảm bảo đầy đủ 4 trạng thái UI (đang tải / rỗng / lỗi / có dữ liệu) cho từng khối, không lộ mã lỗi HTTP thô.

## File đã tạo/sửa
- `app/student/dashboard/page.tsx`: Cập nhật dashboard học sinh theo đúng đặc tả và tiêu chí nghiệm thu của brief.

## Kết quả tự kiểm
```text
=== TASK-056: Dashboard học sinh — bỏ dữ liệu giả, lỗi từng khối, lượt đang làm dở, huy hiệu lớp ===
--- Chạy test nghiệm thu ---
 ✓ tests/student-dashboard-polish.test.ts (35 tests) 7ms
 Test Files  1 passed (1)
      Tests  35 passed (35)
--- Chạy test student-home cũ ---
 ✓ tests/student-home.test.ts (4 tests) 27ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
--- Chạy test design rules ---
 ✓ tests/brand-tokens.test.ts (3 tests) 15ms
 ✓ tests/design-rules.test.ts (5 tests) 39ms
 Test Files  2 passed (2)
      Tests  8 passed (8)
=== TASK-056 verify: TẤT CẢ ĐẠT ===
KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.

## Vòng sửa 1
- **Lỗi đã sửa:** Sửa typo `setSubmissionsLoading(true)` thành `setSubsLoading(true)` tại hàm `fetchSubmissions` trong `app/student/dashboard/page.tsx`, giải quyết lỗi TypeScript / runtime `setSubmissionsLoading` chưa khai báo.
- **Tự kiểm:**
  - `npx tsc --noEmit`: exit code 0, sạch hoàn toàn lỗi TypeScript.
  - `python3 scripts/handoff.py verify TASK-056 --quiet`: exit code 0, 35/35 test nghiệm thu và toàn bộ regression test đều đạt.
