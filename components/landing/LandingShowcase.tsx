import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import SectionTag from "@/components/landing/SectionTag";

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

// Giao diện thu nhỏ: học sinh nộp bài → điểm từng phần → AI nhận xét bài viết
function StudentMock() {
  return (
    <div aria-hidden className="relative rounded-2xl bg-white border border-accent-200 shadow-lg shadow-accent-500/10 p-4 space-y-3 max-w-sm w-full">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ink-subtle">Kết quả bài thi</span>
        <span className="kk-pop rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5" style={delay(0.3)}>Đã chấm xong</span>
      </div>
      {[
        { k: "Đọc hiểu", v: "9/10", w: "90%" },
        { k: "Nghe", v: "8/10", w: "80%" },
        { k: "Viết · AI chấm", v: "7.5", w: "75%" },
      ].map((r, i) => (
        <div key={r.k} className="space-y-1">
          <div className="flex justify-between text-xs font-semibold"><span className="text-ink-muted">{r.k}</span><span className="text-ink">{r.v}</span></div>
          <div className="h-2 rounded-full bg-line-soft overflow-hidden">
            <div className="kk-fill h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-400" style={{ maxWidth: r.w, ...delay(i * 0.3) }} />
          </div>
        </div>
      ))}
      <div className="kk-slide rounded-xl bg-accent-50 border border-accent-100 p-3 text-xs text-ink leading-relaxed" style={delay(1)}>
        <span className="font-bold text-accent-700">AI nhận xét:</span> Bố cục rõ ràng. Nên dùng thêm từ nối để các ý liền mạch hơn.
      </div>
    </div>
  );
}

// Giao diện thu nhỏ: quy trình của thầy cô, từng bước lần lượt được đánh dấu hoàn thành
function TeacherMock() {
  const steps = ["Tải đề Word / PDF lên", "AI tách câu hỏi & đáp án", "Thầy cô duyệt, chỉnh sửa", "Kéo vào lộ trình lớp", "Học sinh làm bài, có điểm"];
  return (
    <div aria-hidden className="rounded-2xl bg-white border border-accent-200 shadow-lg shadow-accent-500/10 p-4 space-y-2 max-w-sm w-full">
      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent-600 mb-1">Từ đề giấy đến lớp học</div>
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-3 rounded-xl bg-accent-50 px-3 py-2">
          <span className="w-6 h-6 shrink-0 rounded-full bg-white text-accent-600 border border-accent-200 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
          <span className="text-xs font-semibold text-ink flex-1">{s}</span>
          <span className="kk-pop w-5 h-5 rounded-full bg-gradient-to-br from-accent-400 to-accent-500 text-white text-[10px] font-extrabold flex items-center justify-center" style={delay(0.3 + i * 0.4)}>✓</span>
        </div>
      ))}
    </div>
  );
}

function Point({ label, children, dark }: { label: string; children: ReactNode; dark?: boolean }) {
  return (
    <div>
      <div className={`text-[11px] font-mono font-bold uppercase tracking-widest ${dark ? "text-accent-300" : "text-accent-600"}`}>{label}</div>
      <p className={`mt-1 text-sm leading-relaxed ${dark ? "text-brand-100" : "text-ink-muted"}`}>{children}</p>
    </div>
  );
}

export default function LandingShowcase() {
  return (
    <section className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Học sinh — hình bên trái, chữ bên phải (so le với khối thầy cô) */}
        <div id="hoc-sinh" className="scroll-mt-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center rounded-[2rem] bg-gradient-to-bl from-accent-100 via-accent-50 to-white border border-accent-200 p-6 sm:p-10 shadow-xl shadow-accent-500/10">
          <div className="space-y-6 lg:order-2">
            <SectionTag index="02" label="Dành cho học sinh" />
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-tight">
              Nộp bài là biết mình <span className="text-accent-500">đang ở đâu.</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-5">
              <Point label="Trước đây">Làm bài xong chờ cả tuần mới có điểm, không biết sai ở đâu.</Point>
              <Point label="Với KitoKit">Trắc nghiệm có điểm ngay; bài Viết, Nói được AI nhận xét theo tiêu chí.</Point>
              <Point label="Kết quả">Xem lại từng câu, nhận thông báo khi có điểm, thấy rõ tiến bộ.</Point>
            </div>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold px-6 py-3 shadow-lg shadow-accent-500/25 transition-all">
              Làm bài thử miễn phí <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex justify-center lg:justify-start lg:order-1"><StudentMock /></div>
        </div>

        {/* Thầy cô / trung tâm */}
        <div id="giao-vien" className="scroll-mt-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center rounded-[2rem] bg-gradient-to-br from-accent-100 via-accent-50 to-white border border-accent-200 p-6 sm:p-10 shadow-xl shadow-accent-500/10">
          <div className="space-y-6">
            <SectionTag index="03" label="Dành cho thầy cô & trung tâm" />
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-tight">
              Bớt giờ soạn đề, chấm bài. <span className="text-accent-500">Thêm giờ dạy.</span>
            </h2>
            <div className="grid sm:grid-cols-3 gap-5">
              <Point label="Trước đây">Gõ lại đề từ giấy, chấm tay từng bài, theo dõi tiến độ bằng bảng tính.</Point>
              <Point label="Với KitoKit">AI nhập đề, trình soạn nhiều dạng câu, kéo thả lộ trình, AI chấm có thầy cô duyệt.</Point>
              <Point label="Kết quả">Một nơi quản lý lớp, kho bài học, đề thi và tiến độ từng học sinh.</Point>
            </div>
            <a href="#lien-he" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold px-6 py-3 shadow-lg shadow-accent-500/25 transition-all">
              Liên hệ dùng thử <ArrowRight className="w-4 h-4" />
            </a>
          </div>
          <div className="flex justify-center lg:justify-end"><TeacherMock /></div>
        </div>
      </div>
    </section>
  );
}
