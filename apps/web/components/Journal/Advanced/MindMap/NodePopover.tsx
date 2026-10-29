"use client"
import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Link2, Maximize2, Minimize2 } from 'lucide-react';

interface Connection {
  nodeId: string;
  nodeLabel: string;
  reason: string;
  similarity: number;
}

interface Node {
  id: string;
  label: string;
  category: string;
  description?: string;
}

interface NodePopoverProps {
  node: Node | null;
  position: { x: number; y: number };
  side?: 'right' | 'left';
  onClose: () => void;
  connections?: Connection[];
}

const NodePopover: React.FC<NodePopoverProps> = ({ node, position, side = 'right', onClose, connections = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCompressed, setIsCompressed] = useState(false);
  
  if (!node) return null;

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      people: 'bg-[#f2dfc7] text-[#6f4a2e]',
      work: 'bg-[#f2dfc7] text-[#6f4a2e]',
      health: 'bg-[#f2dfc7] text-[#6f4a2e]',
      emotions: 'bg-[#f2dfc7] text-[#6f4a2e]',
      learning: 'bg-[#f2dfc7] text-[#6f4a2e]',
      hobbies: 'bg-[#f2dfc7] text-[#6f4a2e]',
      places: 'bg-[#f2dfc7] text-[#6f4a2e]',
      goals: 'bg-[#f2dfc7] text-[#6f4a2e]',
      events: 'bg-[#f2dfc7] text-[#6f4a2e]',
      daily: 'bg-[#f2dfc7] text-[#6f4a2e]'
    };
    return colors[category] || 'bg-[#f2dfc7] text-[#6f4a2e]';
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      people: 'People & Relationships',
      work: 'Work & Career',
      health: 'Health & Wellness',
      emotions: 'Emotions & Feelings',
      learning: 'Learning & Growth',
      hobbies: 'Hobbies & Leisure',
      places: 'Places & Travel',
      goals: 'Goals & Aspirations',
      events: 'Events & Occasions',
      daily: 'Daily Life'
    };
    return labels[category] || category;
  };

  const hasConnections = connections.length > 0;
  const topConnections = connections.slice(0, 5); // Cap at 5 connections max
  const displayedConnections = isExpanded ? topConnections : topConnections.slice(0, 3);
  const hasMoreConnections = topConnections.length > 3;

  return (
    <>
      {/* Backdrop for click-outside-to-close */}
      <div 
        className="absolute inset-0 z-40"
        onClick={onClose}
        style={{ pointerEvents: 'all' }}
      />
      
      {/* Popover content - positioned to the side of the click point, vertically centered */}
      <div 
        className={`absolute z-50 animate-in fade-in duration-200 ${side === 'right' ? 'slide-in-from-left-2' : 'slide-in-from-right-2'}`}
        style={{
          ...(side === 'right'
            ? { left: `${position.x + 20}px` }
            : { right: `calc(100% - ${position.x - 20}px)` }),
          top: `${Math.max(20, Math.min(position.y, 580))}px`,
          transform: 'translateY(-50%)',
          pointerEvents: 'all'
        }}
      >
        <div 
          className={`shadow-2xl border-2 border-[#d5b493]/65 bg-[#fff8ee]/95 rounded-lg overflow-hidden flex flex-col transition-all duration-300 ${
            isCompressed ? 'w-72 max-h-[200px]' : 'w-96 max-h-[500px]'
          }`}
        >
          <div className="p-4 border-b border-[#e5d0b7]">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[#2e2012] text-base mb-1 break-words">
                  {node.label}
                </h3>
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCategoryColor(node.category)}`}>
                  {getCategoryLabel(node.category)}
                </span>
              </div>
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                <button
                  className="h-7 w-7 rounded hover:bg-[#f5e8d9] flex items-center justify-center transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCompressed(!isCompressed);
                  }}
                  title={isCompressed ? "Expand popup" : "Compress popup"}
                >
                  {isCompressed ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  className="h-7 w-7 rounded hover:bg-[#f5e8d9] flex items-center justify-center transition-colors"
                  onClick={onClose}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        
        {/* Connection Reasons Section */}
        <div className="flex-1 overflow-y-auto">
          {hasConnections ? (
            <div className="p-3">
              {!isCompressed && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="w-4 h-4 text-[#856347]" />
                    <span className="text-sm font-medium text-[#6f4a2e]">
                      Top {topConnections.length} of {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {displayedConnections.map((conn, idx) => (
                      <div 
                        key={conn.nodeId || idx}
                        className="bg-[#f7e9db] rounded-lg p-3 border border-[#e1c8ad]"
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <span className="text-sm font-medium text-[#5e4028] break-words flex-1 pr-2">
                            {conn.nodeLabel}
                          </span>
                          <span className="text-xs text-[#9a7655] flex-shrink-0">
                            {(conn.similarity * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-[#6f4a2e] leading-relaxed whitespace-pre-wrap break-words">
                          {conn.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  {hasMoreConnections && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="w-full mt-3 flex items-center justify-center gap-1 py-2 text-sm text-[#856347] hover:text-[#5e4028] hover:bg-[#f5e8d9] rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          Show {topConnections.length - 3} more
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
              
              {isCompressed && (
                <div className="text-sm text-[#6f4a2e]">
                  {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-[#9a7655]">
              <Link2 className="w-5 h-5 mx-auto mb-2 opacity-50" />
              No connections yet
            </div>
          )}
        </div>
      </div>
      {side === 'right' ? (
        <div 
          className="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#fff8ee] border-l-2 border-b-2 border-[#d5b493] rotate-45"
        />
      ) : (
        <div 
          className="absolute top-1/2 right-0 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#fff8ee] border-r-2 border-t-2 border-[#d5b493] rotate-45"
        />
      )}
    </div>
    </>
  );
};

export default NodePopover;
