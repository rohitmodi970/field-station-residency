"use client"
import React, { useState } from "react";
import { InnerSelfPatternCard } from "./InnerSelfPatternCard";
import ConnectWithForceCard from "./ConnectWithForceCard";
import { Card } from "../ui/quilted-gallery/ui/card";
import { MindCard } from "./Cards";

const LandingShowcase = () => {
  const [activeView, setActiveView] = useState("connect"); // "connect", "transform", or "discover"

  return (
    <div 
      className="relative w-full flex flex-col items-center justify-start bg-black overflow-hidden"
      style={{
        backgroundImage: "url('/landing/image.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        borderTopLeftRadius: "20px",
        borderTopRightRadius: "20px",
        borderBottomLeftRadius: "20px",
        borderBottomRightRadius: "20px",
      }}
    >
      {/* Header Section */}
      <div
        className="w-full rounded-l-2xl rounded-r-2xl rounded-t-[0] rounded-b-[0] border-b-[0.5px] border-[#C9C9C9] bg-[#E5E5E5]"
        style={{
          boxShadow: "0 4px 4.3px 0 rgba(0, 0, 0, 0.08)",
        }}
      >
        {/* Top decorative lines */}
        <div className="bg-[#E5E5E5] rounded-t-2xl h-[15px] sm:h-11 top-0 w-full border-b  relative overflow-hidden">
          <div className="flex w-full flex-col items-stretch justify-center pt-2 sm:pt-2.5 gap-1 sm:gap-1.5">
            <div className="h-[1px]  bg-[#C9C9C9] rounded-full w-full  mx-auto" />
            <div className="h-[1px]  bg-[#C9C9C9] rounded-full w-full  mx-auto" />  
            <div className="h-[1px]  bg-[#C9C9C9] rounded-full w-full  mx-auto" />  
            <div className="h-[1px]  bg-[#C9C9C9] rounded-full w-full  mx-auto" />  
            
          </div>
        </div>

        {/* Navigation Bar */}
        <div
          className="absolute left-0 right-0 flex justify-start px-3 sm:px-4 overflow-visible pt-2 sm:pt-2.5 text-center"
          style={{ top: "-22px", zIndex: 50 }}
        >
          <div className="w-full max-w-screen-xl flex items-center justify-start gap-4 sm:gap-6 md:gap-8 lg:gap-10 py-3 sm:py-4 font-bold text-base sm:text-lg z-20">
            {/* Logo */}
            <span className="w-[18px] h-[13px] sm:w-[23px] sm:h-[17px] flex-shrink-0 z-10">
              <img className="w-full h-full" src="/logo2.png" alt="logo" />
            </span>

            {/* Connect Button */}
            <button
              onClick={() => setActiveView("connect")}
              className={`text-center text-sm sm:text-base md:text-lg px-3 sm:px-4 py-1.5 sm:py-2 tracking-tight rounded-none flex-shrink-0 transition-colors ${
                activeView === "connect" 
                  ? "bg-[#54984F] text-white" 
                  : "bg-transparent text-black hover:bg-[#54984F] hover:text-white"
              }`}
            >
              Connect
            </button>

            {/* Discover Button */}
            <button
              onClick={() => setActiveView("discover")}
              className={`text-sm sm:text-base md:text-lg inline transition-colors cursor-pointer ${
                activeView === "discover" 
                  ? "text-[#54984F]" 
                  : "text-black hover:text-[#54984F]"
              }`}
            >
              Discover
            </button>

            {/* Transform Button */}
            <button
              onClick={() => setActiveView("transform")}
              className={`text-sm sm:text-base md:text-lg inline transition-colors cursor-pointer ${
                activeView === "transform" 
                  ? "text-[#54984F]" 
                  : "text-black hover:text-[#54984F]"
              }`}
            >
              Transform
            </button>
          </div>
        </div>
      </div>

      {/* Cards Section - Responsive Grid/Flex */}
      <div className="w-full flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 py-8 sm:py-12 md:py-16 px-3 sm:px-4 md:px-8 lg:px-16 xl:px-24 2xl:px-32 mt-16 sm:mt-20 md:mt-24">
        
        {/* Connect Card - Always show on connect or discover view */}
        {(activeView === "connect" || activeView === "discover") && (
          <div className="w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] flex-shrink-0">
            <MindCard
              src="/landing/connect_with_force/image.png"
              title="Connect with force"
              heading="THE JOURNAL ENTRY"
              description="Share your thoughts in a quiet, intentional space where you can be fully yourself."
            />
          </div>
        )}

        {/* Inner Self Pattern Card - Only on discover view */}
        {activeView === "discover" && (
          <div className="w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] flex-shrink-0">
            <InnerSelfPatternCard/>
          </div>
        )}

        {/* Transform Card - Only on transform view */}
        {activeView === "transform" && (
          <div className="w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] flex-shrink-0">
            <MindCard
              src="/landing/transform_your_mind/image.png"
              title="Transform your mind"
              heading="THE CONNECTION"
              description="Turn insight into intentional action through curated spaces and gentle guidance."
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingShowcase;