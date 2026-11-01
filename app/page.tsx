import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthenticatedUserFromCookie } from "@/lib/auth";
import { getLandingStats } from "@/lib/landing-stats";

import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingMarquee from "@/components/landing/LandingMarquee";
import LandingFeatures from "@/components/landing/LandingFeatures";
import LandingShowcase from "@/components/landing/LandingShowcase";
import LandingPrinciples from "@/components/landing/LandingPrinciples";
import LandingFaq from "@/components/landing/LandingFaq";
import LandingContact from "@/components/landing/LandingContact";
import LandingFooter from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "KitoKit — Học vui. Thi chắc. Có AI đồng hành.",
  description:
    "Cổng bài học và luyện thi trực tuyến đa môn thông minh dành cho học sinh, phụ huynh và giáo viên với công nghệ AI chấm điểm hiện đại.",
  openGraph: {
    title: "KitoKit — Học Vui, Thi Chắc",
    description: "Cổng bài học và luyện thi trực tuyến đa môn thông minh.",
    images: ["/brand/kitokit-logo-full.webp"],
  },
};

export default async function HomePage() {
  const user = await getAuthenticatedUserFromCookie();

  if (user) {
    if (user.role === "ADMIN") {
      redirect("/admin/requests");
    } else if (user.role === "TEACHER") {
      redirect("/teacher/classes");
    } else {
      redirect("/student/dashboard");
    }
  }

  const stats = await getLandingStats();

  return (
    <div className="min-h-screen flex flex-col bg-surface font-sans text-ink selection:bg-brand-600 selection:text-white">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero stats={stats} />
        <LandingMarquee />
        <LandingFeatures />
        <LandingShowcase />
        <LandingPrinciples />
        <LandingFaq />
        <LandingContact />
      </main>
      <LandingFooter />
    </div>
  );
}
