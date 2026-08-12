"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  BookOpen,
  Mic,
  PenTool,
  Headphones,
  ArrowRight,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Star,
  Award,
  ChevronDown,
  ChevronUp,
  PlayCircle,
  Clock,
  ShieldCheck,
  UserCheck,
  Zap,
  GraduationCap,
  Send,
  MessageSquare,
} from "lucide-react";

export default function StudentLandingPage() {
  // Tab state for Programs by Age Group
  const [activeTab, setActiveTab] = useState<"kinder" | "kids" | "academic" | "ielts">("kinder");

  // Registration Form State
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    ageGroup: "3-5",
    courseInterest: "Kinder Journey",
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 800);
  };

  const programDetails = {
    kinder: {
      badge: "TIẾNG ANH MẦM NON",
      title: "Kinder Journey",
      age: "Bé 03 - 05 tuổi",
      description: "Khơi dậy niềm yêu thích Tiếng Anh tự nhiên của trẻ qua các bài học âm thanh, flashcard sinh động và hình ảnh phản xạ chuẩn quốc tế.",
      features: [
        "Test đầu vào miễn phí qua nhận diện AI",
        "Luyện phản xạ âm thanh & phát âm chuẩn US/UK",
        "Luyện thuyết trình từ nhỏ - Tăng tự tin cho bé",
        "Giao diện học bài sinh động, tương tác màu sắc",
      ],
      ctaText: "Đăng Ký Test Đầu Vào 3-5 Tuổi",
      targetPath: "/student/exam/test_01",
    },
    kids: {
      badge: "TIẾNG ANH TIỂU HỌC",
      title: "Kid's Hub",
      age: "Trẻ 06 - 10 tuổi",
      description: "Phát triển toàn diện 4 kỹ năng Nghe - Nói - Đọc - Viết. Lộ trình bám sát kiến thức trên trường và định hướng thi chứng chỉ Cambridge.",
      features: [
        "Luyện thi chứng chỉ Starters - Movers - Flyers",
        "Chấm bài tự động Listening & Reading tức thì",
        "Bài tập thu âm bài nói trực tiếp trên trình duyệt",
        "Báo cáo tiến độ học tập chi tiết hàng tuần",
      ],
      ctaText: "Khám Phá Chương Trình Kid's Hub",
      targetPath: "/student/exam/test_01",
    },
    academic: {
      badge: "TIẾNG ANH TRUNG HỌC",
      title: "Academic Focus",
      age: "Học sinh 11 - 14 tuổi",
      description: "Bổ trợ ngữ pháp chuyên sâu, mở rộng vốn từ vựng học thuật và rèn luyện kỹ năng tự duy luận bài viết tự luận.",
      features: [
        "Bám sát chương trình sách giáo khoa & thi Chuyên",
        "Trình soạn thảo Writing thông minh đếm từ tự động",
        "AI phân tích lỗi ngữ pháp & mạch lạc bài luận",
        "Lớp học tương tác trực tiếp theo mã mời từ Giáo viên",
      ],
      ctaText: "Trải Nghiệm Đề Thi Academic",
      targetPath: "/student/exam/test_01",
    },
    ielts: {
      badge: "LUYỆN THI CHỨNG CHỈ",
      title: "IELTS Intensive 4-Skills",
      age: "Từ 12 tuổi trở lên",
      description: "Kho đề thi IELTS chuẩn format thật với 4 kỹ năng. AI Engine phân tích và chấm điểm bài viết & bài nói theo IELTS Band Descriptor.",
      features: [
        "Kho đề thi IELTS Mock Test chuẩn 4 kỹ năng",
        "AI chấm điểm IELTS Writing & Speaking tự động",
        "Bộ thu âm micro bài nói với AI feedback phát âm",
        "Giáo viên thẩm định và duyệt điểm Human-in-the-Loop",
      ],
      ctaText: "Vào Thi Thử IELTS Mock Test #01",
      targetPath: "/student/exam/test_01",
    },
  };

  const activeProg = programDetails[activeTab];

  const faqs = [
    {
      q: "Làm thế nào để học sinh đăng ký tham gia lớp học của giáo viên?",
      a: "Học sinh chỉ cần đăng ký tài khoản Học viên, sau đó nhập Mã lớp học (Class Code) do Giáo viên cung cấp để tham gia lớp. Khi đó toàn bộ bài tập và đề thi của lớp sẽ hiển thị tự động trên Dashboard của học sinh.",
    },
    {
      q: "Hệ thống AI chấm điểm bài thi Writing & Speaking chính xác ra sao?",
      a: "Hệ thống tích hợp AI Engine tiên tiến (Portkey & Google Gemini Multimodal) chấm bài theo 4 tiêu chí chuẩn IELTS (Task Fulfillment, Coherence, Vocabulary, Grammar, Pronunciation). Ngoài ra, Giáo viên có thể xem xét và chỉnh sửa điểm (Teacher Override) trước khi chốt kết quả.",
    },
    {
      q: "Học sinh có cần cài đặt phần mềm nào khác để thu âm bài nói Speaking không?",
      a: "Không cần cài đặt bất kỳ phần mềm nào! Trình duyệt web sẽ tự động mở bộ thu âm micro tích hợp ngay trên trang bài thi. Học sinh chỉ cần cho phép quyền dùng Micro là có thể thu âm và nghe lại dễ dàng.",
    },
    {
      q: "Kết quả làm bài có được lưu trữ để theo dõi tiến độ không?",
      a: "Có. Tất cả bài nộp đều được lưu trữ an toàn trên cơ sở dữ liệu PostgreSQL / Supabase. Học sinh và phụ huynh có thể vào mục Phân tích tiến độ (Analytics) để xem biểu đồ tăng trưởng điểm số qua từng bài test.",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#fffbff] font-sans text-[#211a16] selection:bg-[#ffb782] selection:text-[#6d3807]">
      {/* 📣 Top Announcement Bar */}
      <div className="bg-[#6d3807] text-[#fff1ea] py-2 px-4 text-center text-xs font-semibold flex items-center justify-center space-x-2 border-b border-[#ffb782]/30 shadow-2xs">
        <Sparkles className="w-4 h-4 text-[#ffb782] animate-spin" />
        <span>
          🎁 HỌC THỬ &amp; KHỞI TẠO MOCK TEST 4 KỸ NĂNG MIỄN PHÍ CÙNG AURA ENGLISH!
        </span>
        <Link
          href="/student/exam/test_01"
          className="ml-2 px-2.5 py-0.5 bg-[#ffb782] text-[#6d3807] hover:bg-white transition-all rounded-full text-[11px] font-bold uppercase tracking-wider shadow-2xs"
        >
          Thi Thử Ngay &rarr;
        </Link>
      </div>

      {/* 🧭 Minimalist Header (Icon Logo AURA English - No Nav Items) */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#d8c2b6]/60 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex justify-between items-center">
          {/* Brand Logo with Icon */}
          <Link href="/student/landing" className="flex items-center space-x-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#6d3807] via-[#8a4f1e] to-[#ffb782] text-white flex items-center justify-center font-extrabold text-2xl shadow-md group-hover:scale-105 transition-all ring-2 ring-[#ffb782]/50">
              <Zap className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <span className="font-headline font-extrabold text-xl text-[#6d3807] tracking-tight block leading-tight">
                AURA English
              </span>
              <span className="text-[10px] font-mono font-bold text-[#857469] tracking-widest uppercase block">
                AI 4-Skills Learning Platform
              </span>
            </div>
          </Link>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <Link
              href="/student"
              className="hidden sm:inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-[#6d3807] bg-[#fff1ea] hover:bg-[#ffb782] border border-[#d8c2b6] rounded-xl transition-all shadow-2xs font-headline"
            >
              <UserCheck className="w-4 h-4 text-[#6d3807]" />
              <span>Vào Lớp Học</span>
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-bold text-[#6d3807] hover:bg-[#fff1ea] rounded-xl transition-all border border-transparent font-headline"
            >
              Đăng Nhập
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-xs font-bold bg-[#6d3807] text-white hover:bg-[#8a4f1e] rounded-xl transition-all shadow-md font-headline flex items-center space-x-1.5"
            >
              <span>Đăng Ký Tài Khoản</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* 🚀 Hero Section */}
      <section className="relative py-16 lg:py-24 bg-gradient-to-b from-[#fff1ea]/60 via-[#fffbff] to-[#fff8f5] overflow-hidden border-b border-[#d8c2b6]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-white border border-[#d8c2b6] text-[#6d3807] text-xs font-bold shadow-2xs mb-3">
                <Sparkles className="w-4 h-4 text-[#6d3807] animate-pulse" />
                <span>AURA English – Nền tảng Tự Động Chấm Điểm AI</span>
              </span>

              <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#211a16] leading-[1.15] tracking-tight">
                Chinh Phục <span className="text-[#6d3807]">4 Kỹ Năng</span> Tiếng Anh Với Trí Tuệ Nhân Tạo
              </h1>

              <p className="text-base text-[#52443a] leading-relaxed max-w-2xl font-medium">
                Đồng hành cùng học viên từ Mầm non đến Tiền IELTS. Hệ thống bài thi mô phỏng chuẩn quốc tế, tự động thu âm bài nói, chấm điểm bài viết theo Band Score và báo cáo tiến bộ liên tục.
              </p>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap gap-4 pt-2">
                <Link
                  href="/student/exam/test_01"
                  className="px-7 py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center space-x-2 font-headline uppercase tracking-wider"
                >
                  <PlayCircle className="w-4 h-4 fill-white text-[#6d3807]" />
                  <span>Vào Làm Đề Thi Thử (Free Mock Test)</span>
                </Link>

                <a
                  href="#contact-form"
                  className="px-6 py-3.5 bg-white text-[#6d3807] hover:bg-[#fff1ea] border-2 border-[#6d3807] font-bold text-xs rounded-xl transition-all font-headline shadow-2xs flex items-center space-x-2 uppercase tracking-wider"
                >
                  <MessageSquare className="w-4 h-4 text-[#6d3807]" />
                  <span>Đăng Ký Tư Vấn &amp; Test Đầu Vào</span>
                </a>
              </div>

              {/* Trust Indicators */}
              <div className="pt-6 border-t border-[#d8c2b6]/60 grid grid-cols-3 gap-4 text-xs font-medium text-[#52443a]">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Chấm Writing &amp; Speaking AI</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Theo dõi Lớp học Giáo viên</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Thu âm Micro không cài đặt</span>
                </div>
              </div>
            </div>

            {/* Right Hero Image Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-white p-2">
                <div className="relative aspect-video sm:aspect-square rounded-2xl overflow-hidden">
                  <Image
                    src="/hero_banner.jpg"
                    alt="Học sinh luyện tiếng Anh 4 kỹ năng tại AURA English"
                    fill
                    className="object-cover hover:scale-105 transition-all duration-700"
                    priority
                  />
                </div>
                <div className="p-4 bg-white rounded-xl mt-2 flex items-center justify-between text-xs border border-[#d8c2b6]/60 shadow-2xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-[#fff1ea] flex items-center justify-center text-[#6d3807] font-bold">
                      <Award className="w-5 h-5 text-[#6d3807]" />
                    </div>
                    <div>
                      <span className="font-bold text-[#211a16] block">Hơn 50,000+ Học Viên</span>
                      <span className="text-[11px] text-[#857469]">Đã học tập cùng AURA English</span>
                    </div>
                  </div>
                  <div className="flex text-amber-500 space-x-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🏫 Program Tabs Section */}
      <section id="program-tabs" className="py-20 bg-white border-b border-[#d8c2b6]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Section Heading with clear pill tag margin spacing */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] text-xs font-bold font-mono uppercase tracking-wider mb-5">
              CHƯƠNG TRÌNH HỌC PHÂN LẠI THEO ĐỘ TUỔI
            </span>
            <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-[#211a16] mt-2">
              Lộ Trình Đào Tạo Tiếng Anh Chuyên Biệt
            </h2>
            <p className="text-sm text-[#52443a] leading-relaxed mt-3">
              Lựa chọn độ tuổi phù hợp để khám phá chương trình học tối ưu nhất cho học sinh từ Mầm non đến Tiền IELTS.
            </p>
          </div>

          {/* Interactive Navigation Tabs */}
          <div className="flex justify-center flex-wrap gap-3">
            <button
              onClick={() => setActiveTab("kinder")}
              className={`px-6 py-3.5 rounded-2xl font-headline text-xs font-bold transition-all shadow-2xs flex items-center space-x-2 cursor-pointer ${
                activeTab === "kinder"
                  ? "bg-[#6d3807] text-white shadow-md ring-2 ring-[#ffb782]"
                  : "bg-[#fff8f5] text-[#52443a] hover:bg-[#fff1ea] border border-[#d8c2b6]"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Kinder Journey (03 - 05 tuổi)</span>
            </button>

            <button
              onClick={() => setActiveTab("kids")}
              className={`px-6 py-3.5 rounded-2xl font-headline text-xs font-bold transition-all shadow-2xs flex items-center space-x-2 cursor-pointer ${
                activeTab === "kids"
                  ? "bg-[#6d3807] text-white shadow-md ring-2 ring-[#ffb782]"
                  : "bg-[#fff8f5] text-[#52443a] hover:bg-[#fff1ea] border border-[#d8c2b6]"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Kid's Hub (06 - 10 tuổi)</span>
            </button>

            <button
              onClick={() => setActiveTab("academic")}
              className={`px-6 py-3.5 rounded-2xl font-headline text-xs font-bold transition-all shadow-2xs flex items-center space-x-2 cursor-pointer ${
                activeTab === "academic"
                  ? "bg-[#6d3807] text-white shadow-md ring-2 ring-[#ffb782]"
                  : "bg-[#fff8f5] text-[#52443a] hover:bg-[#fff1ea] border border-[#d8c2b6]"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Academic Focus (11 - 14 tuổi)</span>
            </button>

            <button
              onClick={() => setActiveTab("ielts")}
              className={`px-6 py-3.5 rounded-2xl font-headline text-xs font-bold transition-all shadow-2xs flex items-center space-x-2 cursor-pointer ${
                activeTab === "ielts"
                  ? "bg-[#6d3807] text-white shadow-md ring-2 ring-[#ffb782]"
                  : "bg-[#fff8f5] text-[#52443a] hover:bg-[#fff1ea] border border-[#d8c2b6]"
              }`}
            >
              <Award className="w-4 h-4" />
              <span>IELTS Intensive (Từ 12 tuổi)</span>
            </button>
          </div>

          {/* Tab Content Box */}
          <div className="bg-[#fff8f5] p-8 sm:p-10 rounded-3xl border-2 border-[#d8c2b6] shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-[#6d3807] text-white text-[11px] font-bold rounded-lg uppercase tracking-wider">
                  {activeProg.badge}
                </span>
                <span className="text-xs font-bold text-[#6d3807] font-mono">{activeProg.age}</span>
              </div>

              <h3 className="font-headline text-2xl sm:text-3xl font-bold text-[#211a16]">
                {activeProg.title}
              </h3>

              <p className="text-sm text-[#52443a] leading-relaxed font-medium">
                {activeProg.description}
              </p>

              <div className="space-y-3">
                <span className="text-xs font-bold text-[#6d3807] uppercase block font-mono">Đặc quyền điểm nhấn khóa học:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeProg.features.map((feat, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-[#d8c2b6] flex items-center space-x-2.5 text-xs text-[#211a16] font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex items-center space-x-4">
                <Link
                  href={activeProg.targetPath}
                  className="px-6 py-3 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-bold text-xs rounded-xl shadow-md transition-all font-headline uppercase tracking-wider flex items-center space-x-2"
                >
                  <span>{activeProg.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <a
                  href="#contact-form"
                  className="px-5 py-3 bg-white hover:bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] font-bold text-xs rounded-xl transition-all font-headline"
                >
                  Tư Vấn Miễn Phí
                </a>
              </div>
            </div>

            {/* Right Tab Showcase Graphic */}
            <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#fff1ea] text-[#6d3807] flex items-center justify-center mx-auto font-bold">
                {activeTab === "kinder" && <Sparkles className="w-8 h-8" />}
                {activeTab === "kids" && <GraduationCap className="w-8 h-8" />}
                {activeTab === "academic" && <BookOpen className="w-8 h-8" />}
                {activeTab === "ielts" && <Award className="w-8 h-8" />}
              </div>

              <h4 className="font-bold text-[#211a16] text-base font-headline">
                Khám Phá Trải Nghiệm Học Tập Sinh Động
              </h4>

              <p className="text-xs text-[#52443a] leading-relaxed">
                Được thiết kế giao diện phù hợp với độ tuổi {activeProg.age}, hỗ trợ làm bài trắc nghiệm, ghép câu, thu âm trực tiếp và nhận điểm số đánh giá chi tiết.
              </p>

              <div className="p-4 bg-[#fff8f5] rounded-xl border border-[#d8c2b6] text-xs text-[#6d3807] font-bold">
                ⚡ Tự động phân tích điểm theo chuẩn IELTS 9.0 Band Scale
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 🎙️ AI 4-Skills Showcase Section */}
      <section id="ai-features" className="py-20 bg-[#fffbff] border-b border-[#d8c2b6]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {/* Section Heading with clear pill tag margin spacing */}
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] text-xs font-bold font-mono uppercase tracking-wider mb-5">
              CÔNG NGHỆ ĐỘT PHÁ
            </span>
            <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-[#211a16] mt-2">
              Bộ Công Cụ Luyện Thi Tiếng Anh 4 Kỹ Năng
            </h2>
            <p className="text-sm text-[#52443a] leading-relaxed mt-3">
              Tích hợp trí tuệ nhân tạo AI nâng cao trải nghiệm thi thử và phản hồi chi tiết cho học sinh.
            </p>
          </div>

          {/* 4 Skills Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Reading */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#fff1ea] text-[#6d3807] flex items-center justify-center font-bold">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#211a16] text-base font-headline">1. Reading Passage</h3>
              <p className="text-xs text-[#52443a] leading-relaxed">
                Đọc bài song song (Passage Split Pane), câu hỏi trắc nghiệm, kéo thả từ điền khuyết (Fill-in Gaps) và giải thích đáp án chi tiết.
              </p>
              <div className="pt-2 text-[11px] font-bold text-[#6d3807] flex items-center space-x-1">
                <span>Trắc nghiệm &amp; Điền từ</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Listening */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#fff1ea] text-[#6d3807] flex items-center justify-center font-bold">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#211a16] text-base font-headline">2. Listening Audio</h3>
              <p className="text-xs text-[#52443a] leading-relaxed">
                Trình phát âm thanh Audio Player chuẩn HD, hỗ trợ câu hỏi nghe nói MC, sắp xếp thứ tự câu thoại và AI Voice Generator đa giọng đọc.
              </p>
              <div className="pt-2 text-[11px] font-bold text-[#6d3807] flex items-center space-x-1">
                <span>Audio Realtime AI</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Writing */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#fff1ea] text-[#6d3807] flex items-center justify-center font-bold">
                <PenTool className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#211a16] text-base font-headline">3. Writing Essay AI</h3>
              <p className="text-xs text-[#52443a] leading-relaxed">
                Trình soạn bài viết với Floating Word Counter. AI chấm bài IELTS Writing 4 tiêu chí (Task Achievement, Coherence, Vocabulary, Grammar).
              </p>
              <div className="pt-2 text-[11px] font-bold text-[#6d3807] flex items-center space-x-1">
                <span>AI Chấm Luận Tự Động</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Speaking */}
            <div className="bg-white p-6 rounded-2xl border border-[#d8c2b6] shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#fff1ea] text-[#6d3807] flex items-center justify-center font-bold">
                <Mic className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[#211a16] text-base font-headline">4. Speaking Recorder</h3>
              <p className="text-xs text-[#52443a] leading-relaxed">
                Bộ thu âm micro trực tiếp trên web (`MediaRecorder`). AI đánh giá phát âm, ngữ điệu, độ trôi chảy và giáo viên thẩm định kết quả.
              </p>
              <div className="pt-2 text-[11px] font-bold text-[#6d3807] flex items-center space-x-1">
                <span>Thu âm &amp; Chấm giọng nói</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* AI Showcase Image Banner */}
          <div className="bg-white p-6 sm:p-8 rounded-3xl border-2 border-[#d8c2b6] shadow-md grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 relative aspect-video rounded-2xl overflow-hidden border border-[#d8c2b6]">
              <Image
                src="/skills_showcase.jpg"
                alt="AURA English AI Speaking & Writing evaluation tool"
                fill
                className="object-cover"
              />
            </div>

            <div className="lg:col-span-6 space-y-4 text-left">
              <span className="inline-block px-3 py-1 bg-[#fff1ea] text-[#6d3807] text-xs font-bold rounded-lg uppercase tracking-wider font-mono mb-2">
                TRẢI NGHIỆM ĐỀ THI MẪU REALTIME
              </span>
              <h3 className="font-headline text-2xl font-bold text-[#211a16]">
                Thử Sức Ngay Với Đề Thi Mock Test Standard #01
              </h3>
              <p className="text-xs text-[#52443a] leading-relaxed font-medium">
                Khám phá giao diện làm bài thi thực tế với 4 kỹ năng hoàn chỉnh. Nộp bài để xem AI chấm điểm tự động bài làm của bạn trong vài giây!
              </p>
              <Link
                href="/student/exam/test_01"
                className="inline-flex items-center space-x-2 px-6 py-3.5 bg-[#6d3807] hover:bg-[#8a4f1e] text-white text-xs font-bold rounded-xl shadow-md transition-all font-headline uppercase tracking-wider"
              >
                <Zap className="w-4 h-4 text-[#ffb782]" />
                <span>Mở Đề Thi Mock Test Standard #01</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ✍️ Consultation & Placement Test Registration Form */}
      <section id="contact-form" className="py-20 bg-[#fff8f5] border-b border-[#d8c2b6]/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 text-center">
          {/* Section Heading with clear pill tag margin spacing */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-white text-[#6d3807] border border-[#d8c2b6] text-xs font-bold font-mono uppercase tracking-wider mb-5">
              ĐĂNG KÝ TƯ VẤN &amp; TEST ĐẦU VÀO
            </span>
            <h2 className="font-headline text-3xl font-extrabold text-[#211a16] mt-2">
              Nhận Lộ Trình Học &amp; Đánh Giá AI Miễn Phí
            </h2>
            <p className="text-xs text-[#52443a] leading-relaxed mt-3">
              Điền thông tin bên dưới để đăng ký lịch kiểm tra đầu vào và tư vấn xếp lớp từ AURA English.
            </p>
          </div>

          {isSubmitted ? (
            <div className="p-8 bg-white rounded-3xl border-2 border-emerald-500 shadow-lg text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto animate-bounce" />
              <h3 className="text-xl font-bold text-[#6d3807] font-headline">
                🎉 Đăng Ký Kiểm Tra Đầu Vào Thành Công!
              </h3>
              <p className="text-xs text-[#52443a] leading-relaxed max-w-md mx-auto">
                Cảm ơn bạn <strong>{formData.fullName}</strong>! Đội ngũ cố vấn học tập AURA English sẽ liên hệ qua SĐT <strong>{formData.phone}</strong> trong vòng 15 phút để sắp xếp lịch thi test AI cho bé.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                className="px-6 py-2.5 bg-[#6d3807] text-white text-xs font-bold rounded-xl hover:bg-[#8a4f1e] transition-all cursor-pointer font-headline"
              >
                Gửi Thêm Đăng Ký Khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleFormSubmit} className="bg-white p-8 sm:p-10 rounded-3xl border-2 border-[#d8c2b6] shadow-md space-y-5 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#6d3807] uppercase">Họ và Tên Phụ Huynh / Học Sinh:</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#6d3807] uppercase">Số Điện Thoại Zalo:</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Ví dụ: 0912 345 678"
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#6d3807] uppercase">Địa Chỉ Email:</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Ví dụ: phuhuynh@gmail.com"
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-[#6d3807] uppercase">Độ Tuổi / Trình Độ Của Học Sinh:</label>
                  <select
                    value={formData.ageGroup}
                    onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
                    className="w-full p-3 bg-[#fff8f5] border border-[#d8c2b6] rounded-xl text-xs font-medium focus:outline-none focus:border-[#6d3807] cursor-pointer"
                  >
                    <option value="3-5">Bé 03 - 05 tuổi (Kinder Journey)</option>
                    <option value="6-10">Bé 06 - 10 tuổi (Kid's Hub - Tiểu Học)</option>
                    <option value="11-14">Bé 11 - 14 tuổi (Academic - Trung Học)</option>
                    <option value="12+">Từ 12 tuổi trở lên (IELTS Intensive)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-[#6d3807] hover:bg-[#8a4f1e] text-white font-headline text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2 uppercase tracking-wider disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Đang gửi thông tin...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#ffb782]" />
                    <span>Gửi Đăng Ký Tư Vấn &amp; Xếp Lịch Test AI</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ❓ FAQ Accordion Section */}
      <section id="faqs" className="py-20 bg-white border-b border-[#d8c2b6]/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Section Heading with clear pill tag margin spacing */}
          <div className="text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#fff1ea] text-[#6d3807] border border-[#d8c2b6] text-xs font-bold font-mono uppercase tracking-wider mb-5">
              CÂU HỎI THƯỜNG GẶP
            </span>
            <h2 className="font-headline text-3xl font-extrabold text-[#211a16] mt-2">
              Giải Đáp Thắc Mắc Về Hệ Thống AURA English
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#fff8f5] rounded-2xl border border-[#d8c2b6] overflow-hidden transition-all shadow-2xs"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left font-bold text-xs sm:text-sm text-[#211a16] flex justify-between items-center hover:text-[#6d3807] transition-all cursor-pointer font-headline"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-5 h-5 text-[#6d3807] shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#857469] shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-[#52443a] leading-relaxed font-medium border-t border-[#d8c2b6]/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ⚓ Footer */}
      <footer className="bg-[#211a16] text-[#d8c2b6] py-12 border-t border-[#6d3807]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6d3807] to-[#ffb782] text-white flex items-center justify-center font-bold text-sm">
                <Zap className="w-5 h-5 text-white fill-white" />
              </div>
              <span className="font-headline font-extrabold text-base text-white">AURA English</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#a89587]">
              Hệ thống Học &amp; Luyện Thi Tiếng Anh 4 Kỹ Năng kết hợp AI Engine &amp; Lớp học Giáo viên.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="font-bold text-white font-headline text-xs uppercase tracking-wider">Liên Kết Nhanh</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li><Link href="/student/landing" className="hover:text-white transition-all">Trang chủ</Link></li>
              <li><Link href="/student/dashboard" className="hover:text-white transition-all">Khóa học của tôi</Link></li>
              <li><Link href="/student/exam/test_01" className="hover:text-white transition-all">Thi thử IELTS Mock Test</Link></li>
              <li><Link href="/login" className="hover:text-white transition-all">Đăng nhập Học viên</Link></li>
            </ul>
          </div>

          {/* Contact Details (AURA English Placeholders) */}
          <div className="space-y-2">
            <h4 className="font-bold text-white font-headline text-xs uppercase tracking-wider">Thông Tin Liên Hệ</h4>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center space-x-2">
                <Phone className="w-3.5 h-3.5 text-[#ffb782]" />
                <span>Hotline: 1900 AURA (1900 8888)</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-3.5 h-3.5 text-[#ffb782]" />
                <span>Email: contact@auraenglish.edu.vn</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-[#ffb782]" />
                <span>Hệ thống Anh ngữ AURA English</span>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="space-y-2 md:text-right">
            <h4 className="font-bold text-white font-headline text-xs uppercase tracking-wider">Bản Quyền</h4>
            <p className="text-[11px] text-[#a89587]">
              &copy; {new Date().getFullYear()} AURA English EdTech Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
