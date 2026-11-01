import {
  Users2,
  FolderKanban,
  GitBranch,
  FileUp,
  Award,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export default function LandingTeachers() {
  const teacherFeatures = [
    {
      title: "Quản lý lớp học thông minh",
      desc: "Tạo lớp, cấp mã mời học sinh và theo dõi tiến độ hoàn thành bài tập của từng học viên.",
      icon: Users2,
    },
    {
      title: "Kho bài học & ngân hàng đề thi",
      desc: "Lưu trữ, tái sử dụng và chia sẻ tài liệu giảng dạy đa môn với phân loại khoa học.",
      icon: FolderKanban,
    },
    {
      title: "Kéo thả xây dựng lộ trình",
      desc: "Thiết kế giáo trình bài học và đề thi linh hoạt theo từng tuần hoặc từng chuyên đề.",
      icon: GitBranch,
    },
    {
      title: "AI nhập đề từ Word / PDF / Ảnh",
      desc: "Tiết kiệm 80% thời gian soạn đề bằng công nghệ AI tự động nhận diện và bóc tách câu hỏi.",
      icon: FileUp,
    },
    {
      title: "Chấm điểm kết hợp AI & Giáo viên",
      desc: "AI chấm sơ bộ các bài Viết và Nói, thầy cô dễ dàng xem lại, chỉnh điểm và thêm lời khuyên riêng.",
      icon: Award,
    },
  ];

  return (
    <section id="giao-vien" className="py-16 md:py-24 bg-surface-alt">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-brand-900 to-brand-800 rounded-3xl p-8 sm:p-12 lg:p-16 text-white shadow-xl relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-400/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="max-w-3xl space-y-4 mb-12">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-accent-300 text-xs font-bold border border-white/15">
                <span>Dành cho Giáo viên & Trung tâm Ngoại ngữ</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                Giải Pháp Toàn Diện Cho Thầy Cô & Cơ Sở Giáo Dục
              </h2>
              <p className="text-brand-100 text-sm sm:text-base leading-relaxed">
                Tối ưu hoá quy trình giảng dạy, số hoá tài liệu và nâng tầm trải nghiệm kiểm tra đánh giá với sự trợ giúp của AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {teacherFeatures.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={i}
                    className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-accent-400/20 text-accent-300 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
                    <p className="text-xs text-brand-200 leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-white/10">
              <div className="space-y-1 text-center sm:text-left">
                <p className="text-sm font-bold text-white">Bạn là giáo viên hoặc quản lý trung tâm?</p>
                <p className="text-xs text-brand-200">
                  Nhận tài khoản trải nghiệm hệ thống quản lý lớp và tính năng AI nhập đề miễn phí.
                </p>
              </div>
              <a
                href="#lien-he"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-accent-400 hover:bg-accent-500 text-ink font-bold text-sm shadow-md transition-all cursor-pointer whitespace-nowrap"
              >
                <span>Liên hệ dùng thử</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
