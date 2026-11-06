# TASK-047 — Báo cáo

Code do agy2 (gemini-3.8-flash-high) viết; agent dừng trước bước nộp (quyền `read_file` ngoài worktree bị từ chối ở chế độ chạy ngầm). Trưởng phòng kiểm tra và nộp thay.

## Kết quả tự kiểm
- Vitest 60 file / 1107 test xanh; `tsc --noEmit` sạch; `next build` thành công (sau khi thay symlink `node_modules` của worktree bằng cài đặt thật — Turbopack từ chối symlink trỏ ra ngoài gốc dự án).
- `scope` báo 3 "ngoài phạm vi" giả: các đường dẫn có `[param]` trong brief bị hiểu là glob.

## Đã làm
- Tab "Bảng điểm" (`?tab=gradebook`) + `components/student/ClassGradebook.tsx`.
- Xem lại đề và kết quả bài học: điểm hiệu lực, nhãn "Giáo viên chấm", nhận xét GV / AI.
- Bài học `NEEDS_REVIEW`: thông báo chờ giáo viên, không polling.
