# 06 — Lược đồ cơ sở dữ liệu (PostgreSQL)

> Cập nhật: 2026-11-03.
> **Nguồn sự thật, theo thứ tự ưu tiên:**
> 1. Các file `docs/db-migration-0NN-*.sql`.
> 2. `ensureSchema()` trong `lib/db-pg.ts`.
> 3. `e2e/schema.sql`: dump DB thật ngày 01/11/2026. ⚠️ Bản dump đã cũ, thiếu `leads`, `subjects`, `teacher_profiles` và các cột từ migration 011–016, cần dump lại.
>
> Không có khoá ngoại thật giữa phần lớn các bảng; quan hệ được giữ bằng code. Id là chuỗi có tiền tố, ví dụ `usr_…`, `cls_…`, `sub_<uuid>`, `att_<uuid>`, `slr_<uuid>`, `aiu_<uuid>`.

## 1. Danh mục migration
| # | File | Nội dung | Chạy |
| :--- | :--- | :--- | :--- |
| 001 | `db-migration-001.sql` | `scoring_rubrics`; cột chấm AI ở `exams`, `submissions` | ensureSchema |
| 002 | `…-002-exam-taxonomy.sql` | `exam_categories`, `lesson_exams`, `course_exams` (**không còn dùng**) | — |
| 003 | `…-003-dynamic-curriculum-tree.sql` | `courses`, `curriculum_items` | ensureSchema |
| 004 | `…-004-enrollments-assignments.sql` | `enrollments`, `class_assignments` | ensureSchema |
| 005 | `…-005-system-settings.sql` | `system_settings` + model AI nhập đề | ensureSchema |
| 006 | `…-006-lessons.sql` | `lessons`, `class_unlocks`, `lesson_attempts`; cột lộ trình ở `classes` | ensureSchema |
| 007 | `…-007-question-owner.sql` | `questions.created_by` | ensureSchema |
| 008 | `…-008-flashcard-owner.sql` | `flashcards.created_by` | ensureSchema |
| 009 | `…-009-scoring-standards.sql` | `scoring_standards` + seed 4 chuẩn; cột lượt thi ở `submissions` | ensureSchema |
| 010 | `…-010-notifications.sql` | `notifications` | ensureSchema |
| 011 | `…-011-leads.sql` | `leads` | ensureSchema |
| 012 | `…-012-subjects.sql` | `subjects` + `subject_id` ở `courses`, `exams`, `lessons` | ensureSchema |
| 013 | `…-013-onboarding.sql` | `teacher_profiles`; cột `username`, `teacher_status`… ở `users` | ensureSchema |
| 014 | `…-014-ai-usage.sql` | `ai_usage_logs` chính thức + `purpose`, `provider`, `lesson_attempt_id`; `system_settings.ai_pricing` | ensureSchema |
| 015 | `…-015-student-slots.sql` | Trả lại slot đã bị trừ khi chấm AI (DEC-031) | **Chạy tay một lần** |
| 016 | `…-016-slot-orders.sql` | Cột đơn hàng ở `slot_requests`; `payment_account`, `slot_pricing` | ensureSchema |

## 2. Bảng theo miền
### 2.1 Người dùng & phân quyền
**`users`**

| Nhóm cột | Cột |
| :--- | :--- |
| Định danh | `id` PK, `name`, `email` UNIQUE, `password` (scrypt `salt:hash`), `role` (`ADMIN`/`TEACHER`/`STUDENT`), `phone`, `target_band` |
| Trạng thái | `status` (`ACTIVE`/`INACTIVE`/`SUSPENDED`), `must_change_password`, `reset_token`, `reset_token_expires`, `last_login_at`, `created_at`, `updated_at` |
| Slot | `slot_limit` INT DEFAULT 250. Với TEACHER là số học sinh khác nhau tối đa (DEC-031) |
| Migration 013 | `username` (4–30 ký tự `a-z0-9._`, duy nhất không phân biệt hoa thường), `email_is_placeholder`, `grade_level`, `learning_goals` JSONB, `teacher_status` (`TRIAL`/`VERIFIED`/`REJECTED`/NULL; NULL coi như đã xác minh) |

⚠️ `ensureSchema` khai báo `password … DEFAULT '123456'`. Mặc định này trái bất biến 6 (xem `docs/11` §4). Code tạo user luôn tự băm mật khẩu, không dựa vào giá trị mặc định này.

**`teacher_profiles`** (013): `user_id` PK FK → `users`, `answers` JSONB (khảo sát đăng ký), `reviewed_by`, `reviewed_at`, `review_note`, `created_at`.

