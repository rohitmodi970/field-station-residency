'use client';

import React, { useState } from 'react';
import AnimatedOrb from '../new/onboarding-steps/animated-orb';
import StepFrame from './StepFrame';
import { ObCard, ObInput, ObButton, ObSpinner } from './ui';
import {
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Globe,
  Github,
  Shield,
} from 'lucide-react';

interface SocialLinksState {
  linkedin: string;
  twitter: string;
  instagram: string;
  facebook: string;
  website: string;
  github: string;
}

interface SocialProfileLinkerProps {
  initialLinks?: Partial<SocialLinksState>;
  onContinue: (links: SocialLinksState, skipped: boolean) => void;
  onBack?: () => void;
}

export default function SocialProfileLinker({
  initialLinks,
  onContinue,
}: SocialProfileLinkerProps) {
  const [links, setLinks] = useState<SocialLinksState>({
    linkedin: initialLinks?.linkedin || '',
    twitter: initialLinks?.twitter || '',
    instagram: initialLinks?.instagram || '',
    facebook: initialLinks?.facebook || '',
    website: initialLinks?.website || '',
    github: initialLinks?.github || '',
  });

  React.useEffect(() => {
    if (initialLinks) {
      setLinks((prev) => ({
        linkedin: initialLinks.linkedin !== undefined ? initialLinks.linkedin : prev.linkedin,
        twitter: initialLinks.twitter !== undefined ? initialLinks.twitter : prev.twitter,
        instagram: initialLinks.instagram !== undefined ? initialLinks.instagram : prev.instagram,
        facebook: initialLinks.facebook !== undefined ? initialLinks.facebook : prev.facebook,
        website: initialLinks.website !== undefined ? initialLinks.website : prev.website,
        github: initialLinks.github !== undefined ? initialLinks.github : prev.github,
      }));
    }
  }, [initialLinks]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (platform: keyof SocialLinksState, value: string) => {
    setLinks((prev) => ({ ...prev, [platform]: value }));
  };

  const hasAnyLink = Object.values(links).some((val) => val.trim().length > 0);

  const handleSubmit = (skip: boolean) => {
    setIsSubmitting(true);
    onContinue(links, skip);
  };

  const rows: Array<{
    key: keyof SocialLinksState;
    label: string;
    hint: string;
    placeholder: string;
    type: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'linkedin',
      label: 'LinkedIn',
      hint: 'Work history & skills',
      placeholder: 'https://linkedin.com/in/username',
      type: 'url',
      icon: Linkedin,
    },
    {
      key: 'twitter',
      label: 'Twitter / X',
      hint: 'Public ideas & writing',
      placeholder: '@handle or profile URL',
      type: 'text',
      icon: Twitter,
    },
    {
      key: 'instagram',
      label: 'Instagram',
      hint: 'Visuals & personal bio',
      placeholder: '@handle or profile URL',
      type: 'text',
      icon: Instagram,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      hint: 'Public profile URL',
      placeholder: 'https://facebook.com/username',
      type: 'url',
      icon: Facebook,
    },
    {
      key: 'website',
      label: 'Personal Website / Substack',
      hint: 'Bio, blog & portfolio',
      placeholder: 'https://yourwebsite.com',
      type: 'url',
      icon: Globe,
    },
    {
      key: 'github',
      label: 'GitHub',
      hint: 'Open source & projects',
      placeholder: 'username or github.com/username',
      type: 'text',
      icon: Github,
    },
  ];

  return (
    <StepFrame width="md" align="center">
      <div className="flex flex-col items-center space-y-6">
        {/* Orb */}
        <div className="scale-75 -my-4">
          <AnimatedOrb />
        </div>

        {/* Title & Narrative */}
        <div className="space-y-2 max-w-md mx-auto">
          <p className="text-xs uppercase tracking-[0.16em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)]">
            Digital Footprint
          </p>
          <h1 className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
            Where can I find you?
          </h1>
          <p className="text-base leading-relaxed text-ob-ink-muted font-normal text-pretty font-[family-name:var(--font-ob-body)]">
            Before we talk, I can learn a lot from what you&apos;ve already put into the world.
          </p>
        </div>

        {/* One ObCard containing the 6 rows and privacy note */}
        <ObCard layer="surface" className="w-full space-y-4 text-left">
          <div className="space-y-4">
            {rows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-ob-ink flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5 text-ob-clay shrink-0" />
                      <span>{row.label}</span>
                    </label>
                    <span className="text-xs text-ob-ink-muted">{row.hint}</span>
                  </div>
                  <ObInput
                    type={row.type}
                    placeholder={row.placeholder}
                    value={links[row.key]}
                    onChange={(e) => handleInputChange(row.key, e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          {/* Privacy Note: Inset surface block with shield icon */}
          <div className="rounded-2xl bg-ob-raised border border-ob-border p-4 flex items-start gap-2.5 mt-2">
            <Shield className="w-4 h-4 text-ob-clay shrink-0 mt-0.5" />
            <p className="text-xs text-ob-ink-muted leading-relaxed font-[family-name:var(--font-ob-body)]">
              Force only reads public info. You&apos;ll see every discovery in the feed and can remove anything before it enters your model.
            </p>
          </div>
        </ObCard>

        {/* Action Controls */}
        <div className="flex items-center justify-between w-full pt-1">
          <ObButton
            variant="link"
            onClick={() => handleSubmit(true)}
          >
            Skip this step
          </ObButton>

          <ObButton
            variant="primary"
            disabled={isSubmitting}
            onClick={() => handleSubmit(false)}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <ObSpinner size="sm" />
                <span>Saving...</span>
              </span>
            ) : (
              <>
                <span>{hasAnyLink ? 'Connect & Continue' : 'Continue'}</span>
                <span>→</span>
              </>
            )}
          </ObButton>
        </div>
      </div>
    </StepFrame>
  );
}
