"use client";

import { useEffect } from "react";
import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";
import Frame from "@/components/f/Frame";
import { f } from "@/lib/f/store";

const App = dynamic(() => import("@/components/f/App"), { ssr: false });

// The residency build: you arrive as someone new, so memory starts empty. Every visit starts
// at the beginning of the way in (lib/f/residency.ts); ?keep=1 picks up where you left off.
export default function Residency() {
  useEffect(() => {
    f.setDemo("new");
    if (process.env.NODE_ENV !== "production") (window as unknown as { __f: typeof f }).__f = f;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <App residency />
      </Frame>
    </MotionConfig>
  );
}
