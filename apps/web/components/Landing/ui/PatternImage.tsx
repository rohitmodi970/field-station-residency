import React from "react";

export interface PatternImageProps {
  src: string;
  alt?: string;
  // pass Tailwind-style utility classes for sizing & position, e.g. "absolute left-[68px] top-[81px] w-[42.5px] h-[66.7px]"
  positionClass: string;
  roundedClass?: string; // e.g. "rounded-[2.51px]"
}

/**
 * NOTE: We avoid inline style attributes and expect the caller to provide Tailwind arbitrary classes
 * for width/height/position (left/top). Example: positionClass="absolute left-[68px] top-[81px] w-[42.514px] h-[66.702px]"
 *
 * Asset optimization: export images as WebP (lossy or lossless for illustrations) at 2x for retina and use
 * small blurred placeholder (LQIP) if needed.
 */
export default function PatternImage({ src, alt = "pattern", positionClass, roundedClass = "rounded-sm" }: PatternImageProps) {
  return (
    <div className={`${positionClass} overflow-hidden ${roundedClass} bg-gray-50`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover block"
        // Allow assistive tech to skip decorative items if alt is empty in specific use-cases
      />
    </div>
  );
}

/* Usage:
<PatternImage
  src="/landing/discover_yourself/morning_run.png"
  positionClass="absolute left-[68px] top-[81px] w-[42.514px] h-[66.702px]"
  roundedClass="rounded-[1.572px]"
/>
*/
