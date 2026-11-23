# 12 — Quy tắc nghiệp vụ & máy trạng thái

> Cập nhật: 2026-11-03.
> - Gom từ `docs/features/*` và DEC, đối chiếu với code. **Code là sự thật.** Quy tắc đã đổi được ghi rõ là "thay".
> - Mã quy tắc: `BR-<miền><NN>`. Miền A = tài khoản, T = dùng thử, S = slot, O = đơn hàng, L = bài học, E = đề thi, G = chấm AI, N = thông báo, D = tổng quan, B = bảng điểm (FEAT-014).

## 1. Tài khoản & đăng nhập (A)
- **BR-A01** Đăng nhập bằng email **hoặc** tên đăng nhập (`identifier`). Sai thông tin thì trả một thông điệp chung, có giới hạn tần suất.
- **BR-A02** `username` dài 4–30 ký tự `a-z0-9._`, duy nhất không phân biệt hoa thường. Học sinh không có email thì nhận email tạm `<username>@kito.io.vn` (`email_is_placeholder = true`) và đổi được sau (DEC-026).
- **BR-A03** Tài khoản do admin hoặc giáo viên tạo có `must_change_password = true`. Token mang cờ `mcp` thì mọi trang `/admin`, `/teacher`, `/student` chuyển về `/change-password`.
- **BR-A04** Đăng ký công khai chỉ tạo được `STUDENT` hoặc `TEACHER` dùng thử, vai trò quyết định theo route. Không tạo được `ADMIN`.
- **BR-A05** `PUT /api/profile` không đổi được `password`, `email`, `role`, `slot_limit`.

## 2. Giáo viên dùng thử (T): DEC-027, DEC-028; `lib/teacher-trial.ts`
- **BR-T01** Đang bị giới hạn khi `teacher_status IN ('TRIAL','REJECTED')`. Trạng thái `VERIFIED`, NULL, hoặc vai trò ADMIN không bị giới hạn. Trạng thái đọc từ DB ở mỗi request, nên xác minh xong có hiệu lực ngay.
- **BR-T02** Hạn mức `TRIAL_LIMITS`:

  | Hạng mục | Tối đa |
  | :--- | :--- |
  | Lớp | 1 (lớp tạo ra có `max_slots ≤ 3`) |
  | Nội dung (bài học + đề, gồm cả AI nhập) | 3 |
  | Học sinh khác nhau | 3 |
  | Lượt nộp mỗi bài/đề trong lớp dùng thử | 1 |

- **BR-T03** Vượt hạn mức trả 403 `{ code: "TRIAL_LIMIT", limit }`, trừ ghi danh bằng mã lớp trả 409. Giáo viên dùng thử không mua slot được.
- **BR-T04** Admin xác minh: `VERIFIED` và `slot_limit = GREATEST(slot_limit, 250)`. Từ chối thì giữ giới hạn và lưu ghi chú. Hai trường hợp đều gửi thông báo `TEACHER_VERIFIED`.

## 3. Slot học sinh (S): DEC-031; `lib/student-slots.ts`
- **BR-S01** 1 slot = 1 học sinh. Số đang dùng = `COUNT(DISTINCT enrollments.student_id)` trên mọi lớp có `classes.teacher_id = giáo viên`.
- **BR-S02** Ghi danh học sinh **mới** với giáo viên mà `used ≥ slot_limit` thì trả 409 "Thầy cô đã dùng hết slot học sinh…". Học sinh đã có ở lớp khác của cùng giáo viên không tốn thêm slot. Chủ lớp là ADMIN không bị giới hạn.
- **BR-S03** Kiểm ở mọi đường ghi danh, **trước** mọi lệnh INSERT: mã lớp / link mời / đăng ký kèm mã (`enrollStudentByCode`), giáo viên thêm học sinh (có sẵn hoặc tạo mới), admin `create-user` có `classIds`, admin `users/[id]` đổi `class_ids`. Bị chặn thì không tạo user thừa.
- **BR-S04** Thứ tự kiểm: quyền → giới hạn dùng thử → slot → sĩ số lớp `max_slots`.
- **BR-S05** Hạ `slot_limit` xuống dưới số đang dùng thì không xoá học sinh nào, chỉ chặn ghi danh mới.
- **BR-S06** Chấm AI **không đọc và không trừ** slot. Quy tắc này thay phần slot của BR-L11, BR-E07 và DEC-009/018/021.

