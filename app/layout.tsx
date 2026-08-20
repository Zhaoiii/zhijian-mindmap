import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "枝见 · 网页脑图浏览器",
  description: "由仓库 JSON 驱动、支持 LaTeX 公式与移动端浏览的现代脑图预览页面。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "枝见 · 网页脑图浏览器",
    description: "让知识自然生长：仓库 JSON 驱动的 LaTeX 脑图浏览器。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "枝见脑图浏览器" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "枝见 · 网页脑图浏览器",
    description: "让知识自然生长：仓库 JSON 驱动的 LaTeX 脑图浏览器。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
