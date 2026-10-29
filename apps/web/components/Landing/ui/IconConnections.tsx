import React from "react";

export interface IconConnectionsProps {
  positionClass?: string;
  className?: string;
}

/**
 * SVG connection lines for the pattern analysis visualization.
 * Uses the provided path that creates interconnected lines between pattern elements.
 */
export default function IconConnections({ 
  positionClass = "", 
  className = "" 
}: IconConnectionsProps) {
  return (
    <svg
      className={`${positionClass} pointer-events-none ${className}`}
      viewBox="0 0 169 108"
      fill="none"
      role="img"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path 
        d="M1.09375 13.5254L52.0938 60.0254L167.594 10.0254L125.594 107.025L77.0938 60.0254L37.5938 95.0254L158.594 52.0254L77.0938 0.525391L1.09375 13.5254Z" 
        stroke="#C9C9C9"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}