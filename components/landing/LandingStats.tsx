import CountUp from "@/components/landing/CountUp";

// Con số về năng lực hệ thống (không phải số người dùng) — đúng với tính năng đang có.
const ITEMS = [
  { to: 15, suffix: "+", label: "dạng câu hỏi", note: "trắc nghiệm, điền từ, nối, sắp xếp, tự luận…" },
  { to: 4, suffix: "", label: "kỹ năng tiếng Anh", note: "Nghe · Nói · Đọc · Viết, AI chấm Viết & Nói" },
  { to: 3, suffix: "", label: "nguồn nhập đề bằng AI", note: "Word, PDF và ảnh chụp" },
  { to: 24, suffix: "/7", label: "luyện tập mọi lúc", note: "máy tính, máy tính bảng, điện thoại" },
];

export default function LandingStats() {
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-r from-brand-800 via-brand-700 to-brand-500 py-14">
      <div className="absolute inset-0 -z-10 kk-grid-dark" aria-hidden />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-8">
        {ITEMS.map((it) => (
          <div key={it.label} className="text-white">
            <div className="font-display text-5xl sm:text-6xl font-extrabold leading-none drop-shadow-sm">
              <CountUp to={it.to} suffix={it.suffix} />
            </div>
            <div className="mt-2 text-base font-bold">{it.label}</div>
            <div className="mt-1 text-xs text-brand-100 leading-relaxed">{it.note}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
