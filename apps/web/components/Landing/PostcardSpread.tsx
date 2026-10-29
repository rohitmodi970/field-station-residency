import React from 'react';
import Image from 'next/image';

// --- Constants for external texture patterns ---
// Using reliable public domain/creative commons textures for grain and grunge.
// In a production app, download these and serve them locally from /public.
const PAPER_TEXTURE_URL = "https://www.transparenttextures.com/patterns/roughcloth.png";
const GRUNGE_TEXTURE_URL = "https://www.transparenttextures.com/patterns/scratched-texture.png";

interface PostcardSpreadProps {
  imageSrc?: string;
  logoSrc?: string;
}

const RetroPostcardSpread: React.FC<PostcardSpreadProps> = ({
  imageSrc = "/landing/img4.jpg",
  logoSrc = "/logo.svg",
}) => {
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
    // Main container with a dark background to make the card pop
    <div className="min-h-screen   flex items-center justify-center  overflow-x-hidden">
      <div className="flex flex-col xl:flex-row gap-8 max-w-[1800px] w-full relative z-10">
        
        {/* =======================
            CARD 1: THE WORLD WE LIVE IN
           ======================= */}
        <RetroAirmailFrame className="flex-1">
          <div className="flex flex-col sm:flex-row h-full relative z-20">
            
            {/* Left Half: Image & Header Overlay */}
            <div className="sm:w-[45%] h-72 sm:h-full relative p-4 sm:p-6 flex flex-col">
              {/* Container for the photo with aged effects */}
              <div className="relative w-full h-full overflow-hidden rounded-sm shadow-md border-[3px] border-[#fdf9e8]/50">
                <Image
                  src={imageSrc}
                  alt="The world we live in"
                  fill
                  className="object-cover filter sepia-[0.3] contrast-[1.1] brightness-[0.9]"
                />
                {/* THIS IS KEY: Overlays to make the image look printed on the paper */}
                {/* 1. Blend the image into the paper color */}
                <div className="absolute inset-0 bg-[#fdf9e8] mix-blend-multiply opacity-40"></div>
                {/* 2. Add paper texture on top of the image */}
                <div className="absolute inset-0 bg-repeat opacity-30 mix-blend-overlay" style={{ backgroundImage: `url(${PAPER_TEXTURE_URL})` }}></div>

                {/* Header overlay */}
                <div className="absolute top-6 left-0 right-0 text-center z-30">
                  <h2 className="font-terminal-grotesque text-[#fdf9e8] text-2xl sm:text-3xl font-bold tracking-widest drop-shadow-lg opacity-90" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                    THE WORLD WE LIVE IN
                  </h2>
                </div>
              </div>
            </div>

            {/* Right Half: Stamp & Intro Text */}
            <div className="sm:w-[55%] p-6 sm:p-8 relative flex flex-col">
              
              {/* Stamp Area */}
              <div className="flex justify-end mb-8 relative">
                 {/* Postmark Circle - made rougher */}
                <div className="absolute right-[85px] top-2 opacity-70 pointer-events-none hidden sm:block mix-blend-multiply">
                  <div className="w-20 h-20 rounded-full border-[3px] border-[#8c8267] flex items-center justify-center transform -rotate-12 mask-image-grunge outline-dashed outline-2 outline-[#8c8267]">
                    <div className="w-14 h-14 rounded-full border-[2px] border-[#8c8267]" />
                    {/* Wavy cancellation lines */}
                    <div className="absolute w-28 h-10 flex flex-col justify-between top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -skew-x-12 opacity-80">
                        <div className="border-t-[2px] border-[#8c8267] border-dashed"></div>
                        <div className="border-t-[2px] border-[#8c8267] border-dashed"></div>
                        <div className="border-t-[2px] border-[#8c8267] border-dashed"></div>
                    </div>
                  </div>
                </div>

                {/* The Stamp - rougher edges and texture */}
                <div className="relative w-20 h-24 bg-[#b0a388] shadow-md transform rotate-1 flex items-center justify-center overflow-hidden">
                  {/* Jagged edge simulation */}
                  <div className="absolute inset-0 border-[5px] border-dashed border-[#fdf9e8] pointer-events-none z-10 scale-[1.02]"></div>
                  {/* Texture inside stamp */}
                   <div className="absolute inset-0 bg-repeat opacity-50 mix-blend-multiply" style={{ backgroundImage: `url(${PAPER_TEXTURE_URL})` }}></div>
                  
                  <div className="w-[75%] h-[75%] relative opacity-80 mix-blend-multiply z-20">
                     <Image src={logoSrc} alt="Logo" fill className="object-contain invert brightness-[0.3] sepia" />
                  </div>
                </div>
              </div>

              {/* Text Content - darkened and slightly blurred for ink effect */}
              <div className="space-y-6 text-[#2a2518] text-sm sm:text-base leading-relaxed font-terminal-grotesque font-semibold opacity-90" style={{ textShadow: '0px 0px 1px rgba(42, 37, 24, 0.2)' }}>
                <p>
                  We built technology to connect us—but somewhere along the way, it began to consume us.
                </p>
                {/* Rough divider line */}
                <div className="w-full h-[2px] bg-[#8c8267]/40 my-2 border-b border-dashed border-[#8c8267]/30"></div>
                <p>
                  Our feeds move faster than our thoughts. Our minds scatter before they can listen. We've optimized for engagement, not awareness.
                </p>
                 <div className="w-full h-[2px] bg-[#8c8267]/40 my-2 border-b border-dashed border-[#8c8267]/30"></div>
                <p>
                  But what if the next evolution of AI was not acceleration, but attention?
                </p>
              </div>
            </div>
          </div>
        </RetroAirmailFrame>


        {/* =======================
            CARD 2: MANIFESTO
           ======================= */}
        <RetroAirmailFrame className="flex-1">
          <div className="p-8 sm:p-12 h-full flex flex-col relative z-20">
            
            {/* Header */}
            <h2 className="font-terminal-grotesque text-[#8c8267] text-3xl sm:text-4xl font-bold tracking-wide mb-10 uppercase drop-shadow-sm" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.1)' }}>
              Manifesto
            </h2>

            {/* Two Column Layout with slightly rougher text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[#2a2518] text-xs sm:text-sm leading-[1.8] font-terminal-grotesque text-justify font-medium opacity-95" style={{ textShadow: '0px 0px 1px rgba(42, 37, 24, 0.1)' }}>
              
              {/* Column 1 */}
              <div className="space-y-5">
                <p>
                  Force is an AI-native journaling space that helps you understand your mind so you can guide your attention instead of losing it.
                </p>
                <p>
                  It listens. It understands emotion. It learns your patterns.
                </p>
                <p>
                  Not to feed you more noise - but to reflect you back to yourself.
                </p>
                <p>
                  A quiet technology. A space for clarity, not chaos. This is how we move beyond doomscrolling: by turning technology into a mirror, not a magnet.
                </p>
              </div>

              {/* Column 2 */}
              <div className="space-y-5">
                <p className="font-bold text-[#1a1710]">
                  Attention is only the beginning.
                </p>
                <p>
                  As Force learns who you are, it helps you find the people whose values resonate with yours—the builders, thinkers, creators who choose depth over distraction. Growth doesn't happen alone. It happens in resonance.
                </p>
                <p>
                  Force is building that world: a social layer for self-aware, high-agency humans who aren't here to survive, but to thrive. With time, Force becomes your mirror, your compass, your quiet force. And then, it helps you find your forces.
                </p>
                <p>
                  A breath of clarity in the age of distraction. A foundation for the next generation of conscious technology.
                </p>
                <p>
                  It listens. It understands emotion. It learns your patterns. Not to feed you more noise - but to reflect you back to yourself. 
                </p>
              </div>

            </div>
          </div>
        </RetroAirmailFrame>

      </div>
    </div>
  );
};

