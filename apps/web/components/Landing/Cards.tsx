import React from 'react';
import { Card } from "../ui/quilted-gallery/ui/card";

export function MindCard({
  src, 
  title, 
  heading, 
  description
}: {
  src: string; 
  title: string; 
  heading: string; 
  description: string;
}) {
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
    const existingStyle = document.querySelector('[data-generated="fonts-terminal-grotesque"]');
    if (!existingStyle) {
      const style = document.createElement("style");
      style.setAttribute("data-generated", "fonts-terminal-grotesque");
      style.appendChild(document.createTextNode(css));
      document.head.appendChild(style);
    }
  }

  return (
    <Card className="w-full max-w-[380px] bg-white rounded-[12px] sm:rounded-[16px] h-auto min-h-[400px] sm:min-h-[450px] overflow-hidden shadow-lg">
      {/* Top title bar */}
      <div className="relative h-[32px] sm:h-[36px] bg-[#e5e5e5] border-b border-[#c9c9c9] rounded-t-[12px] sm:rounded-t-[16px] flex items-center justify-center px-3 sm:px-4">
        <h2 className="font-terminal-grotesque font-light text-[14px] sm:text-[16px] tracking-[-0.56px] text-black">
          {title}
        </h2>
        <div className="absolute left-3 sm:left-4 flex items-center gap-1 sm:gap-1.5" aria-hidden="true">
          <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-500" />
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gray-300" />
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gray-300" />
        </div>
      </div>

      {/* Main content area */}
      <div className="relative px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4">
        {/* Centered hero image */}
        <div className="w-full flex items-center justify-center mb-3 sm:mb-4">
          <img
            src={src}
            alt={title}
            className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] md:w-[250px] md:h-[250px] object-contain select-none"
            draggable={false}
          />
        </div>

        {/* separator */}
        <hr className="border-t border-[#e5e5e5] my-2 sm:my-3" />

        {/* Title + description summary */}
        <div>
          <h3 className="font-terminal-grotesque text-[14px] sm:text-[16px] md:text-[18px] font-medium tracking-[-0.52px] text-black mb-1.5 sm:mb-2 uppercase">
            {heading}
          </h3>
          <p className="font-terminal-grotesque text-[13px] sm:text-[14px] md:text-[16px] leading-[1.4] text-black text-center">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}