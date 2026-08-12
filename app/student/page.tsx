"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { INITIAL_COURSES, INITIAL_CLASSES, Course } from "@/lib/mock-data";
import { GraduationCap, BookOpen, QrCode, CheckCircle2, Sparkles, ArrowRight, Loader2 } from "lucide-react";

export default function StudentDashboardPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>(INITIAL_COURSES);
  const [myClasses, setMyClasses] = useState<any[]>(INITIAL_CLASSES);
  const [loading, setLoading] = useState(true);
  const [selectedCourseForQR, setSelectedCourseForQR] = useState<Course | null>(null);
  const [qrRequested, setQrRequested] = useState(false);
  const [transferCode, setTransferCode] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      // 1. Fetch Classes from Supabase
      const { data: classRows } = await supabase.from("classes").select("*");
      if (classRows && classRows.length > 0) {
        const formattedClasses = classRows.map((c: any) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          teacherName: "Thầy Nguyễn Văn Đức",
          schedule: c.schedule || "Lịch học linh hoạt",
          status: c.status || "ACTIVE",
        }));
        setMyClasses(formattedClasses);
      }

      // 2. Fetch Courses from Supabase
      const { data: courseRows } = await supabase.from("courses").select("*");
      if (courseRows && courseRows.length > 0) {
        const formattedCourses: Course[] = courseRows.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description || "Khóa học tiếng Anh 4 kỹ năng chất lượng cao.",
          price: 2490000,
          level: c.level || "Intermediate",
          thumbnail: c.thumbnail || "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=60",
          skillsCovered: c.skills_covered || ["Reading", "Writing", "Speaking", "Listening"],
        }));
        setCourses(formattedCourses);
      }
    } catch (e) {
      console.error("Data load error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOrder = (course: Course) => {
    const code = `EDTECH${Math.floor(10000 + Math.random() * 90000)}`;
    setTransferCode(code);
    setSelectedCourseForQR(course);
    setQrRequested(false);
  };

  const handleConfirmTransfer = async () => {
    if (!selectedCourseForQR) return;
    try {
      // Record order in Supabase PostgreSQL
      await supabase.from("orders").insert([
        {
          id: `ORD-${Date.now().toString().slice(-6)}`,
          student_id: user?.id || "student_01",
          student_name: user?.name || "Trần Hoàng Nam",
          student_email: user?.email || "student@gmail.com",
          course_title: selectedCourseForQR.title,
          amount: selectedCourseForQR.price,
          transfer_code: transferCode,
          status: "PENDING",
        },
      ]);
    } catch (e) {
      console.warn("Order insert notice:", e);
    }
    setQrRequested(true);
  };

  // Dynamic VietQR Generator URL
  const vietQrUrl = selectedCourseForQR
    ? `https://img.vietqr.io/image/MB-0988888888-compact2.png?amount=${selectedCourseForQR.price}&addInfo=${transferCode}&accountName=EDTECH%20ENGLISH%20CENTER`
    : "";

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Banner Welcome */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <div className="flex items-center space-x-2 text-xs font-mono text-[#86f2e4] uppercase tracking-wider mb-2">
              <GraduationCap className="w-4 h-4" />
              <span>Student Workspace Portal</span>
            </div>
            <h1 className="text-3xl font-bold font-headline">
              Xin chào, {user?.name || "Học viên Trần Hoàng Nam"}!
            </h1>
            <p className="text-sm text-blue-100 mt-1 max-w-xl">
              Bạn đang tham gia {myClasses.length} lớp học. Hệ thống AI sẵn sàng chấm điểm bài làm 4 kỹ năng của bạn bất kỳ lúc nào.
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex space-x-3">
            <Link
              href="/student/analytics"
              className="px-4 py-2.5 bg-[#86f2e4] text-[#00236f] hover:bg-white text-sm font-semibold rounded-xl transition-all shadow-sm font-headline"
            >
              Xem Tiến Độ AI &amp; Band Score &rarr;
            </Link>
          </div>
        </div>

        {/* Dynamic VietQR Payment Modal */}
        {selectedCourseForQR && (
          <div className="mb-8 p-6 bg-white rounded-2xl border border-[#d3e4fe] shadow-lg max-w-2xl mx-auto">
            {!qrRequested ? (
              <div>
                <h2 className="text-lg font-bold font-headline text-[#00236f] mb-2">
                  Thanh Toán Khóa Học: {selectedCourseForQR.title}
                </h2>
                <p className="text-xs text-[#444651] mb-4">
                  Quét mã VietQR động bên dưới để tự động điền số tiền và nội dung chuyển khoản chuẩn xác.
                </p>

                <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6 bg-[#f8f9ff] p-4 rounded-xl border border-[#e5eeff] mb-6">
                  {/* Dynamic VietQR Image */}
                  <div className="w-48 h-48 bg-white p-2 border border-[#c5c5d3] rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
                    <img
                      src={vietQrUrl}
                      alt="VietQR Chuyển Khoản Nhanh"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[#757682] block font-mono">Ngân Hàng:</span>
                      <span className="font-bold text-sm text-[#0b1c30]">MB Bank (Ngân hàng Quân Đội)</span>
                    </div>
                    <div>
                      <span className="text-[#757682] block font-mono">Số Tài Khoản:</span>
                      <span className="font-bold text-sm text-[#0b1c30]">0988888888</span>
                    </div>
                    <div>
                      <span className="text-[#757682] block font-mono">Chủ Tài Khoản:</span>
                      <span className="font-bold text-sm text-[#0b1c30]">EDTECH ENGLISH CENTER</span>
                    </div>
                    <div>
                      <span className="text-[#757682] block font-mono">Số Tiền:</span>
                      <span className="font-bold text-base text-[#006a61] font-mono">
                        {selectedCourseForQR.price.toLocaleString("vi-VN")} VNĐ
                      </span>
                    </div>
                    <div>
                      <span className="text-[#757682] block font-mono">Cú Pháp CK (Bắt buộc):</span>
                      <span className="font-bold text-xs bg-white px-2 py-1 rounded border border-[#d3e4fe] font-mono text-[#00236f]">
                        {transferCode}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedCourseForQR(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmTransfer}
                    className="px-5 py-2 bg-[#006a61] hover:bg-[#005049] text-white text-sm font-medium rounded-xl shadow cursor-pointer font-headline"
                  >
                    Tôi Đã Chuyển Khoản &amp; Gửi Yêu Cầu
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold font-headline text-[#00236f] mb-1">
                  Đã Gửi Yêu Cầu Thanh Toán Thành Công!
                </h3>
                <p className="text-xs text-[#444651] max-w-md mx-auto mb-6">
                  Mã giao dịch <strong>{transferCode}</strong> đã được lưu trên hệ thống. Admin sẽ đối soát và kích hoạt khóa học trong chốc lát.
                </p>
                <button
                  onClick={() => setSelectedCourseForQR(null)}
                  className="px-5 py-2 bg-[#00236f] text-white text-sm font-medium rounded-xl cursor-pointer"
                >
                  Đóng Thông Báo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section 1: My Classes */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold font-headline text-[#00236f] flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-[#006a61]" />
              <span>Lớp Học Đang Tham Gia ({myClasses.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="p-8 bg-white rounded-2xl border border-[#d3e4fe] flex items-center justify-center space-x-2 text-xs font-mono text-[#757682]">
              <Loader2 className="w-4 h-4 animate-spin text-[#00236f]" />
              <span>Đang nạp lớp học từ Supabase...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="bg-white p-6 rounded-2xl border border-[#d3e4fe] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold font-headline text-[#0b1c30]">
                        {cls.name}
                      </h3>
                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          cls.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : cls.status === "UPCOMING"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-rose-100 text-rose-900 border border-rose-300"
                        }`}>
                          {cls.status === "ACTIVE" ? "🟢 Đang Học" : cls.status === "UPCOMING" ? "🟡 Sắp Khai Giảng" : "🔴 Hoàn Thành"}
                        </span>
                        <span className="px-2.5 py-1 rounded-md bg-[#e5eeff] text-[#00236f] font-mono text-xs font-bold">
                          {cls.code}
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#e5eeff] flex items-center justify-between">
                      <span className="text-xs text-[#757682] font-mono">{cls.schedule}</span>
                      <Link
                        href={`/student/class/${cls.id}`}
                        className="px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white text-xs font-semibold rounded-xl transition-all shadow flex items-center space-x-1 font-headline"
                      >
                        <span>Vào Lớp Học</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Public Courses Store */}
        <section>
          <h2 className="text-xl font-bold font-headline text-[#00236f] mb-4 flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-[#006a61]" />
            <span>Cổng Khóa Học Công Khai (Store)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-[#d3e4fe] shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                <div>
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-5">
                    <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 text-[10px] font-mono font-bold uppercase mb-2 inline-block">
                      {course.level}
                    </span>
                    <h3 className="font-bold font-headline text-[#0b1c30] text-base mb-2">
                      {course.title}
                    </h3>
                    <p className="text-xs text-[#444651] line-clamp-2 mb-4">
                      {course.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-[#e5eeff] mt-auto flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#757682] font-mono block">Học phí:</span>
                    <span className="font-bold text-sm text-[#006a61] font-mono">
                      {course.price.toLocaleString("vi-VN")} VNĐ
                    </span>
                  </div>
                  <button
                    onClick={() => handleCreateOrder(course)}
                    className="px-3.5 py-2 bg-[#006a61] hover:bg-[#005049] text-white text-xs font-semibold rounded-xl transition-all shadow cursor-pointer font-headline"
                  >
                    Mua Ngay (VietQR)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
