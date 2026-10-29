export default function Design() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#E8D5C4]">
      {/* Background Image */}
      <div className="absolute inset-0 w-full h-full">
        <img 
          src="/mind_scroll/frame1/frame1.png"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      {/* Decorative Tree Images - Hidden on mobile, visible on larger screens */}
      <div className="hidden lg:block absolute inset-0 w-full h-full pointer-events-none">
        <img 
          src="/mind_scroll/frame1/tree1.png"
          alt=""
          className="absolute left-[18%] top-[17%] w-[406px] h-auto scale-150"
        />
        <img 
          src="/mind_scroll/frame1/tree2.png"
          alt=""
          className="absolute left-[30%] top-[16.8%] w-[136px] h-auto scale-150"
        />
        <img 
          src="/mind_scroll/frame1/tree3.png"
          alt=""
          className="absolute left-[33%] top-[17.7%]  w-[420px] h-auto scale-170"
        />
        <img 
          src="/mind_scroll/frame1/tree4.png"
          alt=""
          className="absolute left-[42%] top-[16.8%]  w-[420px] h-auto scale-150"
        />
        <img 
          src="/mind_scroll/frame1/tree5.png"
          alt=""
          className="absolute left-[48.5%] top-[17%]  w-[420px] h-auto scale-150"
        />
        <img 
          src="/mind_scroll/frame1/tree6.png"
          alt=""
          className="absolute left-[53%] top-[17.3%] w-[436px] h-auto scale-150"
        />
        <img 
          src="/mind_scroll/frame1/tree7.png"
          alt=""
          className="absolute left-[63%] top-[17.5%] w-[434px] h-auto scale-150"
        />
      </div>

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
              {/* Main Heading */}
              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[64px] leading-tight text-white uppercase mb-6 md:mb-8">
                Your mind is a world of its own.
                <br />
                Return to it.
              </h1>

              {/* Subheading */}
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
