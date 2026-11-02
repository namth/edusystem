# TASK-012 — Giao diện tab "Lộ trình" lớp cho giáo viên và học sinh

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Giao diện cho phần lớp học của FEAT-010 (backend đã có ở TASK-009, API học sinh làm song song ở TASK-011):
- **SCR-L5** — tab "Lộ trình" trong trang lớp của giáo viên: gắn khóa học, chọn chế độ mở bài, ngưỡng hoàn thành, mở/khoá từng unit/mục kèm hạn, bảng tiến độ học sinh.
- **SCR-L6** — tab "Lộ trình" trong trang lớp của học sinh: cây unit → bài/đề với trạng thái khoá/mở/hoàn thành, % tiến độ, điểm cao nhất, hạn; bấm để vào làm bài.

## 2. Tài liệu bắt buộc đọc
- `docs/features/lesson-library.md` mục 4 (SCR-L5, SCR-L6), mục 6 (phần **Lớp**, **Học sinh** — hình dạng JSON), mục 7 (BR-L04, BR-L05)
- `app/api/teacher/classes/[classId]/{settings,unlocks,roadmap,progress}/route.ts` (TASK-009) — đọc đúng hình dạng phản hồi
- Hợp đồng `GET /api/student/classes/[classId]/roadmap` ở mục 6 của đặc tả (route đang được làm ở TASK-011; giao diện chỉ cần gọi đúng)
- Test: `tests/class-roadmap-ui.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `components/class-roadmap/TeacherClassRoadmap.tsx` (mới)
- `components/class-roadmap/StudentRoadmap.tsx` (mới)
- `app/teacher/classes/[classId]/page.tsx` (chỉ thêm tab "roadmap" + render component; không sửa phần khác)
- `app/student/class/[classId]/page.tsx` (chỉ thêm tab "roadmap" + render component; không sửa phần khác)

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, `lib/**`, mọi route API, các trang khác
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)

## 4. Đặc tả chi tiết
Chung: client component (`"use client"`), gọi API bằng `fetch` (cookie tự gửi), đủ 4 trạng thái (đang tải / lỗi + nút "Thử lại" / rỗng / dữ liệu), lỗi API hiện `json.error`. **Không** import `@/lib/supabase`, `@/lib/neo4j`, `@/lib/db-pg`, `@/lib/mock-data`. Theo đúng phong cách giao diện của trang hiện có (màu `#6d3807`, `#fff8f5`, `#d8c2b6`, bo góc `rounded-2xl`, icon `lucide-react`).

### 4.1 `TeacherClassRoadmap({ classId }: { classId: string })`
- Tải song song `GET /api/teacher/classes/${classId}/roadmap` và `GET /api/teacher/courses`.
- **Khối cài đặt**: select khóa học (danh sách từ `/api/teacher/courses`, có lựa chọn "— Chưa gắn —" = `null`), radio/segmented `unlock_mode` với 3 lựa chọn và mô tả ngắn: `MANUAL` "Giáo viên mở từng mục", `ALL_OPEN` "Mở tất cả", `SEQUENTIAL` "Tuần tự — hoàn thành mục trước mới mở mục sau"; input số `pass_percent` (1–100, chỉ hiện/kích hoạt khi `SEQUENTIAL` nhưng vẫn lưu được). Nút "Lưu cài đặt" → `PUT …/settings` chỉ gửi trường đã đổi; thành công thì tải lại roadmap.
- **Cây lộ trình** (từ `items` theo thứ tự trả về; mục con thụt lề dưới unit): mỗi dòng hiện loại (Unit / Bài học / Đề thi) + tiêu đề.
  - Ở `MANUAL`: mỗi unit/mục có công tắc "Mở cho cả lớp" (bật = có dòng `unlocks` với `student_id === null` cho mục đó) và input ngày `due_date` (tuỳ chọn). Bật → `POST …/unlocks { curriculum_item_id, due_date }`; tắt → `DELETE …/unlocks?curriculum_item_id=…`; đổi ngày khi đang bật → `POST` lại với `due_date` mới. Cập nhật danh sách `unlocks` tại chỗ (không tải lại cả trang).
  - Ở `ALL_OPEN` / `SEQUENTIAL`: ẩn công tắc, hiện ghi chú chế độ.
- **Bảng tiến độ**: `GET …/progress`; hàng = học sinh, cột = mục học; ô hiện `best_percent`% (bài học) hoặc ✓/— (đề), nền xanh nhạt khi `completed`. Ở `SEQUENTIAL`, ô chưa hoàn thành có nút nhỏ "Mở riêng" → `POST …/unlocks { curriculum_item_id, student_id }` (mở ngoại lệ cho học sinh bị kẹt — DEC-008).
- **Rỗng**: lớp chưa gắn khóa → "Lớp chưa gắn khóa học. Chọn khóa học ở trên để bắt đầu."; khóa không có mục → "Khóa học chưa có lộ trình."

### 4.2 `StudentRoadmap({ classId }: { classId: string })`
- `GET /api/student/classes/${classId}/roadmap`.
- Thanh tiến độ `progress_percent`%; dòng phụ hiện chế độ lớp (vd "Tuần tự — cần đạt 70%").
- Cây: unit (gấp/mở được) → mục. Mỗi mục: biểu tượng theo `state` (`LOCKED` 🔒 xám, `OPEN` ▶ màu chính, `COMPLETED` ✔ xanh), tiêu đề, `best_percent` (nếu có), hạn `due_date` định dạng `vi-VN` (quá hạn tô đỏ).
- Mục `LESSON` ở `OPEN`/`COMPLETED` là `Link` tới `` `/student/lesson/${item.lesson_id}?classId=${classId}` ``; mục `EXAM` ở `OPEN`/`COMPLETED` là `Link` tới `` `/student/exam/${item.exam_id}` ``; mục `LOCKED` không bấm được (có `title` giải thích "Chưa được mở").
- **Rỗng**: `items` rỗng → "Giáo viên chưa gắn khóa học cho lớp này." Lỗi 403 → "Bạn chưa tham gia lớp học này."

### 4.3 Gắn tab vào trang
- `app/teacher/classes/[classId]/page.tsx`: mở rộng kiểu `activeTab` thêm `"roadmap"`, thêm nút tab thứ 3 "3. Lộ trình & Mở bài" (cùng kiểu với 2 nút hiện có, icon `Route` hoặc `Map`), và `{activeTab === "roadmap" && <TeacherClassRoadmap classId={classId} />}`.
- `app/student/class/[classId]/page.tsx`: thêm `"roadmap"` vào kiểu `activeTab`, nút tab "Lộ trình" đặt **đầu tiên**, và đặt làm tab mặc định; render `<StudentRoadmap classId={classId} />`.
- Không đổi logic/giao diện các tab hiện có.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] Hai tab hiển thị đủ 4 trạng thái; giáo viên bật/tắt mở mục không tải lại cả trang
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách kiểm tra chuỗi.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-012`). `npx`, `git`, `find`, `ls`, `rm` đều bị từ chối quyền — đọc/ghi file bằng công cụ file.
- Trang lớp giáo viên dài ~1.050 dòng: chỉ chèn đúng 3 chỗ (kiểu tab, nút tab, render), không định dạng lại file.
- Route học sinh `/api/student/classes/[classId]/roadmap` có thể chưa tồn tại trong worktree này (TASK-011 song song) — giao diện vẫn phải xử lý lỗi gọn gàng; không tự tạo route đó.
- Không thêm thư viện mới.
