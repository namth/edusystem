# Báo cáo TASK-023

## Đã làm
- [x] Tạo API `app/api/teacher/classes/route.ts` hỗ trợ GET (danh sách lớp của GV kèm `student_count` hoặc tất cả cho ADMIN) và POST (tạo lớp học mới với `id = cls_...`, `code` 6 ký tự A-Z0-9 ngẫu nhiên duy nhất, `teacher_id = userId`, đồng bộ Neo4j `syncTeacherManagesClass`).
- [x] Tạo API `app/api/teacher/classes/[classId]/route.ts` hỗ trợ GET, PUT (cập nhật tên, lịch, max_slots với xác thực phân quyền 404/403) và DELETE (xóa theo giao dịch nguyên tử gồm enrollments, class_assignments, class_unlocks và classes).
- [x] Tạo API `app/api/teacher/classes/[classId]/members/route.ts` hỗ trợ GET danh sách học viên (kèm `submission_count`, `latest_total` từ bài nộp mới nhất, không lộ password/reset_token) và danh sách bài tập đã giao kèm tên đề.
- [x] Tạo API `app/api/teacher/classes/[classId]/assignments/route.ts` hỗ trợ POST giao đề (kiểm tra quyền sở hữu đề hoặc đề chung/ADMIN, chặn trùng 409, id `asg_...`) và DELETE hủy giao bài.
- [x] Tạo API `app/api/teacher/classes/[classId]/students/route.ts` hỗ trợ POST:
  - Nếu email đã có: kiểm tra role STUDENT (role khác trả 409), kiểm tra sức chứa lớp và ghi danh vào lớp.
  - Nếu email chưa có: kiểm tra sức chứa lớp, sinh mật khẩu tạm thời ngẫu nhiên ≥ 8 ký tự, băm mật khẩu với `hashPassword`, tạo user `usr_...` với `must_change_password = true`, ghi danh lớp và trả `temp_password` một lần duy nhất.
- [x] Chuyển đổi 3 trang client components (`app/teacher/classes/page.tsx`, `app/teacher/classes/[classId]/page.tsx`, `app/teacher/students/create/page.tsx`) sang dùng API qua `fetch`, loại bỏ hoàn toàn `supabase` và `@/lib/supabase`, thêm thông báo lỗi và nút "Thử lại", hiển thị mật khẩu tạm 1 lần duy nhất cho giáo viên ghi lại, giữ nguyên tab "Lộ trình" của TASK-012.
- [x] Chạy kiểm tra khoá test và xác minh hệ thống: `verify.sh` chạy exit 0, vượt qua toàn bộ 29 test files (570 tests) và TypeScript check.

## File đã tạo/sửa
- `app/api/teacher/classes/route.ts`: API GET (danh sách lớp) và POST (tạo lớp mới).
- `app/api/teacher/classes/[classId]/route.ts`: API GET, PUT (sửa thông tin lớp) và DELETE (xóa lớp giao dịch).
- `app/api/teacher/classes/[classId]/members/route.ts`: API GET thành viên lớp (học viên và đề thi đã giao).
- `app/api/teacher/classes/[classId]/assignments/route.ts`: API POST (giao đề) và DELETE (hủy giao đề).
- `app/api/teacher/classes/[classId]/students/route.ts`: API POST thêm/ghi danh học sinh vào lớp và cấp mật khẩu tạm.
- `app/teacher/classes/page.tsx`: Giao diện danh sách lớp học, thay Supabase bằng API pg, thêm xử lý lỗi và thử lại.
- `app/teacher/classes/[classId]/page.tsx`: Giao diện chi tiết lớp học, sổ điểm, thành viên, thay Supabase bằng API pg, hiển thị mật khẩu tạm 1 lần, giữ tab Lộ trình.
- `app/teacher/students/create/page.tsx`: Giao diện tạo tài khoản học sinh, thay Supabase bằng API pg, hiển thị mật khẩu tạm 1 lần.

## Kết quả tự kiểm
```
 Test Files  29 passed (29)
      Tests  570 passed (570)
   Start at  16:28:46
   Duration  36.31s (transform 1.62s, setup 0ms, collect 2.10s, tests 236.61s, environment 9ms, prepare 2.45s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
