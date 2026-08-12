import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "English 4-Skills EdTech Portal",
  description: "Comprehensive English Learning & AI Mock Test System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${lexend.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#fff8f5] text-[#211a16]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
