"use client"

import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRouter } from 'next/navigation'
import { buildJournalNewUrl, setJournalPromptContext } from '@/lib/journal/new-entry-navigation'

export function PromptCard() {
  const router = useRouter()
  const promptText = 'What would it feel like to trust yourself a little more today?'
  const promptExplanation = "Your entries suggest you've been questioning your instincts lately. This is a moment to reconnect."

  const handleStartWriting = () => {
    setJournalPromptContext({ text: promptText, explanation: promptExplanation })
    router.push(buildJournalNewUrl({ source: 'dashboard_prompt' }))
  }

  return (
    <div className="w-full max-w-xl mx-auto animate-fade-in-delay-2">
      <div
        className={cn(
          "relative bg-card/70 backdrop-blur-sm",
          "border border-foreground/5",
          "rounded-2xl overflow-hidden",
          "transition-all duration-300",
          "hover:shadow-lg hover:bg-card/85",
          "group cursor-pointer"
        )}
        onClick={handleStartWriting}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleStartWriting()}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-foreground/5">
          <div className="window-dots">
            <div className="window-dot window-dot-red" style={{ width: 10, height: 10 }} />
            <div className="window-dot window-dot-gray" style={{ width: 10, height: 10 }} />
            <div className="window-dot window-dot-gray" style={{ width: 10, height: 10 }} />
          </div>
          <span className="flex-1 text-center text-xs text-foreground/40 font-medium uppercase tracking-wider">
            {"Today's Prompt"}
          </span>
          <div className="w-12" />
        </div>

        <div className="p-6 space-y-4">
          <p className="font-serif text-xl md:text-2xl text-foreground/80 leading-relaxed">
            {promptText}
          </p>

          <p className="text-sm text-foreground/50 leading-relaxed">
            {promptExplanation}
          </p>

          <div className="pt-2">
            <button
              className="flex items-center gap-2 text-sm font-medium text-primary/80 hover:text-primary transition-colors group-hover:gap-3"
              onClick={(e) => {
                e.stopPropagation()
                handleStartWriting()
              }}
            >
              Start expressing
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
