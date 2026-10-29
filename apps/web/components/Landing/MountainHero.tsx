"use client";

import React from "react";

/**
 * Component: MountainHero
 * Responsive layered mountain hero with proper stacking
 * Assets expected:
 *  - /landing/Mountain/top.png
 *  - /landing/Mountain/middle.png
 *  - /landing/Mountain/bottom.png
 *  - /landing/Mountain/rectangle.png (dark footer fade)
 *  - /landing/Mountain/Button.png (capsule CTA)
 */
export default function MountainHero() {
    return (
        <div className="relative w-full bg-[#FEF5EF] overflow-hidden">
            {/* Container with aspect ratio to maintain proportions */}
            <div className="relative w-full" style={{ paddingBottom: '200%' }}>

                {/* Layer 1: Top mountain (pink gradient) - Base layer */}
                <div className="absolute top-0 left-0 w-full z-10">
                    <img
                        src="/landing/Mountain/top.png"
                        alt=""
                        className="w-full h-auto block"
                    />
                </div>

                {/* Layer 2: Middle mountain (purple) - Overlapping */}
                <div className="absolute top-[8%] xs:top-[10%] sm:top-[12%] md:top-[14%] lg:top-[15%] xl:top-[16%] left-0 w-full z-20">
                    <img
                        src="/landing/Mountain/middle.png"
                        alt=""
                        className="w-full h-auto block"
                    />
                </div>

                {/* Layer 3: Bottom mountain (dark blue) with gradient fade */}
                <div className="absolute top-[20%] xs:top-[24%] sm:top-[28%] md:top-[32%] lg:top-[36%] xl:top-[38%] left-0 w-full z-30">
                    <img
                        src="/landing/Mountain/bottom.png"
                        alt=""
                        className="w-full h-auto block"
                    />
                </div>

                {/* Dark gradient overlay - extends to bottom */}
                <div className="absolute top-[35%] xs:top-[40%] sm:top-[45%] md:top-[50%] lg:top-[55%] xl:top-[66%] left-0 w-full bottom-0 z-40 bg-gradient-to-b from-[#404666] to-black" />





                {/* Text Content Overlay - Positioned over dark area */}
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-end pb-16 sm:pb-20 md:pb-24 lg:pb-32 px-4 ">
                    <div className="text-center max-w-4xl">
                        <h1
                            className="font-terminal-grotesque text-white text-[24px] sm:text-[32px] md:text-[40px] lg:text-[48px] xl:text-[56px] tracking-tight leading-tight mb-3 sm:mb-4 md:mb-6"
                            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}
                        >
                            RETURN TO YOURSELF.
                            <br />
                            RECLAIM YOUR ATTENTION.
                        </h1>
                        <p
                            className="font-terminal-grotesque text-white/90 text-[12px] sm:text-[14px] md:text-[16px] lg:text-[18px] mb-6 sm:mb-8 max-w-2xl mx-auto px-4"
                            style={{ textShadow: '0 1px 10px rgba(0,0,0,0.9)' }}
                        >
                            Join a vibrant, intelligent space designed for deep thinkers in the age of AI.
                        </p>

                        {/* CTA Button */}
                        <div className="flex justify-center">
                            <button className="group relative "

                            >
                                <img
                                    src="/landing/Mountain/Button.png"
                                    alt="Get Started"
                                    className="h-10 sm:h-12 md:h-14  cursor-pointer transition-transform duration-300 group-hover:scale-105 w-[176px]"
                                    style={{ imageRendering: '-webkit-optimize-contrast' }}
                                />
                                <div className="flex items-center justify-center absolute inset-0 top-0 h-10 sm:h-12 md:h-14 w-full text-white font-terminal-grotesque   gap-2 pointer-events-none select-none text-center">
                                    <span className="inline-flex items-center justify-center whitespace-nowrap">
                                        JOIN WAITLIST
                                    </span>
                                    <span>
                                        <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="19" cy="19" r="18.5" stroke="white" />
                                        <path d="M16 10L22.5 19L16 28" stroke="white" stroke-linecap="round" />
                                    </svg>
                                    </span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}