import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "枝见 · 网页脑图编辑器",
  description: "支持 LaTeX 公式、仓库脑图与本地自动保存的现代脑图编辑器。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "枝见 · 网页脑图编辑器",
    description: "让知识自然生长：支持 LaTeX、仓库脑图与本地自动保存。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "枝见脑图编辑器" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "枝见 · 网页脑图编辑器",
    description: "让知识自然生长：支持 LaTeX、仓库脑图与本地自动保存。",
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
