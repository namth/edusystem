export default function Footer() {
  return (
    <footer className="bg-[#ffffff] border-t border-[#e5eeff] py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center text-xs text-[#757682]">
        <div className="mb-3 md:mb-0">
          <p className="font-medium">
            &copy; 2026 EdTech English 4-Skills Platform. Powered by Next.js, Supabase, Neo4j AuraDB & OpenAI Engine.
          </p>
        </div>
        <div className="flex space-x-6 font-mono">
          <span className="hover:text-[#00236f] cursor-pointer">Neo4j Graph Linked</span>
          <span>&bull;</span>
          <span className="hover:text-[#00236f] cursor-pointer">Supabase DB</span>
          <span>&bull;</span>
          <span className="hover:text-[#00236f] cursor-pointer">Academic Precision Design</span>
        </div>
      </div>
    </footer>
  );
}
