"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertCircle, Loader2, Mail, Phone, User, MessageSquare } from "lucide-react";

export default function LandingContact() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    role: "PARENT",
    message: "",
    website: "", // Honeypot field
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.status === 429) {
        setErrorMsg("Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 1 giờ.");
      } else if (res.ok && data.success) {
        setSuccess(true);
        setFormData({
          name: "",
          phone: "",
          email: "",
          role: "PARENT",
          message: "",
          website: "",
        });
      } else {
        setErrorMsg(data.error || "Gửi thông tin không thành công. Vui lòng kiểm tra lại.");
      }
    } catch {
      setErrorMsg("Đã xảy ra lỗi kết nối. Vui lòng kiểm tra lại kết nối mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="lien-he" className="py-16 md:py-24 bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-100 text-accent-600 text-xs font-bold mb-3">
            <span>Kết nối cùng KitoKit</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Liên Hệ Tư Vấn & Dùng Thử
          </h2>
          <p className="mt-3 text-sm sm:text-base text-ink-muted">
            Để lại thông tin, đội ngũ KitoKit sẽ liên hệ hỗ trợ và tư vấn giải pháp học tập phù hợp nhất.
          </p>
        </div>

        <div className="bg-surface rounded-3xl p-6 sm:p-10 border border-line shadow-sm">
          {success ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-ink">Gửi thông tin thành công!</h3>
              <p className="text-sm text-ink-muted max-w-md mx-auto">
                Cảm ơn bạn đã quan tâm đến KitoKit. Đội ngũ tư vấn sẽ liên hệ với bạn trong thời gian sớm nhất.
              </p>
              <button
                type="button"
                onClick={() => setSuccess(false)}
                className="mt-4 px-6 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors cursor-pointer"
              >
                Gửi phản hồi khác
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Honeypot field (hidden from real users) */}
              <div style={{ display: "none" }} aria-hidden="true">
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              {errorMsg && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full name */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Họ và tên <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 text-xs bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600 text-ink"
                    />
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Bạn là <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600 text-ink cursor-pointer"
                  >
                    <option value="PARENT">Phụ huynh</option>
                    <option value="STUDENT">Học sinh</option>
                    <option value="TEACHER">Giáo viên</option>
                    <option value="CENTER">Trung tâm giáo dục</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Số điện thoại
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      placeholder="0912 345 678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 text-xs bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600 text-ink"
                    />
                  </div>
                  <span className="text-[10px] text-ink-subtle mt-1 block">
                    Cần ít nhất SĐT hoặc Email
                  </span>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-ink mb-1.5">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      placeholder="email@vidu.vn"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-3 py-2.5 text-xs bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600 text-ink"
                    />
                  </div>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-ink mb-1.5">
                  Lời nhắn hoặc nhu cầu tư vấn
                </label>
                <div className="relative">
                  <textarea
                    rows={4}
                    maxLength={1000}
                    placeholder="Môn học quan tâm, số lượng học sinh, mục tiêu đạt được..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full p-3 text-xs bg-surface-alt border border-line rounded-xl focus:outline-none focus:border-brand-600 text-ink resize-none"
                  />
                </div>
                <div className="text-right text-[10px] text-ink-subtle mt-0.5">
                  {formData.message.length}/1000
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang gửi thông tin...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Gửi yêu cầu tư vấn</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
