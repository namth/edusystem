import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  BookOpen,
  FileUp,
  Bot,
  Users,
  Route,
  Layers,
  GraduationCap,
  CreditCard,
  ShieldCheck,
  Clock,
  Phone,
  Mail,
  ExternalLink,
  HelpCircle,
  Zap,
  Award,
} from "lucide-react";
import { BRAND } from "@/lib/brand";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "Giới thiệu KitoKit dành cho Giáo viên & Trung tâm | Trợ lý Giảng dạy & Khảo thí AI",
  description:
    "Tài liệu giới thiệu chi tiết nền tảng KitoKit dành cho thầy cô giáo: lợi ích sản phẩm, AI nhập đề từ Word/PDF, AI chấm Writing & Speaking, chính sách chi phí minh bạch và cẩm nang hướng dẫn sử dụng.",
  openGraph: {
    title: "KitoKit Dành Cho Giáo Viên — Giảm 80% Giờ Soạn Đề & Chấm Bài Cùng AI",
    description:
      "Khám phá lợi ích, chính sách dùng thử miễn phí và hướng dẫn sử dụng sơ bộ KitoKit dành cho các thầy cô giáo.",
    images: ["/brand/kitokit-logo-dung.png"],
  },
};

const CORE_BENEFITS = [
  {
    step: "01",
    tag: "AI Ingestion Studio",
    title: "AI Nhập Đề Tự Động Từ Word, PDF & Ảnh Chụp Trong 10 Giây",
    desc: "Thầy cô không còn phải gõ lại từng câu hỏi hay cắt dán thủ công. Chỉ cần kéo thả file đề Word (.docx), PDF hoặc ảnh chụp đề giấy lên hệ thống, AI tự động nhận diện đoạn văn đọc hiểu, bóc tách câu hỏi và khoanh vùng đáp án đúng.",
    highlights: [
      "Nhận diện thông minh cả đề Tiếng Anh (Reading/Multiple Choice) lẫn đề Toán, Lý, Hóa...",
      "Tự động khớp bảng đáp án cuối trang vào từng câu hỏi tương ứng",
      "Có màn hình xem trước (Preview) để thầy cô kiểm tra và chỉnh sửa trước khi lưu",
    ],
    mascot: "/brand/mascot-3d/kito-3d-ngau.png",
    guideHref: "/guideline/ai-nhap-de.html",
    guideLabel: "Xem hướng dẫn AI nhập đề",
    mockupUrl: "kito.io.vn/teacher/library/ai-studio",
    mockupTitle: "Đã bóc tách thành công 40/40 câu hỏi (Độ chính xác 99%)",
    mockupItems: [
      { label: "File gốc: De_Thi_Thu_THPT_2026.docx", badge: "Hoàn tất 8 giây" },
      { label: "Tự động tách 3 bài đọc (Reading Passages) + 40 câu trắc nghiệm", badge: "Đã khớp đáp án" },
    ],
  },
  {
    step: "02",
    tag: "Human-in-the-Loop AI Grading",
    title: "Trợ Lý AI Chấm Bài Writing & Speaking Tức Thì, Giáo Viên Duyệt Điểm",
    desc: "Giải phóng thầy cô khỏi hàng chục giờ chấm bài tự luận và nghe file ghi âm mỗi tuần. Trắc nghiệm có điểm ngay khi học sinh nộp bài; riêng phần Viết (Writing) và Nói (Speaking) được AI chấm chi tiết theo tiêu chí Rubric quốc tế.",
    highlights: [
      "Phân tích chi tiết ngữ pháp, từ vựng, độ mạch lạc (Writing) và phát âm, độ trôi chảy (Speaking)",
      "Tự động gắn cờ CẦN XEM XÉT (NEEDS_REVIEW) nếu file thu âm ồn hoặc bài làm bất thường",
      "Thầy cô có toàn quyền điều chỉnh điểm (Override) và thêm lời phê riêng trước khi công bố",
    ],
    mascot: "/brand/mascot-3d/kito-3d-nhan-sao.png",
    guideHref: "/guideline/duyet-diem.html",
    guideLabel: "Xem hướng dẫn Duyệt điểm AI",
    mockupUrl: "kito.io.vn/teacher/grading",
    mockupTitle: "Bảng duyệt điểm AI · Writing Task 2 & Speaking Part 2",
    mockupItems: [
      { label: "AI đánh giá: Band 7.0 · Bố cục rõ ràng, từ vựng học thuật tốt", badge: "Đã chấm AI" },
      { label: "Giáo viên duyệt / Chỉnh điểm (Override) & Gửi thông báo cho học sinh", badge: "1 chạm" },
    ],
  },
  {
    step: "03",
    tag: "Khảo Thí Chuẩn Hóa",
    title: "Soạn Đề Thi Đủ 4 Kỹ Năng (Nghe · Nói · Đọc · Viết) & 15+ Dạng Câu Hỏi",
    desc: "Không gian làm bài thi được thiết kế chuẩn khảo thí hiện đại: bài Đọc (Reading) chia đôi màn hình giúp học sinh vừa đọc bài vừa chọn đáp án không cần cuộn trang; bài Nghe (Listening) tích hợp trình phát Audio mượt mà.",
    highlights: [
      "Hỗ trợ hơn 15 dạng câu hỏi: Trắc nghiệm, Điền từ, Nối cặp, Sắp xếp câu, Đúng/Sai, Tự luận, Thu âm...",
      "Chống gian lận hiệu quả: Đếm ngược thời gian thực, tự động thu bài, cảnh báo khi học sinh chuyển tab",
      "Hỗ trợ đa môn học: Ngoại ngữ 4 kỹ năng (LANGUAGE) hoặc các môn Toán, Lý, Hóa, Văn, Sử (SIMPLE)",
    ],
    mascot: "/brand/mascot-3d/kito-3d-viet-bai.png",
    guideHref: "/guideline/de-thi.html",
    guideLabel: "Xem hướng dẫn Soạn đề 4 kỹ năng",
    mockupUrl: "kito.io.vn/teacher/exams",
    mockupTitle: "Cấu trúc đề thi 4 kỹ năng chuẩn IELTS / TOEIC / THPT",
    mockupItems: [
      { label: "Listening (Audio MP3) + Reading (Màn hình đôi Split-Screen)", badge: "Chấm tức thì" },
      { label: "Writing (Đếm từ tự động) + Speaking (Thu âm trực tiếp trên web)", badge: "AI + GV chấm" },
    ],
  },
  {
    step: "04",
    tag: "Quản Lý Học Viên Thông Minh",
    title: "Cấp Tài Khoản Học Sinh Không Cần Email & Link Mời Vào Lớp 1 Chạm",
    desc: "Xóa bỏ hoàn toàn rào cản công nghệ cho học sinh Tiểu học và THCS chưa có email cá nhân. Thầy cô có thể tự tạo tài khoản cho học sinh chỉ bằng Tên đăng nhập (Username) hoặc gửi Link mời vào nhóm Zalo lớp.",
    highlights: [
      "Tạo tài khoản học sinh trong 5 giây, tự động thêm thẳng vào lớp học tương ứng",
      "Xuất thẻ thông tin đăng nhập (kèm mật khẩu mặc định) để sao chép gửi Zalo cho phụ huynh",
      "Học sinh đã có tài khoản chỉ cần bấm vào Link mời (kito.io.vn/join/...) là vào thẳng lớp",
    ],
    mascot: "/brand/mascot-3d/kito-3d-khen-ngon-cai.png",
    guideHref: "/guideline/tao-hoc-sinh.html",
    guideLabel: "Xem hướng dẫn Cấp tài khoản học sinh",
    mockupUrl: "kito.io.vn/teacher/students/create",
    mockupTitle: "Thẻ tài khoản học sinh xuất tự động gửi Phụ huynh",
    mockupItems: [
      { label: "Tên đăng nhập: namnguyen2012 · Mật khẩu: 123456 (Không cần Email)", badge: "Sẵn sàng học" },
      { label: "Tự động ghi danh vào lớp: [KITO88] IELTS 6.5 Intensive", badge: "Đã vào lớp" },
    ],
  },
  {
    step: "05",
    tag: "Lộ Trình Học Tập (Class Roadmap)",
    title: "Quản Lý Lớp Học & Mở Khóa Bài Học Theo Tiến Độ Từng Buổi Dạy",
    desc: "Thay vì gửi link bài tập rời rạc dễ bị trôi trên nhóm chat, thầy cô sắp xếp toàn bộ Bài học lý thuyết, Flashcards và Đề thi thành một Cây lộ trình (Roadmap) khoa học theo từng Unit / Chương học.",
    highlights: [
      "Chủ động kiểm soát tiến độ: Dạy đến buổi nào bấm Mở khóa (🔓) bài tập của buổi đó",
      "Theo dõi trực quan sĩ số lớp, danh sách học sinh đã nộp bài, điểm số từng kỹ năng",
      "Nhân bản lộ trình từ lớp này sang lớp khác chỉ trong vài giây, tiết kiệm công sức chuẩn bị",
    ],
    mascot: "/brand/mascot-3d/kito-3d-chien-thang.png",
    guideHref: "/guideline/lop-hoc.html",
    guideLabel: "Xem hướng dẫn Quản lý lớp & Lộ trình",
    mockupUrl: "kito.io.vn/teacher/classes",
    mockupTitle: "Cây lộ trình lớp học · Kiểm soát đóng/mở theo buổi",
    mockupItems: [
      { label: "Unit 1: Global Warming Vocabulary & Reading Practice", badge: "🔓 Đang mở" },
      { label: "Unit 2: Listening Section 1 & Writing Task 1", badge: "🔒 Đang khóa" },
    ],
  },
  {
    step: "06",
    tag: "Kho Học Liệu & Từ Vựng",
    title: "Soạn Bài Giảng Tương Tác & Thẻ Từ Vựng Flashcards Phát Âm Chuẩn",
    desc: "Bên cạnh đề khảo thí, KitoKit cung cấp trình soạn Bài học đa phương tiện (nhúng video, bảng biểu, âm thanh xen kẽ câu hỏi ôn tập) cùng kho thẻ từ vựng Flashcards giúp học sinh tự ôn luyện tại nhà.",
    highlights: [
      "Tích hợp công nghệ phát âm chuẩn bản ngữ (Text-to-Speech) cho từng thẻ từ vựng Flashcard",
      "Chuyển đổi linh hoạt từ Bài học sang Đề thi hoặc nhân bản bài học chỉ với 1 cú nhấp chuột",
      "Học sinh học trên máy tính, máy tính bảng hoặc điện thoại mượt mà không cần cài đặt app",
    ],
    mascot: "/brand/mascot-3d/kito-3d-yeu-thich.png",
    guideHref: "/guideline/bai-hoc.html",
    guideLabel: "Xem hướng dẫn Soạn bài & Flashcards",
    mockupUrl: "kito.io.vn/teacher/lessons",
    mockupTitle: "Kho học liệu số & Bộ thẻ Flashcards thông minh",
    mockupItems: [
      { label: "Bài giảng lý thuyết kết hợp câu hỏi kiểm tra hiểu bài ngay tại chỗ", badge: "Tương tác" },
      { label: "Bộ thẻ Flashcards song ngữ kèm phiên âm & giọng đọc tự động", badge: "Luyện phản xạ" },
    ],
  },
];

