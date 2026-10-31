# Báo cáo TASK-027: Hiển thị điểm theo chuẩn chấm ở analytics, dashboard, lớp, admin

## Đã làm
- Hiện thực module thuần client-safe `lib/score-display.ts` với đầy đủ các hàm theo đặc tả:
  - `submissionScore(sub)`: chuẩn hoá điểm theo `standard_snapshot` (chuẩn SUM: min/max cộng dồn các phần có điểm, fallback toàn bộ phần; AVERAGE/WEIGHTED: min/max phần đầu; fallback bài cũ 0–9 qua `final_score ?? ai_score`), tính `percent` làm tròn 1 chữ số, trả về trạng thái `status` và `standard_name`.
  - `submissionSkillScores(sub)`: trả về thang điểm chi tiết 4 kỹ năng Listening, Reading, Writing, Speaking tương ứng theo chuẩn snapshot hoặc fallback cột bài cũ thang 0–9.
  - `formatScore(s)`: hiển thị dạng `${value}/${max}` hoặc `"—"` khi value null.
- Cập nhật `app/student/analytics/page.tsx`:
  - Dùng `submissionScore` và `submissionSkillScores` thay thế việc tự đọc trường `final_score`/`ai_score`.
  - Biểu đồ radar năng lực tính toạ độ dựa trên `percent` (chuẩn hoá thang điểm cho mọi loại chuẩn thi).
  - Điểm trung bình tính trên trung bình `percent`.
  - Nhãn hiển thị điểm kết hợp `formatScore` và tên chuẩn `standard_name`.
- Cập nhật `app/student/dashboard/page.tsx`:
  - Dùng `submissionScore` và `formatScore` để hiển thị điểm bài nộp gần đây kèm tên chuẩn nếu có.
  - Hiển thị nhãn trạng thái thân thiện: `GRADING` → "Đang chấm", `NEEDS_REVIEW` → "Chờ giáo viên chấm".
  - Loại bỏ hoàn toàn truy cập trực tiếp `.final_score` và `.ai_score`.
- Cập nhật `app/student/class/[classId]/page.tsx`:
  - Dùng `submissionScore` và `formatScore` trong danh sách bài đã nộp/đã chấm.
  - Hiển thị điểm theo chuẩn và tên chuẩn tương ứng; `GRADING` → "Đang chấm", `NEEDS_REVIEW` → "Chờ giáo viên chấm".
  - Loại bỏ hoàn toàn truy cập trực tiếp `.final_score` và `.ai_score`.
- Cập nhật `app/admin/students/[id]/page.tsx`:
  - Dùng `submissionScore` và `formatScore` trong bảng lịch sử bài nộp của học sinh.
  - Bỏ hiển thị hardcoded `/ 10`, thay bằng formatScore kèm tên chuẩn.
  - Loại bỏ hoàn toàn truy cập trực tiếp `.final_score` và `.ai_score`.

## File đã tạo/sửa
- `lib/score-display.ts`: Module thuần tính toán và định dạng điểm số bài nộp theo chuẩn chấm với fallback cho bài cũ.
- `app/student/analytics/page.tsx`: Cập nhật hiển thị điểm và biểu đồ kỹ năng dựa trên `score-display`.
- `app/student/dashboard/page.tsx`: Cập nhật hiển thị điểm và trạng thái bài nộp gần đây.
- `app/student/class/[classId]/page.tsx`: Cập nhật hiển thị sổ điểm học sinh trong lớp theo chuẩn chấm.
- `app/admin/students/[id]/page.tsx`: Cập nhật lịch sử làm bài và điểm số chi tiết của học sinh trong trang admin.

## Kết quả tự kiểm
```
 Test Files  33 passed (33)
      Tests  592 passed (592)
   Start at  23:26:25
   Duration  39.56s (transform 1.75s, setup 0ms, collect 2.56s, tests 257.35s, environment 8ms, prepare 2.86s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