## 4. Đơn hàng mua slot (O): DEC-032, DEC-033; `lib/slot-orders.ts`
- **BR-O01** Tiền là số nguyên VND do server tính. Đơn của giáo viên = `requested_slots × slot_pricing.unit_price_vnd`; `total_cost` client gửi bị bỏ qua.
- **BR-O02** `requested_slots` là số nguyên 1–10.000. Giá admin nhập là số nguyên 0–1.000.000.000. Giá khác giá chuẩn bắt buộc có `note`. 0 đồng (tặng) hợp lệ.
- **BR-O03** Mã đơn `KK` + 8 ký tự từ `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (`crypto.randomInt`), duy nhất. Nội dung chuyển khoản chỉ gồm mã đơn.
- **BR-O04** Duyệt (`approveOrder`): trong một giao dịch, `UPDATE … SET status='APPROVED' … WHERE id=$1 AND status='PENDING'`, rồi cộng `slot_limit`. Duyệt lần hai trả 409 và không cộng thêm. Thông báo gửi **sau** COMMIT.
- **BR-O05** Mọi thao tác (duyệt, từ chối, huỷ, báo chuyển khoản) chỉ chạy khi đơn `PENDING`. Đơn `APPROVED` không huỷ được; muốn thu hồi slot thì sửa `slot_limit` ở trang giáo viên.
- **BR-O06** Báo đã chuyển khoản không làm gì thêm nếu đã báo trước đó; lần đầu thì báo **mọi** admin. Từ chối bắt buộc lý do 1–500 ký tự.
- **BR-O07** Giáo viên thao tác đơn của người khác nhận 404.
- **BR-O08** QR chỉ sinh khi đã cấu hình `payment_account` (BIN 6 số, STK 6–19 số) **và** đơn còn `PENDING`. Payload theo EMVCo / NAPAS 247; bỏ tag 54 khi số tiền bằng 0. Nội dung được làm sạch: không dấu, in hoa, `[A-Z0-9 ]`, tối đa 25 ký tự.
- **BR-O09** Đơn giá slot lấy từ `system_settings.slot_pricing`. Thiếu dòng này thì dùng `SLOT_UNIT_PRICE_VND`, cũng thiếu thì 0.

## 5. Bài học & lộ trình (L): FEAT-010
- **BR-L01** Bài học thuộc `created_by`. TEACHER chỉ thao tác bài học của mình.
- **BR-L02** Không xoá bài học đang được `curriculum_items.lesson_id` tham chiếu; trả 409 kèm danh sách nơi dùng.
- **BR-L03** Gắn vào lộ trình yêu cầu bài học có ít nhất 1 khối. *(FEAT-017: ≥ 1 phần, BR-P02)*
- **BR-L04** Trạng thái mục theo `unlock_mode`:

  | Chế độ | Mục `OPEN` khi |
  | :--- | :--- |
  | `ALL_OPEN` | luôn luôn |
  | `MANUAL` | có `class_unlocks` (cả lớp hoặc riêng học sinh) cho mục đó hoặc unit cha |
  | `SEQUENTIAL` | là mục đầu, hoặc mọi mục trước đã `COMPLETED`, hoặc có ngoại lệ mở riêng cho học sinh |

  `COMPLETED`: bài học có `best_percent ≥ pass_percent`; đề thi có bài nộp đạt `passing_score`, hoặc chỉ cần có bài nộp nếu đề không có `passing_score`.
- **BR-L05** Đổi `unlock_mode` lúc nào cũng được; các dòng `class_unlocks` giữ nguyên.
- **BR-L06** Chấm khách quan trên server theo điểm thành phần: mỗi câu con, ô trống, cặp nối, thẻ = 1 điểm. *(FEAT-017: hết câu con — mỗi ý trắc nghiệm là một câu, BR-P12)*
- **BR-L07** Tự luận và trả lời ngắn chấm bằng AI, mỗi mục tối đa 1 điểm = band / 9.
- **BR-L08** `score_percent = (objective_earned + ai_earned) / (objective_max + ai_max) × 100`, làm tròn 1 chữ số; tổng tối đa = 0 thì lấy 100.
- **BR-L09** Đáp án không bao giờ có trong phản hồi cho học sinh trước khi nộp.
- **BR-L10** Làm lại không giới hạn. `best_percent` = điểm cao nhất trong các lần đã chấm xong.
- **BR-L11** *(thay bởi BR-S06)* Có câu AI thì lượt nộp ở `GRADING` và đẩy `LESSON_GRADING_REQUESTED`; không trừ slot, không còn `AI_SKIPPED` cho lượt mới.
- **BR-L12** Học sinh chỉ nộp được bài học đang `OPEN`, trong lớp đã ghi danh, và thuộc lộ trình khoá của lớp.

## 6. Đề thi & chuẩn chấm (E): FEAT-011
- **BR-E01** Chuẩn áp dụng: `exams.scoring_standard_id`; không có thì `courses.default_scoring_standard_id` của khoá chứa đề; không có nữa thì `std_internal_10`. Chuẩn được chụp vào `standard_snapshot` lúc bắt đầu thi.
- **BR-E02** Điểm phần nhóm theo `questions.skill` (FEAT-017: luôn bằng `sections.skill`, BR-P04). Quy đổi `LINEAR` hoặc `TABLE` (đề khác số câu chuẩn thì quy tỷ lệ về số câu chuẩn rồi tra bảng). Làm tròn theo `step`.
- **BR-E03** Có `classId`: học sinh phải đã ghi danh, và đề phải được giao cho lớp hoặc là mục EXAM đang mở trong lộ trình.
- **BR-E04** Số lần làm: theo `class_assignments.max_attempts`, mục lộ trình mặc định 1, lớp dùng thử 1. Đề trong ngân hàng luyện tập không giới hạn.
- **BR-E05** `deadline_at = started_at + duration_minutes`. Nộp sau `deadline_at + 2 phút` vẫn được chấm nhưng `is_late = true`. Lưu nháp sau hạn trả 409.
- **BR-E06** Điểm tổng chỉ tính các phần đã có điểm: `AVERAGE`, `SUM`, hoặc `WEIGHTED`, làm tròn theo `round_step`. `passed` theo `pass_score` và `section_min`.
- **BR-E07** *(thay bởi BR-S06)* Có mục AI thì `GRADING` và đẩy `GRADING_REQUESTED`. Đẩy lỗi thì `NEEDS_REVIEW` và báo giáo viên. Không trừ hay hoàn slot.
- **BR-E08** Nội dung đề cho học sinh đi qua `sanitizeQuestionForStudent`. Đáp án chỉ có trong `results` sau khi nộp.

## 7. Chấm AI (G): DEC-021, DEC-034
- **BR-G01** Mỗi mục AI thử tối đa 3 lần. Vẫn lỗi thì `NEEDS_REVIEW`: giữ điểm các phần đã chấm, `total_score = null`, **không** cho điểm thấp nhất.
- **BR-G02** Worker bỏ cuộc (`giveUp`) thì `NEEDS_REVIEW` một lần; gọi lại không đổi gì thêm.
- **BR-G03** *(thay bởi BR-B06/BR-B07, DEC-038; `grade-override` đã bỏ)* Giáo viên lớp (hoặc người tạo đề luyện tập) và ADMIN sửa điểm được qua `grade-override`, xong thì bài `GRADED`.
- **BR-G04** Mỗi lần gọi model thành công ghi đúng 1 dòng `ai_usage_logs` với token thật. Không có usage thì ghi 0. Lời gọi lỗi thì không ghi. Lỗi khi ghi log không làm hỏng việc chấm.
- **BR-G05** `cost_usd = in × giá_in / 1e6 + out × giá_out / 1e6`, theo giá của model. Khớp tên model theo thứ tự: chính xác → phần sau dấu `/` cuối → không phân biệt hoa thường. Model chưa có giá thì chi phí = 0.

## 8. Thông báo (N): DEC-021
- **BR-N01** Học sinh nhận `EXAM_GRADED` khi bài chuyển sang `GRADED` sau thời gian chờ (AI chấm hoặc giáo viên chấm). Bài toàn câu khách quan không tạo thông báo.
- **BR-N02** Giáo viên nhận `EXAM_NEEDS_REVIEW`; chấm lại thì cập nhật đúng thông báo cũ (khoá `user_id` + `type` + `ref_id`).
- **BR-N03** Admin nhận `TEACHER_SIGNUP` và `ORDER_PAID_REPORTED`. Giáo viên nhận `TEACHER_VERIFIED`, `ORDER_CREATED`, `ORDER_APPROVED`, `ORDER_REJECTED`.
- **BR-N04** Chuông thông báo hỏi lại server mỗi 60 giây. Chưa có email hay Zalo.

## 9. Tổng quan (D): FEAT-013; `lib/admin-dashboard.ts`
- **BR-D01** Kỳ tháng `[YYYY-MM-01 00:00, tháng sau 00:00)` theo giờ `Asia/Ho_Chi_Minh` (UTC+7). Không truyền tháng thì lấy tháng hiện tại theo giờ VN.
- **BR-D02** "Bài đã nộp" = `submissions.submitted_at` trong kỳ + `lesson_attempts.created_at` trong kỳ.
- **BR-D03** "Bài chấm bằng AI" = số `submission_id` khác nhau + số `lesson_attempt_id` khác nhau trong log có `purpose ∈ {EXAM_GRADING, LESSON_GRADING}`.
- **BR-D04** Chi phí VND = `usdToVnd(Σ cost_usd đã lưu, ai_pricing.usd_vnd_rate)`, làm tròn số nguyên. Doanh thu = Σ `total_cost` các đơn `APPROVED` có `decided_at` trong kỳ.
- **BR-D05** Top giáo viên: tối đa 10 người, sắp theo chi phí giảm dần, tính mọi `purpose`.

## 9b. Bảng điểm (B): FEAT-014, DEC-037 → DEC-041; `lib/gradebook.ts`, `lib/gradebook-data.ts`
Chi tiết đầy đủ ở `docs/features/cham-diem-bang-diem.md` §7. Tóm tắt:
- **BR-B01** Bài của lớp = mục `LESSON`/`EXAM` trong lộ trình khoá của lớp ∪ `class_assignments`, gộp trùng.
- **BR-B02** Lượt của bài trong lớp: đề theo `class_ref`, bài học theo `class_id`; bài luyện tự do không vào hub.
- **BR-B03** Ô điểm: `manual_score10` > `chosen_attempt_id` > lượt `GRADED` cao nhất (hoà → lượt sớm).
- **BR-B04** Thang 10 = `score_percent / 10` (bài học) hoặc `submissionScore().percent / 10` (đề), làm tròn 0.1.
- **BR-B05** "Chờ duyệt" = lượt `GRADED` có mục AI và `reviewed_at IS NULL`.
- **BR-B06** Chỉ sửa mục AI, trong thang của phần (đề) hoặc band 0–9 bước 0.5 (bài học); `ai_score`/`ai_feedback` không bao giờ bị ghi đè.
- **BR-B07** Lưu sửa → tính lại điểm, đặt `reviewed_at`; `NEEDS_REVIEW` → `GRADED` khi mọi mục AI có điểm; đề gọi `notifyExamGraded`.
- **BR-B08** Chốt: còn `GRADING`/`NEEDS_REVIEW` → 409; còn chờ duyệt mà chưa xác nhận → 409; chốt thì chụp ảnh điểm mọi học sinh trong một giao dịch.
- **BR-B09** Đã chốt: khoá ô và lượt nộp trước mốc; lượt sau mốc chấm được nhưng không đổi ảnh chụp; mở chốt thì học sinh không thấy bài.
- **BR-B10** Trung bình = TB cộng `score10` không rỗng của các bài đã chốt, làm tròn 0.1.
- **BR-B11** Học sinh chỉ thấy dòng của mình, bài đã chốt.
- **BR-B12** AI chấm bài học lỗi 3 lần / `giveUp` → `NEEDS_REVIEW`, không cho 0.
- **BR-B13** AI chấm xong ghi `ai_score`, `ai_feedback` cùng `score`.

## 9c. Chuyển dạng câu khi nhập đề (I): FEAT-015, DEC-042 → DEC-046, DEC-049; `lib/question-conversion.ts`
Chi tiết, bảng dạng giấy và mã cảnh báo ở `docs/features/chuyen-doi-dang-cau-nhap-de.md` §7. Tóm tắt:
- **BR-I01** AI chỉ gắn nhãn `paper_format`, `answer_source`, `confidence`; `convertGroup` (hàm thuần) dựng content.
- **BR-I02** 1 ô → `OPTION_BANK` 4 phương án, mỗi câu một bản ghi.
- **BR-I03** ≥ 2 ô → `INLINE_SELECT`, mỗi ô 4 phương án của ô đó.
- **BR-I04** Phương án dạng cặp, cả 4 tách được đúng k phần → k ô, mỗi ô 1 điểm; không tách được → `READING_MC`.
- **BR-I05** Hộp từ chung → `OPTION_BANK` chung.
- **BR-I06** Đoạn văn ghi `(n) [đáp án]`; ngoặc vuông gốc đổi thành ngoặc tròn; số ô = số đáp án.
- **BR-I07** Không có đáp án → `null` + `NO_ANSWER`, không tự gán "A"; phải chọn đáp án mới nhập được.
- **BR-I08** Dạng chưa hỗ trợ → `READING_MC` + cảnh báo + `reportAlert` WARN, không chặn nhập.
- **BR-I09** Nhóm code không dựng được → AI lượt 2 (≤ 10 nhóm, 20 giây/lần); vẫn lỗi → `READING_MC` + cảnh báo.
- **BR-I10** Học sinh không nhận `import_meta`.
- **BR-I11** Nhóm lẫn dạng → tách thành khối liền nhau, giữ chung `prompt`.
- **BR-I12** Listening dùng tiền tố `LISTENING_` + cảnh báo `AUDIO_MISSING`.
- **BR-I13** `confidence < 0.6` → `LOW_CONFIDENCE`.
- **BR-I14** Bóc tách giữ `<u> <b> <strong> <i> <em> <br>` để AI nhận dạng; câu con và phương án lưu chữ trơn (BR-I25); đáp án chấm luôn là chữ trơn.
- **BR-I15** Ghép nối đúng 1-1 không thừa → `READING_MATCHING`; có nhiễu / đáp án lặp / > 4 phương án → `INLINE_SELECT` giữ đủ lựa chọn (thay `DISTRACTORS_DROPPED`, DEC-049).
- **BR-I16** `SHORT_ANSWER` Reading/Listening có đáp án → `FILL_IN · FREE_TYPING`; chấm ô điền nhận ` / ` và từ tuỳ chọn trong ngoặc tròn.
- **BR-I17** Bài đọc chung (`passages` + `passage_id`) → `stimulus_text` mọi câu của nhóm; thiếu bài đọc → cấu trúc lại một lần rồi `PASSAGE_MISSING`.
- **BR-I18** PDF scan (kể cả có watermark) → OCR theo cụm 4 trang; thiếu trang → 503, không tạo đề thiếu; > 40 trang hoặc quá dài → 400 `DOCUMENT_TOO_LONG`.
- **BR-I19** AI trả thiếu > 10 % số câu đề tự khai → cấu trúc lại một lần; đáp án ghi bằng nội dung phương án → khoá chữ cái.
- **BR-I20** Bỏ tiền tố số câu khỏi chữ câu; câu chỉ có dãy phương án để trống; LessonPlayer hiện số câu gốc.
- **BR-I21** Câu gợi ý từ `a / b / c` có đáp án → sắp xếp từ (`WORD_ORDERING`, học sinh xếp toàn bộ từ của câu đúng), kể cả khi AI gắn nhầm `GENERAL_MC`; lệch quá xa → giữ trắc nghiệm (DEC-050).
- **BR-I22** Không bịa đoạn văn: cloze dựng được trên bài đọc chung; AI lượt 2 thêm > 10 % từ mới bị loại; "the following passage" cũng là nhắc bài đọc.
- **BR-I23** Kỹ năng câu nhập đề suy từ tiền tố dạng câu (không dùng nhãn AI), để thứ tự màn thi giữ đúng đề giấy; nhãn AI lưu ở `import_meta.paper_skill`.
- **BR-I24** Câu nhập AI mở Sửa hiện đủ trường như câu tạo tay, lưu lại không mất dữ liệu; đáp án trắc nghiệm luôn lưu chữ cái A–D; danh sách chọn lưu `inline_options_per_gap`; đổi dạng trong form không xoá dữ liệu; đề độc lập không bị gắn vào khoá khi lưu (DEC-050).
- **BR-I25** Câu con và phương án nhập AI lưu chữ trơn, không giữ gạch chân; bỏ `UNDERLINE_MISSING` (DEC-050).
- **BR-I26** `OPTION_BANK` trên màn học sinh là kho từ bấm để điền vào ô, không phải danh sách chọn (DEC-050).

## 9d. Cảnh báo admin (W): FEAT-016, DEC-047, DEC-048; `lib/admin-alerts.ts`
Chi tiết ở `docs/features/canh-bao-admin.md` §7. Tóm tắt:
- **BR-W01** `reportAlert` không bao giờ ném lỗi, không gọi đệ quy.
- **BR-W02** Upsert theo `fingerprint`; dòng `RESOLVED` tái phát thì về `NEW` và gửi ngay.
- **BR-W03** Telegram: lần đầu, tái phát, hoặc ≥ 15 phút từ tin trước; tin ghi số lần lặp.
- **BR-W04** Trần 20 tin / 60 phút toàn hệ thống; chạm trần thì gửi 1 tin báo.
- **BR-W05** DB lỗi → gửi thẳng Telegram, chống spam trong bộ nhớ.
- **BR-W06** Không PII, không bí mật (`redactSensitive`); không body, cookie, header, tên file.
- **BR-W07** Thiếu biến Telegram → chỉ ghi DB.
- **BR-W08** Mọi nhánh 500 trong `app/api/**` đi qua `serverError` (có test khoá).
- **BR-W09** Dọn dòng `RESOLVED` quá 90 ngày, tối đa 1 lần/24 giờ.
- **BR-W10** Worker báo khi bỏ cuộc sau 5 lần giao (`WORKER:GIVE_UP:*`) và khi mất Redis (`WORKER:REDIS_DOWN`).
- **BR-W11** Nguồn AI: hết nhà cung cấp khi nhập đề (ERROR); bài `NEEDS_REVIEW` do AI (WARN).

## 9e. Bài học & đề thi theo Phần (P): FEAT-017, DEC-051 → DEC-054; `lib/exam-structure.ts` (dự kiến)
Chi tiết ở `docs/features/phan-bai-hoc-de-thi.md` §7. Tóm tắt:
- **BR-P01** Đề / bài học = danh sách phần có thứ tự; mỗi phần thuộc đúng một cha; dùng lại = sao chép.
- **BR-P02** ≥ 1 phần; đề thi có ≥ 1 câu tính điểm; bài học có thể chỉ có phần đọc.
- **BR-P03** Phần có thể 0 câu nhưng phải có lời dẫn, chữ hoặc audio.
- **BR-P04** Dạng câu thuộc kỹ năng của phần; `questions.skill` = `sections.skill`.
- **BR-P05** Ngữ cảnh khớp `stimulus_type`; phần Listening có câu phải có audio.
- **BR-P06** Số câu tính bằng `numberedCount` (điền ô = số ô, nối = số cặp, còn lại 1), liên tục qua các phần; không lưu.
- **BR-P07** Lưu cả cây trong một transaction, `position` = chỉ số mảng; lỗi → rollback.
- **BR-P08** `updated_at` lệch → 409.
- **BR-P09** Đã có lượt làm → xoá mềm, không chấm lại bài cũ, trình soạn hiện số lượt; chưa có → xoá hẳn.
- **BR-P10** Học sinh không thấy phần / câu xoá mềm; xem lại bài nộp thì thấy câu có trong bài đó.
- **BR-P11** Một phần một màn theo `position`; phần 0 câu có nút Tiếp tục, không tính vào số câu.
- **BR-P12** Trắc nghiệm một ý một bản ghi, đáp án A–D; không còn `sub_questions`; code mới không đọc định dạng cũ.
- **BR-P13** Nhân bản chép sâu; chuyển bài học ↔ đề giữ id.
- **BR-P14** AI nhập đề: mỗi nhóm đề giấy → một phần; nhóm liền nhau cùng bài đọc → chung một phần.

## 10. Máy trạng thái
```text
submissions.status      IN_PROGRESS ─submit─▶ GRADED (toàn câu khách quan)
                        IN_PROGRESS ─submit─▶ GRADING ─grade-async OK─▶ GRADED
                                                      ├─AI lỗi 3 lần / giveUp / đẩy sự kiện lỗi─▶ NEEDS_REVIEW ─grade-override─▶ GRADED
lesson_attempts.status  (nộp) ─▶ GRADED | GRADING ─lessons/grade-async─▶ GRADED      (AI_SKIPPED: chỉ dữ liệu cũ)
                        FEAT-014: GRADING ─AI lỗi 3 lần / giveUp─▶ NEEDS_REVIEW ─GV chấm đủ mục AI─▶ GRADED
class_grade_items       (mở) ─finalize─▶ đã chốt (finalized_at) ─reopen─▶ (mở)          (FEAT-014)
slot_requests.status    PENDING ─approve─▶ APPROVED
                        PENDING ─reject(reason)─▶ REJECTED
                        PENDING ─cancel─▶ CANCELLED          (payment_reported_at: cờ, không phải trạng thái)
users.teacher_status    TRIAL ─verify─▶ VERIFIED | REJECTED ; REJECTED ─verify─▶ VERIFIED   (NULL = coi như VERIFIED)
leads.status            NEW ─▶ CONTACTED ─▶ DONE
admin_alerts.status     (mới) ─▶ NEW ─admin đánh dấu─▶ RESOLVED ─tái phát / mở lại─▶ NEW      (FEAT-016)
```
