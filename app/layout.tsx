import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import PWARegister from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "DashAds Pro — Dashboard de Tráfego Pago",
  description:
    "Dashboard profissional para gestão de tráfego pago. Análise de campanhas, funil de conversão, criativos e métricas em tempo real.",
  keywords: ["dashboard", "tráfego pago", "meta ads", "google ads", "ROAS", "funil de vendas"],
  authors: [{ name: "DashAds Pro" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DashAds Pro",
    startupImage: [
      { url: "/icons/icon-512x512.png", media: "(device-width: 320px)" },
    ],
  },
  formatDetection: { telephone: false },
  openGraph: {
    title: "DashAds Pro — Dashboard de Tráfego Pago",
    description: "Dashboard profissional para gestão de tráfego pago.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Fira+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* PWA icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-96x96.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512x512.png" />
        {/* iOS splash / status bar */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DashAds Pro" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <PWARegister />
      </body>
    </html>
  );
}
