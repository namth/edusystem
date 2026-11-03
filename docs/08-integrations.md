# 08 — Tích hợp bên thứ ba

> Cập nhật: 2026-11-03 · Nguồn: `lib/ai-engine.ts`, `lib/document-parser.ts`, `lib/portkey.ts`, `lib/neo4j.ts`, `lib/redis-queue.ts`, `lib/supabase-server.ts`, `app/api/tts`, `lib/vietqr.ts`.

| Tích hợp | Dùng cho | Code | Biến môi trường | Lỗi thì sao |
| :--- | :--- | :--- | :--- | :--- |
| **Portkey AI Gateway** | Chấm Writing (text), Speaking (audio base64 multimodal), cấu trúc đề | `lib/ai-engine.ts`, `lib/document-parser.ts`, `lib/portkey.ts` | `PORTKEY_API_KEY`, `PORTKEY_CONFIG_ID`, `PORTKEY_MODEL` | Thử OpenAI trực tiếp; vẫn lỗi thì `grade-async` thử lại tối đa 3 lần rồi chuyển `NEEDS_REVIEW` |
| **OpenAI** | Dự phòng cho Portkey (`gpt-4o-mini`), OCR / cấu trúc đề | như trên | `OPENAI_API_KEY` | như trên |
| **Google Gemini REST** | AI nhập đề (OCR ảnh, cấu trúc câu hỏi), model theo `system_settings.ai_exam_ingestion_model` | `lib/document-parser.ts`, `lib/ai-model-resolver.ts` | `GOOGLE_API_KEY`, `DEFAULT_AI_MODEL` | Thử danh sách model dự phòng, rồi tới Portkey / OpenAI |
| **Google Cloud TTS** | Đọc văn bản Listening | `app/api/tts/route.ts` (OAuth bằng service account) | `GCP_CLIENT_EMAIL`, `GCP_PRIVATE_KEY` | Trả lỗi cho client |
| **Supabase Storage** | Upload audio, ảnh flashcard, bản ghi Speaking (bucket `audio-assets`, `flashcard-assets`, `speaking-recordings`), chỉ qua server | `app/api/uploads`, `lib/supabase-server.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (`NEXT_PUBLIC_SUPABASE_ANON_KEY` truyền khi build) | 500 kèm thông điệp |
| **Redis (Streams)** | Hàng đợi chấm AI `stream:learning:grading` | `lib/redis-queue.ts`, `worker/grading-worker.js` | `REDIS_URL`, `WORKER_ID`, `APP_URL` (worker gọi API) | Đẩy lỗi thì bài chuyển `NEEDS_REVIEW` và báo giáo viên |
| **Neo4j** | Đồ thị khoá – đề – lớp – học sinh (phụ) | `lib/neo4j.ts` | `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` | Chỉ log; không ảnh hưởng PostgreSQL (bất biến 10) |
| **VietQR (NAPAS 247)** | Mã QR chuyển khoản cho đơn mua slot | `lib/vietqr.ts` (payload EMVCo + CRC16), `lib/vietqr-banks.ts` (BIN), gói `qrcode` vẽ ở client | — (tài khoản lưu ở `system_settings.payment_account`) | Chưa cấu hình tài khoản thì không vẽ QR, báo "chưa cấu hình" |

## Theo dõi chi phí AI
- Mọi lần gọi model **thành công** đều ghi 1 dòng `ai_usage_logs`, với token thật lấy từ `response.usage` hoặc `usageMetadata` (`lib/ai-usage.ts` `recordAiUsage`). Không có `usage` thì ghi 0. Lời gọi lỗi thì không ghi.
- Ngữ cảnh `purpose`, `submissionId`, `lessonAttemptId`, `teacherId`, `studentId` được đặt bằng `withAiUsageContext` ở các route `exam/grade-async`, `lessons/grade-async`, `teacher/exams/ai-parse`, `admin/parse-exam-text`.
- Giá model và tỷ giá lấy từ `system_settings.ai_pricing`, admin sửa ở `/admin/settings`. Model chưa có giá thì chi phí là 0 và dashboard hiện cảnh báo.

## Chưa tích hợp (đã chốt để sau)
- Webhook ngân hàng (SePay / Casso) tự duyệt đơn. Điểm gắn là `approveOrder(id, "WEBHOOK", paymentRef)` trong `lib/slot-orders.ts`.
- Email / Zalo thông báo.
- Đăng nhập Google / Zalo.
