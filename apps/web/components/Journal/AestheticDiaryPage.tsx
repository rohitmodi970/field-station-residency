import React from 'react';
import type { CoverStyle, CoverWidget } from './DiaryStudio';

interface AestheticDiaryPageProps {
  isEven: boolean;
  backgroundClass?: string;
  backgroundStyle?: React.CSSProperties;
  pageType?: 'cover' | 'back' | 'decorative';
  coverStyle?: CoverStyle;
  widgets?: CoverWidget[];
  userInfo?: {
    name: string;
    email: string;
    username: string;
    totalEntries?: number;
    diaryTitle?: string;
    diaryDisplayName?: string;
    showUsername?: boolean;
  };
}

// Get gradient based on cover style variant
function getCoverGradient(style?: CoverStyle): string {
  if (!style || style.variant === 'leather') {
    const base = style?.color || '#2d1f14';
    return `linear-gradient(135deg, ${base} 0%, ${adjustBrightness(base, 30)} 25%, ${adjustBrightness(base, 15)} 50%, ${adjustBrightness(base, 30)} 75%, ${base} 100%)`;
  }
  if (style.variant === 'themed') {
    return 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)';
  }
  if (style.variant === 'template' && style.gradient) {
    return style.gradient;
  }
  return 'linear-gradient(135deg, #2d1f14 0%, #4a3728 50%, #2d1f14 100%)';
}

// Get accent color for decorative elements
function getAccentColor(style?: CoverStyle): string {
  if (style?.accentColor) return style.accentColor;
  return '#D4AF37'; // gold default
}

// Get text color from template or default gold-cream
function getTextColor(style?: CoverStyle): string {
  if (style?.textColor) return style.textColor;
  return '#fff8e6';
}

function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function hasEnabledWidget(widgets: CoverWidget[] | undefined, type: CoverWidget['type']): boolean {
  return Boolean(widgets?.some(widget => widget.type === type && widget.enabled));
}

