"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, MessageCircleQuestion, ArrowRight } from "lucide-react";
import SectionTag from "@/components/landing/SectionTag";

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
    <section id="faq" className="py-16 md:py-24 bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        {/* Cột trái: tiêu đề + minh hoạ mascot hỏi đáp */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-24 space-y-6">
            <div>
              <SectionTag index="04" label="Hỏi đáp" />
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight leading-tight">
                Bạn hỏi,
                <br />
                <span className="text-brand-600">KitoKit trả lời.</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-ink-muted max-w-md">
                Những điều học sinh, phụ huynh và thầy cô hay thắc mắc khi bắt đầu dùng KitoKit.
              </p>
            </div>

            <div aria-hidden className="relative mx-auto lg:mx-0 w-64 h-56 sm:w-72 sm:h-60">
              <div className="absolute inset-6 rounded-full bg-gradient-to-br from-brand-100 to-white" />
              <Image src="/brand/kitokit-mark-transparent.png" alt="" width={430} height={400} className="kk-float absolute inset-0 m-auto w-40 sm:w-44 h-auto" />
              <span className="kk-pop absolute top-2 left-4 w-11 h-11 rounded-2xl rounded-bl-sm bg-brand-600 text-white font-display text-xl font-extrabold flex items-center justify-center shadow-lg shadow-brand-600/30">?</span>
              <span className="kk-pop absolute top-8 right-2 w-9 h-9 rounded-2xl rounded-br-sm bg-accent-400 text-white font-display text-lg font-extrabold flex items-center justify-center shadow-lg shadow-accent-500/30" style={{ animationDelay: "0.8s" }}>?</span>
              <span className="kk-pop absolute bottom-4 right-6 rounded-2xl rounded-tr-sm bg-white border border-line px-3 py-1.5 text-xs font-bold text-ink shadow-md" style={{ animationDelay: "1.6s" }}>Đã hiểu! ✓</span>
            </div>

            <div className="flex items-center gap-4 rounded-3xl bg-white border border-line p-5 shadow-xs max-w-md mx-auto lg:mx-0">
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center">
                <MessageCircleQuestion className="w-6 h-6" />
              </span>
              <div className="flex-1">
                <div className="font-bold text-ink">Còn thắc mắc khác?</div>
                <div className="text-xs text-ink-muted">Để lại lời nhắn, đội ngũ KitoKit sẽ liên hệ lại.</div>
              </div>
              <a href="#lien-he" aria-label="Đến form liên hệ" className="w-10 h-10 shrink-0 rounded-full bg-brand-50 hover:bg-brand-100 text-brand-600 flex items-center justify-center transition-colors">
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Cột phải: danh sách câu hỏi */}
        <div className="lg:col-span-7 space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-3xl border bg-white transition-all duration-300 ${
                  isOpen ? "border-brand-300 shadow-lg shadow-brand-600/10" : "border-line hover:border-brand-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center gap-4 p-5 text-left cursor-pointer"
                >
                  <span
                    className={`w-10 h-10 shrink-0 rounded-2xl font-mono text-sm font-bold flex items-center justify-center transition-colors ${
                      isOpen ? "bg-gradient-to-br from-brand-600 to-brand-400 text-white" : "bg-brand-50 text-brand-600"
                    }`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className={`flex-1 text-sm sm:text-base font-bold transition-colors ${isOpen ? "text-brand-700" : "text-ink"}`}>{faq.q}</span>
                  <span
                    className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen ? "rotate-45 bg-accent-400 text-white" : "bg-surface-alt text-ink-muted"
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </span>
                </button>
                {/* Mở/đóng mượt bằng grid-template-rows */}
                <div className={`grid transition-[grid-template-rows] duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 pl-[4.75rem] text-sm text-ink-muted leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
