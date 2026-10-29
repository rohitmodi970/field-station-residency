"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface PromptSectionProps {
  reflection?: string
  prompt?: string
}

export function PromptSection({ 
  reflection = "Your entries show a powerful shift from seeking validation through romantic connections to investing in self-care practices.",
  prompt = "Now that you're back home and have invested so much in your physical and mental wellness, how are you redefining what 'taking care of yourself' means in this new chapter?"
}: PromptSectionProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div className="animate-fade-in-delay-3">
      {/* Card with window controls - Force style */}
      <div 
        className={cn(
          "relative bg-card/85 backdrop-blur-sm rounded-2xl border border-foreground/5 shadow-lg overflow-hidden",
          "transition-all duration-300 cursor-pointer",
          isHovered && "shadow-xl"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Window controls bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-foreground/5">
          <div className="window-dots">
            <div className="window-dot window-dot-red" />
            <div className="window-dot window-dot-gray" />
            <div className="window-dot window-dot-gray" />
          </div>
          <span className="flex-1 text-center text-sm text-foreground/50 font-medium">
            Today's Prompt
          </span>
          <div className="w-[60px]" />
        </div>

        {/* Content */}
        <div className="p-8 md:p-10">
          <div className="flex items-start gap-6">
            {/* Pen icon */}
            <div className={cn(
              "flex-shrink-0 w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center",
              "transition-all duration-300",
              isHovered && "bg-primary/10"
            )}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-primary/60">
                <path d="M12 19L19 12L22 15L15 22L12 19Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18 13L16.5 5.5L2 2L5.5 16.5L13 18L18 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 2L9.586 9.586" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>

            <div className="flex-1 space-y-5">
              {/* Main prompt */}
              <h3 className="font-serif text-xl md:text-2xl lg:text-3xl text-foreground/90 leading-relaxed text-pretty">
                {prompt}
              </h3>

              {/* Reflection/insight */}
              <p className="text-sm text-foreground/50 leading-relaxed">
                {reflection}
              </p>
            </div>

            {/* Start Writing button */}
            <button className={cn(
              "flex-shrink-0 px-5 py-2.5 rounded-full",
              "bg-primary text-primary-foreground",
              "text-sm font-medium",
              "shadow-sm hover:shadow-md",
              "transition-all duration-300",
              "hover:scale-[1.02]",
              "flex items-center gap-2"
            )}>
              Start expressing
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
