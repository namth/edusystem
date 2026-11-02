import type { Metadata } from "next";
import { Lexend, Baloo_2 } from "next/font/google";
import { BRAND } from "@/lib/brand";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// Chữ tiêu đề bo tròn, gần nét logo KitoKit
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
  applicationName: BRAND.name,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${lexend.variable} ${baloo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-surface-alt text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
