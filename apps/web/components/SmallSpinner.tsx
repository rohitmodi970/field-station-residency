"use client";

import React from 'react';

const SmallSpinner: React.FC<{ size?: number }> = ({ size = 14 }) => {
  return (
    <svg
      className="animate-spin ml-1"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};

export default SmallSpinner;
