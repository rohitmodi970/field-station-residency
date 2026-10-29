"use client";

import React from "react";
import { Card } from "../ui/quilted-gallery/ui/card";

/**
 * Component: ConnectWithForceCard
 * Matches the reference with a header, large centered image, divider, and text.
 * Uses local asset at /landing/connect_with_force/image.png
 */
export default function ConnectWithForceCard() {
  return (
    <Card className="w-[386px] md:w-[640px] lg:w-[820px] h-[464px] md:h-[540px] p-0 bg-white rounded-[16px] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      {/* Top title bar */}
      <div className="relative h-[36px] md:h-12 bg-[#e5e5e5] border-b border-[#c9c9c9] rounded-t-[16px] flex items-center justify-center">
        <h2 className="font-terminal-grotesque text-[14px] md:text-[16px] tracking-[-0.56px] text-black">
          Connect with force
        </h2>
        {/* control dots (decorative) */}
        <div className="absolute left-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
        </div>
      </div>

      {/* Main content area */}
      <div className="relative px-6 md:px-8 pt-6 md:pt-8">
        {/* Centered hero image */}
        <div className="w-full flex items-center justify-center">
          {/* Use plain img to keep blur look unchanged; next/image may sharpen */}
          <img
            src="/landing/connect_with_force/image.png"
            alt="Connect with force visual"
            className="w-[264px] md:w-[360px] lg:w-[420px] h-[226px] select-none"
            draggable={false}
          />
        </div>

        {/* separator */}
        <hr className="border-t border-[#e5e5e5] my-6" />

        {/* Title + description summary */}
        <div className="pl-2 md:pl-4">
          <h3 className="font-terminal-grotesque text-[14px] md:text-[16px] tracking-[-0.56px] text-black mb-3">
            THE JOURNAL ENTRY
          </h3>
          <p className="font-terminal-grotesque text-[14px] md:text-[15px] leading-relaxed text-black max-w-[520px]">
            Share your thoughts in a quiet, intentional space where you can be fully yourself.
          </p>
        </div>
      </div>
    </Card>
  );
}
