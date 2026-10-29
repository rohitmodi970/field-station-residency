'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Palette, X, Moon, Sun, RefreshCw, Check,
  Type, Droplet, ChevronRight, Sliders
} from 'lucide-react';
import { useTheme, fontOptions, getFontFamily } from '@/utilities/context/ThemeContext';
import { backgroundPalettes, gradientBackgrounds } from './ThemePalettes';

// ============================================================================
// MINIMAL THEME PANEL
// ============================================================================

type ActiveSection = 'mode' | 'color' | 'elements' | 'font' | 'background' | null;

// ── Pill Nav ─────────────────────────────────────────────────────────────────

interface NavItem {
  id: ActiveSection;
  label: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { id: 'mode',       label: 'Mode',       icon: <Sun size={14} /> },
  { id: 'color',      label: 'Theme',      icon: <Palette size={14} /> },
  { id: 'elements',   label: 'Elements',   icon: <Sliders size={14} /> },
  { id: 'font',       label: 'Font',       icon: <Type size={14} /> },
  { id: 'background', label: 'Background', icon: <Droplet size={14} /> },
];

// ── Color Dot ─────────────────────────────────────────────────────────────────

const Dot: React.FC<{
  color: string;
  selected: boolean;
  onClick: () => void;
  label: string;
}> = ({ color, selected, onClick, label }) => (
  <button
    onClick={onClick}
    title={label}
    className="relative w-8 h-8 rounded-full transition-transform hover:scale-110 active:scale-95 focus:outline-none"
    style={{
      backgroundColor: color,
      boxShadow: selected
        ? `0 0 0 2px white, 0 0 0 4px ${color}`
        : `0 1px 4px ${color}50`,
    }}
  >
    {selected && (
      <Check size={12} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
    )}
  </button>
);

