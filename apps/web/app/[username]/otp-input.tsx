'use client';

import { forwardRef } from 'react';

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/quilted-gallery/ui/input-otp';

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
};

const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(({ value, onChange }, ref) => {
  return (
    <InputOTP
      ref={ref}
      value={value}
      onChange={onChange}
      maxLength={6}
      inputMode="numeric"
      autoComplete="one-time-code"
      containerClassName="justify-center"
      className="disabled:cursor-not-allowed"
    >
      <InputOTPGroup className="gap-2 md:gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="h-12 w-10 rounded-2xl border border-[#d9c6b1] bg-white/80 text-lg font-medium text-[#2f2b26] shadow-[0_10px_24px_-18px_rgba(81,57,36,0.55)] transition-all focus-within:border-[#9d6f43] md:h-14 md:w-12"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
});

OtpInput.displayName = 'OtpInput';

export default OtpInput;