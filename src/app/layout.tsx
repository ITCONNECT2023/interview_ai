import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PressNote Desk",
  description: "취재 음성 전사와 근거 기반 기사 초안 워크스페이스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
