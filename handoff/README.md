# Giao việc Claude ↔ Antigravity

| Vai trò | Ai | Trách nhiệm |
| :--- | :--- | :--- |
| Trưởng phòng / Giám đốc sản phẩm | **Claude Code** | Phân tích nghiệp vụ, thiết kế kiến trúc, viết đặc tả (`brief.md`), viết test + `verify.sh`, giao việc, nghiệm thu, cập nhật `docs/` |
| Kỹ sư thực thi | **Antigravity (Gemini)** | Đọc brief, viết code trong phạm vi được giao, tự kiểm, viết `report.md`, nộp |

## Vòng đời task

```
draft ──dispatch──▶ assigned ──start──▶ in_progress ──submit──▶ submitted
                                            ▲                      │
                                            │                 verify (Claude)
                                          start                    │
                                            │            ┌─────────┴─────────┐
                                    changes_requested ◀─reject           accept──▶ accepted
```

`state.json` chỉ do `scripts/handoff.py` ghi — không ai sửa tay.

## Quy tắc cứng

1. **Test đã khoá là hợp đồng** (do trưởng phòng hoặc tài khoản kiểm chéo viết). Người code không được sửa/xoá `verify.sh` và các file test liệt kê trong `tests.lock`. Hai lớp bảo vệ: hook `.agents/hooks.json` chặn ngay khi agent định sửa; `submit`/`verify` kiểm SHA-256 lúc nộp.
2. **Không làm ngoài phạm vi.** Chỉ chạm file trong `brief.md` mục 3. Cần thêm → ghi vào mục "câu hỏi" của `report.md`, không tự ý làm.
3. **Báo cáo trung thực.** Output verify dán nguyên văn; việc chưa xong ghi rõ.
4. **Docs do trưởng phòng giữ.** Antigravity không sửa `docs/` trừ khi brief cho phép.

## Tiết kiệm công trưởng phòng, tận dụng tối đa Antigravity

Antigravity viết **toàn bộ** code sản phẩm, kể cả phần khó. Claude chỉ làm phần cần suy nghĩ: lập kế hoạch, đặc tả, test, quyết định nghiệm thu.

- **Kế hoạch theo ma trận** (`handoff/templates/plan.md`) cho việc nhiều task: mỗi task có độ khó `HIGH/LOW` và khối lượng `S/M/L`. Task `L` phải chẻ nhỏ. Task `HIGH` thì brief kèm **blueprint** (interface/kiểu dữ liệu, mã giả, các bước), không kèm code hoàn chỉnh.
- **Chạy song song**: mỗi tài khoản Antigravity chạy 2 task cùng lúc, mỗi task một worktree. Giao các task độc lập (khác file) cùng lúc thay vì chờ từng task.
- **Cầu cứu**: Antigravity tự sửa tới khi verify xanh; sau 2 lần sửa liên tiếp vẫn đỏ vì bế tắc giải thuật (không phải lỗi cách chạy lệnh) thì ghi phân tích vào `report.md` mục "câu hỏi" và dừng. Lúc đó Claude mới can thiệp: bổ sung blueprint, hoặc tự viết đoạn lõi.
- **Việc cơ học không tốn mô hình mạnh**: `verify --quiet` chỉ in tóm tắt (log đầy đủ ghi ra file). Chạy lệnh, đọc log dài, kéo kết quả từ máy thợ, tìm file → giao cho subagent `dieu-phoi` (Haiku), chỉ nhận về bản tóm tắt. Quyết định duyệt đạt/trả về luôn do Claude.
- `dispatch`/`reject` qua `agy` chạy nền, xong thì Claude được báo — không thăm dò trạng thái.

## Kiểm thử & nghiệm thu chéo giữa các tài khoản Antigravity

Các tài khoản Antigravity (agy1, agy2, … — thêm bao nhiêu cũng được) **ngang hàng**. Mỗi task: một tài khoản **code**, một tài khoản **khác** viết test trước rồi nghiệm thu sau. Task sau đổi vai, nên vẫn chạy song song: agy1 code TASK-A trong khi agy2 code TASK-B, rồi kiểm chéo cho nhau.

```
draft ─dispatch-tests (người kiểm)─▶ tests_assigned ─tests-done─▶ tests_ready
      ─dispatch (người code)─▶ assigned ─start─▶ in_progress ─submit─▶ submitted
      ─dispatch-review (người kiểm)─▶ in_review ─review-pass─▶ accepted (LOW) | review_passed (HIGH/nhạy cảm → Claude)
                                                └review-fail─▶ changes_requested ─reject─▶ người code sửa (tối đa 2 vòng)
```

