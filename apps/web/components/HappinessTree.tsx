import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface HappinessSource {
  source: string;
  strength: number;
  moments: string[];
  quote: string;
  color: string;
}

type TreeDisplaySource = HappinessSource & {
  displayColor: string;
  gradientSecondary: string;
};

const VIBRANT_GRADIENT_PALETTE: Array<{ primary: string; secondary: string }> = [
  { primary: '#FF5F6D', secondary: '#FFC371' },
  { primary: '#36D1DC', secondary: '#5B86E5' },
  { primary: '#A18CD1', secondary: '#FBC2EB' },
  { primary: '#43E97B', secondary: '#38F9D7' },
  { primary: '#FA709A', secondary: '#FEE140' },
  { primary: '#30CFD0', secondary: '#330867' },
  { primary: '#F7971E', secondary: '#FFD200' },
];

function isBlackLikeColor(input?: string): boolean {
  if (!input) return true;
  const color = input.trim().toLowerCase();
  if (!color) return true;
  if (color === 'black' || color === '#000' || color === '#000000') return true;
  if (/^#(?:0{3}|1{3}|2{3}|0{6}|1{6}|2{6})$/.test(color)) return true;
  if (/^rgb\(\s*(?:0|1\d|2\d)\s*,\s*(?:0|1\d|2\d)\s*,\s*(?:0|1\d|2\d)\s*\)$/.test(color)) return true;
  if (/^rgba\(\s*(?:0|1\d|2\d)\s*,\s*(?:0|1\d|2\d)\s*,\s*(?:0|1\d|2\d)\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/.test(color)) return true;
  return false;
}

function lightenHex(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return hex;
  const value = parseInt(raw, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const blend = (channel: number) => Math.max(0, Math.min(255, Math.round(channel + (255 - channel) * amount)));
  const nr = blend(r);
  const ng = blend(g);
  const nb = blend(b);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function resolveDisplayColors(color: string, index: number): { primary: string; secondary: string } {
  const fallback = VIBRANT_GRADIENT_PALETTE[index % VIBRANT_GRADIENT_PALETTE.length]!;
  if (!color || isBlackLikeColor(color)) {
    return fallback;
  }

  const normalized = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return { primary: normalized, secondary: lightenHex(normalized, 0.28) };
  }

  // For named/rgb/hsl colors, keep the supplied primary and use a vibrant fallback secondary.
  return { primary: normalized, secondary: fallback.secondary };
}

const defaultSources: HappinessSource[] = [
  {
    source: "Spiritual Connection",
    strength: 9,
    moments: [
      "Sitting under the tree where Swami Vivekanand gained knowledge",
      "Yoga and meditation at the ashram",
      "Feeling the pure energy in Pithoragarh",
      "Planning the 60-day chakra meditation journey"
    ],
    quote: "The energy here feels pure. And I feel as if I'm getting purified here.",
    color: "#9C27B0"
  },
  {
    source: "Nature Immersion",

    strength: 8.5,
    moments: [
      "Sitting on the swing in the garden by the poppies",
      "Boxing during golden hour with sun hitting your face",
      "Mountain views after the rain with potential snow",
      "Watching the moon rise during sunset on Holi"
    ],
    quote: "The way nature takes care of me is unbeatable. The sun, the moon, bees, flowers, mountains and the blue, blue sky.",
    color: "#4CAF50"
  },
  {
    source: "Physical Vitality",
    strength: 8,
    moments: [
      "Daily boxing training that gives you joy and energy",
      "Feeling your body getting stronger through consistent practice",
      "Approaching your peak physical form",
      "The energy from boxing during sunset"
    ],
    quote: "The training gives me so much joy & energy.",
    color: "#2196F3"
  },
  {
    source: "Authentic Connection",
    strength: 7.5,
    moments: [
      "Family gathering for Holi after 10 years",
      "Deep conversations with mother and friends",
      "Moments of feeling genuinely seen and appreciated",
      "Time with your Guruji and the ashram community"
    ],
    quote: "That feeling of looking at someone & seeing them smile because of you. !!PRICELESS!!",
    color: "#E91E63"
  },
  {
    source: "Creative Purpose",
    strength: 7,
    moments: [
      "Building the Force webapp",
      "Mentoring interns on project development",
      "Channeling your creativity through colors during Holi",
      "Planning new features for your community platform"
    ],
    quote: "I'm really happy with myself that I'm able to do all these things & stick to the routine.",
    color: "#FF9800"
  },
  {
    source: "Inner Harmony",
    strength: 6.5,
    moments: [
      "Moments of blissful state and feeling taken care of",
      "Finding peace in simple routines",
      "Feeling invincible when your mind is clear",
      "The experience of flow state while working"
    ],
    quote: "I'm feeling loved & taken care of and because I'm provided for I can not help but feel invincible that I can do anything that I put my mind to.",
    color: "#00BCD4"
  }
];

interface ClusterPosition {
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor: 'middle' | 'end' | 'start';
  rotation: number;
}

const clusterPositions: ClusterPosition[] = [
  // These are example positions for up to 7 sources (odd numbers only: 3, 5, 7)
  { x: 300, y: 130, labelX: 300, labelY: 70, anchor: 'middle', rotation: 0 }, // Top (Spiritual)
  { x: 240, y: 150, labelX: 200, labelY: 150, anchor: 'end', rotation: -30 }, // Left (Nature)
  { x: 360, y: 150, labelX: 400, labelY: 150, anchor: 'start', rotation: 30 }, // Right (Physical)
  { x: 250, y: 220, labelX: 200, labelY: 230, anchor: 'end', rotation: -15 }, // Lower left (Connection)
  { x: 350, y: 220, labelX: 400, labelY: 230, anchor: 'start', rotation: 15 }, // Lower right (Creative)
  { x: 300, y: 200, labelX: 300, labelY: 260, anchor: 'middle', rotation: 0 }, // Center (Harmony)
  { x: 300, y: 280, labelX: 300, labelY: 300, anchor: 'middle', rotation: 0 }, // Bottom (7th source)
];

// Extracted component so useState is called at the component level (not inside .map)
const HappinessSourceCard = ({ source, index }: { source: HappinessSource; index: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      key={index}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="happiness-card p-4 rounded-lg shadow-md border border-[#d5b493]/65 border-l-4 bg-[#fff8ee]/95 cursor-pointer"
      style={{ borderLeftColor: source.color }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-lg" style={{ color: source.color }}>
          {source.source}
        </h3>
        <div className="flex items-center gap-2">
          <div className="text-sm bg-[#f1dfcb] text-[#6f4a2e] px-2 py-1 rounded">
            Strength: <span className="font-medium">{source.strength}/10</span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: source.color }} />
          ) : (
            <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: source.color }} />
          )}
        </div>
      </div>
      
      {/* Always show quote */}
      <p className="italic text-[#6f4a2e] mb-3 text-sm">&ldquo;{source.quote}&rdquo;</p>
      
      {/* Collapsible moments */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-xs uppercase tracking-wider text-[#9a7655] mb-2">
              Moments of joy:
            </p>
            <ul className="space-y-1 text-sm">
              {source.moments.map((moment, i) => (
                <li key={i} className="flex items-start">
                  <span className="mr-2 mt-1" style={{ color: source.color }}>•</span>
                  <span>{moment}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const HappinessTree = ({ sources }: { sources?: HappinessSource[] }) => {
  const happinessSources = sources && sources.length > 0 ? sources : defaultSources;
  const treeSources: TreeDisplaySource[] = happinessSources.map((source, index) => {
    const colors = resolveDisplayColors(source.color, index);
    return {
      ...source,
      displayColor: colors.primary,
      gradientSecondary: colors.secondary,
    };
  });

  // Interface for TreeLeaf component props
  interface TreeLeafProps {
    x: number;
    y: number;
    color: string;
    rotation: number;
    pulse: boolean;
  }

  // Custom tree leaf component with sway animation
  const TreeLeaf = ({ x, y, color, rotation, pulse }: TreeLeafProps) => {
    const swayDelay = Math.random() * 2;
    const swayDuration = 3 + Math.random() * 2;
    
    return (
      <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
        <path
          d="M0,0 C5,-10 15,-10 20,0 C25,10 15,20 0,20 C-15,20 -25,10 -20,0 C-15,-10 -5,-10 0,0"
          fill={color}
          opacity={0.9}
          style={pulse ? {
            animation: `pulse 3s infinite, sway ${swayDuration}s ease-in-out infinite`,
            animationDelay: `0s, ${swayDelay}s`,
            transformOrigin: 'center'
          } : {
            animation: `sway ${swayDuration}s ease-in-out infinite`,
            animationDelay: `${swayDelay}s`,
            transformOrigin: 'center'
          }}
        />
      </g>
    );
  };

  // Custom styles for animation
  const styles = `
    @keyframes pulse {
      0% { transform: scale(1); opacity: 0.9; }
      50% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 0.9; }
    }
    @keyframes sway {
      0%, 100% { transform: rotate(-2deg); }
      50% { transform: rotate(2deg); }
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .happiness-card { 
      animation: fadeIn 0.6s ease-out; 
      transition: transform 0.3s ease-out, box-shadow 0.3s ease-out;
    }
    .happiness-card:hover { 
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
    }
  `;

  return (
    <div className="p-6 bg-[#fff8ee]/95 border border-[#d5b493]/65 rounded-lg shadow-md">
      <style>{styles}</style>
      <h2 className="text-3xl font-bold mb-6 text-center text-[#2e2012]">Where Your Happiness Lies</h2>
      <p className="text-center text-[#6f4a2e] mb-8">Analysis of joy sources from your journal</p>
      <div className="flex justify-center mb-8 overflow-visible">
        <svg width="100%" height="500" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet" className="overflow-visible">
          {/* Tree trunk and roots */}
          <defs>
            {treeSources.map((source, i) => (
              <linearGradient
                key={`leaf-gradient-${source.source}-${i}`}
                id={`leafGradient-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={source.displayColor} />
                <stop offset="100%" stopColor={source.gradientSecondary} />
              </linearGradient>
            ))}
          </defs>

          {/* Tree trunk and roots */}
          <path d="M300,400 C290,350 290,300 300,250 C310,300 310,350 300,400 Z" fill="#795548" />
          <path d="M300,250 C290,220 288,170 300,130 C312,170 310,220 300,250 Z" fill="#8D6E63" />
          <path d="M300,400 C280,420 250,430 220,435 C260,425 290,415 300,400 Z" fill="#5D4037" />
          <path d="M300,400 C320,420 350,430 380,435 C340,425 310,415 300,400 Z" fill="#5D4037" />
          {/* Dynamic clusters for each happiness source - ensure odd numbers (3, 5, or 7) */}
          {(() => {
            // Ensure odd number of sources
            let count = treeSources.length;
            if (count % 2 === 0) count = Math.max(3, count - 1); // Convert even to odd
            return treeSources.slice(0, Math.min(count, 7));
          })().map((source, i) => {
            const pos = clusterPositions[i] || { x: 300, y: 130, labelX: 300, labelY: 70, anchor: 'middle', rotation: 0 };
            // Add more leaves per cluster if we have 3+ sources
            const leafCount = treeSources.length >= 3 ? 5 : 4;
            const leafFill = `url(#leafGradient-${i})`;
            return (
              <g key={source.source}>
                <TreeLeaf x={pos.x} y={pos.y} color={leafFill} rotation={pos.rotation} pulse={true} />
                <TreeLeaf x={pos.x + 20} y={pos.y - 20} color={leafFill} rotation={pos.rotation + 20} pulse={false} />
                <TreeLeaf x={pos.x - 20} y={pos.y - 20} color={leafFill} rotation={pos.rotation - 20} pulse={false} />
                <TreeLeaf x={pos.x} y={pos.y - 40} color={leafFill} rotation={pos.rotation} pulse={false} />
                {leafCount === 5 && (
                  <TreeLeaf x={pos.x + 10} y={pos.y - 30} color={leafFill} rotation={pos.rotation + 10} pulse={false} />
                )}
                <text x={pos.labelX} y={pos.labelY} textAnchor={pos.anchor} fill={source.displayColor} fontWeight="bold">{source.source}</text>
              </g>
            );
          })}
          {/* Ground */}
          <ellipse cx="300" cy="435" rx="200" ry="20" fill="#A1887F" opacity="0.5" />
          {/* Your roots text */}
          <text x="300" y="470" textAnchor="middle" className="text-lg font-medium">
            Your Happiness Tree
          </text>
        </svg>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {treeSources.map((source, index) => (
          <HappinessSourceCard key={source.source || index} source={{ ...source, color: source.displayColor }} index={index} />
        ))}
      </div>
      <div className="bg-[#f5e8d9] border border-[#e1c8ad] p-5 rounded-lg text-[#5e4028]">
        <h3 className="font-bold text-lg mb-3 text-[#2e2012]">Your Happiness Formula</h3>
        <p className="mb-3">
          {happinessSources.length > 0
            ? `Your journal reveals that your deepest happiness comes from a harmonious balance of ${happinessSources.map(s => s.source).join(', ')}.`
            : 'Your journal reveals that your deepest happiness comes from a harmonious balance of spiritual growth, connection with nature, physical vitality, authentic relationships, creative work, and inner peace.'}
        </p>
        <p className="mb-3">
          {happinessSources.length > 0
            ? `When these elements align—as they did during moments like ${happinessSources[0]?.moments[0] || 'special moments'}—you experience your highest states of contentment and joy.`
            : 'When these elements align—as they did during moments like boxing at sunset, sitting in your garden, or practicing meditation—you experience your highest states of contentment and joy.'}
        </p>
        <p>
          The visualization above represents these sources as a "happiness tree" with roots in balance and branches extending into different domains of well-being that your journal identifies as most meaningful to you.
        </p>
      </div>
      <div className="text-sm text-[#9a7655] mt-8 text-center">
        <p className="italic">Based on qualitative analysis of your journal entries</p>
      </div>
    </div>
  );
};

export default HappinessTree; 