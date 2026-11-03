# SYSTEM_ARCHITECTURE.md - EDTECH LEARNING SYSTEM

## 1. Tổng Quan Kiến Trúc (System Architecture Overview)

Hệ thống **EdTech Learning System** là giải pháp quản lý giảng dạy & luyện thi tiếng Anh 4 kỹ năng (Reading, Listening, Writing, Speaking) kết hợp giữa:
1. **Relational Database (Supabase PostgreSQL)**: Lưu trữ các thực thể nghiệp vụ (Người dùng, Lớp học, Đề thi, Câu hỏi, Bài nộp, Flashcards, Slot thanh toán).
2. **Graph Database (Neo4j)**: Lưu trữ đồ thị tri thức, theo dõi quan hệ kỹ năng (`SkillNode`), lộ trình học sinh (`LEARNED`), phân công giảng dạy (`MANAGES`), bài thi thuộc khóa học (`HAS_EXAM`).
3. **Event Bus (Redis Streams / Async Event System)**: Đẩy sự kiện theo cơ chế bất đồng bộ (`EXAM_CREATED`, `QUESTION_BOUND`, `SUBMISSION_GRADED`) để đồng bộ dữ liệu quan hệ sang đồ thị Neo4j.
4. **AI Gateway (Portkey & Gemini TTS)**: Chấm điểm bài thi Speaking/Writing tự động bằng AI Model (`@nam-tran/deep-research-pro-preview-12-2025`), lưu log chi phí USD token vào `ai_usage_logs` và tổng hợp giọng đọc phát âm Text-to-Speech PCM/WAV.

---

## 2. Chuẩn Hóa Cơ Sở Dữ Liệu PostgreSQL (Supabase Schemas)

### 2.1. Bảng `questions` (Kho Câu Hỏi 4 Kỹ Năng)
Bảng `questions` lưu trữ chi tiết các câu hỏi luyện thi theo 17 loại định dạng.

| Tên Cột | Kiểu Dữ Liệu | Mô Tả |
| :--- | :--- | :--- |
| `id` | `TEXT` (PK) | Mã ID duy nhất của câu hỏi (VD: `q_seed_01`) |
| `skill` | `TEXT` | Kỹ năng: `"Reading"`, `"Listening"`, `"Writing"`, `"Speaking"` |
| `category` | `TEXT` | Loại câu hỏi trong 17 loại chuẩn hóa (VD: `READING_MC`, `LISTENING_FILL_IN`...) |
| `prompt` | `TEXT` | Chỉ dẫn ngắn/tiêu đề bài tập (VD: "Read the text and answer questions...") |
| `stimulus_text` | `TEXT` | Phần ngữ cảnh bài đọc rich text HTML dùng chung |
| `stimulus_audio_url` | `TEXT` | Link URL âm thanh hoặc Video YouTube ngữ cảnh dùng chung |
| `flashcard_ids` | `TEXT[]` | Danh sách ID thẻ flashcard (áp dụng cho dạng `FLASHCARD_SET`) |
| `content` | `JSONB` | Dữ liệu cấu trúc tinh gọn riêng cho từng loại câu hỏi (bao gồm `stimulus_type`: `"TEXT_ONLY"`, `"AUDIO_ONLY"`, hoặc `"COMBINED"`) |
| `created_at` | `TIMESTAMPTZ` | Thời gian tạo câu hỏi |

---

## 3. Quy Chuẩn Cấu Trúc JSONB Cột `content` Cho 17 Dạng Câu Hỏi

> [!IMPORTANT]
> **Nguyên tắc vàng**: Cột `content` CHỈ chứa các thuộc tính nghiệp vụ riêng của từng dạng câu hỏi (bao gồm thuộc tính chuẩn hóa **`stimulus_type`** để nhận biết định dạng ngữ cảnh: `"TEXT_ONLY"`, `"AUDIO_ONLY"`, hoặc `"COMBINED"`). Không được trùng lặp các cột giá trị dài ở cấp bảng (`prompt`, `stimulus_text`, `stimulus_audio_url`). Tất cả tên thuộc tính phải sử dụng chuẩn `snake_case`.

### 3.1. `READING_MC` & `LISTENING_MC` (Trắc Nghiệm)
```json
{
  "stimulus_type": "TEXT_ONLY",
  "sub_questions": [
    {
      "id": "sub_1",
      "text": "What is the main topic of the passage?",
      "option_a": "Artificial Intelligence in Education",
      "option_b": "Traditional Classroom Methods",
      "option_c": "History of Computers",
      "option_d": "Space Exploration",
      "correct_answer": "Artificial Intelligence in Education",
      "audio_url": null
    }
  ]
}
```

