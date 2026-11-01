import SectionTag from "@/components/landing/SectionTag";

// Cam kết đúng với cách hệ thống đang vận hành (xem DEC-009, DEC-018, DEC-021, DEC-025).
const PRINCIPLES = [
  "Đáp án không bao giờ gửi xuống máy học sinh trước khi nộp.",
  "AI chấm, thầy cô có quyền xem lại và sửa điểm.",
  "AI lỗi thì chuyển thầy cô chấm — không bao giờ cho điểm ảo.",
  "Mỗi thầy cô chỉ thấy lớp, đề và học sinh của mình.",
  "Mở rộng môn học dần dần, làm chắc từng phần.",
];

export default function LandingPrinciples() {
  return (
    <section className="py-16 md:py-24 bg-surface">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <SectionTag index="04" label="Nguyên tắc" />
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight leading-tight">
            Công bằng với học sinh.
            <br />
            <span className="text-brand-600">Minh bạch với thầy cô.</span>
          </h2>
        </div>
        <ol className="lg:col-span-7 divide-y divide-line border-y border-line">
          {PRINCIPLES.map((p, i) => (
            <li key={p} className="group flex items-baseline gap-6 py-5">
              <span className="font-mono text-sm font-bold text-accent-500">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-base sm:text-lg font-semibold text-ink group-hover:text-brand-600 transition-colors">{p}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
