# TASK-031 — Gom Kho Bài Học & Đề Thi (2 tab) + kho đề; đổi menu Quản Lý Lộ Trình & Khóa Học

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Người dùng muốn menu giáo viên gọn: một mục **"Kho Bài Học & Đề Thi"** (trang có 2 tab "Bài học" / "Đề thi"), và đổi "Quản Lý Đề Thi" thành **"Quản Lý Lộ Trình & Khóa Học"** (vẫn là trang cây lộ trình `/teacher/tests`). Hiện chưa có trang liệt kê đề thi — làm mới tab "Đề thi" (kho đề) kèm API xoá đề an toàn.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2–4)
- `app/teacher/lessons/page.tsx` (kho bài học hiện tại — chuyển nguyên vào panel), `app/teacher/lessons/[id]/page.tsx`
- `app/api/teacher/exams/route.ts` (GET), `app/api/teacher/exams/[id]/route.ts` (GET/PUT, chưa có DELETE), `app/teacher/tests/create/page.tsx` (`?editId=`)
- `components/TeacherLayout.tsx` (`navItems`, logic `isActive`)
- Test: `tests/exam-library.test.ts`, `tests/lesson-library-ui.test.ts` (đường dẫn panel đã đổi), `tests/exams-api.test.ts` (phải tiếp tục xanh)

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/teacher/library/page.tsx` (mới)
- `components/teacher/LessonLibraryPanel.tsx` (mới — nội dung danh sách từ `app/teacher/lessons/page.tsx`, bỏ `TeacherLayout` bọc ngoài)
- `components/teacher/ExamLibraryPanel.tsx` (mới)
- `app/teacher/lessons/page.tsx` (thành trang chuyển hướng)
- `app/teacher/lessons/[id]/page.tsx` (chỉ đổi link "quay lại"/sau khi lưu → `/teacher/library?tab=lessons`)
- `app/api/teacher/exams/route.ts` (GET), `app/api/teacher/exams/[id]/route.ts` (thêm DELETE)
- `components/TeacherLayout.tsx` (menu), `app/teacher/tests/page.tsx` (chỉ tiêu đề trang)

**Không được sửa:** mọi file trong `tests.lock`, route API khác, `docs/`, `package*.json`, `lib/**`.

## 4. Đặc tả chi tiết
### API
- `GET /api/teacher/exams?q=`: giữ phân quyền và các trường cũ; thêm `skills` (mảng, null → `[]`), `duration_minutes`, `question_count` (độ dài `question_ids`, null → 0), `usage_count` (số dòng `curriculum_items` có `exam_id` = đề). `q` lọc `title ILIKE %q%`. Sắp mới nhất trước. Một truy vấn (subquery/JOIN), không N+1.
- `DELETE /api/teacher/exams/[id]`: `requireRole(["ADMIN","TEACHER"])`; không có → 404; TEACHER không phải người tạo → 403. Đang dùng → 409 `{ success:false, error, usages: { curriculum, assignments, submissions } }` (đếm `curriculum_items`, `class_assignments`, `submissions` theo `exam_id`). Không dùng → xoá dòng `exams`, 200 `{ success:true }`. Không xoá `questions`.
### Giao diện
- `/teacher/library`: tiêu đề "Kho Bài Học & Đề Thi"; 2 tab "Bài học" / "Đề thi"; tab theo `?tab=lessons|exams` (mặc định `lessons`), đổi tab cập nhật URL (`router.replace`). Bọc `useSearchParams` trong `Suspense`.
- **ExamLibraryPanel:** ô tìm kiếm (gửi `?q=`, debounce ~300ms); nút "Tạo đề mới" → `"/teacher/tests/create"`, nút phụ "AI Import" → `/admin/tests/import` nếu trang tạo đề đang có lối tắt đó (giữ như trang lộ trình); mỗi đề một thẻ/hàng: tên, chip kỹ năng, số câu (`question_count`), thời gian, "Dùng trong N lộ trình" (`usage_count`), ngày tạo; hành động: Sửa (`/teacher/tests/create?editId=<id>`), Xem thử (`/student/exam/<id>` tab mới), Xoá (xác nhận → `method: "DELETE"`; 409 → báo "Đề đang được dùng: N mục lộ trình, N lớp giao, N bài nộp — gỡ khỏi lộ trình trước khi xoá"). Đủ trạng thái tải / lỗi ("Thử lại") / rỗng ("Chưa có đề thi — bấm Tạo đề mới").
- **LessonLibraryPanel:** giữ nguyên chức năng/giao diện kho bài học hiện có.
- `/teacher/lessons` → chuyển hướng `/teacher/library?tab=lessons` (`redirect` của `next/navigation`).
- **Menu:** `navItems` thành: Quản Lý Lớp Học; `{ href: "/teacher/tests", label: "Quản Lý Lộ Trình & Khóa Học" }`; `{ href: "/teacher/library", label: "Kho Bài Học & Đề Thi" }`; Flashcards; Tạo Acc Học Sinh; Mua Slot; Duyệt Điểm AI. Mục kho sáng khi pathname bắt đầu bằng `/teacher/library`, `"/teacher/lessons"` hoặc `"/teacher/tests/create"`; mục lộ trình chỉ sáng đúng `/teacher/tests`.
- Trang `/teacher/tests`: tiêu đề h1 → "Quản Lý Lộ Trình & Khóa Học".

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-031`); `npx`, `git`, `find`, `ls`, `rm` bị từ chối.
- Panel là client component, không import module server. Không thêm thư viện. Giữ phong cách màu hiện có.
