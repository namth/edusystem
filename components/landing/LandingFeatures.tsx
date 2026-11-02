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

// Thẻ tông xanh; rê chuột: thẻ nổi lên, viền và bóng xanh
const TONE = {
  stage: "bg-gradient-to-br from-brand-100 via-brand-50 to-white",
  bar: "from-brand-600 to-brand-400",
  num: "text-brand-600",
  hover: "hover:border-brand-300 hover:shadow-brand-600/15",
};

export default function LandingFeatures() {
  return (
    <section id="tinh-nang" className="relative py-16 md:py-24 bg-cream overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mb-12">
          <SectionTag index="01" label="Tính năng nổi bật" />
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight leading-tight">
            Học có AI kèm.
            <br />
            <span className="text-brand-600">Dạy có <span className="text-accent-500">trợ lý soạn.</span></span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ Motion, title, desc }, i) => {
            const t = TONE;
            return (
              <article
                key={title}
                className={`group relative overflow-hidden rounded-3xl border border-line bg-white shadow-xs hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${t.hover}`}
              >
                <div className={`h-1.5 bg-gradient-to-r ${t.bar}`} />
                <div className={`p-3 ${t.stage}`}>
                  <Motion />
                </div>
                <div className="px-6 pt-4 pb-6">
                  <div className={`text-xs font-mono font-bold ${t.num}`}>{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="mt-1 font-display text-xl font-bold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted leading-relaxed">{desc}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
