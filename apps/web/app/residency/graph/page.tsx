"use client";

import { MotionConfig } from "motion/react";
import dynamic from "next/dynamic";

const GraphStage = dynamic(() => import("@/components/r/GraphStage"), { ssr: false });

// The residency's graph, for the pitch: shown at the end, not part of anyone's flow.
export default function ResidencyGraph() {
  return (
    <MotionConfig reducedMotion="user">
      <GraphStage />
    </MotionConfig>
  );
}
