# Báo cáo TASK-059

## Đã làm
- Dọn dẹp `/student`: chuyển đổi `app/student/page.tsx` thành Server Component chỉ thực hiện server `redirect("/student/dashboard")`, dọn bỏ toàn bộ 296 dòng giao diện và form cũ trùng lặp.
- Sửa `/student/landing`: chuyển hướng học sinh tới `/student/dashboard` thay vì `/`.
- Việt hoá nhãn vai trò tại `/profile`: bổ sung bảng ánh xạ `ROLE_LABELS` (STUDENT → "Học sinh", TEACHER → "Giáo viên", ADMIN → "Quản trị viên") và hiển thị `{ROLE_LABELS[role] || role}` thay vì in `{role}` thô.
- Không sửa `middleware.ts`, đảm bảo các liên kết nội bộ tới `/student` tiếp tục hoạt động theo luồng chuẩn.
- Tự kiểm đạt `verify.sh` exit 0 (103/103 tests passed, tsc check passed, test locks OK).

## File đã tạo/sửa
- `app/student/page.tsx`: Chuyển thành Server Component redirect tới `/student/dashboard`, xoá code giao diện cũ.
- `app/student/landing/page.tsx`: Đổi đích redirect từ `/` sang `/student/dashboard`.
- `app/profile/page.tsx`: Thêm ánh xạ vai trò sang tiếng Việt và hiển thị trên thẻ hồ sơ người dùng.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-059-student-entry-cleanup/verify.sh

 RUN  v3.2.7 /Users/namtran/agy-farm/worktrees/TASK-059


 ❯ tests/student-entry-cleanup.test.ts [queued]

 Test Files 0 passed (3)
      Tests 0 passed (0)
   Start at 00:24:37
   Duration 102ms

 ❯ tests/client-bundle-safety.test.ts 0/89
 ❯ tests/design-rules.test.ts 1/5
 ❯ tests/student-entry-cleanup.test.ts 0/9

 Test Files 0 passed (3)
      Tests 1 passed (103)
   Start at 00:24:37
   Duration 201ms
 ✓ tests/design-rules.test.ts (5 tests) 41ms
 ✓ tests/client-bundle-safety.test.ts (89 tests) 75ms
 ✓ tests/student-entry-cleanup.test.ts (9 tests) 134ms

 Test Files  3 passed (3)
      Tests  103 passed (103)
   Start at  00:24:37
   Duration  338ms (transform 120ms, setup 0ms, collect 142ms, tests 250ms, environment 0ms, prepare 133ms)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không.
