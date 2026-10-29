import React from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type WheelSection = 'top' | 'right' | 'bottom' | 'left' | 'center' | null;

export interface RetroIPodProps {
  isPlaying: boolean;
  currentSeconds: number;
  durationSeconds: number;
  volume: number; // 0–1
  isDarkMode?: boolean;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  coverImage?: string;
  onAddNote?: () => void; // Replaced Voice Mode with Add Note
  canNavigateNotes?: boolean;
  formatSeconds: (s: number) => string;
  onPlayPause: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (v: number) => void;
  onPrevNote?: () => void;
  onNextNote?: () => void;
  onMenuPress?: () => void;
}

// Describe a donut arc segment for SVG.
function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const pt = (r: number, deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  let ea = endAngle;
  if (ea <= startAngle) ea += 360;
  const largeArc = ea - startAngle > 180 ? 1 : 0;

  const p1 = pt(outerR, startAngle);
  const p2 = pt(outerR, ea);
  const p3 = pt(innerR, ea);
  const p4 = pt(innerR, startAngle);

  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(p1.x)} ${f(p1.y)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${f(p2.x)} ${f(p2.y)}`,
    `L ${f(p3.x)} ${f(p3.y)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${f(p4.x)} ${f(p4.y)} Z`,
  ].join(' ');
}

function arcMidPoint(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  let ea = endAngle;
  if (ea <= startAngle) ea += 360;
  const mid = startAngle + (ea - startAngle) / 2;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  return {
    x: cx + r * Math.cos(toRad(mid)),
    y: cy + r * Math.sin(toRad(mid)),
  };
}

const OUTER_R = 86;
const INNER_R = 30; 
const GAP = 0; 

const SECTIONS = {
  top:    { start: 315 + GAP, end: 45 - GAP },
  right:  { start:  45 + GAP, end: 135 - GAP },
  bottom: { start: 135 + GAP, end: 225 - GAP },
  left:   { start: 225 + GAP, end: 315 - GAP },
} as const;

type SectionKey = keyof typeof SECTIONS;

const RetroIPod: React.FC<RetroIPodProps> = ({
  isPlaying,
  currentSeconds,
  durationSeconds,
  volume,
  isDarkMode = false,
  trackName = 'Voice Note',
  artistName = 'Unknown Artist',
  albumName = 'Journal EP',
  coverImage = 'https://framerusercontent.com/images/vn9Fhn3Ak8lw97yDVLk1q42T9Ds.png',
  onAddNote,
  canNavigateNotes = false,
  formatSeconds,
  onPlayPause,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
  onPrevNote,
  onNextNote,
  onMenuPress,
}) => {
  const [pressed, setPressed] = React.useState<WheelSection>(null);
  void formatSeconds;

  const safeDuration = Math.max(durationSeconds, 1);
  const safeCurrent = Math.min(currentSeconds, safeDuration);
  const progress = (safeCurrent / safeDuration) * 100;

  const sectionActions: Record<SectionKey, () => void> = {
    top:    () => (onMenuPress ? onMenuPress() : onVolumeChange(Math.min(1, volume + 0.1))),
    bottom: () => onVolumeChange(Math.max(0, volume - 0.1)),
    left:   onSkipBack,
    right:  onSkipForward,
  };

  const handleSectionPress = (section: WheelSection) => {
    setPressed(section);
    if (section && section !== 'center') sectionActions[section as SectionKey]?.();
    if (section === 'center') onPlayPause();
  };

  const handleSectionRelease = () => setPressed(null);

  const palette = isDarkMode
    ? {
        shellBackground: 'linear-gradient(180deg, #5B6472 0%, #343B47 100%)',
        shellBorder: '#2A3140',
        shellInsetTop: 'rgba(255,255,255,0.15)',
        shellInsetBottom: 'rgba(0,0,0,0.35)',
        screenBackground: '#1D2430',
        screenBorder: '#0F141D',
        screenTopBar: 'linear-gradient(180deg, #334155 0%, #1F2937 100%)',
        textPrimary: '#E5E7EB',
        textSecondary: '#9CA3AF',
        textMuted: '#6B7280',
        progressTrack: '#374151',
        progressBorder: '#4B5563',
        progressFill: 'linear-gradient(180deg, #60A5FA 0%, #2563EB 100%)',
        wheelIdle: '#CBD5E1',
        wheelPressed: '#94A3B8',
        centerIdle: '#94A3B8',
        centerPressed: '#64748B',
        wheelLabel: '#475569',
      }
    : {
        shellBackground: 'linear-gradient(180deg, #EAEAEA 0%, #BFC0C4 100%)',
        shellBorder: '#A0A0A0',
        shellInsetTop: 'rgba(255,255,255,0.8)',
        shellInsetBottom: 'rgba(0,0,0,0.1)',
        screenBackground: '#F4F5F7',
        screenBorder: '#1A1A1A',
        screenTopBar: 'linear-gradient(180deg, #FFFFFF 0%, #E5E7EB 100%)',
        textPrimary: '#111827',
        textSecondary: '#4B5563',
        textMuted: '#6B7280',
        progressTrack: '#D1D5DB',
        progressBorder: '#9CA3AF',
        progressFill: 'linear-gradient(180deg, #A7F3D0 0%, #34D399 100%)',
        wheelIdle: '#FFFFFF',
        wheelPressed: '#E8E8E8',
        centerIdle: '#EAEAEA',
        centerPressed: '#D0D0D0',
        wheelLabel: '#9CA3AF',
      };

  const fillFor = (section: WheelSection) => (pressed === section ? palette.wheelPressed : palette.wheelIdle);
  const centerFill = pressed === 'center' ? palette.centerPressed : palette.centerIdle;

  const arcPaths = Object.entries(SECTIONS).map(([key, { start, end }]) => ({
    key: key as SectionKey,
    path: describeArc(100, 100, OUTER_R, INNER_R, start, end),
    mid: arcMidPoint(100, 100, (OUTER_R + INNER_R) / 2, start, end),
  }));

  const sectionLabels: Record<SectionKey, string> = {
    top: 'MENU',
    right: '▶▶|',
    bottom: '▶ ||',
    left: '|◀◀',
  };

  return (
    <div
      style={{
        width: 240,
        margin: '0 auto',
        background: palette.shellBackground,
        borderRadius: 24,
        padding: '24px 16px',
        boxShadow:
          `0 20px 40px rgba(0,0,0,0.3), inset 0 2px 4px ${palette.shellInsetTop}, inset 0 -2px 8px ${palette.shellInsetBottom}`,
        border: `1px solid ${palette.shellBorder}`,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {/* Classic Light LCD Screen */}
      <div
        style={{
          background: palette.screenBackground,
          borderRadius: 8,
          border: `4px solid ${palette.screenBorder}`,
          height: 160,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        {/* Top Status Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            borderBottom: `1px solid ${palette.progressBorder}`,
            background: palette.screenTopBar,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 'bold', color: palette.textPrimary }}>
            iPod
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Play Indicator */}
            {isPlaying && (
              <svg width="8" height="8" viewBox="0 0 24 24" fill={palette.textPrimary}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}

            {/* Add Note Button */}
            <button
              onClick={onAddNote}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                fontSize: 9,
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: 4,
                border: `1px solid ${palette.progressBorder}`,
                background: palette.screenTopBar,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                color: palette.textSecondary,
                cursor: 'pointer',
                outline: 'none',
              }}
              title="Add another note"
            >
              <Plus size={10} strokeWidth={3} />
              ADD
            </button>

            {/* Classic Battery Icon */}
            <div
              style={{
                width: 18,
                height: 9,
                border: `1px solid ${palette.textMuted}`,
                padding: 1,
                position: 'relative',
                borderRadius: 1,
              }}
            >
              <div style={{ width: '85%', height: '100%', background: '#10B981' }} />
              <div
                style={{
                  position: 'absolute',
                  right: -3,
                  top: 2,
                  width: 2,
                  height: 3,
                  background: palette.textMuted,
                  borderRadius: '0 1px 1px 0',
                }}
              />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ display: 'flex', flex: 1, padding: '12px' }}>
          {/* Cover Art */}
          <div
            style={{
              width: 72,
              height: 72,
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
              border: '1px solid #E5E7EB',
              flexShrink: 0,
            }}
          >
            <Image
              src={coverImage}
              alt="Album Art"
              width={72}
              height={72}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>

          {/* Track Info */}
          <div
            style={{
              marginLeft: 12,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 'bold',
                color: palette.textPrimary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {trackName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: palette.textSecondary,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {artistName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: palette.textMuted,
                fontStyle: 'italic',
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {albumName}
            </div>
          </div>
        </div>

        {/* Progress Bar Area */}
        <div style={{ padding: '0 12px 12px' }}>
          <div
            style={{
              height: 8,
              background: palette.progressTrack,
              borderRadius: 4,
              overflow: 'hidden',
              border: `1px solid ${palette.progressBorder}`,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(progress, 100)}%`,
                background: palette.progressFill,
                transition: 'width 0.25s linear',
              }}
            />
          </div>
        </div>
      </div>

      {/* Note navigation */}
      {canNavigateNotes && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <button onClick={onPrevNote} style={{ background: 'transparent', border: 'none', color: palette.textMuted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={16} /> Prev
          </button>
          <button onClick={onNextNote} style={{ background: 'transparent', border: 'none', color: palette.textMuted, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center' }}>
             Next <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Click Wheel */}
      <div style={{ position: 'relative', width: 172, height: 172, margin: '0 auto' }}>
        <svg viewBox="0 0 200 200" width={172} height={172} style={{ display: 'block', overflow: 'visible' }}>
          {/* Wheel Shadow */}
          <circle cx={100} cy={100} r={OUTER_R + 2} fill="rgba(0,0,0,0.1)" />

          {/* Four arc sections */}
          {arcPaths.map(({ key, path, mid }) => (
            <g key={key}>
              <path
                d={path}
                fill={fillFor(key as WheelSection)}
                style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
                onMouseDown={() => handleSectionPress(key as WheelSection)}
                onMouseUp={handleSectionRelease}
                onMouseLeave={handleSectionRelease}
                onTouchStart={() => handleSectionPress(key as WheelSection)}
                onTouchEnd={handleSectionRelease}
              />
              <text
                x={mid.x}
                y={key === 'top' || key === 'bottom' ? mid.y + 1 : mid.y + 4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={key === 'top' ? 14 : 16}
                fontFamily="Arial, sans-serif"
                fontWeight="bold"
                fill={palette.wheelLabel}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {sectionLabels[key as SectionKey]}
              </text>
            </g>
          ))}

          {/* Center Button */}
          <circle
            cx={100} cy={100} r={INNER_R}
            fill={centerFill}
            style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
            onMouseDown={() => handleSectionPress('center')}
            onMouseUp={handleSectionRelease}
            onMouseLeave={handleSectionRelease}
            onTouchStart={() => handleSectionPress('center')}
            onTouchEnd={handleSectionRelease}
          />
        </svg>
      </div>
    </div>
  );
};

export default RetroIPod;