"use client"

import { useEffect, useState } from "react"

interface HeroSectionProps {
  userName?: string
}

const greetings = [
  "Your mind is a world of its own.",
  "A calm space awaits you.",
  "Return to yourself.",
  "This is your sanctuary.",
  "Let's slow down together.",
]

export function HeroSection({ userName = "there" }: HeroSectionProps) {
  const [greeting, setGreeting] = useState(greetings[0])
  const [timeOfDay, setTimeOfDay] = useState("")

  useEffect(() => {
    // Select a random greeting
    const randomIndex = Math.floor(Math.random() * greetings.length)
    setGreeting(greetings[randomIndex])

    // Set time-based context
    const hour = new Date().getHours()
    if (hour < 12) {
      setTimeOfDay("morning")
    } else if (hour < 17) {
      setTimeOfDay("afternoon")
    } else {
      setTimeOfDay("evening")
    }
  }, [])

  return (
    <div className="animate-fade-in">
      {/* Card with window controls - Force style */}
      <div className="relative bg-card/85 backdrop-blur-sm rounded-2xl border border-foreground/5 shadow-lg overflow-hidden">
        {/* Window controls bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-foreground/5">
          <div className="window-dots">
            <div className="window-dot window-dot-red" />
            <div className="window-dot window-dot-gray" />
            <div className="window-dot window-dot-gray" />
          </div>
          <span className="flex-1 text-center text-sm text-foreground/50 font-medium">
            Welcome back
          </span>
          <div className="w-[60px]" /> {/* Spacer for centering */}
        </div>

        {/* Content */}
        <div className="px-8 py-10 md:px-12 md:py-14 text-center">
          <p className="text-sm text-foreground/50 mb-4 animate-fade-in-delay-1">
            Good {timeOfDay}, {userName}
          </p>
          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl text-foreground/90 leading-tight text-balance animate-fade-in-delay-2">
            {greeting}
          </h1>
          <p className="mt-6 text-foreground/60 text-base md:text-lg max-w-md mx-auto animate-fade-in-delay-3">
            A calm, intelligent space to write, think, and understand yourself without noise or pressure.
          </p>
        </div>
      </div>
    </div>
  )
}