const GUIDELINE_MODULES = [
  {
    num: "Tổng quan",
    title: "Cẩm Nang Khởi Động Nhanh",
    desc: "Bức tranh toàn cảnh về hệ sinh thái KitoKit và quy trình 4 bước dành cho giáo viên mới bắt đầu.",
    href: "/guideline/index.html",
    mascot: "/brand/mascot-3d/kito-3d-vui-mung.png",
  },
  {
    num: "Chuyên đề 1",
    title: "Quản Lý Lớp Học & Lộ Trình",
    desc: "Tạo lớp mới, lấy mã lớp/link mời 1 chạm và cách đóng/mở khóa bài tập theo từng buổi học.",
    href: "/guideline/lop-hoc.html",
    mascot: "/brand/mascot-3d/kito-3d-chien-thang.png",
  },
  {
    num: "Chuyên đề 2",
    title: "Cấp Nhanh Tài Khoản Học Sinh",
    desc: "Tạo tài khoản bằng Username không cần email, gán vào lớp và xuất thẻ gửi phụ huynh.",
    href: "/guideline/tao-hoc-sinh.html",
    mascot: "/brand/mascot-3d/kito-3d-khen-ngon-cai.png",
  },
  {
    num: "Chuyên đề 3",
    title: "Quản Lý Slot & Mua Gói VietQR",
    desc: "Cách tính hạn ngạch học sinh (1 học sinh học nhiều lớp chỉ tính 1 slot) và thanh toán tự động.",
    href: "/guideline/slot-goi-cuoc.html",
    mascot: "/brand/mascot-3d/kito-3d-vui-mung.png",
  },
  {
    num: "Chuyên đề 4",
    title: "Kho Bài Học & Soạn Bài Giảng",
    desc: "Soạn lý thuyết kèm câu hỏi tương tác, xem trước giao diện học sinh và nhân bản học liệu.",
    href: "/guideline/bai-hoc.html",
    mascot: "/brand/mascot-3d/kito-3d-viet-bai.png",
  },
  {
    num: "Chuyên đề 5",
    title: "Soạn Đề Thi Chuẩn 4 Kỹ Năng",
    desc: "Thiết lập đề Listening (Audio), Reading (màn hình đôi), Writing và Speaking kèm barem điểm.",
    href: "/guideline/de-thi.html",
    mascot: "/brand/mascot-3d/kito-3d-nhan-sao.png",
  },
  {
    num: "Chuyên đề 6",
    title: "AI Nhập Đề Tự Động (Word/PDF/Ảnh)",
    desc: "Tải đề có sẵn lên để AI tự động tách câu hỏi, đoạn văn và đáp án chỉ trong 10 giây.",
    href: "/guideline/ai-nhap-de.html",
    mascot: "/brand/mascot-3d/kito-3d-ngau.png",
  },
  {
    num: "Chuyên đề 7",
    title: "Quản Lý Thẻ Từ Vựng Flashcards",
    desc: "Tạo bộ thẻ từ vựng song ngữ có phát âm chuẩn TTS và đính kèm vào lộ trình lớp học.",
    href: "/guideline/flashcards.html",
    mascot: "/brand/mascot-3d/kito-3d-yeu-thich.png",
  },
  {
    num: "Chuyên đề 8",
    title: "Thiết Lập & Quản Lý Môn Học",
    desc: "Tự tạo môn học mới cho trung tâm: chế độ Ngoại ngữ (LANGUAGE) hoặc Môn chuẩn (SIMPLE).",
    href: "/guideline/mon-hoc.html",
    mascot: "/brand/mascot-3d/kito-3d-thac-mac.png",
  },
  {
    num: "Chuyên đề 9",
    title: "Duyệt Điểm AI & Chấm Bài Tự Luận",
    desc: "Xem chi tiết nhận xét của AI cho bài Viết/Nói, nghe lại file thu âm và điều chỉnh điểm số.",
    href: "/guideline/duyet-diem.html",
    mascot: "/brand/mascot-3d/kito-3d-nhan-sao.png",
  },
];

