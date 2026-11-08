# TASK-051 — Trang bảng giá công khai /pricing

> Người giao: Claude (Trưởng phòng / Giám đốc sản phẩm) · Người thực hiện: Antigravity

**Độ khó:** LOW
**Nhạy cảm:** không

## 1. Mục tiêu
Giáo viên lạ hiện chỉ biết giá sau khi đăng ký và được xác minh. Thêm trang công khai `/pricing` (SCR-53) giải thích cách tính slot mới (FEAT-015) và đơn giá, kèm máy tính chi phí.

## 2. Tài liệu bắt buộc đọc
- `docs/features/vi-slot-hoc-sinh-thang.md` §1, §4 (SCR-53), BR-W01, BR-W13
- `docs/09-conventions.md`, DEC-035 (quy tắc nút) trong `docs/14-decisions.md`
- Mẫu trang công khai: `app/about/page.tsx`, `components/landing/LandingHeader.tsx`, `components/landing/LandingFooter.tsx`
- `lib/slot-orders.ts` `getSlotPricing()`, `lib/brand.ts`

## 3. Phạm vi file
**Được tạo/sửa:**
- `app/pricing/page.tsx` (mới, Server Component, `export const metadata`, `export const dynamic = "force-dynamic"` để luôn đọc giá mới)
- `components/pricing/PricingCalculator.tsx` (mới, Client Component)
- `components/landing/LandingHeader.tsx`, `components/landing/LandingFooter.tsx` (thêm link "Bảng giá" → `/pricing`)
- `tests/pricing-page.test.ts` (mới, nếu tài khoản kiểm chéo chưa viết)

**Không được sửa:** mọi file trong `tests.lock`; `lib/slot-orders.ts`; `docs/`

## 4. Đặc tả chi tiết
- Trang gọi `getSlotPricing()` phía server, truyền `unit_price_vnd` xuống `PricingCalculator`.
- Nội dung, tiếng Việt có dấu:
  1. Tiêu đề "Bảng giá KitoKit" + một câu: "Trả theo số học sinh và số tháng học thật. 1 slot = 1 học sinh học 1 tháng trong một lớp."
  2. Thẻ đơn giá: "<giá định dạng vi-VN> đ / slot". Nếu `unit_price_vnd <= 0`: "Liên hệ để nhận báo giá", hotline `BRAND.company.hotline` (link `tel:`) và email.
  3. Máy tính: ô "Số học sinh" (1–1000) và "Số tháng" (1–24), số nguyên, mặc định 30 và 3. Hiện "Số slot cần = học sinh × tháng" và "Chi phí ước tính = slot × đơn giá" (định dạng vi-VN + " đ"). Nhập ngoài khoảng hoặc không phải số → hiện lỗi dưới ô, không tính. Giá 0 → ẩn dòng chi phí.
  4. "Cách tính" dạng danh sách: trừ 1 slot khi học sinh vào lớp; mỗi tháng tính từ ngày khai giảng, trừ theo sĩ số ngày đó; thiếu slot thì lớp có 7 ngày ân hạn rồi tạm khoá; xoá học sinh hay kết thúc lớp không hoàn slot; học sinh học 2 lớp tốn 2 slot; giáo viên dùng thử miễn phí trong giới hạn (1 lớp, 3 học sinh).
  5. Nút "Đăng ký giáo viên" → `/register/teacher`, link phụ "Chính sách thanh toán" → `/payment-policy`.
- Dùng màu/thành phần theo token hiện có (`brand-*`, `ink`, `line`, `surface`). Không thêm thư viện.

## 5. Tiêu chí nghiệm thu
- [ ] `verify.sh` exit 0; `tests/docs-sync.test.ts` xanh (SCR-53 `/pricing` đã có trong docs/03)
- [ ] Render `app/pricing/page.tsx` khi `slot_pricing.unit_price_vnd = 25000` → HTML chứa "25.000" và "1 slot = 1 học sinh"
- [ ] Giá 0 → chứa "Liên hệ để nhận báo giá" và hotline, không chứa "0 đ / slot"
- [ ] `PricingCalculator` với 30 học sinh × 3 tháng, giá 25000 → hiện 90 slot và "2.250.000"
- [ ] Nhập 0 hoặc 1001 học sinh, hoặc "abc" → hiện lỗi, không hiện chi phí
- [ ] Header và footer landing có link tới `/pricing`
- [ ] Trang có `metadata.title` và nút tới `/register/teacher`

## 6. Ràng buộc & bẫy cần tránh
- Không gọi API từ client để lấy giá; không hard-code giá.
- Nhãn nút không có dấu `+` (DEC-035).
- Kiểm tra bằng `python3 scripts/handoff.py verify TASK-051`; chỉ chạy lệnh `python3`.
