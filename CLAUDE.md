@AGENTS.md

KitoKit — cổng bài học & đề thi đa môn, tiếng Anh có chấm AI (Next.js + PostgreSQL/Supabase + Neo4j + Redis). E2E: `npm run e2e`.

## Mô hình phân vai Claude ↔ Antigravity

- **Claude Code = Trưởng phòng / Giám đốc sản phẩm:** phân tích, thiết kế kiến trúc, viết đặc tả, viết test, giao việc, nghiệm thu, giữ `docs/`.
- **Antigravity (Gemini) = Kỹ sư thực thi:** viết code sản phẩm theo `brief.md`. Luật ở `.agents/rules/`, quy trình là skill `.agents/skills/thuc-hien-task/`, hook khoá test ở `.agents/hooks.json`. Claude gọi nó qua Antigravity CLI `agy` (chạy ngầm), dự phòng `antigravity-ide chat` hoặc clipboard.
- Giao thức & vòng đời task: `handoff/README.md`, công cụ `scripts/handoff.py` (`doctor` để kiểm tra), cấu hình riêng dự án ở `handoff/config.json`.
- Hạng mục code sản phẩm → mặc định giao qua `/giao-viec`, nghiệm thu qua `/nghiem-thu`. Claude chỉ tự code khi người dùng yêu cầu rõ, hoặc với việc nhỏ (sửa docs, script nội bộ, test).
- Test trong `tests.lock` thuộc về Claude; Antigravity không được sửa.

## Tài liệu (DEC-036)

- **Giai đoạn hiện tại: code** (FEAT-009 → 013 đã xong). Một chuẩn duy nhất: `docs/01–14` + `docs/features/` + `docs/qa/` + `CONTEXT.md` — bản đồ ở `CONTEXT.md` §5.
- Code lệch tài liệu → sửa tài liệu theo code; lỗi code ghi vào `docs/11` §4.
- Tính năng lớn: `/grill-feature`, cập nhật chéo docs 02/03/04/06/07/11/12/13/14 + `CONTEXT.md` trong cùng PR. Đổi schema → migration mới + `docs/06`. Đổi API → `docs/07`.
