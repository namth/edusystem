# TASK-040 — Gộp Bộ tiêu chí AI vào trang Chuẩn chấm điểm

> Người giao: Claude (Trưởng phòng) · Người thực hiện: Antigravity
> Đặc tả: `docs/features/quan-tri-he-thong.md` (FEAT-013) §4 (đoạn `/admin/scoring-standards` có 2 tab) · Quyết định **DEC-030**.
> Chỉ đổi giao diện, **không đổi DB/API**. Chạy song song với TASK-038 và TASK-039, không chạm file của hai task đó.

## 1. Tài liệu bắt buộc đọc
- `app/admin/rubrics/page.tsx` (nguồn chuyển sang component), `app/admin/scoring-standards/page.tsx`, `components/AdminLayout.tsx`.
- Test:
  - `tests/scoring-rubrics-merge.test.ts` (mới).
  - `tests/scoring-standards-api.test.ts` §"Trang admin SCR-E1": các chuỗi bắt buộc vẫn phải nằm trong `app/admin/scoring-standards/page.tsx`, nên **giữ phần chuẩn chấm trong file page**.
  - `tests/design-rules.test.ts`, `tests/brand-tokens.test.ts`.
  - Mọi test khác phải xanh.

## 2. Phạm vi file
**Được tạo/sửa:**
- `components/admin/RubricManager.tsx` (mới)
- `app/admin/rubrics/page.tsx` (thay bằng trang chuyển hướng)
- `app/admin/scoring-standards/page.tsx`
- `components/AdminLayout.tsx` (chỉ xoá mục menu rubrics)

**Không được sửa:** `tests/**`, `e2e/**`, `docs/**`, `package*.json`, `app/api/**`, `lib/**`, và mọi trang khác.

## 3. Đặc tả
### 3.1 `components/admin/RubricManager.tsx`
- Chuyển **toàn bộ** chức năng của `app/admin/rubrics/page.tsx` hiện tại (danh sách, lọc theo framework, tạo, sửa, xoá, sửa tiêu chí và thang điểm, ngôn ngữ phản hồi) sang `export default function RubricManager({ initialRubricId }: { initialRubricId?: string | null })`.
- `"use client"`, **không** bọc `AdminLayout`. Thanh tìm kiếm của `AdminLayout` cũ thay bằng ô `<input placeholder="Tìm …">` nằm trong component.
- Khi danh sách tải xong mà có `initialRubricId` khớp một tiêu chí → tự mở form sửa tiêu chí đó và cuộn tới. Không khớp → bỏ qua, không báo lỗi.
- Tiêu đề khối: "Bộ tiêu chí AI" (Writing/Speaking). Bỏ các câu quảng cáo kiểu "Tự động hóa 100%…".

### 3.2 `app/admin/rubrics/page.tsx` → server component chuyển hướng
```tsx
import { permanentRedirect } from "next/navigation";
export default async function Page({ searchParams }: { searchParams: Promise<{ rubric?: string }> }) {
  // → "/admin/scoring-standards?tab=rubrics" (+ "&rubric=<id>" khi có, encodeURIComponent)
}
```

### 3.3 `app/admin/scoring-standards/page.tsx`
- Giữ nguyên phần chuẩn chấm, chỉ thêm tab. Component nội dung đọc `useSearchParams()`, và page export mặc định bọc nó trong `<Suspense>` (bắt buộc với Next 16 khi dùng `useSearchParams`).
- Thanh tab dưới tiêu đề trang: **"Chuẩn chấm"** (`tab=standards`, mặc định) | **"Bộ tiêu chí AI"** (`tab=rubrics`). Bấm tab → `router.replace(\`/admin/scoring-standards?tab=${…}\`)`, tab đang chọn tô `brand`.
- `tab=rubrics` → render `<RubricManager initialRubricId={searchParams.get("rubric")} />`, ẩn danh sách và nút tạo chuẩn.
- Ô tìm kiếm của `AdminLayout` chỉ truyền khi ở tab chuẩn chấm.
- Trong form phần thi Writing/Speaking, cạnh ô chọn `rubric_id`, khi đã chọn tiêu chí thì có link **"Sửa tiêu chí này"** → `/admin/scoring-standards?tab=rubrics&rubric=${encodeURIComponent(sec.rubric_id)}`. Đổi tab trong cùng trang là đủ, nhưng phải giữ được dữ liệu form đang soạn: mở bằng tab mới (`target="_blank"`) hoặc hỏi xác nhận trước khi rời form.
- Tiêu đề trang: "Chuẩn chấm điểm". Mô tả ngắn: chuẩn chấm quy đổi điểm từng kỹ năng; bộ tiêu chí AI dùng cho Writing/Speaking và được nhiều chuẩn dùng chung.

### 3.4 `components/AdminLayout.tsx`
Chỉ xoá dòng menu `{ href: "/admin/rubrics", … }` và import icon không còn dùng. Không đổi thứ tự hay nhãn các mục khác, vì TASK-042 sẽ sắp lại menu.

## 4. Tiêu chí nghiệm thu
- [ ] `python3 scripts/handoff.py verify TASK-040` exit 0
- [ ] `report.md` dán nguyên văn output

## 5. Ràng buộc & bẫy cần tránh
- Không sửa test. **Chỉ được chạy `python3 scripts/handoff.py …`.**
- Không cắt bớt chức năng khi chuyển trang rubrics sang component. Hành vi CRUD phải giữ y như cũ.
- Quy tắc giao diện DEC-022/DEC-035: không viết mã hex trong class, icon trên nền xanh dùng `text-white`, nhãn nút không có "+" ở đầu, gradient chỉ một dải màu.
- Đủ trạng thái tải / rỗng / lỗi cho tab tiêu chí.
