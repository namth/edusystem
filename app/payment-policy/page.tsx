import type { Metadata } from "next";
import LegalLayout from "@/components/legal/LegalLayout";
import { BRAND } from "@/lib/brand";
import { CreditCard, CheckCircle2, RotateCcw, HelpCircle, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Chính sách thanh toán, hoàn tiền & hỗ trợ khách hàng",
  description:
    "Quy định về phương thức thanh toán, giao nhận kích hoạt dịch vụ kỹ thuật số, chính sách hoàn tiền và quy trình hỗ trợ khách hàng của KitoKit.",
};

export default function PaymentPolicyPage() {
  return (
    <LegalLayout
      title="Chính Sách Thanh Toán & Hoàn Tiền"
      subtitle="Minh bạch phương thức thanh toán, thời gian kích hoạt dịch vụ số và chính sách bảo vệ quyền lợi người tiêu dùng trên hệ thống KitoKit."
      lastUpdated="08/11/2026"
    >
      <div className="prose prose-sm sm:prose max-w-none text-ink space-y-8">
        {/* Intro */}
        <section className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100/70 text-xs sm:text-sm text-ink-muted leading-relaxed">
          <p>
            Nhằm đảm bảo sự minh bạch, an toàn và quyền lợi cao nhất cho khách hàng khi giao dịch trên KitoKit, <strong>{BRAND.company.fullName}</strong> ban hành chính sách thanh toán, kích hoạt dịch vụ và hoàn tiền chi tiết dưới đây.
          </p>
        </section>

        {/* Section 1: Payment Methods */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <CreditCard className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg sm:text-xl font-bold text-ink m-0">
              1. Phương thức thanh toán được chấp nhận
            </h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            Hiện KitoKit nhận thanh toán bằng chuyển khoản ngân hàng qua mã VietQR:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <h3 className="font-bold text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Chuyển khoản Ngân hàng (VietQR 24/7)</span>
              </h3>
              <p className="text-ink-muted leading-relaxed">
                Người dùng quét mã QR chuẩn Napas247 hiển thị trên trang đơn hàng bằng ứng dụng ngân hàng bất kỳ. Mã QR đã điền sẵn số tiền và mã đơn hàng. Sau khi chuyển khoản, bấm “Tôi đã chuyển khoản” để KitoKit đối soát.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <h3 className="font-bold text-ink flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Cổng thanh toán & Thẻ ngân hàng (sắp có)</span>
              </h3>
              <p className="text-ink-muted leading-relaxed">
                Thanh toán bằng thẻ ATM nội địa, thẻ quốc tế và ví điện tử qua cổng trung gian được cấp phép đang được triển khai. Khi có, KitoKit sẽ cập nhật chính sách này.
              </p>
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/70 text-xs text-amber-900 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Lưu ý quan trọng:</strong> Quý khách vui lòng điền chính xác <strong>Mã đơn hàng (Order Code)</strong> trong nội dung chuyển khoản để nhân viên KitoKit đối soát nhanh và chính xác. Nếu ghi sai mã, quý khách vui lòng liên hệ Hotline kèm ảnh chụp giao dịch.
            </div>
          </div>
        </section>

        {/* Section 2: Digital Delivery */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg sm:text-xl font-bold text-ink m-0">
              2. Quy trình bàn giao và kích hoạt dịch vụ kỹ thuật số
            </h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            Do sản phẩm của KitoKit là <strong>Dịch vụ phần mềm giáo dục trực tuyến (Digital Goods/SaaS)</strong>, sản phẩm được bàn giao trực tuyến trên tài khoản của quý khách:
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-2">
            <li><strong>Thời gian kích hoạt:</strong> Sau khi KitoKit đối soát được giao dịch, trong giờ làm việc ({BRAND.company.workingHours}), thường trong vòng <strong>04 giờ làm việc</strong>. Giao dịch ngoài giờ được xử lý vào đầu ngày làm việc kế tiếp.</li>
            <li><strong>Hình thức bàn giao:</strong> Số lượng slot học sinh, quyền truy cập kho đề thi hoặc gói học sẽ được cộng trực tiếp vào tài khoản của Giáo viên/Học sinh trên hệ thống.</li>
            <li><strong>Xác nhận hoàn thành:</strong> Đơn hàng chuyển sang trạng thái <em>“Đã duyệt”</em> tại trang đơn hàng, kèm thông báo trong ứng dụng và email xác nhận gửi tới địa chỉ email đã đăng ký. Hoá đơn điện tử được xuất theo yêu cầu, quý khách gửi thông tin xuất hoá đơn qua email {BRAND.company.email}.</li>
          </ul>
        </section>

        {/* Section 3: Refund Policy */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <RotateCcw className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg sm:text-xl font-bold text-ink m-0">
              3. Chính sách đổi trả & Hoàn tiền (Refund Policy)
            </h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            KitoKit cam kết chính sách hoàn tiền công bằng, rõ ràng nhằm đảm bảo quyền lợi chính đáng của khách hàng:
          </p>

          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs sm:text-sm">
              <h3 className="font-bold text-emerald-950 mb-1">
                A. Các trường hợp được hoàn tiền 100%:
              </h3>
              <ul className="list-disc pl-4 text-emerald-900 space-y-1">
                <li>Giao dịch bị trừ tiền nhiều lần do lỗi hệ thống cổng thanh toán hoặc lỗi mạng ngân hàng.</li>
                <li>Lỗi kỹ thuật nghiêm trọng từ phía máy chủ KitoKit khiến người dùng không thể truy cập dịch vụ liên tục quá <strong>48 giờ</strong> mà đội ngũ kỹ thuật không thể khắc phục.</li>
                <li>Khách hàng đã thanh toán nhưng chưa kích hoạt sử dụng bất kỳ slot/bài học nào và gửi yêu cầu hủy dịch vụ trong vòng <strong>03 ngày</strong> kể từ thời điểm thanh toán.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 text-xs sm:text-sm">
              <h3 className="font-bold text-rose-950 mb-1">
                B. Các trường hợp không áp dụng hoàn tiền:
              </h3>
              <ul className="list-disc pl-4 text-rose-900 space-y-1">
                <li>Khách hàng đã kích hoạt sử dụng slot học sinh hoặc đã làm bài thi trên 30% thời lượng của gói học.</li>
                <li>Tài khoản bị tạm ngưng hoặc khóa vĩnh viễn do vi phạm Điều khoản dịch vụ (gian lận thi cử, phát tán mã độc).</li>
                <li>Lỗi xuất phát từ phía thiết bị cá nhân của người dùng (hỏng micro, đứt cáp internet tại nhà, cấu hình trình duyệt không tương thích).</li>
              </ul>
            </div>
          </div>

          <div className="pt-2 text-sm text-ink-muted space-y-2">
            <h3 className="font-bold text-ink">Thời gian và phương thức xử lý hoàn tiền:</h3>
            <p>
              Khi yêu cầu hoàn tiền được xét duyệt hợp lệ, KitoKit sẽ hoàn tiền trực tiếp về tài khoản ngân hàng của quý khách trong thời hạn từ <strong>03 đến 07 ngày làm việc</strong> (không tính Thứ Bảy, Chủ Nhật và ngày Lễ Tết).
            </p>
          </div>
        </section>

        {/* Section 4: Support Process */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line pb-2">
            <HelpCircle className="w-5 h-5 text-brand-600" />
            <h2 className="text-lg sm:text-xl font-bold text-ink m-0">
              4. Quy trình tiếp nhận yêu cầu hỗ trợ & Khiếu nại
            </h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">
            Khi cần hỗ trợ thanh toán, tra soát đơn hàng hoặc khiếu nại chất lượng dịch vụ, quý khách vui lòng thực hiện theo quy trình sau:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <span className="inline-block w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-center leading-6">1</span>
              <h4 className="font-bold text-ink text-sm">Gửi thông tin</h4>
              <p className="text-ink-muted">
                Liên hệ Hotline <strong>{BRAND.company.hotline}</strong> hoặc gửi email tới <strong>{BRAND.company.email}</strong> kèm mã đơn hàng và số điện thoại.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <span className="inline-block w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-center leading-6">2</span>
              <h4 className="font-bold text-ink text-sm">Xác minh đơn</h4>
              <p className="text-ink-muted">
                Bộ phận CSKH kiểm tra đối soát nhật ký giao dịch ngân hàng và phản hồi giải pháp trong vòng <strong>24 giờ làm việc</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-line space-y-2">
              <span className="inline-block w-6 h-6 rounded-full bg-brand-600 text-white font-bold text-center leading-6">3</span>
              <h4 className="font-bold text-ink text-sm">Kích hoạt / Hoàn tiền</h4>
              <p className="text-ink-muted">
                Tiến hành kích hoạt bù slot kèm quà tặng trải nghiệm hoặc chuyển khoản hoàn tiền theo thỏa thuận của hai bên.
              </p>
            </div>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
}
