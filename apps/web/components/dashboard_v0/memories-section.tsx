"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"

interface Memory {
  id: string
  date: string
  formattedDate: string
  excerpt: string
  mood?: "peaceful" | "reflective" | "hopeful" | "neutral"
}

const sampleMemories: Memory[] = [
  {
    id: "1",
    date: "Jan 31",
    formattedDate: "January 31st, 2025",
    excerpt: "The first month of the year is almost over. I want to talk about what has been on my mind lately...",
    mood: "reflective",
  },
  {
    id: "2",
    date: "Jan 30",
    formattedDate: "January 30th, 2025",
    excerpt: "September felt like a turning point. Things are slowly starting to make more sense now...",
    mood: "hopeful",
  },
  {
    id: "3",
    date: "Jan 29",
    formattedDate: "January 29th, 2025",
    excerpt: "I am slowly coming to terms with the quality of my life right now. Where I am is okay...",
    mood: "peaceful",
  },
  {
    id: "4",
    date: "Jan 28",
    formattedDate: "January 28th, 2025",
    excerpt: "How do I revive what feels like it's fading? It's been a month since I felt truly present...",
    mood: "reflective",
  },
]

const moodLabels = {
  peaceful: "Peaceful",
  reflective: "Reflective",
  hopeful: "Hopeful",
  neutral: "Neutral",
}

export function MemoriesSection() {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 300
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-delay-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <h2 className="font-serif text-lg md:text-xl text-foreground/60">
            From you, recently
          </h2>
        </div>

        {/* Navigation arrows */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className={cn(
              "w-9 h-9 rounded-full",
              "bg-card/80 border border-foreground/10",
              "flex items-center justify-center",
              "text-foreground/50 hover:text-foreground/70",
              "transition-all duration-200",
              "hover:shadow-sm"
            )}
            aria-label="Scroll left"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className={cn(
              "w-9 h-9 rounded-full",
              "bg-card/80 border border-foreground/10",
              "flex items-center justify-center",
              "text-foreground/50 hover:text-foreground/70",
              "transition-all duration-200",
              "hover:shadow-sm"
            )}
            aria-label="Scroll right"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            className={cn(
              "ml-2 px-4 py-2 rounded-full",
              "text-sm text-foreground/50",
              "hover:text-foreground/70 hover:bg-card/50",
              "transition-all duration-200",
              "flex items-center gap-2"
            )}
          >
            View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Memory cards */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide"
      >
        {sampleMemories.map((memory, index) => (
          <div
            key={memory.id}
            onMouseEnter={() => setHoveredId(memory.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              "relative flex-shrink-0 w-64",
              "bg-card/70 backdrop-blur-sm",
              "border border-foreground/5",
              "rounded-2xl overflow-hidden",
              "transition-all duration-300 ease-out",
              "hover:shadow-lg hover:bg-card/85",
              "hover:-translate-y-1",
              "cursor-pointer group"
            )}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Window controls bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/5">
              <div className="window-dots">
                <div className="window-dot window-dot-red" style={{ width: 10, height: 10 }} />
                <div className="window-dot window-dot-gray" style={{ width: 10, height: 10 }} />
                <div className="window-dot window-dot-gray" style={{ width: 10, height: 10 }} />
              </div>
              <span className="flex-1 text-center text-xs text-foreground/40 font-medium">
                {memory.date}
              </span>
              <div className="w-[48px]" />
            </div>

            {/* Content */}
            <div className="p-5 space-y-3">
              <h3 className="font-serif text-lg text-foreground/85">
                {memory.formattedDate}
              </h3>
              <p className="text-sm text-foreground/50 leading-relaxed line-clamp-3">
                {memory.excerpt}
              </p>

              {/* Mood tag */}
              {memory.mood && (
                <div className="pt-2">
                  <span className={cn(
                    "inline-block px-3 py-1 rounded-full text-xs font-medium",
                    "bg-foreground/5 text-foreground/50",
                    "border border-foreground/5",
                    "uppercase tracking-wide"
                  )}>
                    {moodLabels[memory.mood]}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
