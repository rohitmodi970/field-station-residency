"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
  DialogClose,
  DialogTitle,
} from "@/components/ui/dialog";
import SnapStart from "@/components/ui/WaitListForm/snapStart2";
import { X } from "lucide-react";
import { Libre_Baskerville } from "next/font/google";

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-libre-baskerville",
});
// Define the main pillars of the application
const pillars = [
  {
    title: "Capture",
    summary: "Write, speak, or upload moments before they turn into noise.",
    detail:
      "Force gives your mind a soft landing zone. You can empty mental tabs quickly, then return later with clarity.",
    tone: "from-[#f4d5c5] via-[#f7e5d6] to-[#faf1e9]",
  },
  {
    title: "Decode",
    summary: "Spot patterns in emotion, context, and momentum with AI support.",
    detail:
      "Instead of generic dashboards, you get interpretable signals that connect what you feel, what happened, and what to do next.",
    tone: "from-[#c8e2d8] via-[#dceee6] to-[#eef7f3]",
  },
  {
    title: "Integrate",
    summary: "Turn insight into gentle, repeatable action.",
    detail:
      "You are not chasing perfect routines. You are building micro-shifts that compound into a calmer, stronger baseline.",
    tone: "from-[#ead5cd] via-[#f2e4dd] to-[#f8f0eb]",
  },
];

const steps = [
  {
    number: "01",
    title: "Unload",
    body: "Drop your thoughts into text, voice, or image without overthinking structure.",
  },
  {
    number: "02",
    title: "Understand",
    body: "Review emotional patterns, triggers, and trends in a clear visual flow.",
  },
  {
    number: "03",
    title: "Act",
    body: "Apply small guided actions so insight becomes behavior, not just information.",
  },
];

