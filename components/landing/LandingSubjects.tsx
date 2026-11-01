import {
  Sparkles,
  Languages,
  Calculator,
  BookOpenText,
  FlaskConical,
  Compass,
  Code2,
} from "lucide-react";

export default function LandingSubjects() {
  const subjects = [
    {
      id: "english",
      name: "Tiếng Anh",
      tagline: "4 Kỹ Năng + AI Chấm Tức Thì",
      description:
        "Luyện tập toàn diện Nghe – Nói – Đọc – Viết theo khung chuẩn Cambridge & IELTS. Trợ lý AI chấm phát âm và ngữ pháp tức thì.",
      icon: Languages,
      featured: true,
      badge: "Nổi bật",
      colorClasses: "bg-brand-50 border-brand-300 text-brand-600",
      accentBg: "bg-brand-600 text-white",
    },
    {
      id: "math",
      name: "Toán học",
      tagline: "Tư duy logic & giải toán",
      description:
        "Ngân hàng đề thi trắc nghiệm và tự luận theo chương trình giáo dục phổ thông mới.",
      icon: Calculator,
      featured: false,
      badge: "Đang mở rộng",
      colorClasses: "bg-surface border-line text-blue-600",
      accentBg: "bg-blue-100 text-blue-700",
    },
    {
      id: "vietnamese",
      name: "Tiếng Việt",
      tagline: "Ngôn ngữ & đọc hiểu",
      description:
        "Rèn luyện kỹ năng đọc hiểu văn bản, ngữ pháp và viết đoạn văn mạch lạc.",
      icon: BookOpenText,
      featured: false,
      badge: "Đang mở rộng",
      colorClasses: "bg-surface border-line text-emerald-600",
      accentBg: "bg-emerald-100 text-emerald-700",
    },
    {
      id: "science",
      name: "Khoa học Tự nhiên",
      tagline: "Khám phá & trải nghiệm",
      description:
        "Hệ thống câu hỏi tình huống sinh động, liên hệ thực tiễn và mô phỏng trực quan.",
      icon: FlaskConical,
      featured: false,
      badge: "Đang mở rộng",
      colorClasses: "bg-surface border-line text-purple-600",
      accentBg: "bg-purple-100 text-purple-700",
    },
    {
      id: "history-geography",
      name: "Lịch sử & Địa lý",
      tagline: "Địa văn hóa & lịch sử",
      description:
        "Học theo bản đồ tương tác và dòng thời gian trực quan, ghi nhớ kiến thức tự nhiên.",
      icon: Compass,
      featured: false,
      badge: "Đang mở rộng",
      colorClasses: "bg-surface border-line text-amber-600",
      accentBg: "bg-amber-100 text-amber-700",
    },
    {
      id: "informatics",
      name: "Tin học",
      tagline: "Kỹ năng số & lập trình",
      description:
        "Thực hành tư duy máy tính, bài tập thuật toán và kỹ năng an toàn thông tin số.",
      icon: Code2,
      featured: false,
      badge: "Đang mở rộng",
      colorClasses: "bg-surface border-line text-rose-600",
      accentBg: "bg-rose-100 text-rose-700",
    },
  ];

  return (
    <section id="mon-hoc" className="py-16 md:py-24 bg-surface-alt">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hệ sinh thái đa môn</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Kho Môn Học Đa Dạng Chuẩn Bị Toàn Diện
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-muted">
            KitoKit định hướng phát triển kho đề thi và bài học cho tất cả các môn trọng tâm,
            với chương trình Tiếng Anh 4 kỹ năng ứng dụng AI đi đầu.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.map((sub) => {
            const Icon = sub.icon;
            return (
              <div
                key={sub.id}
                className={`relative rounded-3xl p-6 border transition-all duration-200 hover:shadow-md flex flex-col justify-between ${
                  sub.featured
                    ? "bg-white border-brand-400 ring-2 ring-brand-100 shadow-sm"
                    : "bg-white border-line hover:border-brand-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sub.colorClasses}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        sub.featured
                          ? "bg-brand-600 text-white"
                          : "bg-surface-alt border border-line text-ink-subtle"
                      }`}
                    >
                      {sub.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-ink mb-1">{sub.name}</h3>
                  <p className="text-xs font-semibold text-brand-600 mb-2">{sub.tagline}</p>
                  <p className="text-xs text-ink-muted leading-relaxed">{sub.description}</p>
                </div>

                {sub.featured && (
                  <div className="mt-5 pt-4 border-t border-line-soft">
                    <span className="text-[11px] font-bold text-brand-700 flex items-center gap-1">
                      ✦ Tích hợp AI chấm Nghe - Nói - Đọc - Viết
                    </span>
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
