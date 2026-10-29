"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface BeginOption {
  id: string
  label: string
  description: string
  icon: React.ReactNode
}
// TODO: Add descriptions below each option and maybe a tooltip with more info?
const options: BeginOption[] = [
  {
    id: "write",
    label: "You write.",
    description: "Put your thoughts on paper",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover:scale-110">
        <path d="M3 17.25V21H6.75L17.81 9.94L14.06 6.19L3 17.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M20.71 7.04C21.1 6.65 21.1 6.02 20.71 5.63L18.37 3.29C17.98 2.9 17.35 2.9 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "speak",
    label: "You speak.",
    description: "Let your voice lead the way",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover:scale-110">
        <path d="M12 1C11.2044 1 10.4413 1.31607 9.87868 1.87868C9.31607 2.44129 9 3.20435 9 4V12C9 12.7956 9.31607 13.5587 9.87868 14.1213C10.4413 14.6839 11.2044 15 12 15C12.7956 15 13.5587 14.6839 14.1213 14.1213C14.6839 13.5587 15 12.7956 15 12V4C15 3.20435 14.6839 2.44129 14.1213 1.87868C13.5587 1.31607 12.7956 1 12 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 10V12C19 13.8565 18.2625 15.637 16.9497 16.9497C15.637 18.2625 13.8565 19 12 19C10.1435 19 8.36301 18.2625 7.05025 16.9497C5.7375 15.637 5 13.8565 5 12V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M12 19V23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M8 23H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "reflect",
    label: "You reflect.",
    description: "Look back on your journey",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover:scale-110">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export function BeginSection() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [isHovering, setIsHovering] = useState<string | null>(null)

  const handleSelect = (id: string) => {
    setSelectedOption(id)
  }

  return (
    <div className="animate-fade-in-delay-2">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            onMouseEnter={() => setIsHovering(option.id)}
            onMouseLeave={() => setIsHovering(null)}
            className={cn(
              "group relative px-6 py-3 rounded-full",
              "bg-card/90 backdrop-blur-sm",
              "border border-foreground/10",
              "shadow-sm hover:shadow-md",
              "transition-all duration-300 ease-out",
              "hover:scale-[1.02]",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-transparent",
              selectedOption === option.id && "ring-2 ring-primary/30 bg-card"
            )}
          >
            <div className="flex items-center gap-3">
              {/* Window dots */}
              <div className="window-dots">
                <div className="window-dot window-dot-red" style={{ width: 10, height: 10 }} />
                <div className="window-dot window-dot-gray" style={{ width: 10, height: 10 }} />
                <div className="window-dot window-dot-gray" style={{ width: 10, height: 10 }} />
              </div>
              <span className="font-medium text-foreground/80 tracking-wide uppercase text-sm">
                {option.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
