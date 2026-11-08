import type { Metadata } from "next";
import LegalLayout from "@/components/legal/LegalLayout";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Chính sách bảo vệ thông tin cá nhân",
  description:
    "Chính sách bảo mật và bảo vệ dữ liệu người dùng của Nền tảng học tập & thi trực tuyến KitoKit theo Nghị định 52/2013/NĐ-CP, Nghị định 85/2021/NĐ-CP và Nghị định 13/2023/NĐ-CP.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout
      title="Chính Sách Bảo Vệ Thông Tin Cá Nhân"
      subtitle="KitoKit cam kết bảo vệ tuyệt đối quyền riêng tư và dữ liệu cá nhân của học sinh, phụ huynh và giáo viên theo các quy định của pháp luật Việt Nam."
      lastUpdated="08/11/2026"
    >
      <div className="prose prose-sm sm:prose max-w-none text-ink space-y-8">
        {/* Intro */}
        <section className="bg-brand-50/50 rounded-2xl p-5 border border-brand-100/70 text-xs sm:text-sm text-ink-muted leading-relaxed">
          <p className="font-semibold text-brand-900 mb-1">
            Căn cứ pháp lý:
          </p>
          <p>
            Chính sách này được xây dựng tuân thủ nghiêm ngặt theo quy định tại <strong>Điều 68 đến Điều 73 Nghị định số 52/2013/NĐ-CP</strong>, 
            <strong> Nghị định số 85/2021/NĐ-CP</strong> của Chính phủ về Thương mại điện tử, 
            <strong> Luật An toàn thông tin mạng số 86/2015/QH13</strong>, 
            và <strong>Nghị định số 13/2023/NĐ-CP</strong> về Bảo vệ dữ liệu cá nhân.
          </p>
        </section>

        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            1. Mục đích thu thập thông tin cá nhân
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Nền tảng KitoKit (thuộc quyền quản lý và vận hành của <strong>{BRAND.company.fullName}</strong>) thu thập thông tin cá nhân của người dùng (bao gồm Học sinh, Phụ huynh và Giáo viên) nhằm các mục đích chính đáng sau:
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1.5">
            <li><strong>Khởi tạo và quản lý tài khoản:</strong> Cung cấp định danh cá nhân để truy cập vào hệ thống lớp học, kho bài giảng và đề thi.</li>
            <li><strong>Cá nhân hóa và đánh giá học tập:</strong> Lưu trữ tiến trình học, lịch sử làm bài thi, phân tích biểu đồ năng lực học sinh và cung cấp nhận xét học tập tự động/AI.</li>
            <li><strong>Hỗ trợ kết nối giữa Nhà trường, Giáo viên và Gia đình:</strong> Cập nhật kết quả bài thi, điểm danh, thông báo tình hình học tập tới phụ huynh.</li>
            <li><strong>Xác thực giao dịch và chăm sóc khách hàng:</strong> Xử lý yêu cầu mua gói học/slot thi, gửi thông báo kỹ thuật, hỗ trợ xử lý sự cố.</li>
            <li><strong>Tuân thủ pháp luật:</strong> Phục vụ công tác thanh tra, kiểm tra hoặc yêu cầu của cơ quan quản lý nhà nước có thẩm quyền.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            2. Phạm vi thu thập thông tin
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Các loại dữ liệu cá nhân được KitoKit thu thập thông qua biểu mẫu đăng ký, quá trình sử dụng hệ thống bao gồm:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-surface border border-line space-y-2">
              <h3 className="font-bold text-ink">Thông tin định danh người dùng:</h3>
              <ul className="list-disc pl-4 text-ink-muted space-y-1">
                <li>Họ và tên học sinh / giáo viên / phụ huynh</li>
                <li>Số điện thoại liên lạc</li>
                <li>Địa chỉ Email</li>
                <li>Trường, lớp học, khối lớp đang theo học</li>
                <li>Ảnh đại diện (nếu người dùng tự nguyện tải lên)</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-line space-y-2">
              <h3 className="font-bold text-ink">Dữ liệu học tập & Kỹ thuật:</h3>
              <ul className="list-disc pl-4 text-ink-muted space-y-1">
                <li>Lịch sử làm bài tập, bài thi trắc nghiệm và tự luận</li>
                <li>Bản ghi âm bài thi Speaking (nếu có thi nói)</li>
                <li>Bản làm bài Writing (bài viết tiếng Anh hoặc môn tự luận)</li>
                <li>Địa chỉ IP, loại trình duyệt, nhật ký truy cập hệ thống</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-ink-subtle italic">
            * KitoKit KHÔNG thu thập và KHÔNG lưu trữ thông tin thẻ ngân hàng hoặc mật khẩu tài khoản thanh toán của người dùng. Mọi giao dịch trực tuyến được thực hiện bảo mật qua cổng thanh toán được Ngân hàng Nhà nước cấp phép.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            3. Thời gian lưu trữ dữ liệu
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Dữ liệu cá nhân của người dùng sẽ được lưu trữ an toàn trên máy chủ của KitoKit cho đến khi có yêu cầu hủy bỏ từ phía người dùng, hoặc khi tài khoản ngừng hoạt động theo quy định. Người dùng có quyền gửi yêu cầu xóa toàn bộ lịch sử và dữ liệu cá nhân bất kỳ lúc nào bằng cách liên hệ với bộ phận hỗ trợ khách hàng của chúng tôi.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            4. Những người hoặc tổ chức có thể được tiếp cận thông tin
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            KitoKit cam kết không bán, chia sẻ hoặc trao đổi thông tin cá nhân của khách hàng cho bên thứ ba vì bất kỳ mục đích thương mại nào. Thông tin chỉ được tiếp cận trong các trường hợp giới hạn sau:
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1.5">
            <li><strong>Giáo viên và Ban quản lý lớp học:</strong> Giáo viên quản lý lớp có quyền xem thông tin học tập, bài thi của học sinh thuộc lớp do mình phụ trách.</li>
            <li><strong>Nhân sự nội bộ phụ trách kỹ thuật & chăm sóc khách hàng:</strong> Được phân quyền truy cập nghiêm ngặt để giải quyết sự cố kỹ thuật hoặc hỗ trợ người dùng.</li>
            <li><strong>Đối tác cung cấp dịch vụ công nghệ:</strong> Các đối tác hạ tầng đám mây (Cloud hosting, Database) tuân thủ tiêu chuẩn an toàn bảo mật ISO/IEC 27001.</li>
            <li><strong>Cơ quan nhà nước có thẩm quyền:</strong> Khi có văn bản yêu cầu chính thức từ cơ quan điều tra, tư pháp hoặc quản lý nhà nước theo luật định.</li>
          </ul>
        </section>

        {/* Section 5 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            5. Địa chỉ của đơn vị thu thập và quản lý thông tin
          </h2>
          <div className="bg-surface rounded-2xl p-5 border border-line text-sm space-y-2">
            <p><strong className="text-ink">Đơn vị chủ quản:</strong> {BRAND.company.fullName}</p>
            <p><strong className="text-ink">Mã số doanh nghiệp:</strong> {BRAND.company.taxCode}</p>
            <p><strong className="text-ink">Địa chỉ trụ sở chính:</strong> {BRAND.company.address}</p>
            <p><strong className="text-ink">Hotline / Zalo:</strong> {BRAND.company.hotline}</p>
            <p><strong className="text-ink">Email chính thức:</strong> {BRAND.company.email}</p>
            <p><strong className="text-ink">Website:</strong> {BRAND.company.website}</p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            6. Phương thức để người dùng tiếp cận và chỉnh sửa dữ liệu cá nhân
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Người dùng có toàn quyền kiểm soát dữ liệu cá nhân của mình thông qua các phương thức sau:
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1.5">
            <li><strong>Tự kiểm tra và chỉnh sửa:</strong> Đăng nhập vào hệ thống và truy cập trang <em>Hồ sơ cá nhân (/profile)</em> để cập nhật họ tên, mật khẩu, số điện thoại, ảnh đại diện.</li>
            <li><strong>Yêu cầu trích xuất hoặc xóa dữ liệu:</strong> Gửi email yêu cầu đến <a href={`mailto:${BRAND.company.email}`} className="text-brand-600 font-bold underline">{BRAND.company.email}</a> hoặc gọi trực tiếp Hotline <span className="font-bold">{BRAND.company.hotline}</span>. Chúng tôi sẽ xử lý và phản hồi bằng văn bản trong vòng tối đa 72 giờ làm việc.</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            7. Cơ chế tiếp nhận và giải quyết khiếu nại của người dùng
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Khi phát hiện thông tin cá nhân của mình bị sử dụng sai mục đích hoặc phạm vi đã thông báo, người dùng có quyền khiếu nại theo quy trình sau:
          </p>
          <ol className="list-decimal pl-5 text-sm text-ink-muted space-y-2">
            <li>
              <strong>Bước 1: Gửi khiếu nại:</strong> Người dùng gửi thông tin khiếu nại qua Email <a href={`mailto:${BRAND.company.email}`} className="text-brand-600 font-bold">{BRAND.company.email}</a> hoặc liên hệ Hotline <span className="font-bold">{BRAND.company.hotline}</span>, nêu rõ nội dung khiếu nại kèm bằng chứng liên quan.
            </li>
            <li>
              <strong>Bước 2: Tiếp nhận và xác minh:</strong> Ban quản trị KitoKit sẽ tiếp nhận, tiến hành kiểm tra nhật ký hệ thống và phản hồi xác nhận tiếp nhận trong vòng 24 giờ.
            </li>
            <li>
              <strong>Bước 3: Xử lý và khắc phục:</strong> Trong thời hạn từ 03 đến 05 ngày làm việc, KitoKit sẽ đưa ra kết luận và phương án khắc phục bảo đảm quyền lợi của người dùng.
            </li>
            <li>
              <strong>Bước 4: Giải quyết theo pháp luật:</strong> Trong trường hợp hai bên không đạt được thỏa thuận, vụ việc sẽ được đưa ra cơ quan có thẩm quyền để giải quyết theo quy định của pháp luật Việt Nam.
            </li>
          </ol>
        </section>

        {/* Section 8 */}
        <section className="space-y-3">
          <h2 className="text-lg sm:text-xl font-bold text-ink border-b border-line pb-2">
            8. An toàn thông tin và Công nghệ bảo mật
          </h2>
          <p className="text-sm text-ink-muted leading-relaxed">
            Hệ thống KitoKit áp dụng các tiêu chuẩn an toàn bảo mật thông tin hàng đầu:
          </p>
          <ul className="list-disc pl-5 text-sm text-ink-muted space-y-1.5">
            <li>Mã hóa toàn bộ lưu lượng truyền tải trên nền tảng giao thức <strong>HTTPS / TLS 1.3</strong> tiêu chuẩn.</li>
            <li>Mật khẩu của người dùng được mã hóa một chiều an toàn (Argon2 / BCrypt), không lưu trữ mật khẩu dạng rõ (plaintext).</li>
            <li>Hệ thống máy chủ cơ sở dữ liệu phân tán có tường lửa đa tầng, chống tấn công DDoS và sao lưu dữ liệu tự động định kỳ.</li>
          </ul>
        </section>
      </div>
    </LegalLayout>
  );
}
