import type { Metadata } from "next";
import LegalLayout from "@/components/legal/LegalLayout";
import { BRAND } from "@/lib/brand";
import { Building2, MapPin, Phone, Mail, Award, CheckCircle2, ShieldCheck, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: "Thông tin đơn vị vận hành",
  description:
    "Thông tin pháp nhân, giấy phép kinh doanh, mã số thuế và thông tin liên hệ của CÔNG TY TNHH CÔNG NGHỆ INOVA - Đơn vị chủ quản nền tảng KitoKit.",
};

export default function AboutCompanyPage() {
  return (
    <LegalLayout
      title="Thông Tin Đơn Vị Sở Hữu & Vận Hành"
      subtitle="Minh bạch thông tin pháp nhân, giấy phép hoạt động kinh doanh và đầu mối liên hệ chính thức của nền tảng KitoKit."
      lastUpdated="08/11/2026"
    >
      <div className="prose prose-sm sm:prose max-w-none text-ink space-y-8">
        {/* Company Card High-level */}
        <section className="bg-gradient-to-br from-brand-900 to-brand-800 text-white rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-brand-200 text-xs font-bold uppercase tracking-wider">
            <Building2 className="w-4 h-4 text-white" />
            <span>Đơn vị sở hữu website</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white m-0 tracking-tight">
            {BRAND.company.fullName}
          </h2>
          <p className="text-sm text-brand-100 leading-relaxed max-w-2xl">
            Doanh nghiệp tiên phong trong lĩnh vực ứng dụng Trí tuệ nhân tạo (AI) và Khoa học dữ liệu vào giải pháp khảo thí, quản lý bài giảng và cá nhân hóa lộ trình học tập tại Việt Nam.
          </p>
        </section>

        {/* Legal Registry Info Table */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2 flex items-center gap-2">
            <Award className="w-5 h-5 text-brand-600" />
            <span>1. Hồ sơ đăng ký kinh doanh & Pháp nhân</span>
          </h2>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface text-xs sm:text-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 p-4 border-b border-line/60 gap-1 bg-white">
              <span className="font-semibold text-ink-muted">Tên tiếng Việt đầy đủ:</span>
              <span className="md:col-span-2 font-bold text-ink">{BRAND.company.fullName}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 border-b border-line/60 gap-1">
              <span className="font-semibold text-ink-muted">Tên giao dịch quốc tế:</span>
              <span className="md:col-span-2 text-ink font-medium">{BRAND.company.englishName}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 border-b border-line/60 gap-1 bg-white">
              <span className="font-semibold text-ink-muted">Tên thương hiệu & Website:</span>
              <span className="md:col-span-2 text-brand-700 font-bold">KitoKit — {BRAND.company.website}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 border-b border-line/60 gap-1">
              <span className="font-semibold text-ink-muted">Mã số doanh nghiệp / MST:</span>
              <span className="md:col-span-2 font-mono font-bold text-ink">{BRAND.company.taxCode}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 border-b border-line/60 gap-1 bg-white">
              <span className="font-semibold text-ink-muted">Ngày cấp:</span>
              <span className="md:col-span-2 text-ink">{BRAND.company.licenseDate}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 border-b border-line/60 gap-1">
              <span className="font-semibold text-ink-muted">Cơ quan cấp phép:</span>
              <span className="md:col-span-2 text-ink">Phòng Đăng ký kinh doanh – {BRAND.company.licensePlace}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 p-4 gap-1 bg-white">
              <span className="font-semibold text-ink-muted">Địa chỉ trụ sở chính:</span>
              <span className="md:col-span-2 text-ink leading-relaxed">{BRAND.company.address}</span>
            </div>
          </div>
        </section>

        {/* Contact Points */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2 flex items-center gap-2">
            <Phone className="w-5 h-5 text-brand-600" />
            <span>2. Thông tin liên hệ & Tiếp nhận khiếu nại</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-5 rounded-2xl bg-surface border border-line space-y-3">
              <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <Phone className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-ink text-base m-0">Đường dây nóng (Hotline)</h3>
              <p className="text-ink-muted text-xs leading-relaxed">
                Hỗ trợ giải đáp nghiệp vụ thi cử, xử lý lỗi kỹ thuật và xác nhận đơn hàng 24/7:
              </p>
              <div className="pt-1">
                <a href={`tel:${BRAND.company.hotline.replace(/\s+/g, "")}`} className="text-lg font-extrabold text-brand-600 hover:text-brand-700">
                  {BRAND.company.hotline}
                </a>
                <span className="block text-ink-subtle text-[11px] mt-0.5">Tiếp nhận cuộc gọi và Zalo hỗ trợ kỹ thuật</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-surface border border-line space-y-3">
              <div className="w-8 h-8 rounded-lg bg-accent-100 text-accent-700 flex items-center justify-center font-bold">
                <Mail className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-ink text-base m-0">Hòm thư điện tử (Email)</h3>
              <p className="text-ink-muted text-xs leading-relaxed">
                Tiếp nhận góp ý, khiếu nại bản quyền, đề xuất hợp tác giáo dục và đối soát thanh toán:
              </p>
              <div className="pt-1">
                <a href={`mailto:${BRAND.company.email}`} className="text-sm font-bold text-brand-600 underline hover:text-brand-700">
                  {BRAND.company.email}
                </a>
                <span className="block text-ink-subtle text-[11px] mt-0.5">Email doanh nghiệp: {BRAND.company.contactEmail}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Commitment & Regulations */}
        <section className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>3. Cam kết chất lượng dịch vụ & Tuân thủ pháp luật</span>
          </h2>

          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80 text-xs sm:text-sm text-emerald-950 space-y-3">
            <p className="leading-relaxed">
              Nền tảng <strong>KitoKit ({BRAND.company.website})</strong> là dịch vụ phần mềm giáo dục trực tuyến thuộc quyền sở hữu hợp pháp của <strong>{BRAND.company.fullName}</strong>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Tuân thủ các quy định về cung cấp dịch vụ trực tuyến trên môi trường mạng theo Nghị định số 52/2013/NĐ-CP và Nghị định 85/2021/NĐ-CP.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Cam kết công khai đầy đủ thông tin về giá cả, điều khoản giao dịch, chính sách bảo mật và chính sách hoàn tiền cho người tiêu dùng.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Tuân thủ Luật An toàn thông tin mạng và quy định về bảo vệ dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Đảm bảo nghĩa vụ kê khai thuế và xuất hóa đơn điện tử đầy đủ theo quy định của Tổng cục Thuế.</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
