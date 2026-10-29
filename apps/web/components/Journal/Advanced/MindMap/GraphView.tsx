"use client"
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { zoom, zoomIdentity, ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from 'd3-force';

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
  source: string | Node;
  target: string | Node;
  similarity?: number;
}

interface GraphViewProps {
  nodes: Node[];
  links: Link[];
  onNodeClick?: (node: Node, event: any) => void;
  onNodeDrag?: (node: Node) => void;
  boundaryRadius?: number;
  onZoomChange?: (svgElement: SVGSVGElement) => void;
  selectedCategory?: string | null;
}

const GraphView: React.FC<GraphViewProps> = ({ 
  nodes, 
  links, 
  onNodeClick, 
  onNodeDrag, 
  boundaryRadius = 350,
  onZoomChange,
  selectedCategory
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const centerX = width / 2;
    const centerY = height / 2;

    const container = svg.append('g');

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: any) => {
        container.attr('transform', event.transform);
      });

    (svg as any).call(zoomBehavior);
    
    // Set initial zoom to show full mindmap
    (svg as any).call(zoomBehavior.transform, zoomIdentity.translate(centerX, centerY).scale(0.6).translate(-centerX, -centerY));

    const defs = svg.append('defs');
    
    // Warm orb gradient + dotted pattern for Reflection Studio consistency
    const radialGradient = defs.append('radialGradient')
      .attr('id', 'circularGradient')
      .attr('cx', '30%')
      .attr('cy', '30%');
    
    radialGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#fffaf2')
      .attr('stop-opacity', 0.95);
    
    radialGradient.append('stop')
      .attr('offset', '30%')
      .attr('stop-color', '#f8ecdc')
      .attr('stop-opacity', 0.75);
    
    radialGradient.append('stop')
      .attr('offset', '60%')
      .attr('stop-color', '#f1dfcb')
      .attr('stop-opacity', 0.55);
    
    radialGradient.append('stop')
      .attr('offset', '85%')
      .attr('stop-color', '#e6ccb1')
      .attr('stop-opacity', 0.45);
    
    radialGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#d8b696')
      .attr('stop-opacity', 0.35);

    const dotPattern = defs.append('pattern')
      .attr('id', 'mindmapDots')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 16)
      .attr('height', 16)
      .attr('patternUnits', 'userSpaceOnUse');

    dotPattern.append('circle')
      .attr('cx', 3)
      .attr('cy', 3)
      .attr('r', 1.3)
      .attr('fill', '#b2875f')
      .attr('opacity', 0.2);

    dotPattern.append('circle')
      .attr('cx', 11)
      .attr('cy', 11)
      .attr('r', 0.9)
      .attr('fill', '#b2875f')
      .attr('opacity', 0.14);

    const canvasPattern = defs.append('pattern')
      .attr('id', 'mindmapCanvasDots')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse');

    canvasPattern.append('rect')
      .attr('width', 20)
      .attr('height', 20)
      .attr('fill', '#f6ead7');

    canvasPattern.append('circle')
      .attr('cx', 4)
      .attr('cy', 4)
      .attr('r', 1.1)
      .attr('fill', '#b2875f')
      .attr('opacity', 0.16);

    canvasPattern.append('circle')
      .attr('cx', 14)
      .attr('cy', 14)
      .attr('r', 0.85)
      .attr('fill', '#b2875f')
      .attr('opacity', 0.12);

    container.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'url(#mindmapCanvasDots)')
      .attr('opacity', 1)
      .style('pointer-events', 'none');

    // Outer atmospheric glow for glass bubble
    container.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', boundaryRadius + 20)
      .attr('fill', 'none')
      .attr('stroke', '#d2a982')
      .attr('stroke-width', 40)
      .attr('opacity', 0.15)
      .style('filter', 'blur(24px)');

    // Main glass bubble with gradient and breathing animation
    const mainOrb = container.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', boundaryRadius)
      .attr('fill', 'url(#circularGradient)')
      .attr('stroke', '#f5e8d9')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.85)
      .attr('class', 'breathing-orb')
      .style('filter', 'drop-shadow(0 10px 36px rgba(127, 79, 47, 0.18)) drop-shadow(0 0 70px rgba(210, 169, 130, 0.18))');

    container.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', boundaryRadius - 8)
      .attr('fill', 'url(#mindmapDots)')
      .attr('opacity', 0.62)
      .style('mix-blend-mode', 'multiply')
      .style('pointer-events', 'none');
    
    // Add CSS animation for breathing effect
    const style = document.createElement('style');
    style.textContent = `
      @keyframes breathe {
        0%, 100% { transform: scale(1); opacity: 0.85; }
        50% { transform: scale(1.05); opacity: 1; }
      }
      .breathing-orb {
        animation: breathe 4s ease-in-out infinite;
        transform-origin: ${centerX}px ${centerY}px;
      }
    `;
    if (!document.getElementById('breathing-orb-style')) {
      style.id = 'breathing-orb-style';
      document.head.appendChild(style);
    }

    // Primary glass highlight (top-left)
    container.append('ellipse')
      .attr('cx', centerX - boundaryRadius * 0.35)
      .attr('cy', centerY - boundaryRadius * 0.35)
      .attr('rx', boundaryRadius * 0.25)
      .attr('ry', boundaryRadius * 0.35)
      .attr('fill', 'white')
      .attr('opacity', 0.45)
      .style('filter', 'blur(20px)')
      .style('pointer-events', 'none');

    // Secondary glass highlight (sharper)
    container.append('circle')
      .attr('cx', centerX - boundaryRadius * 0.25)
      .attr('cy', centerY - boundaryRadius * 0.25)
      .attr('r', boundaryRadius * 0.15)
      .attr('fill', 'white')
      .attr('opacity', 0.55)
      .style('filter', 'blur(8px)')
      .style('pointer-events', 'none');

    // Bottom reflection for depth
    container.append('ellipse')
      .attr('cx', centerX + boundaryRadius * 0.15)
      .attr('cy', centerY + boundaryRadius * 0.6)
      .attr('rx', boundaryRadius * 0.4)
      .attr('ry', boundaryRadius * 0.15)
      .attr('fill', 'white')
      .attr('opacity', 0.15)
      .style('filter', 'blur(15px)')
      .style('pointer-events', 'none');

    // Edge rim highlight
    container.append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', boundaryRadius - 5)
      .attr('fill', 'none')
      .attr('stroke', '#f8ecdc')
      .attr('stroke-width', 3)
      .attr('opacity', 0.45)
      .style('filter', 'blur(2px)')
      .style('pointer-events', 'none');

    // Softer, energy-aligned color palette for soothing experience
    const categoryColors: Record<string, string> = {
      people: '#FF8FA3',       // Soft rose - Heart energy (more saturated)
      work: '#7FB3D5',         // Powder blue - Calm focus (more saturated)
      health: '#81D4AF',       // Mint green - Vitality (more saturated)
      emotions: '#C89FD8',     // Lavender - Emotional flow (more saturated)
      learning: '#FFD54F',     // Golden - Wisdom (more saturated)
      hobbies: '#80DEEA',      // Turquoise - Joy (more saturated)
      places: '#9FA8DA',       // Periwinkle - Expansion (more saturated)
      goals: '#FFF176',        // Yellow - Aspiration (more saturated)
      events: '#FFAB91',       // Coral - Celebration (more saturated)
      daily: '#A5D6A7'         // Sage green - Grounding (more saturated)
    };
    
    const categoryGlows: Record<string, string> = {
      people: '0 0 20px rgba(255, 143, 163, 0.6)',
      work: '0 0 20px rgba(127, 179, 213, 0.6)',
      health: '0 0 20px rgba(129, 212, 175, 0.6)',
      emotions: '0 0 20px rgba(200, 159, 216, 0.6)',
      learning: '0 0 20px rgba(255, 213, 79, 0.6)',
      hobbies: '0 0 20px rgba(128, 222, 234, 0.6)',
      places: '0 0 20px rgba(159, 168, 218, 0.6)',
      goals: '0 0 20px rgba(255, 241, 118, 0.6)',
      events: '0 0 20px rgba(255, 171, 145, 0.6)',
      daily: '0 0 20px rgba(165, 214, 167, 0.6)'
    };

    const graphNodes = nodes.map(n => ({ ...n }));
    const graphLinks = links.map(l => ({ ...l }));

    const simulation = forceSimulation(graphNodes as any)
      .force('link', forceLink(graphLinks)
        .id((d: any) => d.id)
        .distance(240)) // Long edges for better visual separation
      .force('charge', forceManyBody().strength(-300))
      .force('center', forceCenter(centerX, centerY))
      .force('collision', forceCollide().radius(30));

    const link = container.append('g')
      .selectAll('line')
      .data(graphLinks)
      .enter()
      .append('line')
      .attr('stroke', '#9a7655')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', (d: any) => {
        if (!selectedCategory) return 0.6;
        const sourceNode = graphNodes.find((n: any) => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
        const targetNode = graphNodes.find((n: any) => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
        const isHighlighted = (sourceNode?.category === selectedCategory) || (targetNode?.category === selectedCategory);
        return isHighlighted ? 0.6 : 0.15;
      });

    const node = container.append('g')
      .selectAll('g')
      .data(graphNodes)
      .enter()
      .append('g');
    
    (node as any).call(drag<SVGGElement, any>()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended));

    // Add gradients for each node
    graphNodes.forEach((d: any) => {
      const color = categoryColors[d.category] || '#64748b';
      const gradient = defs.append('radialGradient')
        .attr('id', `gradient-${d.id}`)
        .attr('cx', '30%')
        .attr('cy', '30%');
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', color)
        .attr('stop-opacity', '1');
      
      gradient.append('stop')
        .attr('offset', '70%')
        .attr('stop-color', color)
        .attr('stop-opacity', '0.85');
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', color)
        .attr('stop-opacity', '0.7');
    });

    // Fixed node size constant
    const NODE_SIZE = 16;
    const HIGHLIGHTED_SIZE = 24;
    const GLOW_SIZE = NODE_SIZE + 10;
    const HIGHLIGHTED_GLOW_SIZE = HIGHLIGHTED_SIZE + 14;

    // Glow effect circles - dynamic size based on selection
    const glows = node.append('circle')
      .attr('r', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? HIGHLIGHTED_GLOW_SIZE : GLOW_SIZE;
      })
      .attr('fill', (d: any) => categoryColors[d.category] || '#64748b')
      .attr('opacity', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? 0.35 : 0.1;
      })
      .style('filter', 'blur(12px)');

    // Main orb circles - dynamic size based on selection
    const circles = node.append('circle')
      .attr('r', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
      })
      .attr('fill', (d: any) => `url(#gradient-${d.id})`)
      .attr('opacity', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? 1 : 0.3;
      })
      .style('cursor', 'pointer')
      .style('filter', (d: any) => {
        const color = categoryColors[d.category] || '#64748b';
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? `drop-shadow(0 4px 12px ${color}40)` : `drop-shadow(0 2px 6px ${color}20)`;
      });
    
    // Inner highlight - dynamic size based on selection
    node.append('circle')
      .attr('r', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        const size = isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
        return size * 0.35;
      })
      .attr('cx', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        const size = isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
        return -size * 0.25;
      })
      .attr('cy', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        const size = isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
        return -size * 0.25;
      })
      .attr('fill', 'white')
      .attr('opacity', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? 0.35 : 0.15;
      })
      .style('pointer-events', 'none');
    
    // Hover effects - respect selection state with ripple animation
    (circles as any).on('mouseenter', function(this: SVGCircleElement, event: any, d: any) {
      const isHighlighted = !selectedCategory || d.category === selectedCategory;
      const baseSize = isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
      const nodeColor = categoryColors[d.category] || '#64748b';
      
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', baseSize * 1.3) // Grow on hover
        .style('filter', (d: any) => categoryGlows[d.category] || '0 0 25px #64748b');
      
      // Enhance glow on hover
      if (this.parentNode) {
        d3.select(this.parentNode as Element).select('circle:first-child')
          .transition()
          .duration(200)
          .attr('r', (d: any) => {
            const linkCount = links.filter(l => 
              (typeof l.source === 'string' ? l.source : (l.source as any).id) === d.id || 
              (typeof l.target === 'string' ? l.target : (l.target as any).id) === d.id
            ).length;
            return 12 + linkCount * 2 + 18;
          })
          .attr('opacity', 0.4);
        
        // Create ripple effect
        const nodeGroup = d3.select(this.parentNode as Element);
        const ripple = nodeGroup.append('circle')
          .attr('r', baseSize)
          .attr('fill', 'none')
          .attr('stroke', nodeColor)
          .attr('stroke-width', 2)
          .attr('opacity', 1)
          .transition()
          .duration(1000)
          .attr('r', baseSize * 2.5)
          .attr('opacity', 0)
          .on('end', function(this: SVGCircleElement) { d3.select(this).remove(); });
      }
    });
    
    (circles as any).on('mouseleave', function(this: SVGCircleElement, event: any, d: any) {
      const isHighlighted = !selectedCategory || d.category === selectedCategory;
      const baseSize = isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
      const baseGlowSize = isHighlighted ? HIGHLIGHTED_GLOW_SIZE : GLOW_SIZE;
      
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', baseSize) // Restore size based on selection
        .style('filter', (d: any) => {
          const color = categoryColors[d.category] || '#64748b';
          return isHighlighted ? `drop-shadow(0 4px 12px ${color}40)` : `drop-shadow(0 2px 6px ${color}20)`;
        });
      
      // Reset glow
      if (this.parentNode) {
        d3.select(this.parentNode as Element).select('circle:first-child')
          .transition()
          .duration(200)
          .attr('r', baseGlowSize) // Restore glow size based on selection
          .attr('opacity', isHighlighted ? 0.35 : 0.1);
      }
    });
    
    (circles as any).on('click', (event: any, d: any) => {
      event.stopPropagation();
      onNodeClick && onNodeClick(d, event);
    });

    node.append('text')
      .text((d: any) => d.label)
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        const size = isHighlighted ? HIGHLIGHTED_SIZE : NODE_SIZE;
        return size + 14;
      })
      .attr('fill', '#3f2b1a')
      .attr('opacity', (d: any) => {
        const isHighlighted = !selectedCategory || d.category === selectedCategory;
        return isHighlighted ? 1 : 0.3;
      })
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .style('pointer-events', 'none')
      .style('user-select', 'none');

    simulation.on('tick', () => {
      graphNodes.forEach((node: any) => {
        const dx = node.x - centerX;
        const dy = node.y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > boundaryRadius) {
          const scale = boundaryRadius / distance;
          node.x = centerX + dx * scale;
          node.y = centerY + dy * scale;
        }
      });

      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      const dx = event.x - centerX;
      const dy = event.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance <= boundaryRadius) {
        d.fx = event.x;
        d.fy = event.y;
      } else {
        const scale = boundaryRadius / distance;
        d.fx = centerX + dx * scale;
        d.fy = centerY + dy * scale;
      }
      
      onNodeDrag && onNodeDrag(d);
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, links, dimensions, boundaryRadius, onNodeClick, onNodeDrag, selectedCategory]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{ background: '#f6ead7' }}
    />
  );
};

export default GraphView;
