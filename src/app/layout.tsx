import type { Metadata, Viewport } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EverGreen CASH",
  description: "إدارة الصندوق والفواتير والسلف — إيفر غرين للمقاولات الزراعية",
  applicationName: "EverGreen CASH",
  appleWebApp: {
    capable: true,
    title: "EverGreen CASH",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/logo.jpg",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1b4d3e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
