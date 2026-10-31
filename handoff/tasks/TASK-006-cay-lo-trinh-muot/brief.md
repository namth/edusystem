# TASK-006 — Cây lộ trình: API đầy đủ, cập nhật tại chỗ không tải lại, sửa lỗi kéo thả

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Trang quản lý lộ trình `app/teacher/tests/page.tsx` đang có 5 lỗi:
1. Sau mỗi thao tác (thêm bài học/đề/unit, xoá, gắn đề) trang gọi `fetchCurriculum()` → spinner thay cả cây → giật, mất trạng thái. Người dùng muốn **cập nhật tại chỗ, không tải lại cây**.
2. Trang gọi `PUT /api/teacher/curriculum` (sửa tên, lưu thứ tự kéo thả) nhưng API **không có PUT** → không lưu gì.
3. Trang gửi `course_id/parent_id/exam_id` nhưng API đọc `courseId/parentId/examId` → mục mới rơi vào khóa `crs_01` và gốc cây.
4. Kéo thả: khe ngay dưới chính mục đang kéo vẫn hiện ô preview, và kéo xuống thì rơi lệch thêm 1 vị trí.
5. API: không `requireRole`, không kiểm quyền sở hữu khóa học, id `curr_..._<6 số>` trùng khi tạo liên tiếp.

## 2. Tài liệu bắt buộc đọc
- `CONTEXT.md` mục 3 (bất biến 2, 3, 4), mục 4
- `lib/api-auth.ts`, `app/api/teacher/courses/route.ts` (quy tắc sở hữu khóa học: TEACHER thấy khóa `created_by = mình` hoặc `created_by IS NULL`, chỉ sửa khóa của mình)
- Test: `tests/curriculum-api.test.ts`, `tests/curriculum-dnd.test.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/curriculum-dnd.ts` (mới — hàm thuần, không import React/DOM)
- `app/api/teacher/curriculum/route.ts` (viết lại)
- `app/teacher/tests/page.tsx`

**Không được sửa:**
- Mọi file trong `tests.lock` (gồm `tests/**`, `vitest.config.ts`), `package.json`, `package-lock.json`
- `docs/`, `CONTEXT.md`, mọi route API khác, `lib/db-pg.ts` (schema `curriculum_items` giữ nguyên)
- `app/teacher/tests/create/**`, `components/**`
- `stitch_english_mock_exam_portal/` (mockup thiết kế gốc — chỉ tham khảo)
- `docs/db-migration-00*.sql` đã có (migration mới phải là file mới)

## 4. Đặc tả chi tiết

### 4.1 `lib/curriculum-dnd.ts`
```ts
export interface DndItem { id: string; parent_id: string | null; order_index: number; [k: string]: unknown }

// gapIndex: khe trong danh sách anh em ĐÍCH (cha = targetParentId) sắp theo order_index,
// danh sách này VẪN GỒM mục đang kéo nếu nó cùng cha. Khe 0 = trước mục đầu, khe n = sau mục cuối.
export function isNoopGap(items: DndItem[], dragId: string, targetParentId: string | null, gapIndex: number): boolean;

export function computeDrop(items: DndItem[], dragId: string, targetParentId: string | null, gapIndex: number):
  { noop: boolean; items: DndItem[]; changed: DndItem[] };
```
- Cùng cha, mục đang ở vị trí `i`: khe `i` và `i+1` là noop. Khác cha: không bao giờ noop. `dragId` không tồn tại → noop.
- `computeDrop`: noop → `{ noop: true, items: <bản sao không đổi>, changed: [] }`. Ngược lại: bỏ mục khỏi nhóm cũ; vị trí chèn = `gapIndex - 1` nếu cùng cha và `gapIndex > i`, ngược lại `gapIndex`; kẹp vào `[0, len]`; gán `parent_id = targetParentId`; đánh lại `order_index` 1..n cho nhóm đích **và** nhóm cũ (khi đổi cha).
- `changed`: chỉ các mục có `parent_id` hoặc `order_index` khác ban đầu. Không thay đổi mảng/đối tượng đầu vào.

### 4.2 `app/api/teacher/curriculum/route.ts` — mọi method `requireRole(["ADMIN","TEACHER"])` ở dòng đầu
Quyền với khóa học: **đọc** — ADMIN mọi khóa; TEACHER nếu `created_by = userId` hoặc `created_by IS NULL`. **Ghi** — ADMIN mọi khóa; TEACHER chỉ khi `created_by = userId`. Vi phạm → 403; khóa không tồn tại → 404. Trường JSON dùng snake_case như cột DB. Phản hồi item: `{ id, course_id, parent_id, title, type, exam_id, order_index }`.

