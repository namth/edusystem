// lib/vietqr.ts — Tạo mã VietQR theo chuẩn EMVCo / NAPAS 247 (FEAT-013 §3.2, DEC-032)
// Thuần JavaScript / TypeScript, không gọi mạng bên ngoài.

/**
 * Chuẩn hoá nội dung chuyển khoản:
 * Bỏ dấu tiếng Việt (đ→D), in hoa, chỉ giữ [A-Z0-9 ], gộp khoảng trắng, cắt tối đa maxLength ký tự (mặc định 25).
 * Nếu maxLength <= 0 thì không cắt.
 */
export function sanitizeTransferContent(s: string, maxLength = 25): string {
  if (!s) return "";
  const normalized = s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, (c) => (c === "đ" ? "d" : "D"))
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return maxLength > 0 ? normalized.slice(0, maxLength) : normalized;
}

function tlv(tag: string, value: string): string {
  const len = Buffer.byteLength(value, "utf8");
  return `${tag}${String(len).padStart(2, "0")}${value}`;
}

function crc16CcittFalse(s: string): string {
  let crc = 0xffff;
  for (const b of Buffer.from(s, "utf8")) {
    crc ^= b << 8;
    for (let k = 0; k < 8; k++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface BuildVietQrPayloadOptions {
  bankBin: string;
  accountNo: string;
  amount: number;
  addInfo: string;
}

/**
 * Tạo chuỗi payload VietQR theo chuẩn EMVCo / NAPAS 247.
 */
export function buildVietQrPayload(o: BuildVietQrPayloadOptions): string {
  if (typeof o.bankBin !== "string" || !/^\d{6}$/.test(o.bankBin)) {
    throw new Error("Mã BIN ngân hàng phải gồm đúng 6 chữ số.");
  }
  if (typeof o.accountNo !== "string" || !/^\d{6,19}$/.test(o.accountNo)) {
    throw new Error("Số tài khoản phải gồm từ 6 đến 19 chữ số.");
  }
  if (typeof o.amount !== "number" || !Number.isInteger(o.amount) || o.amount < 0) {
    throw new Error("Số tiền phải là số nguyên ≥ 0.");
  }

  // 00: Payload Format Indicator = "01"
  let payload = tlv("00", "01");

  // 01: Point of Initiation Method = "12" (Dynamic QR)
  payload += tlv("01", "12");

  // 38: Merchant Account Information (NAPAS)
  const beneficiaryOrg = tlv("00", o.bankBin) + tlv("01", o.accountNo);
  const napasService = tlv("00", "A000000727") + tlv("01", beneficiaryOrg) + tlv("02", "QRIBFTTA");
  payload += tlv("38", napasService);

  // 53: Transaction Currency = "704" (VND)
  payload += tlv("53", "704");

  // 54: Transaction Amount (bỏ khi amount = 0)
  if (o.amount > 0) {
    payload += tlv("54", String(o.amount));
  }

  // 58: Country Code = "VN"
  payload += tlv("58", "VN");

  // 62: Additional Data Field (08: Reference Label / Nội dung chuyển khoản)
  const cleanAddInfo = sanitizeTransferContent(o.addInfo, 25);
  payload += tlv("62", tlv("08", cleanAddInfo));

  // 63: CRC16 (poly 0x1021, init 0xFFFF)
  const toChecksum = payload + "6304";
  const checksum = crc16CcittFalse(toChecksum);

  return toChecksum + checksum;
}
