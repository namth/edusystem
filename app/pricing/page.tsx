import type { Metadata } from "next";
import Link from "next/link";
import { getSlotPricing } from "@/lib/slot-orders";
import { BRAND } from "@/lib/brand";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";
import PricingCalculator from "@/components/pricing/PricingCalculator";
import {
  CheckCircle2,
  Phone,
  Mail,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Info,
  HelpCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng giá KitoKit — Đơn giản, minh bạch theo sĩ số & thời gian",
  description:
    "Bảng giá ví slot KitoKit: 1 slot = 1 học sinh học 1 tháng trong một lớp. Trả theo số học sinh và số tháng học thật. Đăng ký giáo viên dùng thử miễn phí.",
};

export default async function PricingPage() {
  const { unit_price_vnd } = await getSlotPricing();
  const hasPrice = typeof unit_price_vnd === "number" && unit_price_vnd > 0;

  return (
    <div className="min-h-screen flex flex-col bg-surface font-sans text-ink selection:bg-brand-600 selection:text-white">
      <LandingHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-white border-b border-line py-16 sm:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mô hình ví slot linh hoạt</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-ink tracking-tight font-display">
              Bảng giá KitoKit
            </h1>
            <p className="max-w-2xl mx-auto text-base sm:text-lg text-ink-muted leading-relaxed">
              Trả theo số học sinh và số tháng học thật. 1 slot = 1 học sinh học 1 tháng trong một lớp.
            </p>
          </div>
        </section>

        {/* Pricing Card & Calculator */}
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            {/* Unit Price Card */}
            <div className="rounded-3xl border border-line bg-white p-6 sm:p-10 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-600">
                    <Info className="w-4 h-4" />
                    <span>Đơn giá tiêu chuẩn</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-ink">
                    Ví slot cho Giáo viên & Trung tâm
                  </h2>
                  <p className="text-sm text-ink-muted max-w-xl">
                    Chỉ trừ slot khi học sinh tham gia học tập thực tế. Mua slot nạp vào ví và hệ thống tự động trừ theo từng chu kỳ hàng tháng.
                  </p>
                </div>

                <div className="rounded-2xl bg-surface border border-line p-6 text-center md:text-right shrink-0">
                  {hasPrice ? (
                    <div>
                      <div className="text-3xl sm:text-4xl font-black text-brand-600 tracking-tight">
                        {unit_price_vnd.toLocaleString("vi-VN")} đ / slot
                      </div>
                      <div className="text-xs text-ink-muted mt-1.5">
                        Áp dụng cho mọi môn học và phân hệ
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 text-left md:text-right">
                      <div className="text-xl sm:text-2xl font-black text-ink">
                        Liên hệ để nhận báo giá
                      </div>
                      <p className="text-xs text-ink-muted max-w-xs">
                        Đang cập nhật đơn giá chính thức hoặc chính sách riêng cho trung tâm.
                      </p>
                      <div className="pt-2 flex flex-col gap-2 text-xs font-semibold text-brand-600">
                        <a
                          href={`tel:${BRAND.company.hotlineRaw}`}
                          className="flex items-center gap-2 hover:text-brand-700 md:justify-end"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Hotline: {BRAND.company.hotline}</span>
                        </a>
                        <a
                          href={`mailto:${BRAND.company.email}`}
                          className="flex items-center gap-2 hover:text-brand-700 md:justify-end"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{BRAND.company.email}</span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Interactive Calculator */}
            <PricingCalculator
              unitPriceVnd={unit_price_vnd}
              unit_price_vnd={unit_price_vnd}
            />

            {/* Calculation Rules & FAQ */}
            <div className="rounded-3xl border border-line bg-white p-6 sm:p-10 shadow-xs space-y-6">
              <div className="flex items-center gap-3 border-b border-line pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-ink">
                    Cách tính ví slot
                  </h2>
                  <p className="text-xs text-ink-muted">
                    Nguyên tắc trừ slot minh bạch và quyền lợi của thầy cô
                  </p>
                </div>
              </div>

              <ul className="space-y-4 text-sm text-ink leading-relaxed">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Trừ slot khi ghi danh:</strong> Trừ 1 slot khi học sinh vào lớp cho kỳ hiện tại của lớp.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Chu kỳ hàng tháng:</strong> Mỗi tháng tính từ ngày khai giảng, hệ thống sẽ tự động trừ theo sĩ số ngày đó.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Chính sách ân hạn:</strong> Nếu số dư ví không đủ, lớp sẽ có <strong>7 ngày ân hạn</strong> để nạp thêm slot trước khi bị <strong>tạm khoá</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Không hoàn lại:</strong> Thao tác xoá học sinh hay kết thúc lớp đều <strong>không hoàn</strong> slot đã trừ cho kỳ đó.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Nhiều lớp học:</strong> Nếu một học sinh học ở <strong>2 lớp</strong> khác nhau của cùng thầy cô thì sẽ tính tốn <strong>2 slot</strong> riêng biệt.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Dùng thử miễn phí:</strong> Thầy cô đăng ký mới được quyền <strong>dùng thử</strong> miễn phí trong giới hạn (tối đa <strong>1 lớp</strong> và <strong>3 học sinh</strong>) mà không cần mua slot.
                  </span>
                </li>
              </ul>
            </div>

            {/* Call to action & Policy links */}
            <div className="rounded-3xl bg-gradient-to-br from-brand-900 to-brand-800 text-white p-8 sm:p-12 text-center space-y-6">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Bắt đầu giảng dạy thông minh cùng KitoKit
              </h2>
              <p className="max-w-xl mx-auto text-sm sm:text-base text-brand-100">
                Tạo lớp học, tải lên tài liệu và trải nghiệm trợ lý AI chấm điểm bài tập tự động ngay hôm nay mà không mất phí khởi tạo.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                <Link
                  href="/register/teacher"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold bg-white text-brand-900 hover:bg-brand-50 shadow-xs transition-colors"
                >
                  <span>Đăng ký giáo viên</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/payment-policy"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-sm font-bold border border-white/20 text-white hover:bg-white/10 transition-colors"
                >
                  <span>Chính sách thanh toán</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
