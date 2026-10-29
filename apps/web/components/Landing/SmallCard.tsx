import React from "react";

function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}

export function SmallCard({ src, title, customClass }: { src: string; title: string; customClass?: string }) {
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
      // CHANGED: Reduced widths (w-180px mobile, w-280px desktop) and border radius
      className={`relative mx-auto   bg-white rounded-[20px] overflow-hidden border border-gray-200 ${customClass || ""}`}
    >
      {/* Top title bar - CHANGED: Height reduced to h-8 */}
      <div className="relative h-8 bg-gray-100 border-b border-gray-300 flex items-center justify-center">
        {/* subtle slats */}
        <div className="absolute w-full inset-0 flex flex-col justify-center gap-1">
          <div className="bg-gray-300/70 h-0.5 mb-0.5 rounded" />
          <div className="bg-gray-300/70 h-0.5 mb-0.5 rounded" />
          <div className="bg-gray-300/70 h-0.5 mb-0.5 rounded" />
          <div className="bg-gray-300/70 h-0.5 rounded" />
        </div>

        {/* window controls - CHANGED: Smaller dots */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5" aria-hidden>
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-inner" />
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
        </div>

        {/* centered title - CHANGED: Smaller text */}
        <h2 className="text-xs sm:text-sm absolute px-4 font-semibold text-black lowercase tracking-wide right-0 z-20">{title}</h2>
      </div>

      {/* Image area — edge to edge */}
      <div className="relative">
        <img
          src={src}
          alt={title}
          className=" object-fill h-full w-full"
          draggable={false}
        />
      </div>
    </Card>
  );
}

