# Báo cáo TASK-028

## Đã làm
- Xây dựng module hàm thuần `lib/exam-layout.ts` theo đúng hợp đồng kiểm thử (`SPLIT_MIN_CHARS = 600`, `stimulusPlainLength`, `buildScreens`, `navStatus`, `screenIndexOfQuestion`, `clampScreenIndex`, `unansweredNumbers`, `formatSavedAt`, `keyToOptionLetter`, `isTypingTarget`, `applyOptionShortcut`).
- Bổ sung prop `hideStimulus?: boolean` (ẩn khối `stimulus_text` và `stimulus_audio_url` của từng câu khi trang đã hiển thị ngữ cảnh của màn) và `startNumber?: number` (đánh số thứ tự câu liên tục giữa các màn) vào `components/lesson-player/LessonPlayer.tsx`.
- Cập nhật pha `running` và modal xác nhận nộp bài trong `app/student/exam/[examId]/page.tsx`:
  - **Toàn màn hình & Thanh trên / Đáy / Bảng câu hỏi:** Bọc bằng lớp `fixed inset-0 z-50 bg-[#fff8f5]`, thanh trên cố định (nút Thoát có modal xác nhận lưu nháp trước khi về `/student/dashboard`, tên đề, `Màn x / n`, số câu đã làm, đồng hồ đếm ngược giữ hiệu ứng `< 5 phút`, trạng thái lưu nháp qua `formatSavedAt` / `"Chưa lưu được"`, nút mở/thu gọn Bảng câu hỏi, nút Nộp bài, chip chuyển nhanh kỹ năng), thanh tiến độ ngang, bảng câu hỏi màu theo `navStatus` kèm chú thích và nhảy màn qua `screenIndexOfQuestion`, thanh điều hướng đáy (Màn trước, Đánh dấu xem lại, Màn tiếp / Nộp bài), phím tắt (`ArrowLeft`, `ArrowRight`, `1–4` / `A–D` qua `applyOptionShortcut` khi không gõ trong ô nhập `isTypingTarget`), cảnh báo `beforeunload`, và modal xác nhận nộp bài liệt kê các câu chưa làm (`unansweredNumbers`) dạng nút bấm nhảy tới câu đó.
  - **Bố cục `FOCUS` (thẻ tập trung):** Dùng cho câu/nhóm câu có ngữ cảnh ngắn (< 600 ký tự chữ, không có audio) hoặc chỉ có ảnh. Hiển thị thẻ giữa màn (`max-w-[720px]`), ngữ cảnh HTML đã lọc qua `sanitizeStimulusHtml` hiển thị một lần phía trên (ảnh giới hạn `max-h-[45vh] object-contain`), bên dưới là `LessonPlayer` (`hideStimulus`, `startNumber`).
  - **Bố cục `SPLIT` (chia đôi kéo giãn):** Dùng cho câu/nhóm câu có bài đọc dài (`stimulusPlainLength >= 600`, không có audio). Trên màn rộng (`≥ lg`) chia 2 cột cuộn độc lập với thanh kéo giữa (`onPointerDown`, tỷ lệ 30–70%, mặc định 55%), cột trái có chọn cỡ chữ 3 mức (`text-sm`, `text-base`, `text-lg`) và giữ vị trí cuộn khi chuyển giữa các câu trong cùng màn; trên màn hẹp (`< lg`) hiển thị 2 thẻ chuyển đổi `"Bài đọc"` / `"Câu hỏi"`.
  - **Bố cục `LISTENING` (thanh nghe cố định):** Dùng cho câu/nhóm câu có `stimulus_audio_url` (ưu tiên cao nhất). Thanh `<audio controls>` dính cố định phía trên vùng nội dung (`sticky top-0`), bên dưới là ngữ cảnh văn bản (nếu có) và danh sách câu hỏi một cột.

## File đã tạo/sửa
- `lib/exam-layout.ts`: Tạo mới các hàm thuần chia màn, chọn chế độ bố cục (`FOCUS` / `SPLIT` / `LISTENING`), tính trạng thái điều hướng, kiểm tra câu chưa làm, định dạng giờ lưu và xử lý phím tắt.
- `components/lesson-player/LessonPlayer.tsx`: Thêm prop `hideStimulus` và `startNumber` (mặc định giữ nguyên hành vi cho các trang khác).
- `app/student/exam/[examId]/page.tsx`: Nâng cấp giao diện pha `running` sang toàn màn hình với 3 bố cục tự động theo nội dung màn, bảng câu hỏi, đánh dấu xem lại, phím tắt, cảnh báo rời trang và danh sách câu chưa làm khi nộp.

## Kết quả tự kiểm
```text
$ bash handoff/tasks/TASK-028-bo-cuc-trang-lam-bai/verify.sh

 RUN  v3.2.7 /Users/namtran/Local Apps/learningsystem/.claude/worktrees/drag-drop-exercises-roadmap-fe6c15

 ✓ tests/exam-layout.test.ts (23 tests) 12ms
 ✓ tests/exam-runner-ui.test.ts (13 tests) 29ms
 ✓ tests/curriculum-api.test.ts (26 tests) 31147ms

 Test Files  35 passed (35)
      Tests  623 passed (623)
   Start at  12:16:14
   Duration  63.55s (transform 2.52s, setup 0ms, collect 2.91s, tests 420.63s, environment 6ms, prepare 2.95s)


KẾT QUẢ: khoá test OK, verify.sh exit 0
```

## Điểm lệch / câu hỏi cho trưởng phòng
Không
