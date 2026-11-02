export default function Footer() {
  return (
    <footer className="bg-white border-t border-brand-100 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs text-ink-subtle">
        <div className="mb-3 md:mb-0">
          <p className="font-medium">
            &copy; 2026 KitoKit. Học vui – Thi chắc.
          </p>
        </div>
        <div className="flex space-x-6 font-mono">
          <span className="hover:text-brand-800 cursor-pointer">Neo4j Graph Linked</span>
          <span>&bull;</span>
          <span className="hover:text-brand-800 cursor-pointer">Supabase DB</span>
          <span>&bull;</span>
          <span className="hover:text-brand-800 cursor-pointer">Academic Precision Design</span>
        </div>
      </div>
    </footer>
  );
}
