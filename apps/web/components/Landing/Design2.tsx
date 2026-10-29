export default function Design2() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#E8D5C4]">
      
      {/* --- THE SCENE CONTAINER --- 
          This wrapper acts as a fixed-ratio 'Artboard'. 
          It stays centered and scales to cover the screen, 
          keeping the background and trees locked together. 
      */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto aspect-video">
        
        {/* Background Image */}
        <div className="absolute inset-0 w-full h-full">
          <img 
            src="/mind_scroll/trees/head.png"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>

        {/* Decorative Trees - Positioned relative to the Scene, not the Screen */}
        <div className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none">
          <img 
            src="/mind_scroll/trees/tree1.png"
            alt=""
            className="absolute left-[18%] top-[4%] w-[11%] max-w-[240px] h-auto"
          />
          <img 
            src="/mind_scroll/trees/tree2.png"  
            alt=""
            className="absolute left-[26%] top-[8.8%] w-[11%] max-w-[240px] h-auto"
          />
          <img 
            src="/mind_scroll/trees/tree3.png"
            alt=""
            className="absolute left-[35%] top-[0%] w-[11%] max-w-[230px] h-auto"
          />
          <img 
            src="/mind_scroll/trees/tree4.png"
            alt=""
            className="absolute left-[44%] top-[8.8%] w-[11%] max-w-[230px] h-auto"
          />
          <img 
            src="/mind_scroll/trees/tree5.png"
            alt=""
            className="absolute left-[53.5%] top-[4%] w-[11%] max-w-[230px] h-auto"
          />
          <img 
            src="/mind_scroll/trees/tree6.png"
            alt=""
            className="absolute left-[65%] top-[6.3%] w-[11%] max-w-[236px] h-auto"
          />
          <img 
            src="/mind_scroll/trees/tree7.png"
            alt=""
            className="absolute left-[76%] top-[10.5%] w-[11%] max-w-[234px] h-auto"
          />
        </div>
      </div>

      {/* --- UI OVERLAY ---
          Logo and Text stay relative to the Viewport (Screen), 
          so they are always readable and accessible.
      */}

      {/* Logo */}
      <div className="absolute top-6 left-6 md:top-10 md:left-10 z-10">
        <img 
          src="https://api.builder.io/api/v1/image/assets/TEMP/a1593c42982294ade8537178a3294e78833d2bd7?width=103"
          alt="Logo"
          className="w-10 h-auto md:w-[52px]"
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col justify-end min-h-screen px-6 pb-12 md:px-12 md:pb-16 lg:px-16 lg:pb-20">
        <div className="max-w-7xl w-full mx-auto">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-12">
            
            {/* Left Content */}
            <div className="flex-1 max-w-2xl">
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[64px] leading-tight text-white uppercase mb-6 md:mb-8">
                Your mind is a world of its own.
                <br />
                Return to it.
              </h1>

              <p className="font-body text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-[32px] leading-relaxed text-[#FBE4D6] tracking-tight">
                A calm, intelligent space to help you reclaim your attention and understand your inner world.
              </p>
            </div>

            {/* Right Side - Scroll Indicator */}
            <div className="hidden lg:flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="font-body text-sm tracking-tight text-white">SCROLL</span>
                <div className="w-[38px] h-[38px] rounded-full border border-white flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 1V17" stroke="white" strokeLinecap="round"/>
                    <path d="M1 9H17" stroke="white" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Join Waitlist - Bottom Left */}
          <div className="mt-8 lg:mt-12">
            <button className="group flex items-center gap-4 hover:gap-6 transition-all duration-300">
              <span className="font-body text-sm tracking-tight text-white">JOIN WAITLIST</span>
              <div className="w-[38px] h-[38px] rounded-full border border-white flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                  <path d="M3 1L9.5 10L3 19" stroke="white" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}