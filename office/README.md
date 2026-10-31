# Văn phòng ảo

Mô phỏng phòng làm việc theo thời gian thực: **Bạn** (Giám đốc), **Claude** (Trưởng phòng), **Agy 1 / Agy 2** (Antigravity, nhân viên).
Giao diện chỉ *quan sát* một file sự kiện chung, không điều khiển agent nào.

```bash
npm run office        # mở http://localhost:4317
npm run office:demo   # kịch bản giả lặp lại, để xem khi chưa nối Antigravity
```

## Luồng dữ liệu

```
hook Claude Code ─┐
handoff.py / agy ─┼─► ~/.office-sim/events.jsonl ─► server.mjs (fs.watch → SSE) ─► trình duyệt (Canvas 2D)
demo.mjs ─────────┘
```

- File sự kiện mặc định `~/.office-sim/events.jsonl` (đổi bằng `OFFICE_EVENTS`), dùng chung cho mọi worktree.
- Mỗi dòng: `{"ts","who","type","to?","task?","text?"}`; `who` ∈ `giamdoc|truongphong|agy1|agy2`,
  `type` ∈ `assign|accept|work|submit|review|approve|reject|wait|idle|error` (xem `events.mjs`).
- **Claude**: `office/claude-hooks.json` gắn `hook.mjs` vào `UserPromptSubmit`, `PreToolUse`, `Notification`, `Stop`.
  Hook đang **tắt**; muốn bật thì chép khối `hooks` trong file đó vào `.claude/settings.json` (hoặc `.claude/settings.local.json` nếu chỉ bật trên máy mình), rồi mở phiên Claude mới.
  Nội dung prompt (60 ký tự đầu) được ghi vào file sự kiện trên máy.
- **Antigravity**: gọi từ `handoff.py` hoặc script của agent khi đổi trạng thái task, ví dụ:

```bash
node office/emit.mjs truongphong assign --to agy1 --task TSK-21 --text "API thống kê"
node office/emit.mjs agy1 accept --task TSK-21
node office/emit.mjs agy1 submit --to truongphong --task TSK-21
node office/emit.mjs truongphong reject --to agy1 --task TSK-21 --text "Thiếu test RBAC"
node office/emit.mjs truongphong approve --to agy1 --task TSK-21
```

## Hiệu năng

- Server không dùng thư viện ngoài, chỉ đọc phần mới của file khi `fs.watch` báo (thêm một lần `stat` mỗi 3 giây để dự phòng), tốn khoảng 15MB RAM.
- Canvas 384×216 được phóng to kiểu pixel-art; nền tĩnh vẽ sẵn một lần.
  Chạy 12 fps khi có hoạt động, 4 fps khi yên, dừng hẳn khi tab bị ẩn.
- Khi mở trang hoặc kết nối lại, trang dựng lại trạng thái từ 400 sự kiện gần nhất mà không phát lại hoạt cảnh.