### 2.2 Môn, khoá học, giáo trình
- **`subjects`** (012): `id`, `code`, `name`, `icon`, `color`, `mode` (`LANGUAGE`/`SIMPLE`), `owner_id` (NULL = môn hệ thống), `is_active`, `order_index`, `created_at`.
- **`courses`** (003): `id`, `title`, `description`, `level`, `created_by`, `default_scoring_standard_id` (009), `subject_id` (012, mặc định `'english'`), `created_at`.
- **`curriculum_items`** (003): `id`, `course_id` FK, `parent_id` (cây), `title`, `type` (`UNIT`/`LESSON`/`EXAM`), `exam_id`, `lesson_id` (006), `order_index`, `teacher_id`, `created_by`, `created_at`.

### 2.3 Nội dung
- **`questions`**: `id`, `skill`, `category` (15 dạng, xem `lib/question-content-types.ts`), `prompt`, `content` JSONB (có đáp án, không bao giờ gửi cho học sinh trước khi nộp), `stimulus_text`, `stimulus_audio_url`, `created_by` (007), `created_at`.
- **`flashcards`**: `id`, `vietnamese_name`, `correct_english_word`, `options` JSONB, `image_url`, `audio_url`, `created_by` (008), `created_at`.
- **`lessons`** (006): `id`, `title`, `description`, `skills` TEXT[], `question_ids` JSONB (thứ tự khối), `subject_id`, `created_by`, `created_at`, `updated_at`.
- **`exams`**: `id`, `title`, `description`, `duration_minutes`, `skills` TEXT[], `question_ids` JSONB, `stimulus_type`, `stimulus_text`, `stimulus_audio_url`, `passing_score`, `scoring_standard_id` (009), `subject_id` (012), `created_by`, `created_at`. Các cột `scoring_rubric_id`, `scoring_rubric_override` (001) đã cũ, không đọc nữa.

### 2.4 Chấm điểm
- **`scoring_standards`** (009): `id`, `name`, `framework`, `description`, `sections` JSONB `[{ skill, min, max, step, conversion: LINEAR|TABLE, table_question_count?, table?, rubric_id? }]`, `aggregation` JSONB `{ method: AVERAGE|SUM|WEIGHTED, round_step, weights?, pass_score?, section_min? }`, `is_system`, `created_by`, `created_at`, `updated_at`. Seed sẵn `std_internal_10`, `std_ielts`, `std_toeic_lr`, `std_hsk1`.
- **`scoring_rubrics`** (001): `id`, `name`, `description`, `framework`, `language`, `scale_min`, `scale_max`, `scale_step`, `criteria` JSONB `[{ key, label, weight, descriptor }]`, `output_language`, `created_at`. Đây là bộ tiêu chí AI, được tham chiếu từ `scoring_standards.sections[].rubric_id`.

### 2.5 Lớp học & học tập
- **`classes`**: `id`, `name`, `code` UNIQUE (mã mời), `teacher_id`, `max_slots` (sĩ số lớp, mặc định 30; tối đa 3 khi giáo viên dùng thử), `schedule`, `status`, `course_id`, `unlock_mode` (`MANUAL`/`SEQUENTIAL`/`ALL_OPEN`), `pass_percent` (mặc định 70), `unlocked_progress` (cũ), `created_at`.
- **`enrollments`** (004): `id`, `student_id`, `class_id`, `created_at`; UNIQUE (`student_id`, `class_id`).
- **`class_assignments`** (004): `id`, `class_id`, `exam_id`, `due_date`, `max_attempts` (mặc định 1), `created_at`.
- **`class_unlocks`** (006): `class_id`, `curriculum_item_id`, `student_id` (NULL = cả lớp), `due_date`, `unlocked_by`, `unlocked_at`; UNIQUE (`class_id`, `curriculum_item_id`, `COALESCE(student_id,'')`).
- **`lesson_attempts`** (006): `id`, `lesson_id`, `class_id`, `student_id`, `answers`, `results` (GradeResult[]), `objective_earned`, `objective_max`, `ai_earned` (NULL khi chưa chấm AI), `ai_max`, `score_percent`, `status` (`GRADING`/`GRADED`; `AI_SKIPPED` chỉ còn ở dữ liệu cũ), `created_at`, `graded_at`.
- **`submissions`** (lượt thi đề):

  | Nhóm cột | Cột |
  | :--- | :--- |
  | Định danh | `id`, `exam_id`, `student_id`, `class_ref` (id lớp dạng chuỗi) |
  | Thời gian | `started_at`, `deadline_at`, `submitted_at`, `graded_at`, `is_late` |
  | Bài làm & điểm | `answers`, `results`, `section_scores` JSONB `{ Reading: { score, earned, max } }`, `total_score`, `passed`, `standard_snapshot` (chụp lúc bắt đầu thi) |
  | Trạng thái chấm | `status` (`IN_PROGRESS`/`GRADING`/`NEEDS_REVIEW`/`GRADED`), `grading_attempts`, `last_grading_error`, `teacher_review`, `teacher_feedback` |
  | Cũ, không dùng | `ai_score`, `final_score`, `overall_band`, `class_id` UUID, `candidate_*` |

