"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import Frame from "@/components/f/Frame";
import { f } from "@/lib/f/store";

// Client only: the greeting and the world depend on the device clock and canvas.
const App = dynamic(() => import("@/components/f/App"), { ssr: false });

export default function Page() {
  // ?demo=new starts with an empty memory, as a first-time person would see it.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("demo") === "new") f.setDemo("new");
    // ?onboard=1 runs the onboarding again.
    if (q.get("onboard") === "1") f.restartOnboarding();
    if (process.env.NODE_ENV !== "production") (window as unknown as { __f: typeof f }).__f = f;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <App />
      </Frame>
    </MotionConfig>
  );
}
