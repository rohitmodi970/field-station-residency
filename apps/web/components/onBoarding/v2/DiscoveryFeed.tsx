'use client';

import React, { useState } from 'react';
import AnimatedOrb from '../new/onboarding-steps/animated-orb';
import StepFrame from './StepFrame';
import { ObCard, ObButton, ObBadge, ObSkeleton } from './ui';
import {
  Linkedin,
  Twitter,
  Instagram,
  Facebook,
  Globe,
  Github,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';

export interface DiscoveryItem {
  id: string;
  platform: string;
  title: string;
  summary: string;
  url?: string;
  badgeLabel: string;
  removed?: boolean;
}

interface DiscoveryFeedProps {
  discoveries: DiscoveryItem[];
  isLoading: boolean;
  onRemoveItem: (id: string) => void;
  onContinue: () => void;
  categoryLabel?: string;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

function getPlatformIcon(platform: string) {
  const p = (platform || '').toLowerCase();
  if (p.includes('linkedin')) return Linkedin;
  if (p.includes('twitter') || p.includes('x')) return Twitter;
  if (p.includes('github')) return Github;
  if (p.includes('instagram')) return Instagram;
  if (p.includes('facebook')) return Facebook;
  return Globe;
}

function formatDomain(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return urlStr.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || urlStr;
  }
}

export default function DiscoveryFeed({
  discoveries,
  isLoading,
  onRemoveItem,
  onContinue,
  categoryLabel,
  title,
  subtitle,
  emptyTitle,
  emptyDescription,
}: DiscoveryFeedProps) {
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const handleToggleRemove = (id: string) => {
    if (removedIds.includes(id)) {
      setRemovedIds((prev) => prev.filter((i) => i !== id));
    } else {
      setRemovedIds((prev) => [...prev, id]);
      onRemoveItem(id);
    }
  };

  return (
    <StepFrame width="lg" align="left">
      <div className="flex flex-col items-start space-y-7 w-full">
        {/* Orb */}
        <div className="scale-75 -my-4 self-start">
          <AnimatedOrb />
        </div>

        {/* Title & Narrative */}
        <div className="space-y-2 max-w-xl text-left">
          <p className="text-xs uppercase tracking-[0.16em] text-ob-clay-strong font-semibold font-[family-name:var(--font-ob-body)]">
            {categoryLabel || 'Semantic Discovery'}
          </p>
          <h1 className="text-4xl md:text-5xl font-[500] tracking-normal leading-[1.1] text-balance text-ob-ink font-[family-name:var(--font-ob-display)]">
            {isLoading ? 'Searching the public web...' : (title || "Here's what I found from your links")}
          </h1>
          <p className="text-base leading-relaxed text-ob-ink-muted font-normal text-pretty font-[family-name:var(--font-ob-body)]">
            {isLoading
              ? 'Running semantic searches across public portfolios, writings, and career data.'
              : (subtitle || 'You can remove anything that feels stale or inaccurate before it enters your model.')}
          </p>
        </div>

        {/* Discovery Feed Region */}
        <div
          aria-live="polite"
          className="w-full space-y-3.5 max-h-[440px] overflow-y-auto pr-1"
        >
          {/* Empty State (User skipped everything or no public footprints found) */}
          {discoveries.length === 0 && !isLoading && (
            <ObCard layer="surface" className="p-8 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-ob-raised border border-ob-border flex items-center justify-center mx-auto text-xl text-ob-clay">
                ✨
              </div>
              <div className="space-y-1.5">
                <h2 className="text-lg font-medium text-ob-ink font-[family-name:var(--font-ob-body)]">
                  {emptyTitle || 'Starting fresh with zero public signal'}
                </h2>
                <p className="text-sm text-ob-ink-muted font-normal leading-relaxed font-[family-name:var(--font-ob-body)]">
                  {emptyDescription || "No public links were imported. We'll craft your model purely from your genuine conversational answers."}
                </p>
              </div>
              <div className="pt-2">
                <ObButton variant="primary" onClick={onContinue} className="w-full sm:w-auto">
                  <span>Continue to Reflection</span>
                  <span>→</span>
                </ObButton>
              </div>
            </ObCard>
          )}

          {/* Loading Skeletons matching the final card layout */}
          {isLoading && discoveries.length === 0 && (
            <div className="space-y-3.5 w-full">
              {[1, 2, 3].map((i) => (
                <ObCard key={i} layer="raised" className="p-5 space-y-3">
                  <div className="flex items-start gap-3.5">
                    <ObSkeleton className="w-10 h-10 rounded-xl shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <ObSkeleton className="h-5 w-20 rounded-full" />
                        <ObSkeleton className="h-5 w-44 rounded-md" />
                      </div>
                      <ObSkeleton className="h-4 w-full rounded" />
                      <ObSkeleton className="h-4 w-4/5 rounded" />
                      <ObSkeleton className="h-3 w-28 rounded mt-1" />
                    </div>
                  </div>
                </ObCard>
              ))}
            </div>
          )}

          {/* Real Discoveries Feed with Staggered Entrance */}
          {discoveries.map((item, idx) => {
            const isRemoved = removedIds.includes(item.id);
            const PlatformIcon = getPlatformIcon(item.platform || item.badgeLabel);

            return (
              <ObCard
                key={item.id}
                layer="raised"
                style={{ animationDelay: `${idx * 60}ms` }}
                className={[
                  'ob-enter p-5 transition-all duration-300 text-left',
                  isRemoved ? 'opacity-50' : 'hover:border-ob-border-strong',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Platform tile + metadata */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    {/* Platform tile */}
                    <div className="w-10 h-10 rounded-xl bg-ob-surface border border-ob-border flex items-center justify-center shrink-0 text-ob-clay">
                      <PlatformIcon className="w-5 h-5" />
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <ObBadge variant="clay">
                          {item.badgeLabel}
                        </ObBadge>
                        <h2
                          className={[
                            'text-base font-medium text-ob-ink truncate font-[family-name:var(--font-ob-body)]',
                            isRemoved ? 'line-through text-ob-ink-muted' : '',
                          ].join(' ')}
                        >
                          {item.title}
                        </h2>
                      </div>

                      <p className="text-sm text-ob-ink-muted font-normal leading-relaxed line-clamp-3 font-[family-name:var(--font-ob-body)]">
                        {item.summary}
                      </p>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-ob-ink-faint hover:text-ob-clay transition-colors pt-0.5"
                        >
                          <span>{formatDomain(item.url)}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Labelled Remove / Restore Button */}
                  <button
                    type="button"
                    aria-label={isRemoved ? `Restore ${item.title}` : `Remove ${item.title}`}
                    onClick={() => handleToggleRemove(item.id)}
                    className="p-2 rounded-xl text-ob-ink-muted hover:text-ob-danger hover:bg-ob-danger-soft transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ob-clay"
                  >
                    {isRemoved ? (
                      <RotateCcw className="w-4 h-4" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </ObCard>
            );
          })}
        </div>

        {/* Action CTA when discoveries exist */}
        {discoveries.length > 0 && (
          <div className="w-full pt-2">
            <ObButton
              variant="primary"
              disabled={isLoading}
              onClick={onContinue}
              className="w-full sm:w-auto"
            >
              <span>Proceed to Reflection</span>
              <span>→</span>
            </ObButton>
          </div>
        )}
      </div>
    </StepFrame>
  );
}