- **GET `?courseId=`**: thiếu → 400. `200 { success, items }` — mọi mục của khóa, sắp `order_index`.
- **POST** body `{ course_id, parent_id, title, type, exam_id? }`:
  - 400 khi: thiếu `course_id`; `title.trim()` rỗng; `type` ∉ {`UNIT`,`LESSON`,`EXAM`}; `UNIT` có `parent_id`; `LESSON`/`EXAM` có `parent_id` không phải id một `UNIT` cùng khóa; `EXAM` thiếu `exam_id` hoặc `exam_id` không có trong `exams`.
  - `id = "curr_" + crypto.randomUUID()`; `order_index = COALESCE(MAX(order_index) của nhóm anh em, 0) + 1` (tính phía server, bỏ qua giá trị client gửi); `created_by = userId`; `title` đã `trim()`.
  - `201 { success: true, item }`.
- **PUT** body `{ items: [{ id, title?, exam_id?, parent_id?, order_index? }] }` — sửa tên / đổi thứ tự / chuyển unit hàng loạt:
  - `items` thiếu/rỗng → 400. Id nào không tồn tại → 404. Các mục phải cùng một khóa (khác → 400) và người gọi có quyền ghi khóa đó (403).
  - Kiểm tra: `title` (nếu gửi) sau `trim()` không rỗng; `parent_id` (nếu gửi) là `null` hoặc id một `UNIT` cùng khóa và khác chính nó; mục `UNIT` không được có cha. Sai → 400, **không ghi gì**.
  - Chỉ cập nhật trường có trong payload. Toàn bộ lô trong **một giao dịch** (`getPgPool().connect()` → `BEGIN` … `COMMIT`, lỗi → `ROLLBACK`, luôn `release()`).
  - `200 { success: true, items: <các dòng sau cập nhật> }`.
- **DELETE `?id=`**: không có → 404; không quyền ghi khóa → 403. Xoá `UNIT` thì xoá luôn các mục con. `200 { success: true, deletedIds: string[] }`.

### 4.3 `app/teacher/tests/page.tsx`
- `fetchCurriculum` **chỉ** được gọi khi nạp lần đầu/đổi khóa học (đúng 1 lời gọi trong code, trong `useEffect` theo `selectedCourseId`). Spinner toàn cây chỉ hiện trong lần nạp đó.
- Sau thao tác, cập nhật `items` tại chỗ:
  - Thêm (bài học / đề / unit / gắn đề chưa phân loại): gọi POST với **snake_case** `course_id`, `parent_id`, `exam_id`; thêm `json.item` vào `items`. Unit mới tự mở (`expandedUnits[id] = true`).
  - Sửa: PUT `{ items: [{ id, title, exam_id }] }`; thay mục bằng phần tử trả về.
  - Xoá: bỏ khỏi `items` mọi id trong `json.deletedIds`.
  - Kéo thả & nút mũi tên lên/xuống: dùng `computeDrop` (mũi tên quy về khe tương ứng); `noop` → không làm gì, không gọi API; ngược lại cập nhật lạc quan `items = result.items` rồi PUT `{ items: result.changed.map(({id,parent_id,order_index}) => ...) }`; lỗi → khôi phục `items` trước đó.
- Ô preview (dashed slot) chỉ hiện khi `!isNoopGap(items, activeId, pointerTargetState.parentId, pointerTargetState.hoverIndex)` — áp dụng cho cả khe giữa và khe cuối, cấp gốc và cấp con.
- Trong khi một thao tác đang gửi: chỉ khoá/hiện trạng thái trên nút/mục liên quan, không khoá cả cây. Lỗi hiển thị bằng thông báo không chặn (banner/toast trong trang) thay vì `alert`, nội dung lấy `json.error`.
- Giữ nguyên giao diện và cơ chế kéo bằng pointer hiện có.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0 (toàn bộ `npx vitest run` + `tsc --noEmit`)
- [ ] Thêm/sửa/xoá/tạo unit/kéo thả không còn spinner toàn cây; unit đang mở giữ nguyên trạng thái
- [ ] Thả vào khe ngay trên/dưới chính mục không hiện preview và không đổi gì
- [ ] `report.md` dán nguyên văn output `verify.sh`, liệt kê file đã tạo/sửa

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không lách bằng nhánh `NODE_ENV`/`VITEST`.
- **Không chạy lệnh shell để dò/xoá file** (`find`, `ls`, `rm`, `git rm` từng bị từ chối) — dùng công cụ đọc/ghi file; chỉ chạy `python3 scripts/handoff.py …`, `npx vitest`, `npx tsc`.
- `lib/curriculum-dnd.ts` không được truy cập DOM hay state React — phải thuần để test được.
- Không đổi schema `curriculum_items`, không thêm migration.
- `COUNT`/`MAX` trên pg thật có thể trả chuỗi → `Number(...)`.
- Không thêm thư viện kéo thả mới.
