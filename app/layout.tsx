import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
// import { NotificationManager } from "@/components/NotificationManager";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Habit Cracker - Personal Habit Tracker & Idea Vault",
  description: "A thinking partner, not just a tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Habit Cracker",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#667eea" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans h-full antialiased touch-pan-y`}>
        <GlobalErrorBoundary>
          <ThemeProvider>
            {/* Temporarily disabled NotificationManager for WebView crash isolation */}
            {/* <NotificationManager /> */}
            {children}
          </ThemeProvider>
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
