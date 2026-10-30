import type { Viewport } from "next";

// The residency carries its own viewport, so it behaves the same under any root layout it's
// mounted in. Without maximum-scale 1, iOS zooms in on every 15px field you tap and stays
// zoomed: the page gets cut off at the sides, pans sideways, and the bottom bar slides under
// Safari's toolbar. Keep this file with the route wherever it's copied.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#f6f5f3",
};

export default function ResidencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
