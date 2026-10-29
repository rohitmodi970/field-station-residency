'use client';
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import cloud from 'd3-cloud';

// Type definitions for d3-cloud
interface CloudWord {
  text: string;
  size: number;
  x?: number;
  y?: number;
  rotate?: number;
}

interface CloudLayout {
  size(size: [number, number]): CloudLayout;
  words(words: CloudWord[]): CloudLayout;
  padding(padding: number): CloudLayout;
  rotate(rotate: () => number): CloudLayout;
  fontSize(fontSize: (d: CloudWord) => number): CloudLayout;
  spiral(spiral: string): CloudLayout;
  on(event: string, listener: (words: CloudWord[]) => void): CloudLayout;
  start(): void;
}

interface ActivityWordCloudProps {
  words: string[]; // Array of words from API response, most important first
}

interface WordData extends CloudWord {
  color: string;
}

const colorPalette = [
  '#6baed6', '#74c476', '#fd8d3c', '#9e9ac8', '#e377c2', '#fdd0a2', '#bcbddc', 
  '#c7e9c0', '#fdae6b', '#c6dbef', '#ff9896', '#c49c94', '#f7b6d2', '#dbdb8d', 
  '#17becf', '#aec7e8', '#ffbb78', '#98df8a', '#ff7f0e', '#2ca02c'
];

const ActivityWordCloud: React.FC<ActivityWordCloudProps> = ({ words }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const width = Math.min(containerWidth, 700);
        const height = Math.min(Math.max(300, width * 0.6), 450);
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  useEffect(() => {
    if (!containerRef.current || !words || !words.length) return;
    
    // Clear any existing SVG
    d3.select(containerRef.current).select('svg').remove();
    
    const { width, height } = dimensions;
    
    // Limit number of words based on screen size to prevent overflow
    const maxWords = width < 400 ? 15 : width < 600 ? 25 : 35;
    
    // Prepare data - limit words and adjust sizes
    const wordData: WordData[] = words
      .slice(0, maxWords) // Limit number of words
      .filter(word => typeof word === 'string' && word.trim().length > 0)
      .map((word, index) => {
        // Calculate size based on importance and container size
        const baseSizeFactor = width < 400 ? 0.6 : width < 600 ? 0.8 : 1;
        const maxSize = 45 * baseSizeFactor;
        const minSize = 12 * baseSizeFactor;
        const sizeRange = maxSize - minSize;
        const size = maxSize - Math.min((index / maxWords) * sizeRange, sizeRange);
        
        return {
          text: word,
          size: Math.max(size, minSize),
          color: (colorPalette[index % colorPalette.length] || colorPalette[0]) as string
        };
      });
    
    // Create layout with responsive settings
    const layout = (cloud() as unknown as CloudLayout)
      .size([width, height])
      .words(wordData)
      .padding(width < 400 ? 3 : 5) // Less padding on small screens
      .rotate(() => (Math.random() > 0.7 ? 90 : 0)) // Less rotation for better readability
      .fontSize((d: CloudWord) => d.size)
      .spiral('archimedean') // Use archimedean spiral for better word placement
      .on('end', draw);
    
    layout.start();
    
    // Draw function
    function draw(words: CloudWord[]) {
      if (!containerRef.current) return;
      
      // Map CloudWord[] back to WordData[] by finding the original color
      const wordsWithColor = words.map(word => {
        const originalWord = wordData.find(w => w.text === word.text);
        return { ...word, color: originalWord?.color || colorPalette[0] } as WordData;
      });
      
      const svg = d3.select(containerRef.current as HTMLDivElement)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .append('g')
        .attr('transform', `translate(${width / 2},${height / 2})`);
        
      svg.selectAll('text')
        .data(wordsWithColor)
        .enter()
        .append('text')
        .style('font-size', (d: WordData) => `${d.size}px`)
        .style('font-family', 'sans-serif')
        .style('fill', (d: WordData) => d.color)
        .attr('text-anchor', 'middle')
        .attr('transform', (d: WordData) => `translate(${d.x || 0},${d.y || 0}) rotate(${d.rotate || 0})`)
        .text((d: WordData) => d.text)
        .style('cursor', 'pointer')
        .style('transition', 'all 0.2s')
        //@ts-ignore
        .on('mouseover', function(this: SVGTextElement) {
          d3.select(this).style('opacity', 0.7).style('font-weight', 'bold');
        })
        .on('mouseout', function(this: SVGTextElement) {
          d3.select(this).style('opacity', 1).style('font-weight', 'normal');
        })
        .append('title')
        .text((d: WordData) => `${d.text} (importance: ${Math.round(d.size)})`);
    }
  }, [words, dimensions]);
  
  if (!words || !words.length) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400">
        No words available
      </div>
    );
  }
  
  return (
    <div
      ref={containerRef}
      className="bg-[#fff8ee]/95 border border-[#d5b493]/65 rounded-xl shadow-sm p-4 sm:p-6 w-full"
      style={{ 
        minHeight: '300px',
        maxHeight: '450px',
        height: `${dimensions.height}px`
      }}
    />
  );
};

export default ActivityWordCloud;