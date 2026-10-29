"use client";
import React from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button2";
import { useRouter } from "next/navigation";

type Props = {
  embedded?: boolean;
};

export const JournalCover: React.FC<Props> = ({ embedded = false }) => {
  const router = useRouter();

  const containerClass = embedded
    ? 'relative w-full flex items-center justify-center p-4'
    : 'relative min-h-screen flex items-center justify-center p-8 overflow-hidden bg-gradient-warm';

  const buttonClass = embedded
    ? 'relative self-start mb-2 gap-2 glass-effect text-white hover:bg-white/20 z-10'
    : 'absolute top-6 right-6 gap-2 glass-effect text-white hover:bg-white/20 z-10';

  const cardWrapperClass = embedded
    ? 'relative w-full max-w-sm aspect-[3/4] animate-fade-in'
    : 'relative w-full max-w-md aspect-[3/4] animate-fade-in';

  const coverOffsetClass = embedded ? 'left-4' : 'left-8';

  return (
    <div className={containerClass}>
      {/* Dictionary Navigation Button */}
      <Button
        onClick={() => router.push('/new/dictionary')}
        variant="ghost"
        className={buttonClass}
      >
        <BookOpen className="h-4 w-4" />
        My Vocabulary
      </Button>

      {/* Main journal card with glassmorphism */}
      <div className={cardWrapperClass}>
        {/* 3D Book Effect - Spine/Binding with glass */}
        <div className={`absolute left-0 top-0 bottom-0 w-12 glass-heavy rounded-l-3xl shadow-2xl border-r-0 bg-gradient-warm`} />
        
        {/* Main book cover with liquid glass effect */}
        <div className={`absolute inset-0 ${coverOffsetClass} glass-heavy bg-gradient-glass rounded-r-3xl overflow-hidden group transition-all duration-500 hover:scale-[1.02]`}>
          {/* Centered text */}
          <div className="absolute inset-0 flex items-center justify-center p-12">
            <h1 className={`font-serif-display ${embedded ? 'text-2xl' : 'text-5xl'} font-light text-white tracking-wide text-center leading-tight drop-shadow-lg`}>
              write here to find your force
            </h1>
          </div>
          
          {/* Subtle shimmer overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          {/* Inner glow border effect */}
          <div className="absolute inset-0 rounded-r-3xl ring-1 ring-inset ring-white/30 pointer-events-none" />
        </div>
        
        {/* Ambient shadow for depth */}
        <div className={`absolute inset-0 ${coverOffsetClass} rounded-r-3xl shadow-[0_35px_90px_rgba(0,0,0,0.2)]`} />
      </div>
    </div>
  );
};
