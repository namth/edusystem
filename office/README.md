# Văn phòng ảo

Mô phỏng phòng làm việc theo thời gian thực: **Bạn** (Giám đốc), **Claude** (Trưởng phòng), **Agy 1** (Antigravity trên máy này)
và **Agy 2** (Antigravity trên máy khác, ngồi ở khu "Máy từ xa" kèm tên máy và IP).
Giao diện chỉ *quan sát* một file sự kiện chung, không điều khiển agent nào.

```bash
npm run office        # chỉ máy này: http://localhost:4317
npm run office:lan    # mở cho máy khác trong LAN (cần cho Agy 2), in sẵn lệnh để chạy trên máy đó
npm run office:demo   # kịch bản giả lặp lại, để xem khi chưa có việc thật
```

## Ai làm gì trên màn hình

| Hành động | Nguồn thật | Hoạt cảnh |
|---|---|---|
| Bạn gửi prompt cho Claude | hook `UserPromptSubmit` | Claude vào phòng giám đốc nhận hồ sơ |
| Claude tự làm | hook `PreToolUse` | Claude gõ phím ở bàn mình |
| Claude giao task | `state.json` → `assigned` | Claude mang hồ sơ tới bàn nhân sự (Agy 2: xuống khu máy từ xa) |
| Nhân sự nhận / **tự làm** | `in_progress`, file trong worktree đổi | nhân sự gõ phím ở bàn mình, bong bóng `⌨️ Sửa …`, màn hình chạy code |
| Nhân sự nộp | `submitted` | nhân sự giơ tay 🙋 tại bàn, chờ kiểm tra |
| **Claude kiểm tra bài** | Claude chạy `handoff.py verify/accept/reject <ID>` (hoặc `agy-worktree.sh verify`) | Claude cầm bảng kẹp **đi tới bàn người làm task**, màn hình bàn đó chạy test, bong bóng viền tím `🧪 …`; mọi lệnh tiếp theo của Claude được hiện là đang kiểm tra tại bàn đó |
| Claude duyệt đạt / trả về | `accepted` / `changes_requested` (lý do lấy từ `review.md`) | kết luận tại bàn nhân sự rồi Claude về chỗ |
| Claude chờ bạn | hook `Notification` | ✋ trên Claude, 📞 trên bàn giám đốc |

## Luồng dữ liệu

```
hook Claude Code ───────────┐
server: theo dõi handoff ───┼─► ~/.office-sim/events.jsonl ─► server.mjs (fs.watch → SSE) ─► trình duyệt
remote_agent.py (máy Agy 2) ┘   (qua POST /emit, /presence)
```

- File sự kiện mặc định `~/.office-sim/events.jsonl` (đổi bằng `OFFICE_EVENTS`), dùng chung cho mọi worktree.
- Mỗi dòng: `{"ts","who","type","to?","task?","text?"}`; `who` ∈ `giamdoc|truongphong|agy1|agy2`,
  `type` ∈ `assign|accept|work|submit|review|approve|reject|wait|idle|error` (xem `events.mjs`).
- **Claude**: `.claude/settings.json` gắn `hook.mjs` vào `UserPromptSubmit`, `PreToolUse`, `Notification`, `Stop`.
  Phiên Claude mới mở trong repo mới nạp hook. Nội dung prompt (60 ký tự đầu) được ghi vào file sự kiện trên máy.
  Muốn tắt: xoá khối `hooks` trong `.claude/settings.json`.
- **Agy 1 (máy này)**: server tự theo dõi `handoff/tasks/*/state.json` ở repo chính và mọi worktree trong
  `../agy-worktrees/` (đổi bằng `AGY_WT_DIR`), cùng file đang bị sửa trong các worktree đó. Không cần sửa `handoff.py`.
  Nhân sự mặc định của máy này là `agy1` (đổi bằng `OFFICE_LOCAL_AGENT`).
- **Agy 2 (máy khác)**: chạy trên máy đó (chỉ cần Python 3, chép riêng file `remote_agent.py` cũng được):

```bash
python3 office/remote_agent.py --server http://<IP-máy-chính>:4317 --token <token> --as agy2 --root <repo-trên-máy-đó>
```

  Lệnh đầy đủ kèm token được in ra khi chạy `npm run office:lan`. Agent báo có mặt mỗi 15 giây (tên máy, IP),
  theo dõi `handoff/tasks` và `git status` của repo trên máy đó. Quá 45 giây không thấy báo, Agy 2 hiện là ngoại tuyến 📴.
- Ghi sự kiện bằng tay: `node office/emit.mjs <who> <type> [--to x] [--task id] [--text "..."]`.

## Bảo mật

- `npm run office` chỉ nghe ở `127.0.0.1`.
- `npm run office:lan` nghe ở mọi giao diện mạng; mọi yêu cầu không đến từ máy này phải kèm token
  (`x-office-token` hoặc `?token=`). Token sinh ngẫu nhiên một lần, lưu ở `~/.office-sim/token`
  (đổi bằng `OFFICE_TOKEN`). Xem từ máy khác: `http://<IP>:4317/?token=<token>`.

## Hiệu năng

- Server không dùng thư viện ngoài, chỉ đọc phần mới của file khi `fs.watch` báo; quét `state.json` 2 giây một lần.
- Canvas 384×272 phóng to kiểu pixel-art, nền tĩnh vẽ sẵn một lần.
  Chạy 12 fps khi có hoạt động, 4 fps khi yên, dừng hẳn khi tab bị ẩn.
- Khi mở trang hoặc kết nối lại, trang dựng lại trạng thái từ 400 sự kiện gần nhất mà không phát lại hoạt cảnh.
