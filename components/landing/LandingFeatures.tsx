import {
  Compass,
  FileCheck2,
  Bot,
  Zap,
  TrendingUp,
  BellRing,
  RotateCcw,
  BarChart3,
  CheckCircle2,
} from "lucide-react";

export default function LandingFeatures() {
  const steps = [
    {
      step: "01",
      title: "Chọn môn & đề thi",
      description:
        "Lựa chọn bài kiểm tra phù hợp theo khối lớp, kỹ năng mục tiêu hoặc mã lớp được giao bởi thầy cô.",
      icon: Compass,
    },
    {
      step: "02",
      title: "Làm đề trực tuyến",
      description:
        "Làm bài với giao diện thân thiện, hỗ trợ đếm giờ, ghi âm bài nói và soạn thảo bài viết trực tiếp.",
      icon: FileCheck2,
    },
    {
      step: "03",
      title: "Xem điểm & AI chấm",
      description:
        "Nhận điểm trắc nghiệm tức thì; bài tự luận Viết & Nói được trợ lý AI chấm điểm và chỉ rõ lỗi sai chi tiết.",
      icon: Bot,
    },
  ];

  const studentFeatures = [
    {
      title: "Chấm điểm tức thì",
      desc: "Không phải chờ đợi, học sinh biết ngay kết quả phần thi trắc nghiệm kèm đáp án đối chiếu.",
      icon: Zap,
    },
    {
      title: "Lộ trình học tập rõ ràng",
      desc: "Hệ thống bài học được sắp xếp theo từng cấp độ, giúp bứt phá tiến độ từng ngày.",
      icon: TrendingUp,
    },
    {
      title: "Thông báo có điểm",
      desc: "Hệ thống tự động thông báo ngay khi bài thi hoàn tất chấm điểm từ AI hoặc giáo viên.",
      icon: BellRing,
    },
    {
      title: "Xem lại bài chi tiết",
      desc: "Dễ dàng mở lại từng câu hỏi, kiểm tra bài làm, nghe lại file ghi âm và xem nhận xét sửa lỗi.",
      icon: RotateCcw,
    },
    {
      title: "Thống kê tiến bộ",
      desc: "Biểu đồ trực quan theo dõi sự tiến bộ qua từng bài luyện tập và từng kỹ năng cụ thể.",
      icon: BarChart3,
    },
  ];

  return (
    <section id="tinh-nang" className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* How it works (3 steps) */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-600 text-xs font-bold mb-3">
            <span>Đơn giản & Dễ dàng</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Cách KitoKit Hoạt Động
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-muted">
            Trải nghiệm học tập và ôn thi thông minh chỉ qua 3 bước tinh gọn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative mb-20">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="bg-surface-alt rounded-3xl p-8 border border-line relative overflow-hidden"
              >
                <div className="text-5xl font-extrabold text-brand-100 absolute top-4 right-6 select-none">
                  {s.step}
                </div>
                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white flex items-center justify-center mb-6 shadow-sm">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-ink mb-2">{s.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{s.description}</p>
              </div>
            );
          })}
        </div>

        {/* Features for Students */}
        <div className="pt-8 border-t border-line">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
              Tính Năng Dành Cho Học Sinh
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              Công cụ toàn diện giúp các em tự tin chinh phục mọi kỳ thi và phát triển năng lực tự học.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studentFeatures.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="p-6 rounded-2xl bg-surface-alt border border-line flex items-start gap-4 hover:border-brand-200 transition-colors"
                >
                  <div className="p-3 rounded-xl bg-brand-100 text-brand-600 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-ink mb-1">{f.title}</h4>
                    <p className="text-xs text-ink-muted leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
