"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import dynamic from "next/dynamic";
import Frame from "@/components/f/Frame";
import { f } from "@/lib/f/store";

const App = dynamic(() => import("@/components/f/App"), { ssr: false });

// The residency build: you arrive as someone new, so memory starts empty. Every visit starts
// at the beginning of the way in (lib/f/residency.ts); ?keep=1 picks up where you left off.
export default function Residency() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    f.setDemo("new");
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __f: typeof f }).__f = f;
    }
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f5f3]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <App residency />
      </Frame>
    </MotionConfig>
  );
}
