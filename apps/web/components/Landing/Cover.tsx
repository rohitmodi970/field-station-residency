import React from 'react';
import Image from 'next/image';

interface PostcardProps {
  /** The main photograph to display on the left side */
  imageSrc: string;
  /** The logo to place inside the stamp */
  logoSrc: string;
  /** Optional custom message for the back of the card */
  className?: string;
}

const Postcard: React.FC<PostcardProps> = ({
  imageSrc,
  logoSrc,
  className = "",
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
    <div className={`relative mx-auto p-2 ${className}`}>
      {/* 1. Airmail Border Container 
        Using a repeating linear gradient to simulate the red/blue stripes 
      */}
      <div
        className="relative w-full aspect-[3/2] md:aspect-[16/10] shadow-2xl overflow-hidden p-[2%] sm:p-[20px]"
        style={{
          background: `repeating-linear-gradient(
            45deg,
            #d93030 0px,
            #d93030 15px,
            #fdf8e4 15px,
            #fdf8e4 30px,
            #1e51b3 30px,
            #1e51b3 45px,
            #fdf8e4 45px,
            #fdf8e4 60px
          )`,
        }}
      >
        {/* 2. Inner Card (Cream Paper Background) */}
        <div className="relative w-full h-full bg-[#fcf5e5] flex shadow-inner">
          
          {/* --- LEFT SIDE: Photo Area --- */}
          <div className="w-[45%] h-full p-4 sm:p-6 flex items-center justify-center">
            <div className="relative w-full h-full overflow-hidden rounded-sm shadow-md border-4 border-white transform -rotate-1">
              <Image
                src={imageSrc}
                alt="Postcard memory"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Optional: Vintage overlay/filter */}
              <div className="absolute inset-0 bg-yellow-900/10 mix-blend-multiply pointer-events-none" />
            </div>
          </div>

          {/* --- RIGHT SIDE: Stamp & Lines --- */}
          <div className="w-[55%] h-full relative p-6 sm:p-8 flex flex-col">
            
            {/* Top Area: Stamp and Postmark */}
            <div className="absolute top-6 right-6 flex items-start gap-4 z-10">
              
              {/* Postmark (The circle cancel mark) */}
              <div className="hidden sm:block absolute right-[110%] top-2 opacity-60 pointer-events-none">
                <div className="w-24 h-24 rounded-full border-[3px] border-[#a89f81] flex items-center justify-center transform -rotate-12 mask-image-grunge">
                  <div className="w-16 h-16 rounded-full border-[2px] border-[#a89f81]" />
                  <div className="absolute w-28 h-8 bg-transparent border-t-[3px] border-b-[3px] border-[#a89f81] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform -skew-x-12" />
                </div>
              </div>

              {/* The Stamp */}
              <div className="relative w-20 h-24 sm:w-24 sm:h-28 bg-[#d6cfb8] shadow-sm transform rotate-2">
                {/* Stamp jagged edges simulation using dashed border */}
                <div className="absolute inset-0 border-[6px] border-dashed border-[#fcf5e5] pointer-events-none z-20"></div>
                
                {/* Stamp Inner Content */}
                <div className="w-full h-full bg-[#9c8c74] p-2 flex items-center justify-center overflow-hidden">
                   {/* Logo inside stamp */}
                   <div className="relative w-full h-full opacity-90">
                     <Image 
                       src={logoSrc} 
                       alt="Stamp Logo" 
                       fill
                       className="object-contain p-2 invert brightness-200 sepia" // Styling to make logo look integrated
                     />
                   </div>
                </div>
              </div>
            </div>

            {/* Bottom Area: Writing Lines */}
            <div className="mt-auto w-full flex flex-col gap-8 pb-4 pr-4">
              {[1, 2, 3, 4].map((_, i) => (
                <div 
                  key={i} 
                  className="w-full border-b border-[#c2bca3] h-8 relative"
                >
                    {/* Subtle grunge on lines */}
                </div>
              ))}
            </div>
            
          </div>

          {/* Texture Overlay (Optional - adds paper grain) */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cardboard.png')]"></div>
        </div>
      </div>
    </div>
  );
};

export default Postcard;