- **Một lệnh cho cả chuỗi:** `python3 scripts/handoff.py auto <ID> [--coder agy1 --checker agy2]` (chạy nền; không ghi tài khoản thì chia đều theo số task). Dừng khi đạt, khi cần Claude duyệt cuối, hoặc khi agent dừng giữa chừng / cầu cứu / trả về quá 2 vòng.
- **Claude chỉ:** lập kế hoạch, viết `brief.md` (ghi **Độ khó** và **Nhạy cảm** ở đầu, phạm vi file ở mục 3, tiêu chí đo được ở mục 5), chạy `auto`, đọc kết quả cuối. Task `HIGH` hoặc nhạy cảm (phân quyền, tiền, migration, bảo mật) → Claude duyệt lần cuối sau khi nghiệm thu chéo đạt.
- **Cửa cứng bằng script** (không dựa vào lời agent):
  - `tests-done`: người kiểm chỉ được đổi file trong `test_paths` + `verify.sh` của task; test phải **đỏ** khi chưa có code; script tự khoá test.
  - `submit`: khoá test nguyên vẹn, file đã đổi nằm trong brief mục 3, verify xanh.
  - `review-pass`: lại kiểm khoá test, phạm vi, verify xanh; code không được đổi kể từ lúc giao nghiệm thu (so dấu vân tay) — người nghiệm thu không sửa code được.
  - Người code ≠ người viết test, người nghiệm thu ≠ người code.
- **Model:** `agy_model` = `claude-sonnet-5-5-medium`; hết hạn mức → tự chuyển `agy_fallback_models` (`gemini-3.8-flash-high`) trong cùng hội thoại.
- **Tài khoản trên từng máy:** tự nhận `~` (agy1) và `~/.agy-accountN` (agyN) — `python3 scripts/handoff.py accounts`. Máy thợ đặt tên riêng trong `~/.config/handoff/accounts.json`, vd `{"agy2": "~/.agy-worker", "agy3": "~/.agy-account3"}`. Nghiệm thu chéo cần ≥ 2 tài khoản **trên cùng máy chạy task** (vì cùng worktree); máy chỉ có 1 tài khoản thì chạy `dispatch` thường và Claude nghiệm thu.
- Người nghiệm thu chỉ chạy được `python3` → dùng `scope <ID>` và `diff <ID>` thay cho `git`.

## Cấu hình riêng của dự án — `handoff/config.json`

| Khoá | Ý nghĩa |
| :--- | :--- |
| `protected_paths` | Thư mục/file agent thực thi **không bao giờ** được sửa (mã cũ, vendor, dữ liệu gốc…). Hook chặn theo tiền tố đường dẫn, vd `"legacy/"`. |
| `test_paths` | Nơi người kiểm (nghiệm thu chéo) được viết test, mặc định `["tests/", "e2e/"]`. |
| `agy_model` | Slug model mặc định cho `agy` (xem `agy models`); `null` = mặc định của agy. |
| `agy_fallback_models` | Model dự phòng, vd `["gemini-3.8-flash-high", "gemini-3.8-flash-low"]`. Model đang dùng hết hạn mức (429) mà task chưa nộp → script tự chuyển sang model kế tiếp trong cùng hội thoại. |
| `agy_timeout` | Thời gian tối đa một lần chạy `agy`, vd `"60m"`. |

Luôn được bảo vệ, không cần khai báo: file trong `tests.lock`, `brief.md`/`state.json`/`review.md`/`tests.lock` của mọi task, `scripts/handoff.py`, `scripts/agy_guard.py`, `.agents/`, `handoff/config.json`, mọi `.env*`.

## Cách Claude gửi việc sang Antigravity

`dispatch` (và `reject`) dùng đường đầu tiên chạy được:

| Thứ tự | Đường | Điều kiện | Đặc điểm |
| :---: | :--- | :--- | :--- |
| 1 | **`agy -p`** (Antigravity CLI) | Đã cài và đăng nhập `agy` | Claude chờ agent làm xong rồi nghiệm thu luôn; `reject` nhắn tiếp đúng hội thoại cũ (`--conversation`) |
| 2 | `agentapi` | Claude Code chạy trong terminal tích hợp của Antigravity | Hội thoại riêng cho từng task trong Antigravity |
| 3 | `antigravity-ide chat -m agent` | Đã cài Antigravity IDE | Mở dự án trong IDE và gửi prompt; người dùng báo lại khi xong |
| 4 | Clipboard | Luôn có | Dán thủ công |

Ép một đường: `python3 scripts/handoff.py dispatch TASK-001 --via ide`.

### Cài Antigravity CLI (một lần cho cả máy)

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

```bash
agy
```

Lần chạy `agy` đầu tiên để đăng nhập, rồi thoát (`/exit`). Sau đó cho phép agent chạy `python3` mà không hỏi (cần để `handoff.py` và test chạy được ở chế độ ngầm) — thêm vào `~/.gemini/antigravity-cli/settings.json`:

```json
{ "permissions": { "allow": ["command(python3)"] } }
```

Thêm lệnh riêng của dự án nếu task cần (vd `"command(npm)"`, `"command(pytest)"`). **Không** dùng `--dangerously-skip-permissions`.

Kiểm tra mọi thứ đã sẵn sàng:

```bash
python3 scripts/handoff.py doctor
```

## Lệnh nhanh

```bash
python3 scripts/handoff.py list                 # bảng trạng thái
python3 scripts/handoff.py verify TASK-001      # kiểm khoá test + chạy verify.sh
python3 scripts/handoff.py verify TASK-001 --quiet  # chỉ in tóm tắt, log đầy đủ ra file (trưởng phòng nghiệm thu)
python3 scripts/handoff.py doctor               # kiểm tra bộ phối hợp & agy
```
