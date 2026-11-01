"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export default function LandingFaq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: "KitoKit hỗ trợ những môn học nào?",
      a: "KitoKit mạnh nhất ở Tiếng Anh với đủ 4 kỹ năng Nghe – Nói – Đọc – Viết và AI chấm bài. Các môn khác đang được mở rộng dần; trung tâm và thầy cô có thể tự tạo môn học riêng để soạn bài và đề trắc nghiệm.",
    },
    {
      q: "Công nghệ AI chấm bài Viết và Nói hoạt động như thế nào?",
      a: "Với kỹ năng Viết, AI phân tích cấu trúc câu, ngữ pháp, từ vựng và tính mạch lạc dựa trên tiêu chuẩn rubric học thuật. Với kỹ năng Nói, hệ thống nhận diện giọng nói và đánh giá độ trôi chảy, phát âm cũng như nội dung câu trả lời.",
    },
    {
      q: "Học sinh có thể làm bài thử miễn phí không?",
      a: "Có. Học sinh chỉ cần tạo tài khoản miễn phí là có thể truy cập các đề thi mẫu và trải nghiệm tính năng chấm điểm tự động ngay trên trình duyệt.",
    },
    {
      q: "Làm thế nào để học sinh tham gia vào lớp học của giáo viên?",
      a: "Mỗi lớp học trên KitoKit có một mã lớp riêng. Học sinh chỉ cần đăng nhập và nhập mã lớp được giáo viên cung cấp để nhận các bài tập và đề thi do thầy cô giao.",
    },
    {
      q: "Giáo viên và trung tâm cần chuẩn bị gì để nhập đề bằng AI?",
      a: "Thầy cô chỉ cần tải lên file đề thi có sẵn ở định dạng Microsoft Word (.docx), PDF hoặc chụp ảnh đề thi rõ nét. AI của KitoKit sẽ tự động nhận diện câu hỏi, các lựa chọn và đáp án để thầy cô xem lại trước khi lưu.",
    },
    {
      q: "Hệ thống có chạy được trên điện thoại và máy tính bảng không?",
      a: "KitoKit được tối ưu hoá giao diện tương thích hoàn toàn trên máy tính để bàn, laptop, máy tính bảng và điện thoại thông minh, không cần cài đặt phần mềm phức tạp.",
    },
  ];

  return (
    <section id="faq" className="py-16 md:py-24 bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold mb-3">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Giải đáp thắc mắc</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Câu Hỏi Thường Gặp
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-muted">
            Những thông tin cần biết để bắt đầu học tập và giảng dạy cùng KitoKit.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="border border-line rounded-2xl bg-surface-alt overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-ink hover:text-brand-600 transition-colors cursor-pointer"
                >
                  <span className="text-sm sm:text-base pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-ink-subtle shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-brand-600" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-ink-muted leading-relaxed border-t border-line/40 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
