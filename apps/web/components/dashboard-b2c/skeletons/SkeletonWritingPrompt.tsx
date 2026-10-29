/**
 * Skeleton component for Writing Prompt Hero
 * Matches WritingPromptHero layout with animated placeholder
 */

export function SkeletonWritingPrompt() {
  return (
    <div className="relative overflow-hidden space-y-4 rounded-2xl border border-[#e8cfc3]/60 bg-white/12 backdrop-blur-sm p-6">
      <style jsx>{`
        @keyframes shimmerSlide {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .skeleton-shimmer {
          background-size: 200% 100%;
          animation: shimmerSlide 1.9s linear infinite;
        }
      `}</style>

      {/* Main prompt text skeleton */}
      <div className="space-y-3">
        <div className="skeleton-shimmer h-6 w-3/4 rounded-lg bg-linear-to-r from-[#fff2ea] via-[#ffd6c4] to-transparent" />
        <div className="skeleton-shimmer h-4 w-full rounded-lg bg-linear-to-r from-[#fff6f0] via-[#ffe6d9] to-transparent" />
        <div className="skeleton-shimmer h-4 w-5/6 rounded-lg bg-linear-to-r from-[#fff6f0] via-[#ffdcc8] to-transparent" />
      </div>

      {/* Suggestion chips skeleton */}
      <div className="pt-4 space-y-2">
        <div className="skeleton-shimmer h-3 w-1/4 rounded-full bg-linear-to-r from-[#fff2ea] via-[#ffd6c4] to-transparent" />
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton-shimmer h-8 w-24 rounded-full bg-linear-to-r from-[#fff3eb] via-[#ffd9c6] to-transparent"
              style={{ animationDelay: `${i * 120}ms` }}
            />
          ))}
        </div>
      </div>

      {/* CTA button skeleton */}
      <div className="skeleton-shimmer mt-4 h-10 w-32 rounded-lg bg-linear-to-r from-[#fff2ea] via-[#ffd6c4] to-transparent" />
    </div>
  );
}
