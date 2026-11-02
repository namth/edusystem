# Review TASK-041 — vòng 2

`lib/slot-orders.ts` đã sạch. Còn 1 việc:

1. `app/api/teacher/slot-requests/route.ts:71–…`: khối `catch` bắt `42703` / "does not exist" rồi chạy luồng "Legacy fallback cho schema cũ chưa chạy migration 016". **Kỳ vọng:** xoá toàn bộ nhánh dự phòng này. POST chỉ gọi `createOrder` và trả kết quả. Lỗi DB để ném ra như mọi route khác. Không giữ bất kỳ đường INSERT nào cho schema cũ ở bất kỳ file nào (`grep -rn "42703\|does not exist" app lib` phải rỗng).

Sau khi sửa: `python3 scripts/handoff.py verify TASK-041` rồi `submit`. Chỉ dùng python3, không chạy git.
