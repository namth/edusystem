# Báo cáo TASK-009

## Đã làm
- Hiện thực hoá module `lib/roadmap.ts` thuần túy (không phụ thuộc DB, React, Next.js): `flattenRoadmap` sắp xếp thứ tự học, `computeRoadmapStates` tính trạng thái mục (LOCKED/OPEN/COMPLETED) và hạn chót theo 3 chế độ `ALL_OPEN`, `MANUAL`, `SEQUENTIAL` (kèm ngoại lệ mở riêng học sinh), và `computeProgressPercent`.
- Hiện thực hoá module `lib/roadmap-data.ts`: các hàm `loadCompletedItemIds` và `loadClassProgress` đọc dữ liệu PostgreSQL (lấy điểm cao nhất của bài học, bài nộp đề thi, xác định hoàn thành dựa trên `pass_percent` / `passing_score`).
- Hiện thực hoá API `PUT /api/teacher/classes/[classId]/settings`: xác thực quyền GV/Admin, cập nhật khóa học, chế độ mở, ngưỡng đạt.
- Hiện thực hoá API `POST /api/teacher/classes/[classId]/unlocks` và `DELETE /api/teacher/classes/[classId]/unlocks`: mở và khoá mục lộ trình cho cả lớp hoặc riêng học sinh, xử lý xung đột qua kiểm tra tồn tại thay vì ON CONFLICT.
- Hiện thực hoá API `GET /api/teacher/classes/[classId]/roadmap`: trả cây mục lộ trình theo thứ tự học kèm các bản ghi mở bài.
- Hiện thực hoá API `GET /api/teacher/classes/[classId]/progress`: trả danh sách học sinh ghi danh, danh sách mục học và ma trận `cells[studentId][itemId]` với `best_percent`, `attempts`, `completed`.
- Chạy `verify.sh` đạt exit 0 (13 test files, 312 tests passed, TypeScript kiểm tra sạch không có lỗi).

## File đã tạo/sửa
- `lib/roadmap.ts`: Module hàm thuần tính toán trạng thái lộ trình và tiến độ.
- `lib/roadmap-data.ts`: Module truy vấn dữ liệu PostgreSQL cho trạng thái hoàn thành và ma trận tiến độ lớp.
- `app/api/teacher/classes/[classId]/settings/route.ts`: Route PUT cập nhật cài đặt lớp học.
- `app/api/teacher/classes/[classId]/unlocks/route.ts`: Route POST / DELETE quản lý mở/khoá mục lộ trình.
- `app/api/teacher/classes/[classId]/roadmap/route.ts`: Route GET lấy lộ trình và trạng thái mở bài của lớp.
- `app/api/teacher/classes/[classId]/progress/route.ts`: Route GET lấy bảng tiến độ chi tiết của học sinh trong lớp.

## Kết quả tự kiểm
```
 Test Files  13 passed (13)
      Tests  312 passed (312)
   Start at  12:16:26
   Duration  102.63s (transform 8.80s, setup 0ms, collect 5.05s, tests 581.60s, environment 5ms, prepare 4.07s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
