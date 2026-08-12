<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# WORKSPACE SHORTCUT RULES & TRIGGERS

Tất cả các rules trong `.antigravity/rules/` và `.agents/rules/` được tự động áp dụng và cho phép người dùng kích hoạt trực tiếp trong khung chat bằng các từ khóa ngắn (Triggers) dưới đây:

### 1. `grill-feature` / `phỏng vấn tính năng`
- **Tệp quy tắc:** [`.antigravity/rules/grill-feature.md`](file:///Users/namtran/Local%20Apps/learningsystem/.antigravity/rules/grill-feature.md) / [`.agents/rules/grill-feature.md`](file:///Users/namtran/Local%20Apps/learningsystem/.agents/rules/grill-feature.md)
- **Kích hoạt:** Khi người dùng nhập `grill-feature`, `/grill-feature`, `phỏng vấn tính năng`, hoặc `tính năng mới`.
- **Hành động:** Đóng vai Senior Solutions Architect, thực hiện phỏng vấn từng câu một để làm rõ luồng trải nghiệm, tác động DB/API và xuất tài liệu spec vào `docs/features/`.

### 2. `grill-master` / `phỏng vấn kiến trúc`
- **Tệp quy tắc:** [`.antigravity/rules/grill-master.md`](file:///Users/namtran/Local%20Apps/learningsystem/.antigravity/rules/grill-master.md) / [`.agents/rules/grill-master.md`](file:///Users/namtran/Local%20Apps/learningsystem/.agents/rules/grill-master.md)
- **Kích hoạt:** Khi người dùng nhập `grill-master`, `/grill-master`, `grill with docs`, `phỏng vấn kiến trúc`, hoặc `khởi tạo dự án`.
- **Hành động:** Đóng vai Principal System Architect, phỏng vấn từng câu một về kiến trúc toàn hệ thống và xuất bộ tài liệu chuẩn trong `/docs/` (`overview.md`, `architecture.md`, `api-contracts.md`, v.v.).

### 3. `wayfinder` / `định vị code`
- **Tệp quy tắc:** [`.antigravity/rules/wayfinder.md`](file:///Users/namtran/Local%20Apps/learningsystem/.antigravity/rules/wayfinder.md) / [`.agents/rules/wayfinder.md`](file:///Users/namtran/Local%20Apps/learningsystem/.agents/rules/wayfinder.md)
- **Kích hoạt:** Khi người dùng nhập `wayfinder`, `/wayfinder`, `định vị code`, hoặc `khoanh vùng mã nguồn`.
- **Hành động:** Định vị chính xác Target Files (file sửa/tạo) và Context Files (file đọc tham chiếu), phân tích ảnh hưởng và xuất `WAYFINDER LOCATION REPORT` trước khi sửa code.
