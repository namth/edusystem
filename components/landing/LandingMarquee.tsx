// Dải chữ chạy liệt kê điểm mạnh (nhân đôi danh sách để chạy liền mạch).
const ITEMS = [
  "AI chấm Viết",
  "AI chấm Nói",
  "Điểm tức thì",
  "Nhập đề từ Word · PDF · ảnh",
  "Kéo thả lộ trình",
  "Ngân hàng đề dùng chung",
  "Thông báo khi có điểm",
  "Theo dõi tiến bộ",
  "Quản lý lớp bằng mã mời",
  "Chạy tốt trên điện thoại",
];

export default function LandingMarquee() {
  return (
    <div className="border-y border-line bg-white overflow-hidden" aria-hidden>
      <div className="kk-marquee flex w-max gap-10 py-4">
        {[...ITEMS, ...ITEMS].map((t, i) => (
          <span key={i} className="flex items-center gap-10 text-sm font-bold text-ink-muted whitespace-nowrap">
            {t}
            <span className="text-accent-400">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
