// Nhãn mục kiểu "[01] TÍNH NĂNG" dùng chung cho các section landing.
export default function SectionTag({ index, label, dark = false }: { index: string; label: string; dark?: boolean }) {
  return (
    <div className={`mb-4 inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest ${dark ? "text-brand-200" : "text-ink-subtle"}`}>
      <span className={dark ? "text-accent-300" : "text-accent-500"}>[{index}]</span>
      <span>{label}</span>
    </div>
  );
}
