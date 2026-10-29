"use client"

export function ForceLogo() {
  return (
    <div className="flex items-center gap-3">
      {/* Dragonfly icon - matching the Force brand */}
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 40 40" 
        fill="none" 
        className="text-primary"
      >
        {/* Body */}
        <ellipse cx="20" cy="22" rx="2" ry="10" fill="currentColor" />
        {/* Head */}
        <circle cx="20" cy="10" r="3" fill="currentColor" />
        {/* Left wings */}
        <ellipse cx="12" cy="16" rx="8" ry="4" fill="currentColor" fillOpacity="0.7" transform="rotate(-20 12 16)" />
        <ellipse cx="10" cy="22" rx="7" ry="3" fill="currentColor" fillOpacity="0.5" transform="rotate(-10 10 22)" />
        {/* Right wings */}
        <ellipse cx="28" cy="16" rx="8" ry="4" fill="currentColor" fillOpacity="0.7" transform="rotate(20 28 16)" />
        <ellipse cx="30" cy="22" rx="7" ry="3" fill="currentColor" fillOpacity="0.5" transform="rotate(10 30 22)" />
      </svg>
    </div>
  )
}
