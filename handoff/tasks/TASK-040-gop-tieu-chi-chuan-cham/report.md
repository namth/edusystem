# Báo cáo TASK-040 — Gộp Bộ tiêu chí AI vào trang Chuẩn chấm điểm

## Đã làm
- `components/admin/RubricManager.tsx` (mới): chuyển toàn bộ chức năng trang rubrics cũ (danh sách, lọc framework, tạo/sửa/xoá, tiêu chí, thang điểm, ngôn ngữ phản hồi). Client component, không bọc `AdminLayout`, có ô `Tìm …` riêng. Có `initialRubricId`: khi danh sách tải xong và khớp thì tự mở form sửa và cuộn tới thẻ; không khớp thì bỏ qua. Thêm trạng thái tải / rỗng / lỗi (nút Thử lại) và hiển thị lỗi lưu/xoá. Bỏ câu quảng cáo; tiêu đề khối "Bộ tiêu chí AI".
- `app/admin/rubrics/page.tsx`: server component, `permanentRedirect` tới `/admin/scoring-standards?tab=rubrics` (+ `&rubric=<id>` đã encode).
- `app/admin/scoring-standards/page.tsx`: bọc `Suspense`, đọc `useSearchParams`, thanh tab "Chuẩn chấm" | "Bộ tiêu chí AI" (`router.replace`, tab chọn tô brand). `tab=rubrics` render `RubricManager`, ẩn danh sách và nút tạo chuẩn; ô tìm của `AdminLayout` chỉ truyền ở tab chuẩn chấm. Thêm link "Sửa tiêu chí này" (`target="_blank"`, giữ dữ liệu form) cạnh ô chọn `rubric_id`. Tiêu đề "Chuẩn chấm điểm" + mô tả mới.
- `components/AdminLayout.tsx`: chỉ xoá mục menu rubrics và import `Award`.

## Kết quả kiểm thử
`python3 scripts/handoff.py verify TASK-040`:
```
 Test Files  48 passed (48)
      Tests  829 passed (829)
   Duration  523.03s

KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Câu hỏi
Không có.
