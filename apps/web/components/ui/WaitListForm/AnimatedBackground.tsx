import React, { useEffect, useRef } from 'react';

interface GridPoint {
  x: number;
  y: number;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
}

interface AnimatedBackgroundProps {
  className?: string;
  opacity?: number;
}

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ className = '', opacity = 0.5 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const setCanvasDimensions = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    setCanvasDimensions();
    window.addEventListener("resize", setCanvasDimensions);

    // Grid properties
    const gridSize = 20;
    const rows = Math.ceil(canvas.height / gridSize) + 2;
    const cols = Math.ceil(canvas.width / gridSize) + 2;
    const points: GridPoint[] = [];

    // Create grid points
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        points.push({
          x: x * gridSize,
          y: y * gridSize,
          originX: x * gridSize,
          originY: y * gridSize,
          offsetX: 0,
          offsetY: 0,
        });
      }
    }

    // Animation variables
    let animationFrameId: number;
    let time = 0;

    // Animation function
    const animate = () => {
      time += 0.005;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw gradient background
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, `rgba(255, 120, 120, ${1 + Math.sin(time) * 0.3})`)
      gradient.addColorStop(0.25, `rgba(255, 200, 50, ${1 + Math.cos(time) * 0.3})`)
      gradient.addColorStop(0.5, `rgba(100, 255, 100, ${1 + Math.sin(time + 1) * 0.3})`)
      gradient.addColorStop(0.95, `rgba(50, 150, 255, ${1 + Math.cos(time + 1) * 0.3})`)
      gradient.addColorStop(1, `rgba(150, 100, 255, ${1 + Math.sin(time + 2) * 0.3})`)

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update grid points
      points.forEach((point) => {
        point.offsetX = Math.sin(time + point.originX * 0.01) * 15;
        point.offsetY = Math.cos(time + point.originY * 0.01) * 15;
        point.x = point.originX + point.offsetX;
        point.y = point.originY + point.offsetY;
      });

      // Draw grid
      ctx.strokeStyle = "rgba(128, 0, 255, 0.2)";
      ctx.lineWidth = 1;

      for (let y = 0; y < rows - 1; y++) {
        for (let x = 0; x < cols - 1; x++) {
          const index = y * cols + x;
          const point = points[index];
          const rightPoint = points[index + 1];
          const bottomPoint = points[index + cols];
          const bottomRightPoint = points[index + cols + 1];

          if (point && rightPoint && bottomPoint && bottomRightPoint) {
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(rightPoint.x, rightPoint.y);
            ctx.lineTo(bottomRightPoint.x, bottomRightPoint.y);
            ctx.lineTo(bottomPoint.x, bottomPoint.y);
            ctx.closePath();
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", setCanvasDimensions);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 w-full h-full ${className}`}
      style={{ opacity }}
    />
  );
};

export default AnimatedBackground; 