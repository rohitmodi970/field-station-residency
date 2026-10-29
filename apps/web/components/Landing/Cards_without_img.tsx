import React from "react";

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

export function MindCardTxt({ heading, content,src, customClass }: { heading: string; content: string; src?: string; customClass?: string }) {
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
    <Card
      className={`
        relative mx-auto 
        w-full max-w-[400px] 
        bg-[#FFFAF8] 
        rounded-xl 
        overflow-hidden 
        shadow-xl 
        ${customClass || ""}
      `}
    >
      {/* --- Header Bar --- */}
      <div className="relative h-9 bg-[#e4e4e4] border-b border-[#cdcdcd] flex items-center justify-center overflow-hidden">
        
        {/* THE 4 BARS: Flex container with 4 distinct lines */}
        <div className="absolute inset-0 flex flex-col justify-center gap-[6px] opacity-20 pointer-events-none w-full">
           <div className="w-full h-[1px] bg-black" />
           <div className="w-full h-[1px] bg-black" />
           <div className="w-full h-[1px] bg-black" />
           <div className="w-full h-[1px] bg-black" />
        </div>

        {/* Window Controls (Traffic Lights) */}
        <div className="absolute left-3 flex items-center gap-1.5 z-10">
          <span className="w-4 h-4 rounded-full bg-[#ff5f57] border border-red-600/20 shadow-sm" />
          <span className="w-3 h-3 rounded-full bg-[#cecece] border border-gray-400/30 shadow-sm" />
          <span className="w-3 h-3 rounded-full bg-[#cecece] border border-gray-400/30 shadow-sm" />
        </div>

        {/* Title */}
        <h2 className="relative z-10 text-[20px] font-terminal-grotesque font-semibold text-black tracking-tight">
          {heading}
        </h2>
      </div>

      {/* --- Main Content Area --- */}
      <div className="px-8 pt-10 pb-6 flex flex-col items-center text-center">
        
        {/* Main Text */}
        <p className="text-[20px] sm:text-3xl font-terminal-grotesque font-semibold leading-tight text-[#363D01] tracking-tight mb-8">
         {content}
        </p>

        {/* Icons Row */}
        <div className="flex items-center mb-2 pb-2 text-black">
          {/*  Icon */}
          <img src={src} alt="" />
        </div>

        {/* Bottom Line */}
        <div className="w-full h-1 bg-[#A4A4A4] rounded-full overflow-hidden">
          <div className="w-[98%] h-full bg-[#A4A4A4] mx-auto rounded-full" />
        </div>
      </div>
    </Card>
  );
}