### 3.2. `READING_FILL_IN` & `LISTENING_FILL_IN` (Điền Chỗ Trống)
```json
{
  "passage": "Artificial Intelligence is [slowly] transforming language teaching. Students learn [flexibly].",
  "fill_subtype": "INLINE_SELECT",
  "option_bank": ["slowly", "flexibly", "rarely", "rigidly"],
  "option_banks": [
    { "gap_index": 0, "options": ["slowly", "rapidly", "rarely", "rigidly"] },
    { "gap_index": 1, "options": ["flexibly", "easily", "poorly", "strictly"] }
  ]
}
```
*(Ghi chú: `fill_subtype` nhận 3 giá trị: `"OPTION_BANK"`, `"INLINE_SELECT"`, hoặc `"FREE_TYPING"`. Ký hiệu chỗ trống trong `passage` sử dụng cặp ngoặc vuông `[đáp_án_đúng]`. Thuộc tính `option_banks` hỗ trợ ngân hàng phương án trắc nghiệm riêng biệt cho từng chỗ trống `gap_index`)*.

### 3.3. `READING_ORDERING` & `LISTENING_ORDERING` (Sắp Xếp Câu/Từ)
```json
{
  "ordering_type": "SENTENCE_ORDERING",
  "correct_text": "Firstly, online education provides flexibility. However, face-to-face interaction remains crucial. Therefore, a blended approach is recommended."
}
```

### 3.4. `READING_MATCHING` & `LISTENING_MATCHING` (Nối Cặp Từ)
```json
{
  "pairs": [
    { "id": "mp_1", "left": "Accommodation", "right": "Chỗ ở, nơi lưu trú" },
    { "id": "mp_2", "left": "Destination", "right": "Điểm đến" }
  ]
}
```

### 3.5. `READING_FLASHCARD_SET` & `WRITING_FLASHCARD_SET` (Bộ Thẻ Flashcards)
```json
{
  "flashcard_ids": ["fc_01", "fc_02", "fc_03"]
}
```

### 3.6. `WRITING_SHORT_ANSWER` (Tự Luận Ngắn)
```json
{
  "sub_questions": [
    { "id": "sa_1", "text": "Summarize the main advantage of online learning...", "max_words": 50 }
  ]
}
```

### 3.7. `WRITING_ESSAY` (Bài Viết Tự Luận)
```json
{
  "min_words": 250,
  "rubric": "Task Achievement (25%), Coherence & Cohesion (25%), Lexical Resource (25%), Grammatical Range (25%)"
}
```

### 3.8. `WRITING_FREE_TYPING_BLANKS` (Tự Gõ Điền Từ Vào Câu)
```json
{
  "stimulus_type": "TEXT_ONLY",
  "passage": "To achieve success in IELTS, one must practice [consistently] every day."
}
```
*(Ghi chú: Ký hiệu chỗ trống trong `passage` sử dụng cặp ngoặc vuông `[đáp_án_đúng]`).*

### 3.9. `WRITING_SENTENCE_REWRITE` (Viết Lại Câu - Hỗ Trợ Nhiều Câu Con)
```json
{
  "stimulus_type": "TEXT_ONLY",
  "sub_questions": [
    {
      "id": "sr_1",
      "original_sentence": "It is impossible to finish this project without team collaboration.",
      "correct_answer": "[Unless] you collaborate with your team, it is impossible to finish the project."
    },
    {
      "id": "sr_2",
      "original_sentence": "She started working here three years ago.",
      "correct_answer": "[She has] been working here for three years."
    }
  ]
}
```
*(Ghi chú: Mỗi câu hỏi con chứa `original_sentence` và `correct_answer`. Từ/Cụm từ gợi ý mở đầu được đặt trong cặp ngoặc vuông `[Cue]` bên trong `correct_answer`. Hệ thống sẽ tự động trích xuất `[Cue]` để hiển thị gợi ý mở đầu cho học sinh).*

### 3.10. `SPEAKING_TOPIC_PROMPT` (Nói Theo Chủ Đề / Cue Card)
```json
{
  "prep_time_seconds": 60,
  "record_time_seconds": 120
}
```

### 3.11. `SPEAKING_READ_ALOUD` (Đọc Thành Tiếng)
```json
{
  "passage": "Artificial Intelligence in education provides personalized learning pathways for students around the globe."
}
```

---

## 4. Các Bảng Thực Thể Khác Trong PostgreSQL

- `exams`: Lưu danh sách bộ đề thi (`id`, `title`, `duration_minutes`, `skills`, `question_ids`).
- `flashcards`: Lưu các thẻ từ vựng (`id`, `vietnamese_name`, `correct_english_word`, `options`, `image_url`, `audio_url`).
- `submissions`: Bài nộp của học sinh (`id`, `answers`, `score`, `skill_scores`, `ai_feedback`, `status`).
- `users`: Tài khoản học sinh, giáo viên, admin hệ thống.
- `ai_usage_logs`: Nhật ký tiêu thụ token và chi phí USD chấm bài AI qua Portkey.
