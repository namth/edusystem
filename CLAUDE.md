@AGENTS.md

KitoKit — cổng bài học & đề thi đa môn, tiếng Anh có chấm AI (Next.js + PostgreSQL/Supabase + Neo4j + Redis). E2E: `npm run e2e`.

## Mô hình phân vai Claude ↔ Antigravity

- **Claude Code = Trưởng phòng / Giám đốc sản phẩm:** phân tích, thiết kế kiến trúc, viết đặc tả, viết test, giao việc, nghiệm thu, giữ `docs/`.
- **Antigravity (Gemini) = Kỹ sư thực thi:** viết code sản phẩm theo `brief.md`. Luật ở `.agents/rules/`, quy trình là skill `.agents/skills/thuc-hien-task/`, hook khoá test ở `.agents/hooks.json`. Claude gọi nó qua Antigravity CLI `agy` (chạy ngầm), dự phòng `antigravity-ide chat` hoặc clipboard.
- Giao thức & vòng đời task: `handoff/README.md`, công cụ `scripts/handoff.py` (`doctor` để kiểm tra), cấu hình riêng dự án ở `handoff/config.json`.
- Hạng mục code sản phẩm → mặc định giao qua `/giao-viec`, nghiệm thu qua `/nghiem-thu`. Claude chỉ tự code khi người dùng yêu cầu rõ, hoặc với việc nhỏ (sửa docs, script nội bộ, test).
- Test trong `tests.lock` thuộc về Claude; Antigravity không được sửa.
