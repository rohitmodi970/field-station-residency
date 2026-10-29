import React, { useState } from 'react';

interface CoreValue {
  name: string;
  alignmentPercent: number;
  description: string;
  quotes: string[];
  insight: string;
  actionGap: {
    score: number;
    label: string;
  };
  recommendations: string[];
}

interface TextAnalysisTabsProps {
  coreValues: CoreValue[];
}

const getActionGapColor = (label: string) => {
  if (label.toLowerCase() === 'low') return '#22c55e';
  if (label.toLowerCase() === 'medium') return '#eab308';
  return '#ef4444';
};

export default function TextAnalysisTabs({ coreValues }: TextAnalysisTabsProps) {
  const [selected, setSelected] = useState(0);

  // Theme vars
  let cssVars: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const root = getComputedStyle(document.documentElement);
      cssVars = {
        text: root.getPropertyValue('--analysis-text') || '#6f4a2e',
        muted: root.getPropertyValue('--analysis-muted') || '#9a7655',
        card: root.getPropertyValue('--analysis-card') || '#fff8ee'
      };
    } catch (e) {
      cssVars = { text: '#6f4a2e', muted: '#9a7655', card: '#fff8ee' };
    }
  }

  if (!coreValues || coreValues.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8 p-6 rounded-lg shadow" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.08)' }}>
        <p style={{ color: 'var(--analysis-text)' }}>No core values data available.</p>
      </div>
    );
  }

  const selectedValue = coreValues[selected];

  if (!selectedValue) {
    return (
      <div className="w-full max-w-3xl mx-auto mt-8 p-6 rounded-lg shadow" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.08)' }}>
        <p style={{ color: 'var(--analysis-text)' }}>Selected value not found.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto mt-8">
      <div className="flex gap-2 mb-4">
        {coreValues.map((v, i) => (
          <button
            key={v.name}
            className={`px-4 py-2 rounded-t-lg font-semibold text-sm transition-colors duration-200`}
            onClick={() => setSelected(i)}
            style={selected === i ? { background: 'var(--analysis-muted)', color: '#fff' } : { background: 'transparent', border: '1px solid rgba(0,0,0,0.04)', color: 'var(--analysis-text)' }}
          >
            {v.name} <span className="ml-2 text-xs font-normal">{Math.round(v.alignmentPercent * 100)}%</span>
          </button>
        ))}
      </div>
      <div className="rounded-b-lg shadow p-6" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.08)' }}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold" style={{ color: 'var(--analysis-text)' }}>{selectedValue.name}</h2>
          <span style={{ background: 'var(--analysis-shell-bg)', color: 'var(--analysis-muted)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>{Math.round(selectedValue.alignmentPercent * 100)}% Aligned</span>
        </div>
        <div style={{ color: 'var(--analysis-text)' }} className="mb-4">{selectedValue.description}</div>
        <div style={{ background: 'var(--analysis-shell-bg)' }} className="rounded p-3 mb-4">
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--analysis-muted)' }}>From your journal:</div>
          {selectedValue.quotes.map((q, idx) => (
            <div key={idx} className="italic text-sm mb-1" style={{ color: 'var(--analysis-muted)' }}>&quot;{q}&quot;</div>
          ))}
        </div>
        <div className="mb-4">
          <span className="block font-bold mb-1" style={{ color: 'var(--analysis-muted)' }}>Force Insight:</span>
          <span style={{ color: 'var(--analysis-muted)' }}>{selectedValue.insight}</span>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-[#5e4028]">Action Gap:</span>
            <span className="text-xs font-semibold" style={{ color: getActionGapColor(selectedValue.actionGap.label) }}>{selectedValue.actionGap.label}</span>
          </div>
          <div className="w-full h-2 rounded" style={{ background: 'rgba(229,208,183,0.6)' }}>
            <div
              className="h-2 rounded"
              style={{
                width: `${Math.round(selectedValue.actionGap.score * 100)}%`,
                background: getActionGapColor(selectedValue.actionGap.label),
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
        <div className="mb-2">
          <span className="block font-bold mb-1" style={{ color: 'var(--analysis-muted)' }}>Bridging the Action Gap:</span>
          <ol className="list-decimal list-inside" style={{ color: 'var(--analysis-muted)' }}>
            {selectedValue.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ol>
        </div>
      </div>
      <div className="text-xs text-[#9a7655] mt-4">
        <b>Force App Notes:</b> The Values Alignment tool helps identify the core values expressed in journal entries and measures how well current behaviors align with these values. The Action Gap represents the distance between what users say they value and what they actually do, with specific recommendations to close that gap.
      </div>
    </div>
  );
} 