export default RetroPostcardSpread;

// --------------------------------------------------------------------------
// Helper Component: Retro Airmail Frame (The Core Texture Engine)
// --------------------------------------------------------------------------

const RetroAirmailFrame: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => {
  return (
    <div 
      className={`relative w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden p-[15px] sm:p-[22px] rounded-[2px] ${className}`}
      style={{
        // The repeating gradient for the airmail border - slightly desaturated for age
        background: `repeating-linear-gradient(
          45deg,
          #c92a2a 0px,
          #c92a2a 15px,
          #e6e0c8 15px,
          #e6e0c8 30px,
          #1a4a9c 30px,
          #1a4a9c 45px,
          #e6e0c8 45px,
          #e6e0c8 60px
        )`,
      }}
    >
       {/* OVERLAY 1: Grunge on the border stripes themselves */}
       <div className="absolute inset-0 pointer-events-none opacity-20 bg-repeat mix-blend-multiply z-10" style={{ backgroundImage: `url(${GRUNGE_TEXTURE_URL})` }} />

      {/* Cream Paper Inner Container */}
      <div className="relative w-full h-full bg-[#fdf9e8]">
        
        {/* --- TEXTURE LAYERS --- */}
        
        {/* Layer 1: Strong Base Paper Grain */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-60 bg-repeat mix-blend-multiply z-0" 
            style={{ backgroundImage: `url(${PAPER_TEXTURE_URL})` }} 
        />
        
        {/* Layer 2: Aged Edges Vignette (Crucial for retro look) */}
        {/* This creates the dark, dirty edges fading inwards */}
        <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_150px_rgba(139,119,90,0.35),inset_0_0_30px_rgba(139,119,90,0.5)] rounded-[2px]" />

        {/* Layer 3: Surface Scratches and Dirt */}
         <div 
            className="absolute inset-0 pointer-events-none opacity-10 bg-repeat mix-blend-overlay z-10" 
            style={{ backgroundImage: `url(${GRUNGE_TEXTURE_URL})` }} 
        />
        
        {/* Content Container */}
        <div className="relative z-20 h-full">
          {children}
        </div>
      </div>
    </div>
  );
};