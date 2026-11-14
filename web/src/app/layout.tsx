import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ask \"Me\"",
  description: "Digital Self 工作室的提问箱",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
