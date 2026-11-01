import {
  AiGradingMotion,
  EditorMotion,
  AiImportMotion,
  RoadmapMotion,
  InstantResultMotion,
  ProgressNotifyMotion,
} from "@/components/landing/motion/MotionIcons";
import SectionTag from "@/components/landing/SectionTag";

const FEATURES = [
  { Motion: AiGradingMotion, title: "AI chấm Viết & Nói", desc: "Học sinh nộp bài là có nhận xét theo tiêu chí: ngữ pháp, từ vựng, mạch lạc." },
  { Motion: InstantResultMotion, title: "Điểm ngay khi nộp", desc: "Câu trắc nghiệm chấm tức thì trên máy chủ. Đáp án không lộ trước khi nộp." },
  { Motion: EditorMotion, title: "Trình soạn cho thầy cô", desc: "Soạn câu hỏi nhiều dạng, chèn ảnh, âm thanh, công thức — như soạn văn bản." },
  { Motion: AiImportMotion, title: "AI nhập đề từ Word, PDF, ảnh", desc: "Tải đề có sẵn lên, AI tách câu hỏi và đáp án để thầy cô duyệt lại." },
  { Motion: RoadmapMotion, title: "Kéo thả tạo lộ trình", desc: "Sắp bài học và đề thi thành lộ trình, mở dần theo tiến độ từng lớp." },
  { Motion: ProgressNotifyMotion, title: "Thông báo & tiến bộ", desc: "Có điểm là báo ngay. Học sinh, thầy cô thấy rõ tiến bộ qua từng bài." },
];

export default function LandingFeatures() {
  return (
    <section id="tinh-nang" className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <SectionTag index="01" label="Tính năng nổi bật" />
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight leading-tight">
            Học có AI kèm.
            <br />
            <span className="text-brand-600">Dạy có trợ lý soạn.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ Motion, title, desc }, i) => (
            <article
              key={title}
              className="group rounded-3xl border border-line bg-white p-3 shadow-xs hover:shadow-md hover:-translate-y-1 hover:border-brand-200 transition-all duration-300"
            >
              <Motion />
              <div className="px-3 pt-5 pb-3">
                <div className="text-xs font-mono font-bold text-accent-500">{String(i + 1).padStart(2, "0")}</div>
                <h3 className="mt-1 font-display text-xl font-bold text-ink group-hover:text-brand-600 transition-colors">{title}</h3>
                <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{desc}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
