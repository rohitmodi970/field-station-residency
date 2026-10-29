"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Mic, PenLine, HelpCircle, X, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type Mode = "idle" | "options" | "reflecting" | "prompted" | "speaking" | "writing"

const personalizedPrompts = [
  {
    observation: "You've been thinking a lot about self-trust lately.",
    question: "What would trusting yourself look like today?",
  },
  {
    observation: "There's been a quiet shift in how you talk about your days.",
    question: "What's changing inside you?",
  },
  {
    observation: "You've mentioned feeling stuck more than once recently.",
    question: "What would unstuck feel like?",
  },
]

export function LivingOrb() {
  const [mode, setMode] = useState<Mode>("idle")
  const [isListening, setIsListening] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [text, setText] = useState("")
  const [currentPrompt] = useState(personalizedPrompts[0] || { observation: "", question: "" })
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>(0)

  const handleOrbClick = () => {
    if (mode === "idle") {
      setMode("options")
    }
  }

  const handleClose = () => {
    setMode("idle")
    setIsListening(false)
    setText("")
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
  }

  const handleDontKnow = () => {
    setMode("reflecting")
    // After 3 seconds, show the personalized prompt
    setTimeout(() => {
      setMode("prompted")
    }, 3000)
  }

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)

      const updateLevel = () => {
        if (analyserRef.current && isListening) {
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average / 255)
          animationFrameRef.current = requestAnimationFrame(updateLevel)
        }
      }

      setIsListening(true)
      updateLevel()
    } catch {
      console.log("Microphone access denied")
    }
  }, [isListening])

  const handleSpeak = () => {
    setMode("speaking")
    startListening()
  }

  const handleWrite = () => {
    setMode("writing")
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  const isOrbSlowed = mode === "reflecting" || mode === "prompted"

  return (
    <div className="relative flex flex-col items-center justify-center min-h-[55vh] md:min-h-[60vh]">
      {/* Background dim when active */}
      <div
        className={cn(
          "fixed inset-0 transition-all duration-1000 z-0",
          mode === "reflecting" || mode === "prompted"
            ? "bg-foreground/3 backdrop-blur-[2px] opacity-100"
            : mode !== "idle"
            ? "bg-foreground/5 backdrop-blur-sm opacity-100"
            : "opacity-0 pointer-events-none"
        )}
        onClick={handleClose}
      />

      {/* The Living Orb */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Close button */}
        {mode !== "idle" && (
          <button
            onClick={handleClose}
            className="absolute -top-16 right-1/2 translate-x-1/2 p-2 rounded-full bg-card/80 backdrop-blur-sm border border-foreground/10 text-foreground/50 hover:text-foreground/80 transition-all duration-300 hover:scale-110"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Orb container */}
        <div
          onClick={handleOrbClick}
          className={cn(
            "relative cursor-pointer transition-all duration-700 ease-out",
            mode === "idle" && "hover:scale-105",
            mode === "speaking" && "scale-125",
            isOrbSlowed && "scale-95"
          )}
        >
          {/* Outer glow */}
          <div
            className={cn(
              "absolute inset-0 rounded-full transition-all duration-1000",
              mode === "speaking" ? "orb-glow-speaking" : "orb-glow",
              isOrbSlowed && "opacity-60"
            )}
            style={{
              transform: mode === "speaking" ? `scale(${1 + audioLevel * 0.3})` : "scale(1)",
            }}
          />

          {/* Inner orb with gradient */}
          <div
            className={cn(
              "relative w-40 h-40 md:w-52 md:h-52 rounded-full transition-all duration-1000",
              isOrbSlowed ? "orb-gradient-calm" : mode === "speaking" ? "orb-gradient-active" : "orb-gradient"
            )}
            style={{
              transform: mode === "speaking" ? `scale(${1 + audioLevel * 0.15})` : "scale(1)",
              animationDuration: isOrbSlowed ? "8s" : "4s",
            }}
          >
            {/* Inner shimmer */}
            <div className={cn(
              "absolute inset-4 rounded-full orb-shimmer transition-opacity duration-1000",
              isOrbSlowed ? "opacity-30 animate-orb-shimmer-slow" : "animate-orb-shimmer"
            )} />

            {/* Center highlight */}
            <div className="absolute inset-8 rounded-full bg-white/20 blur-xl" />
          </div>

          {/* Floating particles around orb */}
          <div className={cn(
            "absolute inset-0 pointer-events-none",
            isOrbSlowed ? "animate-spin-very-slow" : "animate-spin-slow"
          )}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "absolute w-2 h-2 rounded-full blur-sm transition-all duration-1000",
                  isOrbSlowed ? "bg-white/20" : "bg-white/40"
                )}
                style={{
                  top: "50%",
                  left: "50%",
                  transform: `rotate(${i * 60}deg) translateX(${mode === "speaking" ? 120 + audioLevel * 20 : isOrbSlowed ? 90 : 100}px) translateY(-50%)`,
                }}
              />
            ))}
          </div>
        </div>

        {/* Text prompts */}
        <div className="mt-8 text-center max-w-md px-4">
          {mode === "idle" && (
            <p className="font-serif text-xl md:text-2xl text-foreground/60 animate-fade-in leading-relaxed">
              You don't have to know where to begin.
            </p>
          )}

          {mode === "options" && (
            <div className="space-y-4 animate-fade-in">
              <p className="font-serif text-lg text-foreground/50 mb-6">
                How would you like to start?
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleSpeak}
                  className="group flex items-center gap-3 px-6 py-3 bg-card/90 backdrop-blur-sm rounded-full border border-foreground/10 hover:border-foreground/20 hover:bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="window-dots">
                    <div className="window-dot window-dot-red" />
                    <div className="window-dot window-dot-gray" />
                    <div className="window-dot window-dot-gray" />
                  </div>
                  <span className="font-medium text-foreground/80 group-hover:text-foreground">Speak it out</span>
                  <Mic className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
                </button>

                <button
                  onClick={handleWrite}
                  className="group flex items-center gap-3 px-6 py-3 bg-card/90 backdrop-blur-sm rounded-full border border-foreground/10 hover:border-foreground/20 hover:bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="window-dots">
                    <div className="window-dot window-dot-red" />
                    <div className="window-dot window-dot-gray" />
                    <div className="window-dot window-dot-gray" />
                  </div>
                  <span className="font-medium text-foreground/80 group-hover:text-foreground">Write it down</span>
                  <PenLine className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
                </button>

                <button
                  onClick={handleDontKnow}
                  className="group flex items-center gap-3 px-6 py-3 bg-card/90 backdrop-blur-sm rounded-full border border-foreground/10 hover:border-foreground/20 hover:bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="window-dots">
                    <div className="window-dot window-dot-red" />
                    <div className="window-dot window-dot-gray" />
                    <div className="window-dot window-dot-gray" />
                  </div>
                  <span className="font-medium text-foreground/80 group-hover:text-foreground">{"I don't know yet"}</span>
                  <HelpCircle className="w-4 h-4 text-foreground/40 group-hover:text-primary transition-colors" />
                </button>
              </div>
            </div>
          )}

          {mode === "reflecting" && (
            <div className="animate-fade-in space-y-2">
              <p className="font-serif text-xl md:text-2xl text-foreground/70 leading-relaxed">
                {"That's okay."}
              </p>
              <p className="font-serif text-lg text-foreground/50">
                {"Let's just sit for a second."}
              </p>
            </div>
          )}

          {mode === "prompted" && currentPrompt && (
            <div className="animate-fade-in space-y-6">
              <div className="space-y-3">
                <p className="text-sm text-foreground/40 uppercase tracking-wider">
                  From your recent entries
                </p>
                <p className="font-serif text-lg text-foreground/60 leading-relaxed">
                  {currentPrompt.observation}
                </p>
                <p className="font-serif text-xl md:text-2xl text-foreground/80 leading-relaxed">
                  {currentPrompt.question}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={handleWrite}
                  className="group flex items-center gap-3 px-5 py-2.5 bg-card/90 backdrop-blur-sm rounded-full border border-foreground/10 hover:border-foreground/20 hover:bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground">Write a few words</span>
                  <PenLine className="w-3.5 h-3.5 text-foreground/40 group-hover:text-primary transition-colors" />
                </button>

                <button
                  onClick={handleSpeak}
                  className="group flex items-center gap-3 px-5 py-2.5 bg-card/90 backdrop-blur-sm rounded-full border border-foreground/10 hover:border-foreground/20 hover:bg-card transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <span className="text-sm font-medium text-foreground/70 group-hover:text-foreground">Say it out loud</span>
                  <Mic className="w-3.5 h-3.5 text-foreground/40 group-hover:text-primary transition-colors" />
                </button>
              </div>
            </div>
          )}

          {mode === "speaking" && (
            <div className="animate-fade-in space-y-4">
              <p className="font-serif text-2xl md:text-3xl text-foreground/80">
                Say anything. I'm listening.
              </p>
              <p className="text-sm text-foreground/50">
                Take your time. There's no rush.
              </p>

              {/* Audio visualization bars */}
              <div className="flex items-center justify-center gap-1 h-12 mt-6">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-primary/60 rounded-full transition-all duration-100"
                    style={{
                      height: `${Math.max(8, audioLevel * 48 * Math.sin((i + Date.now() / 200) * 0.5) + 24)}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === "writing" && (
            <div className="animate-fade-in w-full max-w-lg">
              <div className="bg-card/90 backdrop-blur-sm rounded-2xl border border-foreground/10 p-1 shadow-xl">
                {/* Window header */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/5">
                  <div className="window-dots">
                    <div className="window-dot window-dot-red" />
                    <div className="window-dot window-dot-gray" />
                    <div className="window-dot window-dot-gray" />
                  </div>
                  <span className="text-xs text-foreground/40 ml-2">Write freely. No one else will see this.</span>
                </div>

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Begin anywhere..."
                  className="w-full min-h-[200px] p-4 bg-transparent text-foreground/90 placeholder:text-foreground/30 font-serif text-lg leading-relaxed resize-none focus:outline-none"
                />

                {text.length > 0 && (
                  <div className="flex justify-end px-4 pb-4">
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
