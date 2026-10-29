// apps/web/app/layout.tsx - Root Layout

import "@workspace/ui/globals.css";
import "@/styles/residency.css";
import { Providers } from "@/components/providers";
import { NavProvider } from "@/utilities/context/NavContext";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
import { Inter, Syne_Mono } from "next/font/google";
import { PostHogProvider } from "./providers/posthog-provider";
import { PostHogPageView } from "./providers/posthog-pageview";
import { Suspense } from "react";
import Script from "next/script";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const syneMono = Syne_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-syne-mono",
  display: "swap",
});

const hydrogenWhiskey = localFont({
  src: "../public/fonts/Hydrogen_Whiskey.otf",
  variable: "--font-hydrogen",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#171311",
};

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://findmyforce.com");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Force Web App",
  description: "Personal and private journal web app",
  applicationName: "Force",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Force",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/forcelogo.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-precomposed.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon-32x32.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${hydrogenWhiskey.variable} ${syneMono.variable} ${inter.variable}`}>
      <head>
        <meta charSet="utf-8" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Force" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#171311" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" sizes="180x180" href="/apple-touch-icon-precomposed.png" />
        <meta name="google-site-verification" content="aBm-Kkg-k42EQZHBkxj88IBE54lhQij-xuCWSTojkg8" />
        <script src="https://js.puter.com/v2/" async></script>
      </head>
      <body suppressHydrationWarning>
        <PostHogProvider>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <Providers>
            {/* NavProvider wraps everything  context items set by child layoutes */}
            <NavProvider>
              {children}
              <Analytics />
              <SpeedInsights />
            </NavProvider>
          </Providers>
        </PostHogProvider>
      </body>
    </html>
  );
}
