import { Geist_Mono, Inter } from "next/font/google";

import "@workspace/ui/globals.css";
import { cn } from "@workspace/ui/lib/utils";
import { AppProviders } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        inter.variable
      )}
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
