"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/student/landing");
    } else if (user.role === "ADMIN") {
      router.push("/admin/requests");
    } else if (user.role === "TEACHER") {
      router.push("/teacher/classes");
    } else {
      router.push("/student/dashboard");
    }
  }, [user, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f9ff]">
      <Loader2 className="w-8 h-8 text-[#00236f] animate-spin mb-3" />
      <p className="text-xs font-mono text-[#006a61] font-bold">Đang điều hướng đến phân hệ tương ứng...</p>
    </div>
  );
}