const AestheticDiaryPage = ({ 
  isEven, 
  backgroundClass, 
  backgroundStyle, 
  pageType = 'cover',
  coverStyle,
  widgets,
  userInfo 
}: AestheticDiaryPageProps) => {

  const coverGradient = getCoverGradient(coverStyle);
  const isCustomImage = coverStyle?.variant === 'custom' && coverStyle?.imageUrl;
  const accent = getAccentColor(coverStyle);
  const textClr = getTextColor(coverStyle);
  const isTemplate = coverStyle?.variant === 'template';
  const templateId = coverStyle?.template;
  const showDiaryTitle = hasEnabledWidget(widgets, 'diary-title');
  const showDisplayName = hasEnabledWidget(widgets, 'display-name');
  const showUsername = hasEnabledWidget(widgets, 'username');

  // Helper: render enabled widgets
  const renderWidgets = () => {
    if (!widgets || widgets.length === 0) return null;
    const enabled = widgets.filter(w => w.enabled);
    if (enabled.length === 0) return null;

    return (
      <div className="flex flex-col items-center gap-2 mt-4" style={{ maxWidth: '80%' }}>
        {enabled.map(w => {
          switch (w.type) {
            case 'date':
              return (
                <div key={w.id} className="rounded-full px-4 py-1" style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                  <p style={{ color: `${accent}cc`, fontSize: '11px', letterSpacing: '0.15em' }}>
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              );
            case 'monogram':
              return (
                <div key={w.id} className="flex items-center justify-center" style={{
                  width: 44, height: 44,
                  borderRadius: w.config?.style === 'diamond' ? '4px' : w.config?.style === 'square' ? '8px' : '50%',
                  transform: w.config?.style === 'diamond' ? 'rotate(45deg)' : undefined,
                  background: `${accent}15`,
                  border: `2px solid ${accent}55`,
                }}>
                  <span style={{
                    fontSize: '18px', fontFamily: 'inherit', color: `${accent}dd`,
                    transform: w.config?.style === 'diamond' ? 'rotate(-45deg)' : undefined,
                  }}>
                    {(userInfo?.name?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              );
            case 'entry-count':
              return (
                <div key={w.id} className="flex items-center gap-1.5" style={{ color: `${accent}99`, fontSize: '11px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px', color: `${accent}cc` }}>{userInfo?.totalEntries || 0}</span>
                  <span style={{ letterSpacing: '0.1em' }}>entries written</span>
                </div>
              );
            case 'quote':
              return (
                <div key={w.id} style={{ maxWidth: '240px', textAlign: 'center' }}>
                  <p style={{ color: `${textClr}99`, fontSize: '12px', fontStyle: 'italic', fontFamily: 'inherit', lineHeight: 1.5 }}>
                    "{w.config?.text || 'Every page holds a piece of my soul.'}"
                  </p>
                </div>
              );
            case 'icon': {
              const iconMap: Record<string, string> = { feather: '🪶', star: '⭐', heart: '❤️', moon: '🌙', flower: '🌸', diamond: '💎', butterfly: '🦋', crown: '👑' };
              return (
                <div key={w.id} style={{ fontSize: '24px', opacity: 0.7 }}>
                  {iconMap[w.config?.icon || 'feather'] || '🪶'}
                </div>
              );
            }
            case 'divider': {
              if (w.config?.style === 'dots') return <div key={w.id} style={{ color: `${accent}55`, fontSize: '12px', letterSpacing: '0.5em' }}>• • • • •</div>;
              if (w.config?.style === 'stars') return <div key={w.id} style={{ color: `${accent}55`, fontSize: '10px', letterSpacing: '0.3em' }}>✦ ✦ ✦</div>;
              if (w.config?.style === 'line') return <div key={w.id} style={{ width: '80px', height: '1px', background: `linear-gradient(to right, transparent, ${accent}44, transparent)` }} />;
              return <div key={w.id} style={{ color: `${accent}55`, fontSize: '14px' }}>❧</div>;
            }
            case 'mood-ring': {
              const moodColors: Record<string, string> = { calm: '#7ec8e3', happy: '#ffd700', focus: '#9b59b6', creative: '#ff6b6b', grateful: '#2ecc71' };
              const moodClr = moodColors[w.config?.mood || 'calm'] || '#7ec8e3';
              return (
                <div key={w.id} className="flex items-center justify-center" style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `radial-gradient(circle, ${moodClr}66, ${moodClr}22)`,
                  border: `2px solid ${moodClr}88`,
                  boxShadow: `0 0 12px ${moodClr}33`,
                }} />
              );
            }
            case 'weather': {
              const weatherIcons: Record<string, string> = { sunny: '☀️', cloudy: '☁️', rainy: '🌧️', stormy: '⛈️', snowy: '❄️', starry: '🌙' };
              const weatherBgs: Record<string, string> = {
                sunny: `linear-gradient(135deg, ${accent}15, #ffd70015)`,
                cloudy: `linear-gradient(135deg, ${accent}10, #94a3b815)`,
                rainy: `linear-gradient(135deg, ${accent}10, #3b82f615)`,
                stormy: `linear-gradient(135deg, ${accent}10, #6b21a815)`,
                snowy: `linear-gradient(135deg, ${accent}10, #e2e8f015)`,
                starry: `linear-gradient(135deg, ${accent}10, #1e1b4b15)`,
              };
              const wType = w.config?.weather || 'sunny';
              return (
                <div key={w.id} className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{
                  background: weatherBgs[wType] || weatherBgs.sunny,
                  border: `1px solid ${accent}20`,
                }}>
                  <span style={{ fontSize: '16px' }}>{weatherIcons[wType] || '☀️'}</span>
                  <span style={{ fontSize: '10px', color: `${accent}aa`, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500 }}>
                    {wType}
                  </span>
                </div>
              );
            }
            case 'streak': {
              const count = parseInt(w.config?.count || '7', 10);
              const flameColor = count >= 30 ? '#ff4500' : count >= 14 ? '#ff8c00' : count >= 7 ? '#ffa500' : '#ffcc00';
              return (
                <div key={w.id} className="flex items-center gap-1.5">
                  <div className="relative flex items-center justify-center" style={{ width: 28, height: 28 }}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                      <path d="M12 2C6.5 8 3 12 3 15.5C3 19.6 6.4 23 10.5 23C10.5 23 8 20 8 17C8 14 12 10 12 10C12 10 16 14 16 17C16 20 13.5 23 13.5 23C17.6 23 21 19.6 21 15.5C21 12 17.5 8 12 2Z" 
                        fill={flameColor} opacity="0.7" />
                      <path d="M12 10C12 10 9 13.5 9 16C9 18.5 10.5 20 12 20C13.5 20 15 18.5 15 16C15 13.5 12 10 12 10Z" 
                        fill={`${flameColor}cc`} />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span style={{ fontSize: '14px', fontWeight: 700, color: `${accent}dd`, lineHeight: 1 }}>{count}</span>
                    <span style={{ fontSize: '8px', color: `${accent}88`, letterSpacing: '0.1em', textTransform: 'uppercase' }}>day streak</span>
                  </div>
                </div>
              );
            }
            case 'constellation': {
              // Mini constellation patterns rendered as SVG
              const patterns: Record<string, Array<{x: number; y: number}>> = {
                'orion': [{x:20,y:8},{x:35,y:15},{x:50,y:12},{x:65,y:16},{x:80,y:10},{x:40,y:30},{x:60,y:32}],
                'big-dipper': [{x:15,y:20},{x:30,y:15},{x:45,y:18},{x:55,y:12},{x:65,y:22},{x:75,y:30},{x:80,y:40}],
                'cassiopeia': [{x:15,y:25},{x:30,y:10},{x:45,y:30},{x:60,y:8},{x:75,y:28}],
                'lyra': [{x:50,y:8},{x:35,y:22},{x:65,y:22},{x:40,y:38},{x:60,y:38}],
                'random': [{x:20,y:12},{x:45,y:8},{x:70,y:20},{x:30,y:35},{x:55,y:30},{x:80,y:38}],
              };
              const pts = patterns[w.config?.pattern || 'orion'] ?? patterns['orion'] ?? [];
              return (
                <div key={w.id} style={{ width: 100, height: 44, position: 'relative' }}>
                  <svg viewBox="0 0 100 48" width="100" height="44" fill="none">
                    {/* Connection lines */}
                    {pts.slice(0, -1).map((p, i) => (
                      <line key={`l-${i}`} x1={p.x} y1={p.y} x2={pts[i+1]?.x} y2={pts[i+1]?.y} stroke={`${accent}30`} strokeWidth="0.5" />
                    ))}
                    {/* Stars */}
                    {pts.map((p, i) => (
                      <circle key={`s-${i}`} cx={p.x} cy={p.y} r={1 + (i % 2)} fill={`${accent}aa`} />
                    ))}
                  </svg>
                </div>
              );
            }
            case 'wax-seal': {
              const sealColors: Record<string, string> = { crimson: '#8b0000', gold: '#b8860b', navy: '#1a1a5e', emerald: '#005c3a', bronze: '#6b4423' };
              const sealClr = sealColors[w.config?.color || 'crimson'] || '#8b0000';
              return (
                <div key={w.id} className="relative flex items-center justify-center" style={{ width: 52, height: 52 }}>
                  <svg viewBox="0 0 60 60" width="52" height="52">
                    {/* Wavy seal edge */}
                    <path d={(() => {
                      const cx = 30, cy = 30, n = 18, rOuter = 26, rInner = 22;
                      let d = '';
                      for (let i = 0; i <= n; i++) {
                        const angle = (i / n) * Math.PI * 2;
                        const r = i % 2 === 0 ? rOuter : rInner;
                        const x = cx + r * Math.cos(angle);
                        const y = cy + r * Math.sin(angle);
                        d += (i === 0 ? 'M' : 'L') + `${x},${y} `;
                      }
                      return d + 'Z';
                    })()} fill={sealClr} opacity="0.85" />
                    {/* Inner circle */}
                    <circle cx="30" cy="30" r="16" fill="none" stroke={`${sealClr}88`} strokeWidth="1" />
                    {/* Monogram initial */}
                    <text x="30" y="35" textAnchor="middle" fill="#fff8e6" fontSize="14" fontFamily="inherit" opacity="0.9">
                      {(userInfo?.name || 'D')[0]}
                    </text>
                  </svg>
                </div>
              );
            }
            case 'progress-ring': {
              const goal = parseInt(w.config?.goal || '100', 10);
              const current = userInfo?.totalEntries || 0;
              const pct = Math.min(100, Math.round((current / Math.max(1, goal)) * 100));
              const r = 18;
              const circ = 2 * Math.PI * r;
              const offset = circ - (pct / 100) * circ;
              return (
                <div key={w.id} className="flex items-center gap-2">
                  <svg viewBox="0 0 48 48" width="42" height="42">
                    <circle cx="24" cy="24" r={r} fill="none" stroke={`${accent}20`} strokeWidth="3" />
                    <circle cx="24" cy="24" r={r} fill="none" stroke={`${accent}bb`} strokeWidth="3"
                      strokeDasharray={circ} strokeDashoffset={offset}
                      strokeLinecap="round" transform="rotate(-90 24 24)" />
                    <text x="24" y="27" textAnchor="middle" fill={`${accent}cc`} fontSize="10" fontWeight="bold">{pct}%</text>
                  </svg>
                  <div className="flex flex-col">
                    <span style={{ fontSize: '10px', color: `${accent}bb`, fontWeight: 600 }}>{current}/{goal}</span>
                    <span style={{ fontSize: '8px', color: `${accent}77`, letterSpacing: '0.05em' }}>entries</span>
                  </div>
                </div>
              );
            }
            case 'season': {
              const month = new Date().getMonth();
              const seasons: Array<{ name: string; icon: string; colors: [string, string] }> = [
                { name: 'Winter', icon: '❄️', colors: ['#a5c8e1', '#d6eaf8'] },
                { name: 'Spring', icon: '🌱', colors: ['#a8e6cf', '#dcedc1'] },
                { name: 'Summer', icon: '☀️', colors: ['#ffd700', '#ffe4b5'] },
                { name: 'Autumn', icon: '🍂', colors: ['#d2691e', '#f4a460'] },
              ];
              const seasonIdx = month <= 1 || month === 11 ? 0 : month <= 4 ? 1 : month <= 7 ? 2 : 3;
              const s = seasons[seasonIdx];
              if (!s) return null;
              return (
                <div key={w.id} className="flex items-center gap-2 rounded-full px-3 py-1" style={{
                  background: `linear-gradient(135deg, ${s.colors[0]}22, ${s.colors[1]}22)`,
                  border: `1px solid ${s.colors[0]}33`,
                }}>
                  <span style={{ fontSize: '14px' }}>{s.icon}</span>
                  <div className="flex flex-col">
                    <span style={{ fontSize: '10px', fontWeight: 600, color: `${accent}cc`, lineHeight: 1.2 }}>{s.name}</span>
                    <span style={{ fontSize: '8px', color: `${accent}77` }}>{new Date().getFullYear()}</span>
                  </div>
                </div>
              );
            }
            case 'zodiac': {
              const zodiacSymbols: Record<string, { symbol: string; name: string }> = {
                aries: { symbol: '♈', name: 'Aries' }, taurus: { symbol: '♉', name: 'Taurus' },
                gemini: { symbol: '♊', name: 'Gemini' }, cancer: { symbol: '♋', name: 'Cancer' },
                leo: { symbol: '♌', name: 'Leo' }, virgo: { symbol: '♍', name: 'Virgo' },
                libra: { symbol: '♎', name: 'Libra' }, scorpio: { symbol: '♏', name: 'Scorpio' },
                sagittarius: { symbol: '♐', name: 'Sagittarius' }, capricorn: { symbol: '♑', name: 'Capricorn' },
                aquarius: { symbol: '♒', name: 'Aquarius' }, pisces: { symbol: '♓', name: 'Pisces' },
              };
              const z = zodiacSymbols[w.config?.sign || 'pisces'] || zodiacSymbols.pisces;
              if (!z) return null;
              return (
                <div key={w.id} className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center justify-center" style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `radial-gradient(circle, ${accent}18, transparent)`,
                    border: `1.5px solid ${accent}30`,
                  }}>
                    <span style={{ fontSize: '18px', color: `${accent}cc` }}>{z.symbol}</span>
                  </div>
                  <span style={{ fontSize: '8px', color: `${accent}77`, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{z.name}</span>
                </div>
              );
            }
            case 'stamp': {
              const stampStyle = w.config?.style || 'postmark';
              const stampTexts: Record<string, { line1: string; line2: string }> = {
                postmark: { line1: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), line2: new Date().getFullYear().toString() },
                passport: { line1: 'APPROVED', line2: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) },
                library: { line1: 'EX LIBRIS', line2: (userInfo?.name?.split(' ')[0] || 'Owner').toUpperCase() },
                confidential: { line1: 'TOP SECRET', line2: '— CLASSIFIED —' },
              };
              const st = stampTexts[stampStyle] ?? stampTexts.postmark;
              if (!st) return null;
              return (
                <div key={w.id} className="flex items-center justify-center" style={{
                  width: 64, height: 48, borderRadius: stampStyle === 'passport' ? '4px' : '50% / 40%',
                  border: `2px ${stampStyle === 'postmark' ? 'dashed' : 'double'} ${accent}55`,
                  transform: 'rotate(-8deg)',
                  padding: '4px 8px',
                }}>
                  <div className="flex flex-col items-center">
                    <span style={{ fontSize: '8px', fontWeight: 700, color: `${accent}bb`, letterSpacing: '0.1em', lineHeight: 1.3, textTransform: 'uppercase' }}>
                      {st.line1}
                    </span>
                    <span style={{ fontSize: '7px', color: `${accent}77`, letterSpacing: '0.05em' }}>
                      {st.line2}
                    </span>
                  </div>
                </div>
              );
            }
            case 'custom-text':
              return (
                <div key={w.id} className="rounded-full px-4 py-1.5" style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
                  <p style={{ color: `${textClr}bb`, fontSize: '12px', letterSpacing: '0.15em', fontStyle: 'italic', fontFamily: 'inherit' }}>
                    {w.config?.text || 'My Story'}
                  </p>
                </div>
              );
            case 'bookmark':
              return (
                <div key={w.id} className="relative flex flex-col items-center" style={{ width: 28 }}>
                  <div style={{
                    width: 20, height: 36,
                    background: `linear-gradient(180deg, ${accent}66, ${accent}33)`,
                    border: `1px solid ${accent}44`,
                    borderRadius: '2px 2px 0 0',
                    clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4px',
                  }}>
                    <span style={{ fontSize: '8px', color: `${accent}cc` }}>✦</span>
                  </div>
                </div>
              );
            case 'affirmation':
              return (
                <div key={w.id} style={{ maxWidth: '220px', textAlign: 'center', padding: '6px 12px', background: `${accent}08`, borderRadius: '8px' }}>
                  <p style={{ color: `${accent}cc`, fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, marginBottom: '3px' }}>
                    Today&apos;s Affirmation
                  </p>
                  <p style={{ color: `${textClr}88`, fontSize: '11px', fontStyle: 'italic', fontFamily: 'inherit', lineHeight: 1.4 }}>
                    {w.config?.text || 'I am enough, I am worthy, I am loved.'}
                  </p>
                </div>
              );
            default: return null;
          }
        })}
      </div>
    );
  };

  // Template-specific overlay patterns
  const renderTemplateOverlay = () => {
    if (!isTemplate || !templateId) return null;

    switch (templateId) {
      case 'celestial':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="absolute rounded-full bg-white" style={{
                width: `${1 + (i % 4)}px`, height: `${1 + (i % 4)}px`,
                top: `${(i * 7 + 3) % 95}%`, left: `${(i * 13 + 5) % 95}%`,
                opacity: 0.15 + (i % 5) * 0.08,
                animation: `pulse ${2 + i % 3}s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }} />
            ))}
          </div>
        );
      case 'sakura':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="absolute text-pink-300" style={{
                top: `${8 + (i * 13) % 85}%`, left: `${5 + (i * 17) % 90}%`,
                fontSize: `${12 + (i % 3) * 4}px`,
                transform: `rotate(${i * 40}deg)`,
              }}>❀</div>
            ))}
          </div>
        );
      case 'botanical':
        return (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute rounded-xl" style={{ inset: '20px', border: `1.5px solid rgba(34,120,60,0.15)` }} />
            <div className="absolute top-5 left-1/2 -translate-x-1/2 text-green-800/20 text-lg">❧</div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-green-800/20 text-lg rotate-180">❧</div>
          </div>
        );
      case 'art-deco':
        return (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute rounded-sm" style={{ inset: '14px', border: `2px solid ${accent}25` }}>
              <div className="absolute rounded-sm" style={{ inset: '6px', border: `1px solid ${accent}15` }} />
            </div>
            {/* Corner geometric triangles */}
            {['top-3 left-3', 'top-3 right-3 rotate-90', 'bottom-3 left-3 -rotate-90', 'bottom-3 right-3 rotate-180'].map((pos, i) => (
              <div key={i} className={`absolute ${pos}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity="0.2">
                  <polygon points="0,0 24,0 0,24" fill={accent} />
                </svg>
              </div>
            ))}
          </div>
        );
      case 'marble-luxe':
        return (
          <div className="absolute inset-0 pointer-events-none opacity-10" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 500 500' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.02' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23m)'/%3E%3C/svg%3E")`
          }} />
        );
      case 'ocean-wave':
        return (
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none opacity-20">
            <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="w-full h-16">
              <path d="M0 30 Q50 0 100 30 Q150 60 200 30 Q250 0 300 30 Q350 60 400 30 L400 60 L0 60 Z" fill={accent} opacity="0.3" />
              <path d="M0 40 Q50 15 100 40 Q150 65 200 40 Q250 15 300 40 Q350 65 400 40 L400 60 L0 60 Z" fill={accent} opacity="0.2" />
            </svg>
          </div>
        );
      case 'noir':
        return (
          <div className="absolute inset-0 pointer-events-none" style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.03) 0%, transparent 60%)',
          }} />
        );
      case 'royal-crest':
        return (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]">
              <svg width="160" height="160" viewBox="0 0 100 100" fill={accent}>
                <circle cx="50" cy="50" r="45" fill="none" stroke={accent} strokeWidth="1.5" />
                <circle cx="50" cy="50" r="38" fill="none" stroke={accent} strokeWidth="0.5" />
                <path d="M50 15 L55 30 L70 30 L58 40 L62 55 L50 45 L38 55 L42 40 L30 30 L45 30 Z" />
              </svg>
            </div>
          </div>
        );
      case 'velvet-rose':
        return (
          <div className="absolute inset-0 pointer-events-none opacity-[0.08]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='v'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23v)'/%3E%3C/svg%3E")`
          }} />
        );
      case 'minimalist':
        return null; // Clean — no overlay needed
      case 'aurora':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="absolute" style={{
                top: `${10 + i * 12}%`, left: `-10%`, right: `-10%`,
                height: `${8 + i * 3}px`,
                background: `linear-gradient(90deg, transparent, ${['#00f5d4','#7b2ff7','#00b4d8','#90be6d','#f77f00','#e63946'][i % 6]}22, transparent)`,
                borderRadius: '50%',
                transform: `rotate(${-5 + i * 3}deg) scaleX(1.3)`,
                filter: 'blur(8px)',
                opacity: 0.6 + i * 0.05,
              }} />
            ))}
          </div>
        );
      case 'parchment':
        return (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.004' numOctaves='5' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23p)' opacity='0.15'/%3E%3C/svg%3E")`,
            }} />
            <div className="absolute inset-3 rounded" style={{ border: '1.5px solid rgba(139,90,43,0.18)' }} />
            <div className="absolute top-5 left-1/2 -translate-x-1/2 text-amber-900/15 text-2xl">☙</div>
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-amber-900/15 text-2xl rotate-180">☙</div>
          </div>
        );
      case 'cyberpunk':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Scanlines */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 4px)`,
            }} />
            {/* Neon corner lines */}
            <div className="absolute top-3 left-3" style={{ width: 28, height: 28, borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
            <div className="absolute top-3 right-3" style={{ width: 28, height: 28, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
            <div className="absolute bottom-3 left-3" style={{ width: 28, height: 28, borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}` }} />
            <div className="absolute bottom-3 right-3" style={{ width: 28, height: 28, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}` }} />
            {/* Glitch stripe */}
            <div className="absolute" style={{ top: '30%', left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${accent}44, transparent)`, opacity: 0.5 }} />
          </div>
        );
      case 'spring':
        return (
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="absolute" style={{
                top: `${5 + (i * 11) % 88}%`, left: `${5 + (i * 17) % 88}%`,
                fontSize: `${10 + (i % 4) * 4}px`,
                transform: `rotate(${i * 36}deg)`,
                color: ['#f9c74f','#90be6d','#43aa8b','#f94144','#f8961e'][i % 5],
              }}>
                {['🌸','🌿','🌼','🍀','✿'][i % 5]}
              </div>
            ))}
          </div>
        );
      case 'watercolor':
        return (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.07]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3CradialGradient id='g1' cx='30%25' cy='30%25'%3E%3Cstop offset='0%25' stop-color='%23a8edea' stop-opacity='0.7'/%3E%3Cstop offset='100%25' stop-color='transparent'/%3E%3C/radialGradient%3E%3CradialGradient id='g2' cx='70%25' cy='60%25'%3E%3Cstop offset='0%25' stop-color='%23fed6e3' stop-opacity='0.7'/%3E%3Cstop offset='100%25' stop-color='transparent'/%3E%3C/radialGradient%3E%3Crect width='100%25' height='100%25' fill='url(%23g1)'/%3E%3Crect width='100%25' height='100%25' fill='url(%23g2)'/%3E%3C/svg%3E")`,
              backgroundSize: 'cover',
            }} />
          </div>
        );
      default:
        return null;
    }
  };

  const renderCoverPage = () => (
    <div className="relative h-full w-full overflow-hidden">
      {/* Cover background */}
      {isCustomImage ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${coverStyle!.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      ) : (
        <div 
          className="absolute inset-0"
          style={{ backgroundImage: coverGradient }}
        />
      )}
      
      {/* Template-specific overlay */}
      {renderTemplateOverlay()}

      {/* Leather grain texture overlay (for leather + velvet variants — skip for custom images) */}
      {!isCustomImage && (!isTemplate || templateId === 'velvet-rose' || templateId === 'noir') && (
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      )}

      {/* Embossed border effect (skip for minimalist and custom images) */}
      {!isCustomImage && templateId !== 'minimalist' && (
        <>
          <div 
            className="absolute rounded-lg" 
            style={{ 
              inset: '16px',
              border: `2px solid ${accent}40`,
              boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)' 
            }} 
          />
          <div 
            className="absolute rounded-lg" 
            style={{ 
              inset: '24px',
              border: `1px solid ${accent}30`
            }} 
          />
        </>
      )}

      {/* Corner decorations (leather + classic templates only — skip for custom images) */}
      {!isCustomImage && (!isTemplate || templateId === 'royal-crest' || templateId === 'art-deco') && (
        <>
          <div className="absolute top-8 left-8">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M0 40 L0 20 Q0 0 20 0 L40 0" stroke={accent} strokeWidth="2" fill="none" opacity="0.6"/>
              <circle cx="8" cy="8" r="3" fill={accent} opacity="0.4"/>
            </svg>
          </div>
          <div className="absolute top-8 right-8" style={{ transform: 'rotate(90deg)' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M0 40 L0 20 Q0 0 20 0 L40 0" stroke={accent} strokeWidth="2" fill="none" opacity="0.6"/>
              <circle cx="8" cy="8" r="3" fill={accent} opacity="0.4"/>
            </svg>
          </div>
          <div className="absolute bottom-8 left-8" style={{ transform: 'rotate(-90deg)' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M0 40 L0 20 Q0 0 20 0 L40 0" stroke={accent} strokeWidth="2" fill="none" opacity="0.6"/>
              <circle cx="8" cy="8" r="3" fill={accent} opacity="0.4"/>
            </svg>
          </div>
          <div className="absolute bottom-8 right-8" style={{ transform: 'rotate(180deg)' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M0 40 L0 20 Q0 0 20 0 L40 0" stroke={accent} strokeWidth="2" fill="none" opacity="0.6"/>
              <circle cx="8" cy="8" r="3" fill={accent} opacity="0.4"/>
            </svg>
          </div>
        </>
      )}

      {/* Main content */}
      <div className="relative h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center">
        {/* Decorative top flourish */}
        <div className="mb-6">
          <svg width="180" height="30" viewBox="0 0 180 30" fill="none">
            <path d="M0 15 Q45 0 90 15 Q135 30 180 15" stroke={accent} strokeWidth="1.5" fill="none" opacity="0.7"/>
            <circle cx="90" cy="15" r="4" fill={accent} opacity="0.8"/>
            <circle cx="60" cy="12" r="2" fill={accent} opacity="0.5"/>
            <circle cx="120" cy="18" r="2" fill={accent} opacity="0.5"/>
          </svg>
        </div>

        {/* Title */}
        {showDiaryTitle && userInfo?.diaryTitle?.trim() ? (
          <div className="mb-8">
            <p style={{ color: `${textClr}99`, fontSize: '14px', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {userInfo.diaryTitle}
            </p>
          </div>
        ) : null}

        {/* Embossed nameplate */}
        {((showDisplayName && userInfo?.diaryDisplayName?.trim()) || (showUsername && userInfo?.username)) ? (
          <div 
            className="mb-6 rounded-lg"
            style={{
              padding: '24px 40px',
              background: `linear-gradient(145deg, ${accent}18 0%, ${accent}0a 100%)`,
              border: `1px solid ${accent}35`,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            <h2 style={{ 
              fontSize: '24px', 
              fontFamily: 'inherit',
              color: `${textClr}f0`, 
              letterSpacing: '0.1em',
              marginBottom: '4px'
            }}>
              {showDisplayName ? (userInfo?.diaryDisplayName?.trim() || userInfo?.name || 'Your Name') : null}
            </h2>
            {showUsername && userInfo?.username ? (
              <p style={{ color: `${accent}88`, fontSize: '12px', letterSpacing: '0.15em' }}>
                @{userInfo.username}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Decorative divider */}
        <div className="flex items-center mb-4" style={{ gap: '16px' }}>
          <div style={{ width: '48px', height: '1px', background: `linear-gradient(to right, transparent, ${accent}55)` }}/>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z" fill={`${accent}88`}/>
          </svg>
          <div style={{ width: '48px', height: '1px', background: `linear-gradient(to left, transparent, ${accent}55)` }}/>
        </div>

        {/* Widgets */}
        {renderWidgets()}

        {/* Spine effect */}
        <div 
          className="absolute top-0 bottom-0 left-0"
          style={{
            width: '16px',
            background: 'linear-gradient(90deg, #1a1008 0%, #2d1f14 50%, transparent 100%)',
            boxShadow: 'inset -2px 0 8px rgba(0,0,0,0.5)'
          }}
        />
      </div>
    </div>
  );

  const renderBackPage = () => (
    <div className="relative h-full w-full overflow-hidden">
      {/* Same cover background as front */}
      {isCustomImage ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${coverStyle!.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            filter: 'brightness(0.7)',
          }}
        />
      ) : (
        <div 
          className="absolute inset-0"
          style={{ backgroundImage: coverGradient }}
        />
      )}

      {/* Template overlay on back too */}
      {renderTemplateOverlay()}

      {/* Leather grain — skip for custom images */}
      {!isCustomImage && (!isTemplate || templateId === 'velvet-rose' || templateId === 'noir') && (
        <div 
          className="absolute inset-0 opacity-30"
          style={{ 
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` 
          }}
        />
      )}

      {/* Embossed border — skip for custom images */}
      {!isCustomImage && templateId !== 'minimalist' && (
        <div 
          className="absolute rounded-lg"
          style={{ 
            inset: '16px',
            border: `2px solid ${accent}40`,
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3)' 
          }}
        />
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center">
        <div className="mb-8">
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto' }}>
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill={`${accent}88`}/>
          </svg>
        </div>

        <h2 style={{ 
          fontSize: '24px', 
          fontFamily: 'inherit',
          color: `${textClr}f0`, 
          marginBottom: '16px'
        }}>
          Thank You for Writing
        </h2>
        
        <div 
          className="rounded-lg mb-8"
          style={{ 
            maxWidth: '280px',
            padding: '24px',
            background: 'rgba(0,0,0,0.2)', 
            border: `1px solid ${accent}22` 
          }}
        >
          <p style={{ color: `${textClr}99`, fontSize: '14px', marginBottom: '12px' }}>
            Your Journey
          </p>
          <div className="flex justify-between mb-2" style={{ color: `${accent}bb`, fontSize: '12px' }}>
            <span>Entries</span>
            <span style={{ fontWeight: '500' }}>{userInfo?.totalEntries || 0}</span>
          </div>
          <div className="flex justify-between" style={{ color: `${accent}bb`, fontSize: '12px' }}>
            <span>Author</span>
            <span>{userInfo?.name?.split(' ')[0] || 'You'}</span>
          </div>
        </div>

        <p style={{ 
          color: `${textClr}66`, 
          fontSize: '14px', 
          fontStyle: 'italic', 
          fontFamily: 'inherit',
          maxWidth: '280px'
        }}>
          "The story you&apos;re writing becomes the wisdom you&apos;ll cherish tomorrow."
        </p>

        <div className="absolute" style={{ bottom: '32px' }}>
          <p style={{ color: `${accent}44`, fontSize: '12px' }}>
            {userInfo?.email || 'your.email@example.com'}
          </p>
        </div>
      </div>

      {/* Spine effect on right */}
      <div 
        className="absolute top-0 bottom-0 right-0"
        style={{ 
          width: '16px',
          background: 'linear-gradient(-90deg, #1a1008 0%, #2d1f14 50%, transparent 100%)', 
          boxShadow: 'inset 2px 0 8px rgba(0,0,0,0.5)' 
        }}
      />
    </div>
  );

  return (
    <div 
      className={backgroundClass || 'h-full w-full'}
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
        ...backgroundStyle
      }}
    >
      {pageType === 'cover' && renderCoverPage()}
      {pageType === 'back' && renderBackPage()}
    </div>
  );
};

export default AestheticDiaryPage;