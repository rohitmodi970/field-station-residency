"use client";

import React from "react";
import { Card } from "../ui/quilted-gallery/ui/card";
import PatternImage from "./ui/PatternImage";
import PatternTag from "./ui/PatternTag";
import IconConnections from "./ui/IconConnections";

export function InnerSelfPatternCard() {

  const fonts = {
  heading: "'Terminal Grotesque', serif",
  body: "'Open Sans', sans-serif",
};

if (typeof window !== "undefined") {
  const css = `
    @font-face {
      font-family: 'Terminal Grotesque';
      src: url('/fonts/terminal-grotesque.ttf') format('opentype');
      font-weight: normal;
      font-style: normal;
      font-display: swap;
    }
    .font-terminal-grotesque { font-family: 'Terminal Grotesque', serif !important; }
    :root { --font-heading: 'Terminal Grotesque', serif; --font-body: 'Open Sans', sans-serif; }
  `;
  const style = document.createElement("style");
  style.setAttribute("data-generated", "fonts-terminal-grotesque");
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

  return (
    <Card className="w-full max-w-[380px] bg-white rounded-[16px] overflow-hidden shadow-[0_8px_20px_rgba(0,0,0,0.08)]">
      {/* Top title bar */}
      <div className="relative h-[36px] bg-[#e5e5e5] border-b border-[#c9c9c9] rounded-t-[16px] flex items-center justify-center px-4">
        <h2 className="font-terminal-grotesque font-light text-[16px] tracking-[-0.56px] text-black">
          Discover yourself
        </h2>
        {/* control dots (decorative) */}
        <div className="absolute left-4 flex items-center gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="w-2 h-2 rounded-full bg-gray-300" />
        </div>
      </div>

      {/* Main content area */}
      <div className="relative px-4 pt-4 pb-4">
        {/* Visualization canvas - matches the reference layout */}
        <div className="w-full flex justify-center mb-4  ">
          <div className="relative w-[270px] h-[220px] mt-10 ">
            {/* Pattern images positioned to match reference */}
            
            {/* Photography - top left */}
            <PatternImage
              src="/landing/discover_yourself/photograph.png"
              positionClass="absolute left-[20px] top-[16px] w-[32px] h-[48px]"
              roundedClass="rounded-[2px]"
            />
            
            {/* Gratitude - top right */}
            <PatternImage
              src="/landing/discover_yourself/gratitude.png"
              positionClass="absolute right-[10px] top-[16px] w-[32px] h-[48px]"
              roundedClass="rounded-[2px]"
            />
            
            {/* Morning run - top center */}
            <PatternImage
              src="/landing/discover_yourself/morning_run.png"
              positionClass="absolute scale-110 left-[108px] top-[10px] w-[26px] h-[50px]"
              roundedClass="rounded-[2.5px]"
            />
            
            {/*Meditation  - center */}
            <PatternImage
              src="/landing/discover_yourself/meditation.png"
              positionClass="absolute left-[120px] top-[98px] w-[32px] scale-125 h-[48px]"
              roundedClass="rounded-[2px]"
            />
            
            {/* House - right middle */}
            <PatternImage
              src="/landing/discover_yourself/house.png"
              positionClass="absolute right-[18px] top-[76px] w-[44px] h-[36px]"
              roundedClass="rounded-[2.5px]"
            />
            
            {/* Coffee shop - bottom left */}
            <PatternImage
              src="/landing/discover_yourself/coffee_shop.png"
              positionClass="absolute left-[16px] bottom-[83px] w-[56px] h-[34px]"
              roundedClass="rounded-[2.5px]"
            />

            {/* Connection lines SVG - stretched to fill the area */}
            <IconConnections 
              positionClass="absolute left-[12px] top-[10px] w-[224px] h-[144px]" 
            />

            {/* Labels positioned above/beside images */}
            <PatternTag 
              text="photography" 
              positionClass="absolute left-[0px] top-[0px] text-[10px]" 
            />
            <PatternTag 
              text="gratitude" 
              positionClass="absolute right-[4px] top-[0px] text-[10px]" 
            />
            <PatternTag 
              text="morning run" 
              positionClass="absolute left-[96px] -top-[7px] text-[10px]" 
            />
            <PatternTag 
              text="meditation" 
              positionClass="absolute left-[86px] top-[70px] text-[10px] whitespace-nowrap" 
            />
            <PatternTag 
              text="house" 
              positionClass="absolute right-[20px] top-[62px] text-[10px]" 
            />
            <PatternTag 
              text="coffee shop" 
              positionClass="absolute left-[18px] bottom-[115px] text-[10px] whitespace-nowrap" 
            />
          </div>
        </div>

        {/* separator */}
        <hr className="border-t border-[#e5e5e5] my-3" />

        {/* Title + description summary */}
        <div>
          <h3 className="font-terminal-grotesque text-[16px] font-medium tracking-[-0.52px] text-black mb-2 uppercase">
            THE INNER-SELF PATTERN ANALYSIS
          </h3>
          <p
            className="font-terminal-grotesque text-[18px] leading-[1.4] text-black text-center"
            style={{ fontFamily: '"Terminal-Grotesque"', color: '#000', fontStyle: 'normal', fontWeight: 400 }}
          >
            Force reveals patterns, emotional shifts, and the deeper meaning behind what you're experiencing.
          </p>
        </div>
      </div>
    </Card>
  );
}