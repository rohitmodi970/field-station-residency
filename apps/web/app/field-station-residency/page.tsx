"use client";

import { useEffect } from "react";
import { MotionConfig } from "framer-motion";
import dynamic from "next/dynamic";
import Frame from "@/components/f/Frame";
import { f } from "@/lib/f/store";

const App = dynamic(() => import("@/components/f/App"), { ssr: false });

export default function FieldStationResidencyPage() {
  useEffect(() => {
    f.setDemo("new");
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __f: typeof f }).__f = f;
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <Frame>
        <App residency />
      </Frame>
    </MotionConfig>
  );
}
