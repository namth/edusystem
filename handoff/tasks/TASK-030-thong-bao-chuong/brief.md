# TASK-030 — Thông báo trong ứng dụng: API + chuông + GV chấm tay báo học sinh (DEC-021)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Nút chuông trên thanh đầu trang hiện chỉ để trang trí; học sinh rời trang kết quả thì không biết khi nào có điểm. Làm thông báo trong ứng dụng theo DEC-021 dựa trên bảng `notifications` và `lib/notifications.ts` đã có. **TASK-029 chạy song song** (luồng chấm, grade-async, trang làm/xem lại đề) — không chạm file của nó.

## 2. Tài liệu bắt buộc đọc
- `docs/14-decisions.md` DEC-021; `CONTEXT.md` mục 3 (bất biến 1–3)
- `lib/notifications.ts` (`listNotifications`, `markNotificationsRead`, `notifyExamGraded`), `docs/db-migration-010-notifications.sql`
- `lib/api-auth.ts` (`requireRole`), `app/api/exam/grade-override/route.ts`
- `components/StudentLayout.tsx`, `components/TeacherLayout.tsx` (nút `Bell` hiện tại)
- Test: `tests/notifications-api.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/api/notifications/route.ts` (mới) — `GET`
- `app/api/notifications/read/route.ts` (mới) — `POST`
- `components/NotificationBell.tsx` (mới, `"use client"`)
- `components/StudentLayout.tsx`, `components/TeacherLayout.tsx` (chỉ thay nút chuông)
- `app/api/exam/grade-override/route.ts` (chỉ thêm gọi `notifyExamGraded` sau khi cập nhật thành `GRADED`)

**Không được sửa:** mọi file trong `tests.lock`, `lib/notifications.ts`, `app/api/student/**`, `app/api/exam/grade-async/**`, `app/api/submissions/**`, `app/student/**`, `worker/**`, `docs/`, `package*.json`.

## 4. Đặc tả chi tiết
- `GET /api/notifications?limit=N` (mặc định 20): mọi vai trò đã đăng nhập (`requireRole()`), không có phiên → 401. Trả `{ success: true, items, unread }` từ `listNotifications(userId, limit)` — userId lấy từ token.
- `POST /api/notifications/read` body `{ ids?: string[] }`: không có `ids` → đánh dấu tất cả; `ids` không phải mảng chuỗi → 400. Trả `{ success: true, updated }`.
- `grade-override`: sau khi lượt chuyển `GRADED` → `await notifyExamGraded(submissionId)`. Không đổi logic khác.
- `NotificationBell`:
  - Nút chuông + huy hiệu số chưa đọc (0 → ẩn; > 9 → "9+").
  - Tải khi mount và mỗi 60 giây (`setInterval`, dọn khi unmount); tạm dừng khi tab ẩn là tốt (không bắt buộc).
  - Bấm mở danh sách thả xuống (đóng khi bấm ra ngoài / Esc): mỗi mục hiện tiêu đề, nội dung, thời gian tương đối ("5 phút trước"), chưa đọc thì nền nhấn; bấm mục → `POST read { ids:[id] }` rồi `router.push(item.link)` (nếu có link).
  - Nút "Đánh dấu đã đọc tất cả"; rỗng → "Chưa có thông báo"; lỗi tải → im lặng giữ dữ liệu cũ.
  - Không import module server (`@/lib/notifications`, `@/lib/db-pg`) — chỉ gọi API. Giữ phong cách màu của layout.
- Thay `<button><Bell/></button>` trang trí trong `StudentLayout` và `TeacherLayout` bằng `<NotificationBell />`.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-030`); `npx`, `git`, `find`, `ls`, `rm` bị từ chối.
- Không đọc `user_id` từ body/query (bất biến 3). Không thêm thư viện.