// ── Section Wrapper ────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode; dark: boolean }> = ({
  title, children, dark,
}) => (
  <div className="space-y-3">
    <p className={`text-[10px] font-semibold uppercase tracking-widest ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
      {title}
    </p>
    {children}
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const ThemeSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [active, setActive] = useState<ActiveSection>('mode');
  const [copied, setCopied] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const {
    colorOptions, currentTheme, isDarkMode, elementColors,
    currentFont, pageBackground,
    setCurrentTheme, toggleDarkMode, updateElementColor,
    setFont, setPageBackground, resetToDefaults,
  } = useTheme();

  // close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const fn = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [isOpen]);

  // close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsOpen(false); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, []);

  const selectTheme = useCallback((c: typeof currentTheme) => {
    setCurrentTheme(c);
    updateElementColor('button', c.primary);
    updateElementColor('background', c.light);
    updateElementColor('accent', c.medium);
  }, [setCurrentTheme, updateElementColor]);

  const copyColor = useCallback((hex: string, key: string) => {
    navigator.clipboard.writeText(hex);
    setCopied(key);
    setTimeout(() => setCopied(''), 1800);
  }, []);

  const accent = elementColors.button;

  // ── Section content map ────────────────────────────────────────────────────

  const renderSection = () => {
    switch (active) {

      /* MODE */
      case 'mode':
        return (
          <Section title="Appearance" dark={isDarkMode}>
            <div className={`flex rounded-xl overflow-hidden border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {[
                { label: 'Light', dark: false, Icon: Sun },
                { label: 'Dark',  dark: true,  Icon: Moon },
              ].map(({ label, dark, Icon }) => {
                const on = isDarkMode === dark;
                return (
                  <button
                    key={label}
                    onClick={() => { if (!on) toggleDarkMode(); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                      on
                        ? 'text-white'
                        : isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={{ backgroundColor: on ? accent : 'transparent' }}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                );
              })}
            </div>
          </Section>
        );

      /* COLOR THEME */
      case 'color':
        return (
          <Section title="Color Theme" dark={isDarkMode}>
            <div className="grid grid-cols-5 gap-3">
              {colorOptions.map(c => (
                <Dot
                  key={c.name}
                  color={c.primary}
                  label={c.name}
                  selected={currentTheme.name === c.name}
                  onClick={() => selectTheme(c)}
                />
              ))}
            </div>
          </Section>
        );

      /* ELEMENTS */
      case 'elements':
        return (
          <Section title="Element Colors" dark={isDarkMode}>
            <div className="space-y-4">
              {(
                [
                  { key: 'button'     as const, label: 'Primary' },
                  { key: 'text'       as const, label: 'Text' },
                  { key: 'background' as const, label: 'Cards' },
                  { key: 'accent'     as const, label: 'Accent' },
                ] as const
              ).map(el => (
                <div key={el.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {el.label}
                    </span>
                    <button
                      onClick={() => copyColor(elementColors[el.key], el.key)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md transition-colors ${
                        isDarkMode ? 'bg-gray-800 text-gray-400 hover:text-gray-200' : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {copied === el.key ? '✓ copied' : elementColors[el.key]}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {colorOptions.map(c => {
                      const val =
                        el.key === 'background' ? c.light :
                        el.key === 'accent'      ? c.medium : c.primary;
                      return (
                        <Dot
                          key={c.name}
                          color={val}
                          label={c.name}
                          selected={elementColors[el.key] === val}
                          onClick={() => updateElementColor(el.key, val)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        );

      /* FONT */
      case 'font':
        return (
          <Section title="Typeface" dark={isDarkMode}>
            <div className="space-y-1.5">
              {fontOptions.map(f => {
                const on = currentFont === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFont(f.value)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all ${
                      on
                        ? 'text-white'
                        : isDarkMode
                          ? 'bg-gray-800/60 text-gray-300 hover:bg-gray-800'
                          : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                    style={{ backgroundColor: on ? accent : undefined }}
                  >
                    <span className="text-sm font-medium" style={{ fontFamily: getFontFamily(f.value) }}>
                      {f.name}
                    </span>
                    {on && <Check size={14} className="text-white" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </Section>
        );

      /* BACKGROUND */
      case 'background':
        return (
          <div className="space-y-5">
            {/* Solid */}
            <Section title="Solid" dark={isDarkMode}>
              <div className="grid grid-cols-6 gap-2">
                {(isDarkMode ? backgroundPalettes.dark : backgroundPalettes.light).map(bg => {
                  const on = pageBackground === bg.value;
                  return (
                    <button
                      key={bg.value}
                      onClick={() => setPageBackground(bg.value)}
                      title={bg.name}
                      className="w-9 h-9 rounded-xl transition-transform hover:scale-110 active:scale-95 focus:outline-none"
                      style={{
                        background: bg.value,
                        boxShadow: on
                          ? `0 0 0 2px white, 0 0 0 4px ${accent}`
                          : '0 1px 4px rgba(0,0,0,0.1)',
                      }}
                    >
                      {on && <Check size={12} className="m-auto text-gray-600" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Gradient */}
            <Section title="Gradient" dark={isDarkMode}>
              <div className="grid grid-cols-2 gap-2">
                {gradientBackgrounds.map(g => {
                  const on = pageBackground === g.value;
                  return (
                    <button
                      key={g.name}
                      onClick={() => setPageBackground(g.value)}
                      className="relative h-14 rounded-xl overflow-hidden transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none"
                      style={{
                        background: g.value,
                        boxShadow: on
                          ? `0 0 0 2px white, 0 0 0 4px ${accent}`
                          : '0 1px 4px rgba(0,0,0,0.15)',
                      }}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white drop-shadow">
                        {g.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            {/* Custom */}
            <Section title="Custom" dark={isDarkMode}>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={pageBackground.startsWith('#') ? pageBackground : '#F7F9FC'}
                  onChange={e => setPageBackground(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0.5"
                  style={{ backgroundColor: pageBackground.startsWith('#') ? pageBackground : '#F7F9FC' }}
                />
                <input
                  type="text"
                  value={pageBackground}
                  onChange={e => setPageBackground(e.target.value)}
                  placeholder="#hex or CSS gradient"
                  className={`flex-1 px-3 py-2 rounded-xl text-xs border outline-none transition-colors ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 text-gray-200 placeholder-gray-600 focus:border-gray-500'
                      : 'bg-white border-gray-200 text-gray-700 placeholder-gray-400 focus:border-gray-300'
                  }`}
                />
              </div>
            </Section>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open Theme Panel"
        className="fixed top-20 right-5 z-50 w-11 h-11 rounded-2xl flex items-center justify-center
          transition-all hover:scale-110 active:scale-95 shadow-lg backdrop-blur-sm"
        style={{
          backgroundColor: isDarkMode ? 'rgba(31,41,55,0.9)' : 'rgba(255,255,255,0.9)',
          border: `1.5px solid ${accent}`,
          boxShadow: `0 4px 16px ${accent}30`,
        }}
      >
        <Palette size={18} style={{ color: accent }} />
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`fixed top-0 right-0 h-full z-50 w-80 flex flex-col transition-transform duration-400 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${isDarkMode ? 'bg-gray-900' : 'bg-white'} shadow-2xl`}
        style={{ borderLeft: `1px solid ${isDarkMode ? '#1F2937' : '#F3F4F6'}` }}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
            <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>
              Theme
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => resetToDefaults('all')}
              title="Reset"
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'}`}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Nav Pills */}
        <div className={`px-4 py-3 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="flex flex-wrap gap-1.5">
            {NAV.map(n => {
              const on = active === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setActive(on ? null : n.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    on
                      ? 'text-white'
                      : isDarkMode
                        ? 'text-gray-400 bg-gray-800 hover:text-gray-200'
                        : 'text-gray-500 bg-gray-100 hover:text-gray-700'
                  }`}
                  style={{ backgroundColor: on ? accent : undefined }}
                >
                  {n.icon}
                  {n.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {active
            ? renderSection()
            : (
              <div className={`flex flex-col items-center justify-center h-full gap-2 text-center ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`}>
                <Palette size={32} />
                <p className="text-sm">Pick a section above</p>
              </div>
            )
          }
        </div>

        {/* Live swatch strip */}
        <div className={`px-5 py-4 border-t flex items-center gap-3 ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
            Active
          </span>
          <div className="flex gap-2 flex-1">
            {(['button', 'text', 'background', 'accent'] as const).map(k => (
              <div
                key={k}
                title={k}
                className="w-6 h-6 rounded-lg border"
                style={{
                  backgroundColor: elementColors[k],
                  borderColor: isDarkMode ? '#374151' : '#E5E7EB',
                }}
              />
            ))}
          </div>
          <ChevronRight size={14} style={{ color: accent }} />
        </div>
      </div>
    </>
  );
};

export default ThemeSidebar;