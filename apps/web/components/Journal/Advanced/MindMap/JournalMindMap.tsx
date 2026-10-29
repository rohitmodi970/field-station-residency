"use client"
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import GraphView from './GraphView';
import NodePopover from './NodePopover';
import Legend from './Legend';

interface Node {
  id: string;
  label: string;
  category: string;
  description?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface Link {
  source: string;
  target: string;
  similarity?: number;
  connectionReason?: string;
  sourceLabel?: string;
  targetLabel?: string;
}

interface Connection {
  nodeId: string;
  nodeLabel: string;
  reason: string;
  similarity: number;
}

interface MindmapCluster {
  clusterTitle: string;
  theme: string;
  patternFlow: string[];
  insight: string;
  supportingEntries: string[];
}

interface JournalMindMapProps {
  nodes: Node[];
  links: Link[];
  mindmapInsight?: {
    physical: string;
    mental: string;
    spiritual: string;
  };
  mindmapClusters?: MindmapCluster[];
}

// Collapsible Insight Card — Mirror → Meaning → Movement format
const InsightCard: React.FC<{
  icon: string;
  title: string;
  text: string;
  color: string;
}> = ({ icon, title, text, color }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-gradient-to-br ${color} rounded-xl shadow-md p-4`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{icon}</span>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-xs leading-relaxed text-gray-700">{text}</p>
    </motion.div>
  );
};

// Cluster Card — shows pattern flow and supporting entries
const ClusterCard: React.FC<{
  cluster: MindmapCluster;
  index: number;
}> = ({ cluster, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = [
    'border-[#d5b493] bg-[#f5e8d9]',
    'border-[#d5b493] bg-[#f5e8d9]',
    'border-[#d5b493] bg-[#f5e8d9]',
  ];
  const color = colors[index % colors.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`rounded-xl border-l-4 ${color} p-4 cursor-pointer`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm text-slate-800">{cluster.clusterTitle}</h4>
        <button className="p-0.5 rounded hover:bg-[#fff8ee]/60 transition-colors" aria-label={isExpanded ? "Collapse" : "Expand"}>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>
      </div>
      <p className="text-xs text-slate-600 mb-2">{cluster.theme}</p>

      {/* Pattern Flow — always visible */}
      {cluster.patternFlow && cluster.patternFlow.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {cluster.patternFlow.map((step, i) => (
            <React.Fragment key={i}>
              <span className="text-xs bg-[#fff8ee]/80 rounded px-2 py-0.5 text-[#5e4028] font-medium">{step}</span>
              {i < cluster.patternFlow.length - 1 && <span className="text-slate-400 text-xs">→</span>}
            </React.Fragment>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-700 italic">{cluster.insight}</p>

      {/* Supporting entries — expandable */}
      <AnimatePresence>
        {isExpanded && cluster.supportingEntries && cluster.supportingEntries.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 pt-3 border-t border-[#e5d0b7] space-y-1"
          >
            <span className="text-xs font-medium text-slate-500">Supporting entries:</span>
            {cluster.supportingEntries.map((entry, i) => (
              <p key={i} className="text-xs text-slate-600 pl-2 border-l-2 border-slate-300">
                &ldquo;{entry}&rdquo;
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const JournalMindMap: React.FC<JournalMindMapProps> = ({ nodes, links, mindmapInsight, mindmapClusters }) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [popoverSide, setPopoverSide] = useState<'right' | 'left'>('right');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Build a map of node IDs to labels for quick lookup
  const nodeLabelsMap = useMemo(() => {
    return new Map(nodes.map(n => [n.id, n.label]));
  }, [nodes]);

  // Compute connections for the selected node
  const selectedNodeConnections = useMemo<Connection[]>(() => {
    if (!selectedNode) return [];
    
    const connections: Connection[] = [];
    
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
      
      if (sourceId === selectedNode.id) {
        // This node is the source, connected to target
        connections.push({
          nodeId: targetId,
          nodeLabel: link.targetLabel || nodeLabelsMap.get(targetId) || 'Entry',
          reason: link.connectionReason || 'Similar content',
          similarity: link.similarity || 0.5
        });
      } else if (targetId === selectedNode.id) {
        // This node is the target, connected to source
        connections.push({
          nodeId: sourceId,
          nodeLabel: link.sourceLabel || nodeLabelsMap.get(sourceId) || 'Entry',
          reason: link.connectionReason || 'Similar content',
          similarity: link.similarity || 0.5
        });
      }
    });
    
    // Sort by similarity (highest first)
    return connections.sort((a, b) => b.similarity - a.similarity);
  }, [selectedNode, links, nodeLabelsMap]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleNodeClick = useCallback((node: Node, event: any) => {
    setSelectedNode(node);
    // Convert mouse event coordinates to container-relative position
    if (containerRef.current && event) {
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = event.clientX || event.sourceEvent?.clientX || 0;
      const clientY = event.clientY || event.sourceEvent?.clientY || 0;
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      // If the click is in the right 55% of the container, show popover on the left
      const side = relX > rect.width * 0.55 ? 'left' : 'right';
      setPopoverSide(side);
      setPopoverPosition({ x: relX, y: relY });
    } else {
      setPopoverPosition({ x: node.x || 0, y: node.y || 0 });
    }
  }, []);

  const handleNodeDrag = useCallback((node: Node) => {
    // Node dragged handler
  }, []);

  return (
    <div className="w-full">
      <div ref={containerRef} className="relative w-full" style={{ height: '600px' }}>
        <GraphView
          nodes={nodes}
          links={links}
          onNodeClick={handleNodeClick}
          onNodeDrag={handleNodeDrag}
          boundaryRadius={450}
          selectedCategory={selectedCategory}
        />
        <Legend 
          selectedCategory={selectedCategory}
          onCategoryClick={(category) => setSelectedCategory(category === selectedCategory ? null : category)}
        />
        <NodePopover
          node={selectedNode}
          position={popoverPosition}
          side={popoverSide}
          onClose={() => setSelectedNode(null)}
          connections={selectedNodeConnections}
        />
      </div>
      
      {/* Mindmap Clusters — Pattern Flow Cards */}
      {mindmapClusters && mindmapClusters.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
            <span>🔗</span> Top Pattern Clusters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {mindmapClusters.slice(0, 3).map((cluster, idx) => (
              <ClusterCard key={idx} cluster={cluster} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Health Insights — Compact Mirror cards */}
      {mindmapInsight && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {mindmapInsight.physical && (
            <InsightCard
              icon="💪"
              title="Physical Energy"
              text={mindmapInsight.physical}
              color="from-[#f5e8d9] to-[#fff8ee]"
            />
          )}
          {mindmapInsight.mental && (
            <InsightCard
              icon="🧠"
              title="Mental Clarity"
              text={mindmapInsight.mental}
              color="from-[#f5e8d9] to-[#fff8ee]"
            />
          )}
          {mindmapInsight.spiritual && (
            <InsightCard
              icon="✨"
              title="Purpose & Direction"
              text={mindmapInsight.spiritual}
              color="from-[#f5e8d9] to-[#fff8ee]"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default JournalMindMap;