export default function LandingPage() {
  const [expandedPillar, setExpandedPillar] = useState<number | null>(null);

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden ${libreBaskerville.variable} font-serif text-[#3f2c24]`}
      style={{
        background:
          "radial-gradient(circle at 16% 8%, rgba(236,188,170,0.22), transparent 34%), radial-gradient(circle at 84% 6%, rgba(178,214,203,0.24), transparent 32%), linear-gradient(165deg, #fffaf6 0%, #f9f0e7 46%, #f4e8dd 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-14 top-8 h-64 w-64 rounded-full bg-[#eac4b3]/30 blur-3xl" />
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-[#bcded2]/25 blur-3xl" />
        <div className="absolute bottom-12 left-1/3 h-72 w-72 rounded-full bg-[#e5d0c3]/24 blur-3xl" />
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(122,92,77,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(122,92,77,0.08) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(circle at 50% 35%, black 30%, transparent 85%)",
          }}
        />
      </div>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative overflow-hidden rounded-[34px] border border-[#d9c0b4]/60 bg-[#fff9f4]/92 p-6 shadow-[0_18px_42px_rgba(104,67,48,0.14)] backdrop-blur-xl sm:p-8"
        >
          <div className="absolute -left-16 bottom-2 h-24 w-56 rounded-full bg-[#e5c8b7]/28 blur-2xl" />
          <div className="absolute right-8 top-6 h-20 w-48 rounded-full bg-[#c7dfd6]/24 blur-2xl" />

          <div className="inline-flex items-center rounded-full border border-[#c9a89a]/55 bg-[#f8e6db]/88 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#7e564b]">
            Private Beta
          </div>

          <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <h1 className="text-[40px] leading-[0.95] tracking-[0.02em] text-[#3f2c24] sm:text-[54px]">
                Your thoughts shape your world.
                <span className="block text-[#6f4c43]">Build it with intention.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#6b4f44] sm:text-lg">
                Force is an AI reflection workspace that helps you clear mental clutter, decode emotional patterns, and turn awareness into action.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:flex-col">
              <Dialog>
                <DialogTrigger asChild>
                  <motion.button
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-2xl bg-[#b45476] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(116,58,81,0.26)] transition-colors hover:bg-[#9c4968]"
                  >
                    Join Waitlist
                  </motion.button>
                </DialogTrigger>
                <DialogPortal>
                  <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
                  <DialogContent className="fixed inset-0 m-0 h-full w-full max-w-none rounded-none border-0 bg-white p-0 dark:bg-gray-900">
                    <DialogTitle className="sr-only">Join Waitlist</DialogTitle>
                    <DialogClose className="absolute right-4 top-4 z-50 rounded-full bg-gray-100 p-2 opacity-80 transition-opacity hover:opacity-100 dark:bg-gray-800">
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close</span>
                    </DialogClose>
                    <div className="h-full w-full overflow-auto">
                      <SnapStart />
                    </div>
                  </DialogContent>
                </DialogPortal>
              </Dialog>

              <Link
                href="/login"
                className="rounded-2xl border border-[#cbb3a7] bg-[#fffdfa] px-6 py-3 text-center text-sm font-semibold text-[#6b4a41] transition-colors hover:bg-[#f6ece4]"
              >
                Log In
              </Link>
            </div>
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-[#d6c2b7]/65 bg-[#fffdfa]/92 p-4">
            <Image
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo%205-WLJE5RDwPFYhDNKeJ95PCiz8xy7aWV.png"
              alt="Force Logo"
              width={48}
              height={48}
              className="h-12 w-12"
            />
            <p className="text-sm leading-relaxed text-[#6a4d43]">
              Created for people who want depth over dopamine loops.
            </p>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {pillars.map((pillar, index) => {
            const isExpanded = expandedPillar === index;
            return (
              <article
                key={pillar.title}
                className={`rounded-[26px] border border-[#d6beb3]/60 bg-gradient-to-br ${pillar.tone} p-5 shadow-[0_12px_26px_rgba(96,65,45,0.11)]`}
              >
                <p className="text-[11px] uppercase tracking-[0.1em] text-[#765046]">{pillar.title}</p>
                <h2 className="mt-2 text-lg font-semibold text-[#3e2a23]">{pillar.summary}</h2>
                <p className={`mt-3 text-sm leading-relaxed text-[#654a41] ${!isExpanded ? "line-clamp-3" : ""}`}>
                  {pillar.detail}
                </p>
                <button
                  onClick={() => setExpandedPillar(isExpanded ? null : index)}
                  className="mt-3 text-xs font-semibold text-[#6c4c42] hover:text-[#503730]"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              </article>
            );
          })}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.5 }}
          className="mt-8 rounded-[30px] border border-[#d8c2b5]/60 bg-[#fff8f2]/90 p-5 shadow-[0_14px_32px_rgba(95,70,52,0.1)]"
        >
          <h3 className="text-2xl text-[#3f2c24]">How Force Works</h3>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-2xl border border-[#d9c8bd]/60 bg-[#fffdfb] p-4"
              >
                <div className="inline-flex rounded-full border border-[#cfaea0] bg-[#f9e8de] px-2.5 py-1 text-xs font-semibold text-[#7a5146]">
                  {step.number}
                </div>
                <h4 className="mt-3 text-lg font-semibold text-[#3e2a23]">{step.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-[#654a41]">{step.body}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-8 rounded-[30px] border border-[#d8c2b5]/60 bg-[#fff8f2]/90 p-6 shadow-[0_14px_32px_rgba(95,70,52,0.1)]"
        >
          <h3 className="text-2xl text-[#3f2c24]">A More Honest Growth Model</h3>
          <p className="mt-3 text-base leading-relaxed text-[#674b42]">
            Force is not a hype machine. It is a focused system for people willing to show up consistently. You bring your reality. Force helps you see it clearly and respond with intention.
          </p>
          <AnimatePresence mode="wait">
            <motion.blockquote
              key="quote"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 rounded-2xl border border-[#d5c0b4] bg-[#fffdfa] p-4 text-lg italic text-[#5d4138]"
            >
              "Depth over distraction. Pattern over panic. Action over rumination."
            </motion.blockquote>
          </AnimatePresence>
        </motion.section>

        <footer className="mt-10 rounded-[24px] border border-[#d8c3b7]/60 bg-[#fff9f5]/90 px-5 py-6 text-center">
          <p className="text-sm text-[#6d5248]">(c) {new Date().getFullYear()} Force. All rights reserved.</p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm">
            <Link href="/terms-and-conditions" className="text-[#84584e] hover:underline">
              Terms and Conditions
            </Link>
            <span className="text-[#b59d92]">|</span>
            <Link href="/privacy-policy" className="text-[#84584e] hover:underline">
              Privacy Policy
            </Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