export default function ForTeachersBrochurePage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface font-sans text-ink selection:bg-brand-600 selection:text-white">
      {/* Top Sticky Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-line shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Image
                src="/brand/kitokit-logo-ngang.png"
                alt="KitoKit"
                width={170}
                height={70}
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>
            <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold">
              <GraduationCap className="w-3.5 h-3.5 text-brand-600" />
              <span>Tài Liệu Giới Thiệu Dành Cho Giáo Viên</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-ink-muted">
            <a href="#loi-ich" className="hover:text-brand-600 transition-colors">
              Lợi ích sản phẩm
            </a>
            <a href="#chi-phi" className="hover:text-brand-600 transition-colors">
              Có mất phí không?
            </a>
            <a href="#quy-trinh" className="hover:text-brand-600 transition-colors">
              Cách đăng ký & sử dụng
            </a>
            <a href="#cam-nang" className="hover:text-brand-600 transition-colors">
              Cẩm nang Guideline
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <a
              href="/guideline/index.html"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Cẩm nang HTML</span>
              <span className="sm:hidden">Guideline</span>
            </a>
            <Link
              href="/register/teacher"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white text-xs font-bold shadow-sm transition-all"
            >
              <span>Đăng ký dùng thử</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* HERO SECTION */}
        <section className="relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 pt-12 pb-20 md:pt-16 md:pb-24 text-white">
          <div
            className="absolute inset-0 -z-10 kk-grid-dark [mask-image:radial-gradient(ellipse_at_center,black,transparent_80%)]"
            aria-hidden
          />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-brand-100 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                  <span>Giải Pháp Giảng Dạy & Khảo Thí Thông Minh Thế Hệ Mới</span>
                </div>

                <h1 className="font-display text-3xl sm:text-5xl lg:text-[52px] font-extrabold text-white tracking-tight leading-[1.12]">
                  Bớt 80% Giờ Soạn Đề, Chấm Bài.{" "}
                  <span className="bg-gradient-to-r from-accent-300 via-accent-400 to-accent-500 bg-clip-text text-transparent">
                    Thêm Trọn Giờ Truyền Cảm Hứng.
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-brand-100 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                  <strong>KitoKit</strong> là trợ lý công nghệ được thiết kế riêng cho các Thầy Cô giáo và Trung tâm đào tạo: biến file đề Word/PDF thành bài thi trực tuyến trong <strong>10 giây</strong>, tự động chấm điểm trắc nghiệm và dùng <strong>AI nhận xét chi tiết bài Viết & Nói</strong> theo chuẩn Rubric.
                </p>

                {/* Key Value Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-left">
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                    <div className="font-display text-xl sm:text-2xl font-extrabold text-white">10 giây</div>
                    <div className="text-xs text-brand-100">AI bóc tách đề từ Word, PDF, Ảnh</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                    <div className="font-display text-xl sm:text-2xl font-extrabold text-white">4 Kỹ năng</div>
                    <div className="text-xs text-brand-100">Nghe · Nói · Đọc · Viết & Đa môn</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                    <div className="font-display text-xl sm:text-2xl font-extrabold text-white">0đ Khởi tạo</div>
                    <div className="text-xs text-brand-100">Đăng ký dùng thử miễn phí ngay</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
                    <div className="font-display text-xl sm:text-2xl font-extrabold text-white">100% Web</div>
                    <div className="text-xs text-brand-100">Chạy trên cả máy tính & điện thoại</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                  <Link
                    href="/register/teacher"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-base shadow-lg shadow-accent-500/30 transition-all"
                  >
                    <span>Đăng Ký Giáo Viên Dùng Thử (Miễn Phí)</span>
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <a
                    href="/guideline/index.html"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/10 border border-white/25 hover:bg-white/20 text-white font-bold text-base backdrop-blur-sm transition-all"
                  >
                    <BookOpen className="w-5 h-5 text-white" />
                    <span>Mở Cẩm Nang Hướng Dẫn Chi Tiết</span>
                  </a>
                </div>
              </div>

              {/* Right Column: 3D Mascot Showcase */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="relative w-80 h-80 sm:w-96 sm:h-96 flex items-center justify-center">
                  <div className="absolute inset-6 rounded-full bg-brand-400/35 blur-3xl" />
                  <div className="absolute inset-10 rounded-3xl bg-white/10 border border-white/20 backdrop-blur-md rotate-3" />
                  <div className="relative z-10 flex flex-col items-center">
                    <Image
                      src="/brand/mascot-3d/kito-3d-viet-bai.png"
                      alt="Trợ lý AI Kito đồng hành cùng Giáo viên"
                      width={340}
                      height={460}
                      className="kk-float h-64 sm:h-76 w-auto drop-shadow-[0_24px_36px_rgba(0,0,0,0.4)]"
                      priority
                    />
                  </div>

                  {/* Floating Feature Badges around 3D Mascot */}
                  <div className="absolute -top-2 left-0 sm:-left-4 z-20 bg-white text-ink rounded-2xl px-3.5 py-2 shadow-xl flex items-center gap-2 border border-brand-100">
                    <span className="w-7 h-7 rounded-xl bg-brand-600 text-white flex items-center justify-center">
                      <FileUp className="w-4 h-4 text-white" />
                    </span>
                    <div className="text-left">
                      <div className="text-[11px] font-extrabold text-ink">AI Nhập Đề 10s</div>
                      <div className="text-[10px] text-ink-muted">Word · PDF · Ảnh chụp</div>
                    </div>
                  </div>

                  <div className="absolute top-1/3 -right-2 sm:-right-6 z-20 bg-white text-ink rounded-2xl px-3.5 py-2 shadow-xl flex items-center gap-2 border border-brand-100">
                    <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </span>
                    <div className="text-left">
                      <div className="text-[11px] font-extrabold text-ink">AI Chấm Viết & Nói</div>
                      <div className="text-[10px] text-emerald-700 font-semibold">Chuẩn Rubric quốc tế</div>
                    </div>
                  </div>

                  <div className="absolute -bottom-2 left-4 sm:left-2 z-20 bg-white text-ink rounded-2xl px-4 py-2.5 shadow-xl flex items-center gap-2.5 border border-brand-100">
                    <Image
                      src="/brand/mascot-3d/kito-3d-khen-ngon-cai.png"
                      alt="Kito"
                      width={40}
                      height={40}
                      className="w-8 h-8 object-contain"
                    />
                    <div className="text-left">
                      <div className="text-xs font-extrabold text-brand-700">Dùng thử miễn phí ngay!</div>
                      <div className="text-[10px] text-ink-muted">Kích hoạt tự động trong 1 phút</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: SO SÁNH NỖI ĐAU TRƯỚC ĐÂY VS GIẢI PHÁP KITOKIT */}
        <section className="py-16 md:py-22 bg-cream border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wider">
                Vì sao thầy cô chọn KitoKit?
              </span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
                Thay Thế Quy Trình Thủ Công Rời Rạc Bằng{" "}
                <span className="text-brand-600">Một Nền Tảng Duy Nhất</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-ink-muted">
                KitoKit được thiết kế từ chính thực tế giảng dạy của các thầy cô giáo tại Việt Nam, giải quyết triệt để 4 khâu tốn thời gian nhất.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              {/* Before KitoKit */}
              <div className="rounded-3xl bg-white border border-rose-200 p-6 sm:p-8 shadow-xs flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4 border-b border-rose-100 pb-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-600">
                        Cách làm truyền thống
                      </span>
                      <h3 className="font-display text-xl sm:text-2xl font-extrabold text-ink mt-0.5">
                        Khi chưa có trợ lý KitoKit
                      </h3>
                    </div>
                    <Image
                      src="/brand/mascot-3d/kito-3d-buon-khoc.png"
                      alt="Vất vả soạn đề chấm bài"
                      width={72}
                      height={96}
                      className="w-16 h-16 object-contain shrink-0"
                    />
                  </div>

                  <ul className="space-y-4 text-sm text-ink-muted">
                    <li className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-ink">Mất 2–3 giờ gõ lại từng đề thi:</strong> Phải copy-paste từng câu từ file Word/PDF sang biểu mẫu online, định dạng lại đoạn văn và đáp án rất cực nhọc.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-ink">Quá tải chấm bài Viết & Nói:</strong> Chấm tay hàng chục bài luận Writing và mở nghe từng file ghi âm Speaking qua Zalo khiến thầy cô kiệt sức mỗi tối.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-ink">Học sinh nhỏ tuổi không có Email:</strong> Học sinh Tiểu học, THCS không thể tự đăng ký tài khoản nếu hệ thống bắt buộc xác thực email phức tạp.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-ink">Quản lý bài tập rời rạc:</strong> Gửi link bài tập qua nhóm chat dễ bị trôi, khó thống kê em nào làm đủ, em nào đang yếu kỹ năng nào.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* With KitoKit */}
              <div className="rounded-3xl bg-gradient-to-br from-brand-50 via-white to-brand-50 border-2 border-brand-500 p-6 sm:p-8 shadow-lg shadow-brand-600/10 flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4 border-b border-brand-200 pb-4">
                    <div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand-600">
                        <Sparkles className="w-3.5 h-3.5" /> Giải pháp KitoKit AI
                      </span>
                      <h3 className="font-display text-xl sm:text-2xl font-extrabold text-brand-900 mt-0.5">
                        Khi đồng hành cùng KitoKit
                      </h3>
                    </div>
                    <Image
                      src="/brand/mascot-3d/kito-3d-chien-thang.png"
                      alt="Thảnh thơi dạy học cùng KitoKit"
                      width={72}
                      height={96}
                      className="w-16 h-16 object-contain shrink-0"
                    />
                  </div>

                  <ul className="space-y-4 text-sm text-ink">
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tải file Word/PDF/Ảnh lên là xong đề (10 giây):</strong> AI tự động bóc tách câu hỏi, bài đọc hiểu và bảng đáp án. Thầy cô chỉ cần kiểm tra và bấm Lưu.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Trắc nghiệm chấm tức thì · Tự luận có AI chấm nháp:</strong> Học sinh nộp bài là có điểm và nhận xét chi tiết cho cả Writing & Speaking; thầy cô duyệt lại chỉ trong 1 phút.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Cấp tài khoản học sinh không cần Email:</strong> Tạo tài khoản bằng Tên đăng nhập dễ nhớ (vd: <code className="px-1.5 py-0.5 bg-brand-100 rounded text-brand-800 font-bold">namnguyen2012</code>) và xuất thẻ gửi phụ huynh.
                      </span>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Lộ trình lớp học đóng/mở theo buổi:</strong> Gắn bài học, Flashcard và đề thi vào từng Unit; dạy đến buổi nào mở khóa bài buổi đó cực kỳ kỷ luật.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: CHI TIẾT 6 LỢI ÍCH SẢN PHẨM (KÈM MASCOT 3D & UI MOCKUP) */}
        <section id="loi-ich" className="scroll-mt-16 py-16 md:py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-700 text-xs font-bold uppercase tracking-wider">
                Chi tiết tính năng & Lợi ích
              </span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight">
                6 Trợ Thủ Đắc Lực Trong Không Gian{" "}
                <span className="text-brand-600">Giáo Viên KitoKit</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-ink-muted">
                Mỗi tính năng đều đi kèm hướng dẫn trực quan từng bước trong bộ Cẩm nang Guideline HTML.
              </p>
            </div>

            <div className="space-y-12">
              {CORE_BENEFITS.map((item, idx) => {
                const isEven = idx % 2 === 1;
                return (
                  <div
                    key={item.step}
                    className="rounded-3xl border border-line bg-surface-alt/60 p-6 sm:p-10 shadow-xs hover:border-brand-300 transition-all"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
                      {/* Text Description Column */}
                      <div className={`lg:col-span-7 space-y-4 ${isEven ? "lg:order-2" : ""}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="px-3 py-1 rounded-xl bg-brand-600 text-white font-mono text-xs font-bold">
                            LỢI ÍCH {item.step}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-wider text-brand-700">
                            {item.tag}
                          </span>
                        </div>

                        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-ink leading-tight">
                          {item.title}
                        </h3>

                        <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                          {item.desc}
                        </p>

                        <ul className="space-y-2.5 pt-1">
                          {item.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2.5 text-sm text-ink">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="pt-3 flex flex-wrap items-center gap-3">
                          <a
                            href={item.guideHref}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-brand-200 hover:bg-brand-50 text-brand-700 text-xs sm:text-sm font-bold shadow-2xs transition-colors"
                          >
                            <BookOpen className="w-4 h-4 text-brand-600" />
                            <span>{item.guideLabel}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-brand-500" />
                          </a>
                        </div>
                      </div>

                      {/* Visual Mockup + 3D Mascot Column */}
                      <div className={`lg:col-span-5 ${isEven ? "lg:order-1" : ""}`}>
                        <div className="relative rounded-2xl bg-white border border-line shadow-md overflow-hidden">
                          {/* Browser Bar */}
                          <div className="bg-brand-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                            </div>
                            <span className="font-mono text-[11px] text-brand-100 truncate max-w-[200px] sm:max-w-xs">
                              https://{item.mockupUrl}
                            </span>
                            <span className="w-6" />
                          </div>

                          {/* Mockup Content */}
                          <div className="p-5 space-y-4">
                            <div className="flex items-center gap-4 bg-brand-50/80 border border-brand-100 rounded-2xl p-3.5">
                              <Image
                                src={item.mascot}
                                alt={item.title}
                                width={80}
                                height={100}
                                className="w-16 h-20 object-contain shrink-0 drop-shadow-sm"
                              />
                              <div className="space-y-1">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-brand-600 text-white text-[10px] font-bold">
                                  MÔ PHỎNG TRỰC QUAN
                                </span>
                                <h4 className="text-xs sm:text-sm font-extrabold text-ink leading-snug">
                                  {item.mockupTitle}
                                </h4>
                              </div>
                            </div>

                            <div className="space-y-2.5">
                              {item.mockupItems.map((m) => (
                                <div
                                  key={m.label}
                                  className="p-3 rounded-xl bg-surface-alt border border-line flex items-center justify-between gap-2 text-xs"
                                >
                                  <span className="font-semibold text-ink leading-snug">{m.label}</span>
                                  <span className="shrink-0 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                    {m.badge}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3: SỬ DỤNG KITOKIT CÓ MẤT PHÍ KHÔNG? (CHÍNH SÁCH CHI PHÍ MINH BẠCH) */}
        <section
          id="chi-phi"
          className="scroll-mt-16 relative isolate overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 py-16 md:py-24 text-white"
        >
          <div className="absolute inset-0 -z-10 kk-grid-dark" aria-hidden />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-brand-100 text-xs font-bold uppercase tracking-wider">
                <HelpCircle className="w-4 h-4 text-white" />
                <span>Giải đáp câu hỏi quan trọng nhất của Thầy Cô</span>
              </div>
              <h2 className="mt-4 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight">
                Sử Dụng KitoKit Có Mất Phí Không?
              </h2>
              <p className="mt-3 text-base sm:text-lg text-brand-100 leading-relaxed">
                Câu trả lời là: <strong>Thầy cô được Đăng ký & Dùng thử MIỄN PHÍ 100% ngay lập tức!</strong> Khi mở rộng dạy nhiều học sinh, chi phí được tính theo cơ chế <strong>Slot Học Sinh</strong> cực kỳ tiết kiệm và minh bạch.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              {/* Tier 1: Free Trial */}
              <div className="lg:col-span-6 rounded-3xl bg-white text-ink p-6 sm:p-9 shadow-xl flex flex-col justify-between border-2 border-brand-200">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
                        Giai đoạn 1 · Trải nghiệm ngay
                      </span>
                      <h3 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-ink">
                        Gói Dùng Thử Giáo Viên
                      </h3>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-display text-4xl font-extrabold text-brand-600">0đ</span>
                        <span className="text-xs font-bold text-ink-muted">/ Kích hoạt tự động sau 1 phút đăng ký</span>
                      </div>
                    </div>
                    <Image
                      src="/brand/mascot-3d/kito-3d-vui-mung.png"
                      alt="Dùng thử miễn phí"
                      width={80}
                      height={110}
                      className="w-18 h-22 object-contain shrink-0"
                    />
                  </div>

                  <p className="text-sm text-ink-muted leading-relaxed">
                    Dành cho mọi thầy cô mới làm quen với KitoKit. Không cần thẻ ngân hàng, mở ngay không gian giảng dạy để trải nghiệm tận tay toàn bộ công nghệ AI:
                  </p>

                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tạo ngay 01 Lớp học</strong> và mời tối đa <strong>03 Học sinh</strong> vào làm bài thực tế.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Soạn tay hoặc dùng AI Nhập Đề tối đa 03 Bài học / Đề thi</strong> từ file Word, PDF, Ảnh chụp.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Tặng sẵn 09 lượt AI chấm thử</strong> bài thi Writing & Speaking chuẩn Rubric.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Xác minh mở khóa tính năng:</strong> Đội ngũ KitoKit liên hệ qua SĐT/Zalo trong 1–2 ngày làm việc để xác minh giáo viên và mở khóa giới hạn lớp/đề!
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-line">
                  <Link
                    href="/register/teacher"
                    className="w-full py-3.5 px-6 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm sm:text-base shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Tạo Tài Khoản Dùng Thử Miễn Phí Ngay</span>
                    <ArrowRight className="w-4 h-4 text-white" />
                  </Link>
                </div>
              </div>

              {/* Tier 2: Verified Teacher & Slot Pricing */}
              <div className="lg:col-span-6 rounded-3xl bg-white text-ink p-6 sm:p-9 shadow-xl flex flex-col justify-between border-2 border-accent-400">
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-accent-100 text-accent-700 text-xs font-extrabold uppercase tracking-wider">
                        Giai đoạn 2 · Khi mở rộng lớp học
                      </span>
                      <h3 className="mt-2 font-display text-2xl sm:text-3xl font-extrabold text-ink">
                        Cơ Chế Tính Theo Slot Học Sinh
                      </h3>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-display text-4xl font-extrabold text-accent-500">Chỉ ~10.000đ</span>
                        <span className="text-xs font-bold text-ink-muted">/ 1 Slot Học sinh hoạt động</span>
                      </div>
                    </div>
                    <Image
                      src="/brand/mascot-3d/kito-3d-khen-ngon-cai.png"
                      alt="Slot học sinh tiết kiệm"
                      width={80}
                      height={110}
                      className="w-18 h-22 object-contain shrink-0"
                    />
                  </div>

                  <p className="text-sm text-ink-muted leading-relaxed">
                    Sau khi xác minh tài khoản, thầy cô <strong>không phải đóng phí thuê bao tháng cố định</strong>. Dạy bao nhiêu học sinh thì chỉ cần bấy nhiêu Slot:
                  </p>

                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Miễn phí không giới hạn cho Giáo viên:</strong> Tạo vô hạn lớp học, môn học, bài giảng, đề thi và Flashcards.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>AI Chấm bài & AI Nhập đề không trừ Slot:</strong> Học sinh làm bao nhiêu đề hay chấm bao nhiêu bài tự luận AI cũng không phát sinh thêm phí.
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Quy tắc vàng tiết kiệm (1 Slot = 1 Học sinh):</strong> Nếu 1 học sinh tham gia cùng lúc 2, 3 hay 5 lớp khác nhau của thầy cô, hệ thống <strong>chỉ tính là 01 Slot duy nhất</strong>!
                      </span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Mua thêm linh hoạt qua VietQR:</strong> Mua từ 10 slots trở lên ngay tại mục <em>Slot & Đơn hàng</em>, quét QR kích hoạt tự động.
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-line flex flex-col sm:flex-row gap-3">
                  <a
                    href="/guideline/slot-goi-cuoc.html"
                    className="flex-1 py-3.5 px-5 rounded-2xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4 text-brand-600" />
                    <span>Xem hướng dẫn Quản lý Slot</span>
                  </a>
                  <a
                    href="/#lien-he"
                    className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>Tư vấn gói Trung tâm</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: CÁCH THỨC ĐĂNG KÝ & SỬ DỤNG SƠ BỘ TRONG 4 BƯỚC */}
        <section id="quy-trinh" className="scroll-mt-16 py-16 md:py-24 bg-cream border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-xs font-bold uppercase tracking-wider">
                Hướng dẫn khởi động nhanh
              </span>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ink tracking-tight">
                Cách Thức Đăng Ký & Sử Dụng Sơ Bộ{" "}
                <span className="text-brand-600">Chỉ Trong 4 Bước</span>
              </h2>
              <p className="mt-3 text-sm sm:text-base text-ink-muted">
                Không cần cài đặt phần mềm. Thầy cô chỉ cần làm theo 4 bước dưới đây là có thể tổ chức buổi học & kiểm tra đầu tiên ngay hôm nay.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1 */}
              <div className="rounded-3xl bg-white border border-line p-6 shadow-xs flex flex-col justify-between relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-2xl bg-brand-600 text-white font-display text-xl font-extrabold flex items-center justify-center shadow-sm">
                      1
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold">
                      Khoảng 1 phút
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-ink">
                    Đăng Ký Tài Khoản Giáo Viên
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Truy cập trang{" "}
                    <Link href="/register/teacher" className="text-brand-600 font-bold underline">
                      /register/teacher
                    </Link>
                    . Trợ lý Kito sẽ hỏi thầy cô vài câu ngắn gọn (Họ tên, môn giảng dạy, cấp học, SĐT/Zalo và Email) để mở ngay tài khoản dùng thử.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-line">
                  <Link
                    href="/register/teacher"
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    <span>Mở trang đăng ký Giáo viên</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Step 2 */}
              <div className="rounded-3xl bg-white border border-line p-6 shadow-xs flex flex-col justify-between relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-2xl bg-brand-600 text-white font-display text-xl font-extrabold flex items-center justify-center shadow-sm">
                      2
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold">
                      Khoảng 2 phút
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-ink">
                    Tạo Lớp & Thêm Học Sinh
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Vào menu <strong>Quản Lý Lớp Học</strong> để tạo lớp mới. Sau đó thầy cô có 2 cách thêm học sinh: copy <strong>Link Mời</strong> gửi vào nhóm Zalo lớp, hoặc vào mục <strong>Tạo Acc Học Sinh</strong> để cấp tài khoản không cần email.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-line">
                  <a
                    href="/guideline/lop-hoc.html"
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    <span>Xem chi tiết tạo lớp & cấp acc</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 3 */}
              <div className="rounded-3xl bg-white border border-line p-6 shadow-xs flex flex-col justify-between relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-2xl bg-brand-600 text-white font-display text-xl font-extrabold flex items-center justify-center shadow-sm">
                      3
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-[11px] font-bold">
                      Khoảng 1 phút
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-ink">
                    AI Nhập Đề & Mở Khóa Bài
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Vào <strong>Kho Bài Học & Đề Thi</strong>, chọn <strong>AI Nhập Đề</strong> để tải file Word/PDF có sẵn lên (hoặc tự soạn mới). Gắn đề thi vào <strong>Lộ trình lớp</strong> và bấm nút <strong>Mở Khóa (🔓)</strong> để học sinh thấy bài.
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-line">
                  <a
                    href="/guideline/ai-nhap-de.html"
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    <span>Xem chi tiết AI nhập đề</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Step 4 */}
              <div className="rounded-3xl bg-white border border-line p-6 shadow-xs flex flex-col justify-between relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-2xl bg-brand-600 text-white font-display text-xl font-extrabold flex items-center justify-center shadow-sm">
                      4
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      Tự động 24/7
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-extrabold text-ink">
                    Duyệt Điểm AI & Theo Dõi
                  </h3>
                  <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                    Học sinh nộp bài xong sẽ biết ngay điểm trắc nghiệm. Với bài Writing & Speaking, AI chấm nháp và nhận xét chi tiết; thầy cô vào mục <strong>Duyệt Điểm AI</strong> để kiểm tra, sửa điểm nếu cần và gửi phản hồi!
                  </p>
                </div>
                <div className="pt-4 mt-4 border-t border-line">
                  <a
                    href="/guideline/duyet-diem.html"
                    className="text-xs font-bold text-brand-600 hover:text-brand-800 inline-flex items-center gap-1"
                  >
                    <span>Xem chi tiết Duyệt điểm AI</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: CẨM NANG HƯỚNG DẪN CHI TIẾT (LINK TỚI TRANG GUIDELINE HTML) */}
        <section id="cam-nang" className="scroll-mt-16 py-16 md:py-24 bg-surface">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 p-6 sm:p-10 text-white mb-12 shadow-lg">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8 space-y-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5 text-white" />
                    <span>Cẩm nang hướng dẫn sử dụng trực quan (HTML Guideline)</span>
                  </span>
                  <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white leading-tight">
                    Tra Cứu Từng Thao Tác Với Bộ Cẩm Nang 9 Chuyên Đề Có Hình Minh Họa
                  </h2>
                  <p className="text-sm sm:text-base text-brand-100 leading-relaxed">
                    Chúng tôi đã biên soạn sẵn bộ tài liệu hướng dẫn từng bước (kèm hình chụp vị trí từng nút bấm số 1, 2, 3 và giải thích chi tiết). Thầy cô có thể xem trực tiếp trên trình duyệt hoặc bấm nút <strong>In tài liệu</strong> ở mỗi trang.
                  </p>
                  <div className="pt-2">
                    <a
                      href="/guideline/index.html"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-brand-700 hover:bg-brand-50 font-extrabold text-sm sm:text-base shadow-md transition-colors"
                    >
                      <BookOpen className="w-5 h-5 text-brand-600" />
                      <span>Mở Trang Chủ Cẩm Nang Hướng Dẫn (/guideline)</span>
                      <ArrowRight className="w-4 h-4 text-brand-600" />
                    </a>
                  </div>
                </div>
                <div className="lg:col-span-4 flex justify-center">
                  <Image
                    src="/brand/mascot-3d/kito-3d-thac-mac.png"
                    alt="Cẩm nang hướng dẫn giáo viên KitoKit"
                    width={220}
                    height={300}
                    className="kk-float h-48 sm:h-56 w-auto drop-shadow-xl"
                  />
                </div>
              </div>
            </div>

            {/* Grid of 10 Guideline Pages */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {GUIDELINE_MODULES.map((mod) => (
                <a
                  key={mod.href}
                  href={mod.href}
                  className="group rounded-3xl border border-line bg-white hover:border-brand-400 p-6 shadow-2xs hover:shadow-lg transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-extrabold">
                        {mod.num}
                      </span>
                      <Image
                        src={mod.mascot}
                        alt={mod.title}
                        width={48}
                        height={60}
                        className="w-11 h-11 object-contain group-hover:scale-110 transition-transform"
                      />
                    </div>
                    <h3 className="font-display text-lg font-extrabold text-ink group-hover:text-brand-600 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-line-soft flex items-center justify-between text-xs font-bold text-brand-600">
                    <span>Xem hướng dẫn từng bước</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA BANNER */}
        <section className="py-16 bg-cream border-t border-line">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-white border-2 border-brand-200 p-8 sm:p-12 shadow-md text-center space-y-6">
              <div className="flex justify-center">
                <Image
                  src="/brand/mascot-3d/kito-3d-vui-mung.png"
                  alt="Bắt đầu cùng KitoKit"
                  width={120}
                  height={160}
                  className="h-28 w-auto object-contain"
                />
              </div>
              <div className="space-y-2 max-w-2xl mx-auto">
                <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-ink">
                  Sẵn Sàng Trải Nghiệm Trợ Lý Giảng Dạy AI Cùng KitoKit?
                </h2>
                <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                  Tạo tài khoản Giáo viên dùng thử miễn phí chỉ trong 1 phút hoặc liên hệ trực tiếp với đội ngũ hỗ trợ để được tư vấn thiết lập lớp học cho trường và trung tâm của thầy cô.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Link
                  href="/register/teacher"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-accent-400 to-accent-500 hover:from-accent-500 hover:to-accent-600 text-white font-bold text-base shadow-lg shadow-accent-500/25 transition-all"
                >
                  <span>Đăng Ký Giáo Viên Dùng Thử Ngay</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="/guideline/index.html"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 font-bold text-base transition-colors"
                >
                  <BookOpen className="w-5 h-5 text-brand-600" />
                  <span>Xem Cẩm Nang Hướng Dẫn</span>
                </a>
              </div>

              <div className="pt-4 border-t border-line flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-brand-600" />
                  <span>
                    Hotline / Zalo hỗ trợ Giáo viên:{" "}
                    <a href={`tel:${BRAND.company.hotlineRaw}`} className="font-extrabold text-brand-700 hover:underline">
                      {BRAND.company.hotline}
                    </a>
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-brand-600" />
                  <span>
                    Email:{" "}
                    <a href={`mailto:${BRAND.company.email}`} className="font-bold text-brand-700 hover:underline">
                      {BRAND.company.email}
                    </a>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
