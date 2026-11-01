# TASK-028 — Bố cục trang làm bài tự chọn theo nội dung (thẻ tập trung / chia đôi / thanh nghe)

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

## 1. Mục tiêu
Trang làm đề học sinh `app/student/exam/[examId]` (pha `running`) đang xếp mọi câu thành một cột dài trong khung menu học sinh. Đề Cambridge chủ yếu 1–2 câu kèm **ảnh**, đề IELTS có **bài đọc dài** dùng chung nhiều câu → cần bố cục tự chọn theo nội dung (DEC-020). Chỉ đổi giao diện/điều hướng; **không đổi** luồng lượt thi, đồng hồ, lưu tạm, nộp bài, định dạng câu trả lời, chấm điểm.

## 2. Tài liệu bắt buộc đọc
- `docs/14-decisions.md` DEC-016, DEC-020; `CONTEXT.md` mục 3
- `app/student/exam/[examId]/page.tsx` (luồng hiện tại), `components/lesson-player/LessonPlayer.tsx`
- `lib/exam-player.ts` (`groupQuestionsBySkill`), `lib/lesson-player.ts` (`countAnswered`), `lib/stimulus-html.ts` (`sanitizeStimulusHtml` — đã có, dùng lại)
- Test: `tests/exam-layout.test.ts` (hợp đồng chính), `tests/exam-runner-ui.test.ts` (phải tiếp tục xanh)

## 3. Phạm vi file
**Được tạo/sửa:**
- `lib/exam-layout.ts` (mới — hàm thuần, xem §4.1)
- `components/exam-runner/*.tsx` (mới, tuỳ chia: vd `ExamTopBar`, `QuestionNavigator`, `FocusScreen`, `SplitScreen`, `ListeningBar`)
- `app/student/exam/[examId]/page.tsx` (chỉ pha `running` + modal xác nhận nộp; các pha khác giữ nguyên)
- `components/lesson-player/LessonPlayer.tsx` (chỉ thêm prop §4.3, không đổi cách ghi câu trả lời)

**Không được sửa:** mọi file trong `tests.lock`, `lib/stimulus-html.ts`, `lib/exam-player.ts`, `lib/lesson-player.ts`, `lib/grading.ts`, route API, `components/StudentLayout.tsx`, `package.json`/`package-lock.json`, `docs/`, trang khác.

## 4. Đặc tả chi tiết
### 4.1 `lib/exam-layout.ts` — chữ ký đúng như test
- `SPLIT_MIN_CHARS = 600`; `stimulusPlainLength(html)`: bỏ thẻ, gộp khoảng trắng, trim, đếm ký tự.
- `buildScreens(questions): ExamScreen[]` với `ExamScreen = { key, skill, mode: "FOCUS"|"SPLIT"|"LISTENING", stimulus_text, stimulus_audio_url, questionIds }`. Duyệt theo `groupQuestionsBySkill`; câu **liên tiếp cùng kỹ năng** có ngữ cảnh **khác rỗng** và giống nhau (so `stimulus_text` đã trim + `stimulus_audio_url`) gộp một màn; câu không có ngữ cảnh mỗi câu một màn. `key` = id câu đầu. Mode: có audio → LISTENING; ngữ cảnh ≥ 600 → SPLIT; còn lại FOCUS.
- `navStatus`, `screenIndexOfQuestion`, `clampScreenIndex`, `unansweredNumbers` (dùng `countAnswered`), `formatSavedAt`, `keyToOptionLetter`, `isTypingTarget`, `applyOptionShortcut` — hành vi đúng như test.

