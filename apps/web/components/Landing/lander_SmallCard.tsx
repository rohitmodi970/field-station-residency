import React from 'react';
import { Card } from "../ui/quilted-gallery/ui/card";

export function LanderCard({
  src, 
  heading, 
  description
}: {
  src: string; 
  heading: string; 
  description: string;
}) {
  return (
    <Card className="w-full max-w-[386px] h-[464px] bg-[#FFFAF8] rounded-[16px] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      {/* Top title bar */}
      <div className="relative h-[36px] bg-[#E5E5E5] border-b border-[#c9c9c9] rounded-t-[16px] flex items-center justify-center px-4">
        {/* THE 4 BARS: Flex container with 4 distinct lines */}
        <div className="absolute inset-0 flex flex-col justify-center gap-[6px] opacity-20 pointer-events-none w-full">
           <div className="w-full h-[1px] bg-black" />
           <div className="w-full h-[1px] bg-black" />
           <div className="w-full h-[1px] bg-black" />
           <div className="w-full h-[1px] bg-black" />
        </div>
        <h2 className="font-terminal-grotesque font-bold z-10 text-[24px] px-4 tracking-[-0.56px] text-black">
          {heading}
        </h2>
        <div className="absolute left-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
        </div>
      </div>

      {/* Main content area */}
      <div className="relative px-4 pt-4 pb-4">
        {/* Centered hero image */}
        <div className="w-full flex items-center justify-center mb-4 overflow-hidden rounded-[12px]">
          <img
            src={src}
            alt={heading}
            className="w-full h-[180px] object-cover object-center transform scale-175 select-none"
            draggable={false}
          />
        </div>

        {/* separator */}
        <hr className="border-t border-[#e5e5e5] my-3" />

        {/* Title + description summary */}
        <div>
          
          <p className="font-terminal-grotesque font-bold text-[20px] leading-[1.4] text-black text-justify pt-10">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}