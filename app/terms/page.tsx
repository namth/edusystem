import type { Metadata } from "next";
import LegalLayout from "@/components/legal/LegalLayout";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Điều khoản dịch vụ",
  description:
    "Điều khoản dịch vụ và quy chế hoạt động của Nền tảng học tập & khảo thí trực tuyến KitoKit thuộc CÔNG TY TNHH CÔNG NGHỆ INOVA.",
};

export default function TermsOfServicePage() {
  return (
    <LegalLayout
      title="Điều Khoản Dịch Vụ & Quy Chế Hoạt Động"
      subtitle="Bản thỏa thuận quy định quyền, trách nhiệm và nghĩa vụ của người dùng khi truy cập và sử dụng dịch vụ trên hệ thống KitoKit."
      lastUpdated="08/11/2026"
    >
      <div className="prose prose-sm sm:prose max-w-none text-ink space-y-8">
        {/* Intro */}
        <section className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100/70 text-xs sm:text-sm text-ink-muted leading-relaxed">
          <p>
            Chào mừng bạn đến với <strong>KitoKit</strong> (sau đây gọi tắt là <em>“Hệ thống”</em> hoặc <em>“Nền tảng”</em>), dịch vụ công nghệ giáo dục trực tuyến được sở hữu và phát triển bởi <strong>{BRAND.company.fullName}</strong>.
          </p>
          <p className="mt-2">
            Bằng việc đăng ký tài khoản hoặc sử dụng bất kỳ dịch vụ nào trên KitoKit, bạn xác nhận đã đọc, hiểu rõ và đồng ý bị ràng buộc vô điều kiện bởi các điều khoản dưới đây.
          </p>
        </section>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            1. Giải thích từ ngữ
          </h2>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-2">
            <li><strong>“KitoKit”:</strong> Là nền tảng phần mềm giáo dục, quản lý bài học, giao đề và tổ chức thi trực tuyến thông minh có ứng dụng trí tuệ nhân tạo (AI).</li>
            <li><strong>“Đơn vị vận hành”:</strong> Là {BRAND.company.fullName}, chịu trách nhiệm pháp lý và kỹ thuật cho nền tảng.</li>
            <li><strong>“Học sinh (Student)”:</strong> Là người dùng đăng ký tài khoản để học bài, làm bài tập, luyện thi và theo dõi tiến độ học tập cá nhân.</li>
            <li><strong>“Giáo viên / Trung tâm (Teacher)”:</strong> Là cá nhân, thầy cô giáo hoặc tổ chức giáo dục tạo lớp học, giao đề thi, quản lý học viên và mua slot cấp quyền cho học sinh.</li>
            <li><strong>“Phụ huynh (Parent)”:</strong> Là người giám hộ hợp pháp của học sinh, liên kết tài khoản để theo dõi kết quả và đánh giá học tập.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            2. Đăng ký và Bảo mật tài khoản
          </h2>
          <div className="text-sm text-ink-muted leading-relaxed space-y-2">
            <p>
              Người dùng cần cung cấp thông tin chính xác, đầy đủ và cập nhật khi đăng ký tài khoản trên KitoKit. Người dùng có trách nhiệm tự bảo mật mật khẩu và các thông tin định danh của mình.
            </p>
            <p>
              Mỗi tài khoản được cấp quyền cho một cá nhân duy nhất sử dụng. Nghiêm cấm hành vi chia sẻ, cho mượn, chuyển nhượng hoặc bán lại tài khoản cho người khác khi chưa có sự đồng ý bằng văn bản của KitoKit.
            </p>
            <p>
              Nếu phát hiện bất kỳ dấu hiệu truy cập trái phép hoặc rò rỉ thông tin đăng nhập, người dùng phải thông báo ngay lập tức cho KitoKit để có biện pháp xử lý kịp thời.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            3. Quyền sở hữu trí tuệ
          </h2>
          <div className="text-sm text-ink-muted leading-relaxed space-y-2">
            <p>
              Toàn bộ giao diện, thiết kế đồ họa, biểu tượng, logo thương hiệu KitoKit, mã nguồn phần mềm, cơ sở dữ liệu câu hỏi hệ thống, tài liệu hướng dẫn và thuật toán chấm điểm AI đều thuộc quyền sở hữu trí tuệ duy nhất của <strong>{BRAND.company.fullName}</strong> và được bảo hộ theo Luật Sở hữu trí tuệ Việt Nam.
            </p>
            <p>
              Đối với các bài giảng, đề thi do Giáo viên tự tải lên hệ thống: Giáo viên chịu trách nhiệm hoàn toàn về bản quyền và tính hợp pháp của học liệu do mình cung cấp.
            </p>
            <p>
              Nghiêm cấm sao chép, đảo ngược kỹ thuật (reverse engineering), trích xuất dữ liệu tự động (scraping) hoặc sử dụng nội dung của KitoKit vì mục đích thương mại ngoài phạm vi thỏa thuận.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            4. Các hành vi bị nghiêm cấm
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Người dùng cam kết KHÔNG thực hiện các hành vi sau:
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1.5">
            <li>Sử dụng các công cụ can thiệp, gian lận kết quả bài thi hoặc làm sai lệch kết quả đánh giá năng lực.</li>
            <li>Phát tán virus, phần mềm độc hại, mã độc hoặc thực hiện các hành vi tấn công từ chối dịch vụ (DDoS) vào hạ tầng KitoKit.</li>
            <li>Đăng tải, truyền bá các nội dung vi phạm pháp luật, thuần phong mỹ tục, đồi trụy hoặc xuyên tạc, thù địch.</li>
            <li>Giả mạo danh tính cá nhân hoặc đại diện của KitoKit để lừa đảo chiếm đoạt tài sản.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            5. Quyền và Nghĩa vụ của KitoKit
          </h2>
          <div className="text-sm text-ink-muted leading-relaxed space-y-2">
            <p><strong>Quyền của KitoKit:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Tạm khóa hoặc khóa vĩnh viễn tài khoản có dấu hiệu vi phạm điều khoản dịch vụ mà không cần báo trước.</li>
              <li>Nâng cấp, bảo trì, cải tiến tính năng hoặc thay đổi giao diện để tối ưu hóa trải nghiệm người dùng.</li>
              <li>Điều chỉnh biểu phí gói cước/slot thi và thông báo công khai trên website trước ngày áp dụng.</li>
            </ul>

            <p className="pt-2"><strong>Nghĩa vụ của KitoKit:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Duy trì hệ thống hoạt động ổn định, bảo mật và liên tục (hướng tới chỉ số sẵn sàng 99.5%).</li>
              <li>Bảo mật thông tin người dùng theo đúng Chính sách bảo vệ dữ liệu cá nhân đã cam kết.</li>
              <li>Hỗ trợ kỹ thuật và giải quyết thắc mắc, khiếu nại của người dùng kịp thời theo quy chuẩn dịch vụ.</li>
            </ul>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            6. Giới hạn trách nhiệm pháp lý
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            KitoKit nỗ lực tối đa để cung cấp dịch vụ tốt nhất. Tuy nhiên, chúng tôi không chịu trách nhiệm đối với các sự cố bất khả kháng như: thiên tai, gián đoạn đường truyền viễn thông diện rộng của các nhà mạng, sự cố mất điện lưới hoặc lỗi phần cứng từ thiết bị cá nhân của người dùng.
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            7. Luật áp dụng và Giải quyết tranh chấp
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Điều khoản này được điều chỉnh và giải thích theo các quy định của <strong>Pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam</strong>.
          </p>
          <p className="text-sm text-ink-muted leading-relaxed">
            Mọi tranh chấp phát sinh từ hoặc liên quan đến việc sử dụng dịch vụ trước hết sẽ được giải quyết thông qua thương lượng hòa giải thiện chí giữa các bên. Trong trường hợp thương lượng không thành công, tranh chấp sẽ được đưa ra giải quyết tại Tòa án nhân dân có thẩm quyền tại Thành phố Hà Nội.
          </p>
        </section>
      </div>
    </LegalLayout>
  );
}
