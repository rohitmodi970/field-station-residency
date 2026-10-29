import type { Metadata, Viewport } from "next";
import { Syne_Mono } from "next/font/google";
import "./globals.css";

const syneMono = Syne_Mono({ subsets: ["latin"], weight: "400", variable: "--font-syne-mono", display: "swap" });

const SITE = "https://force-proto.vercel.app";
const TITLE = "Force";
const TAGLINE = "A companion that builds your longitudinal memory and helps you find your perfect side quest partnerships.";

// What the link looks like when it's shared or added to a home screen: her painting with the
// mark on it, the name, the one line.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: `%s · ${TITLE}` },
  description: TAGLINE,
  applicationName: TITLE,
  appleWebApp: { capable: true, title: TITLE, statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: TITLE,
    title: TITLE,
    description: TAGLINE,
    locale: "en_IN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Force" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: TAGLINE,
    images: ["/og.png"],
  },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false }, // a private prototype
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f6f5f3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={syneMono.variable}>
      <body>{children}</body>
    </html>
  );
}