### 4.2 Trang (pha `running`)
- **Toàn màn hình:** bọc bằng lớp `fixed inset-0` (z cao hơn menu/header của `StudentLayout`, nền `#fff8f5`), tự cuộn bên trong.
- **Thanh trên** (cố định): Thoát (về `/student/dashboard`, xác nhận trước), tên đề, "Màn x / n", số câu đã làm, đồng hồ (giữ hiệu ứng < 5 phút), trạng thái lưu (`formatSavedAt` sau mỗi lần `saveTempAnswers` thành công; lỗi → "Chưa lưu được"), nút Nộp bài, nút mở bảng câu hỏi. Có > 1 kỹ năng → chip kỹ năng nhảy tới màn đầu của kỹ năng đó (vẫn dùng `groupQuestionsBySkill`).
- **Thanh tiến độ** theo số câu đã làm / tổng.
- **FOCUS:** thẻ giữa màn (max ~720px): ngữ cảnh trên (ảnh tối đa ~45vh, `object-contain`), dưới là `LessonPlayer` với các câu của màn (`hideStimulus`). Đáp án dễ bấm trên điện thoại.
- **SPLIT (≥ lg):** 2 cột — trái: ngữ cảnh cuộn độc lập, chỉnh cỡ chữ (3 mức), giữ vị trí cuộn khi đổi câu trong cùng màn; giữa: thanh kéo (`onPointerDown` + pointermove/up, tỷ lệ 30–70%, mặc định 55%); phải: câu hỏi cuộn độc lập. **< lg:** 2 thẻ "Bài đọc" / "Câu hỏi".
- **LISTENING:** thanh `<audio controls>` dính trên vùng nội dung (dưới thanh trên), câu hỏi một cột bên dưới; ngữ cảnh chữ (nếu có) hiển thị trên câu hỏi.
- **Điều hướng đáy:** Câu/Màn trước, "Đánh dấu xem lại" (bật/tắt theo câu — với màn nhiều câu thì đánh dấu cả màn là đủ, lưu theo id câu), Màn tiếp; màn cuối → nút Nộp bài.
- **Bảng câu hỏi:** ô số theo thứ tự màn, màu theo `navStatus` (đang làm / đánh dấu / đã làm / trống) + chú thích; bấm → nhảy màn (`screenIndexOfQuestion`). Desktop rộng: cột phải thu gọn được; điện thoại: ngăn trượt.
- **Phím tắt** (`keydown` trên window, gỡ khi dọn; bỏ qua khi `isTypingTarget(e.target)`): `ArrowLeft`/`ArrowRight` đổi màn; 1–4/A–D gọi `applyOptionShortcut` cho màn có đúng 1 câu, kết quả khác `null` thì ghi vào `answers`.
- **Rời trang:** `beforeunload` khi pha `running` (gỡ khi rời pha).
- **Nộp bài:** modal hiện danh sách số câu chưa làm (`unansweredNumbers`) dạng nút nhảy tới câu đó; vẫn cho xác nhận nộp.
- Ngữ cảnh mỗi màn hiển thị **một lần** qua `dangerouslySetInnerHTML={{ __html: sanitizeStimulusHtml(...) }}`.
- Giữ nguyên phong cách màu hiện có (#6d3807, #fff8f5, #d8c2b6…).

### 4.3 `LessonPlayer`
- `hideStimulus?: boolean` (mặc định false): ẩn khối `stimulus_text` và `stimulus_audio_url` của từng câu.
- `startNumber?: number` (mặc định 1): đánh số "Câu N" liên tục giữa các màn.
- Các trang khác (bài học, xem lại, xem trước của giáo viên) không truyền prop mới → hiển thị như cũ.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` chạy exit 0
- [ ] `report.md` dán nguyên văn output `verify.sh`, kèm mô tả ngắn từng bố cục đã làm

## 6. Ràng buộc & bẫy cần tránh
- Không sửa test; không hard-code để qua test (vd chuỗi "FOCUS" chỉ trong comment) — trưởng phòng sẽ mở trang thật để nghiệm thu.
- **Chỉ được chạy `python3 scripts/handoff.py …`** (kiểm tra bằng `python3 scripts/handoff.py verify TASK-028`). `npx`, `git`, `find`, `ls`, `rm` bị từ chối quyền.
- Không thêm thư viện. Không dùng `localStorage` cho câu trả lời (đã có lưu tạm qua API). Đánh dấu/tỷ lệ chia/cỡ chữ chỉ là state trong trang.
- Đồng hồ, tự nộp khi hết giờ, lưu tạm 30 giây, polling kết quả: giữ nguyên logic.
- Không phá `tests/exam-runner-ui.test.ts` (vẫn dùng `LessonPlayer` với `allowSpeaking`, `groupQuestionsBySkill`).
