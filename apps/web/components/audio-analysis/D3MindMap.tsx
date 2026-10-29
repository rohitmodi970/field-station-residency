import React, { useState, useEffect } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as d3 from 'd3';

interface MindMapNode {
  id: string;
  label: string;
  group: string;
  value: number;
  color: string;
  details: {
    description: string;
    keyPoints: string[];
    relevance: number;
    sentiment: string;
    connections: string[];
    color: string;
  };
}

interface MindMapLink {
  source: string;
  target: string;
  strength: number;
}

interface D3MindMapProps {
  nodes: MindMapNode[];
  links: MindMapLink[];
  insights: string;
  actionSuggestion: string;
}

export default function D3MindMap({ nodes, links, insights, actionSuggestion }: D3MindMapProps) {
  const [selectedNode, setSelectedNode] = useState<MindMapNode | null>(null);

  // Theme CSS vars
  let cssVars: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    try {
      const root = getComputedStyle(document.documentElement);
      cssVars = {
        text: root.getPropertyValue('--analysis-text') || '#312e81',
        muted: root.getPropertyValue('--analysis-muted') || '#a5b4fc',
        card: root.getPropertyValue('--analysis-card') || '#fff8ee',
        overlay: root.getPropertyValue('--analysis-overlay') || 'radial-gradient(circle at 50% 50%, #f0f4ff 60%, #e0e7ff 100%)'
      };
    } catch (e) {
      cssVars = { text: '#312e81', muted: '#a5b4fc', card: '#fff8ee', overlay: 'radial-gradient(circle at 50% 50%, #f0f4ff 60%, #e0e7ff 100%)' };
    }
  }

  useEffect(() => {
    d3.select('#d3-mind-map-container').selectAll('*').remove();
    if (!nodes || nodes.length === 0) return;

    // Build a hierarchy from the flat node list
    const nodeMap: Record<string, any> = {};
    nodes.forEach(n => {
      nodeMap[n.id] = { ...n, children: [] };
    });
    links.forEach(l => {
      if (nodeMap[l.source] && nodeMap[l.target]) {
        nodeMap[l.source].children = nodeMap[l.source].children || [];
        nodeMap[l.source].children.push(nodeMap[l.target]);
      }
    });
    // Find root (node not targeted by any link)
    const targetIds = new Set(links.map(l => l.target));
    const rootNode = nodes.find(n => !targetIds.has(n.id)) || nodes[0];
    if (!rootNode) return;
    
 
    const hierarchy = d3.hierarchy(nodeMap[rootNode.id])
      .sum((d: any) => d.value);

    // D3 cluster layout
    const width = 900;
    const height = 700;
    const radius = Math.min(width, height) / 2 - 80;
   
    const cluster = d3.cluster().size([360, radius]);
    const root = cluster(hierarchy);

    const svg = d3.select('#d3-mind-map-container')
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', `max-width: 100%; height: auto; background: ${cssVars.overlay};`);

    const g = svg.append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    // Draw links
    g.selectAll('.link')
      .data(root.links())
      .enter().append('path')
      .attr('class', 'link')
      .attr('d', (d: any) => {
        return `M${d.target.y * Math.cos((d.target.x - 90) * Math.PI / 180)},
                 ${d.target.y * Math.sin((d.target.x - 90) * Math.PI / 180)}
                 C${(d.source.y + d.target.y) / 2 * Math.cos((d.target.x - 90) * Math.PI / 180)},
                 ${(d.source.y + d.target.y) / 2 * Math.sin((d.target.x - 90) * Math.PI / 180)}
                 ${(d.source.y + d.target.y) / 2 * Math.cos((d.source.x - 90) * Math.PI / 180)},
                 ${(d.source.y + d.target.y) / 2 * Math.sin((d.source.x - 90) * Math.PI / 180)}
                 ${d.source.y * Math.cos((d.source.x - 90) * Math.PI / 180)},
                 ${d.source.y * Math.sin((d.source.x - 90) * Math.PI / 180)}`;
      })
      .style('fill', 'none')
      .style('stroke', cssVars.muted || '#a5b4fc')
      .style('stroke-width', (d: any) => {
        const target = d.target as any;
        return Math.max(2, target.data.value / 18);
      })
      .style('filter', 'url(#link-glow)');

    // Add SVG filter for glowing links
    const defs = svg.append('defs');
    const filter = defs.append('filter').attr('id', 'link-glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'coloredBlur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Color palette for nodes
    const palette = [
      '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#F43F5E', '#A21CAF', '#F472B6', '#FBBF24', '#22D3EE', '#84CC16', '#E11D48'
    ];

    // Draw nodes
    const node = g.selectAll('.node')
      .data(root.descendants())
      .enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => {
        return `translate(${d.y * Math.cos((d.x - 90) * Math.PI / 180)},
                           ${d.y * Math.sin((d.x - 90) * Math.PI / 180)})`;
      });
      
    // @ts-expect-error - d3 event handler types not fully recognized
    node.on('click', (event: any, d: any) => {
      event.stopPropagation();
      setSelectedNode(d.data as MindMapNode);
    });

    const circles = node.append('circle')
      .attr('r', (d: any) => Math.max(18, (d.data as MindMapNode).value / 4))
      .style('fill', (_d: any, i: number) => palette[i % palette.length])
      .style('stroke', cssVars.card || '#fff')
      .style('stroke-width', 3)
      .style('cursor', 'pointer')
      .style('filter', `drop-shadow(0 0 12px ${cssVars.muted || '#818cf8'})`);
    
    // @ts-expect-error - d3 event handler types not fully recognized
    circles.on('mouseover', function (this: any) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', 38)
        .style('filter', `drop-shadow(0 0 24px ${cssVars.muted || '#6366f1'})`);
    });
    
    // @ts-expect-error - d3 event handler types not fully recognized
    circles.on('mouseout', function (this: any, _event: any, d: any) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', () => Math.max(18, (d.data as MindMapNode).value / 4))
        .style('filter', `drop-shadow(0 0 12px ${cssVars.muted || '#818cf8'})`);
    });

    node.append('text')
      .attr('dy', (d: any) => d.x < 180 ? '1.5em' : '-0.5em')
      .attr('dx', (d: any) => d.x < 180 ? 16 : -16)
      .attr('text-anchor', (d: any) => d.x < 180 ? 'start' : 'end')
      .text((d: any) => (d.data as MindMapNode).label)
      .style('font-size', '1.1em')
      .style('font-family', 'Poppins, sans-serif')
      .style('font-weight', 600)
      .style('fill', cssVars.text || '#312e81')
      .style('cursor', 'pointer')
      .style('text-shadow', '0 2px 8px #e0e7ff');

    // @ts-expect-error - d3 event handler types not fully recognized
    svg.on('click', () => {
      setSelectedNode(null);
    });

    return () => {
      // Cleanup
    };
  }, [nodes, links]);

  return (
    <div className="p-6 rounded-xl shadow-lg" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.08)' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: 'var(--analysis-text)' }}>Mind Map Analysis</h2>
        <div className="text-sm" style={{ color: 'var(--analysis-muted)' }}>Click nodes to explore connections</div>
      </div>
      <div id="d3-mind-map-container" className="w-full h-80 mb-6" />
      {selectedNode && (
        <div className="p-4 rounded-lg mb-4 transition-all duration-300 ease-in-out" style={{ background: 'var(--analysis-card)', border: '1px solid rgba(147,114,95,0.08)' }}>
          <h3 className="font-bold text-lg" style={{ color: 'var(--analysis-text)' }}>{selectedNode.label}</h3>
          {selectedNode.details?.description && (
            <p style={{ color: 'var(--analysis-muted)' }} className="mt-2">{selectedNode.details.description}</p>
          )}
          {selectedNode.details?.keyPoints && selectedNode.details.keyPoints.length > 0 && (
            <ul className="list-disc list-inside mt-2" style={{ color: 'var(--analysis-muted)' }}>
              {selectedNode.details.keyPoints.map((kp, i) => (
                <li key={i}>{kp}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center">
            <div className="w-full rounded-full h-2" style={{ background: 'rgba(229,208,183,0.6)' }}>
              <div
                className="h-2 rounded-full"
                style={{ width: `${selectedNode.value}%`, background: 'var(--analysis-muted)' }}
              ></div>
            </div>
            <span className="ml-2 text-sm" style={{ color: 'var(--analysis-muted)' }}>{selectedNode.value}%</span>
          </div>
        </div>
      )}
      <div className="mt-4">
        <h3 className="font-medium mb-2" style={{ color: 'var(--analysis-text)' }}>Mind Map Insights</h3>
        <p style={{ color: 'var(--analysis-muted)' }}>{insights}</p>
        <div className="mt-4 p-3 text-sm" style={{ background: 'var(--analysis-card)', borderLeft: '4px solid rgba(139,93,54,0.9)', color: 'var(--analysis-muted)' }}>
          <strong>Action Suggestion:</strong> {actionSuggestion}
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <button className="px-4 py-2 text-white rounded-lg" style={{ background: 'var(--analysis-muted)' }}>
          Export Mind Map
        </button>
        <button className="px-4 py-2 rounded-lg" style={{ border: '1px solid var(--analysis-muted)', color: 'var(--analysis-muted)', background: 'transparent' }}>
          Track Mental Changes
        </button>
      </div>
    </div>
  );
} 