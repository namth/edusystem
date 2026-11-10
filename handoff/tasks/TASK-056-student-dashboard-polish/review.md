# Trả về từ cổng tự động (tsc ĐỎ)
Sửa lỗi sau rồi chạy `python3 scripts/handoff.py verify TASK-056 --quiet` xanh và `submit` lại (chỉ chạy python3):
- `app/student/dashboard/page.tsx` dòng ~57: `setSubmissionsLoading` chưa khai báo → trang crash khi chạy. Khai báo state `[submissionsLoading, setSubmissionsLoading] = useState(...)` hoặc bỏ lời gọi.
(Lỗi tsc ở file test đã được trưởng phòng sửa; không đụng file test.)
