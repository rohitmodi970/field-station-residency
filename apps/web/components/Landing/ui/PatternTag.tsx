import React from "react";

export interface PatternTagProps {
  text: string;
  // pass Tailwind-style position class like "absolute left-[144px] top-[114px]"
  positionClass: string;
}

export default function PatternTag({ text, positionClass }: PatternTagProps) {
  return (
    <p
      className={`${positionClass} font-terminal-grotesque text-[12px] tracking-[-0.48px] text-black select-none`}
      aria-hidden={false}
    >
      {text}
    </p>
  );
}

/* Usage:
<PatternTag text="morning run" positionClass="absolute left-[144px] top-[114px]" />
*/