### 2.6 Thông báo, liên hệ, cấu hình
- **`notifications`** (010): `id`, `user_id`, `type`, `title`, `body`, `link`, `ref_id`, `read_at`, `created_at`. Chấm lại thì cập nhật cùng thông báo (khoá `user_id` + `type` + `ref_id`). Các loại thông báo:
  - `EXAM_GRADED`, `EXAM_NEEDS_REVIEW`;
  - `TEACHER_SIGNUP`, `TEACHER_VERIFIED`;
  - `ORDER_CREATED`, `ORDER_APPROVED`, `ORDER_REJECTED`, `ORDER_PAID_REPORTED`.
- **`leads`** (011): `id`, `name`, `phone`, `email`, `role`, `message`, `status` (`NEW`/`CONTACTED`/`DONE`), `source`, `ip`, `created_at`.
- **`system_settings`** (005): `key` PK, `value` JSONB, `description`, `updated_by`, `updated_at`.

  | Khoá | Giá trị |
  | :--- | :--- |
  | `ai_exam_ingestion_model` | `{ provider, model, temperature, max_tokens }` |
  | `ai_pricing` | `{ usd_vnd_rate, models: { <model>: { input_per_1m, output_per_1m } } }` |
  | `payment_account` | `{ bank_bin, bank_name, account_no, account_name }` |
  | `slot_pricing` | `{ unit_price_vnd }` |

### 2.7 Đơn hàng & chi phí AI
- **`slot_requests`** (đơn mua slot; cột mở rộng ở 016):

  | Nhóm cột | Cột |
  | :--- | :--- |
  | Định danh | `id` (`slr_…`), `code` UNIQUE (`KK` + 8 ký tự, cũng là nội dung chuyển khoản) |
  | Giáo viên | `teacher_id`, `teacher_name`, `teacher_email` |
  | Số lượng & tiền | `requested_slots`, `unit_price`, `total_cost` (VND nguyên) |
  | Trạng thái | `status` (`PENDING`/`APPROVED`/`REJECTED`/`CANCELLED`), `source` (`TEACHER`/`ADMIN`), `created_by`, `note` |
  | Thanh toán & duyệt | `payment_reported_at`, `decided_by` (id admin hoặc `WEBHOOK`), `decided_at`, `reject_reason`, `payment_ref`, `created_at` |

- **`ai_usage_logs`** (014): `id` (`aiu_…`), `purpose` (`EXAM_GRADING`/`LESSON_GRADING`/`EXAM_IMPORT`/`OTHER`), `provider`, `model`, `teacher_id`, `student_id`, `submission_id`, `lesson_attempt_id`, `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd` (tính lúc ghi theo `ai_pricing`), `created_at` (TIMESTAMP không có múi giờ, ghi bằng `NOW()`; dashboard coi là UTC). Có index `created_at` và (`teacher_id`, `created_at`).

## 3. Quan hệ chính
```text
users(TEACHER) 1─n classes ─n enrollments n─1 users(STUDENT)
classes n─1 courses 1─n curriculum_items ─▶ lessons | exams
classes 1─n class_assignments n─1 exams ; classes 1─n class_unlocks n─1 curriculum_items
exams.question_ids / lessons.question_ids ─▶ questions ; questions(flashcard) ─▶ flashcards
exams n─1 scoring_standards(sections[].rubric_id) ─▶ scoring_rubrics ; courses.default_scoring_standard_id
submissions n─1 exams, users(STUDENT), classes(class_ref) ; lesson_attempts n─1 lessons, classes, users
users(TEACHER) 1─n slot_requests ; ai_usage_logs ─▶ submissions | lesson_attempts | users
users 1─n notifications ; users(TEACHER) 1─1 teacher_profiles ; subjects 1─n courses|exams|lessons
```

## 4. Bảng di sản (không có code đọc)
| Bảng / cột | Nguồn |
| :--- | :--- |
| `exam_categories`, `lesson_exams`, `course_exams` | migration 002 |
| `orders` | `lib/db-init.js`, học sinh mua khoá, bỏ theo DEC-019 |
| `exams.scoring_rubric_id`, `exams.scoring_rubric_override` | migration 001 |
| `classes.unlocked_progress` | cũ |
| `submissions.ai_score`, `final_score`, `overall_band`, `class_id`, `candidate_*` | cũ |

Không xoá bằng cách sửa migration cũ. Muốn dọn thì viết migration mới.
