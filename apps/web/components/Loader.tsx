import React from 'react'

const AnimatedLoader = ({elementColors}: {elementColors: { text: string }}) => (
  <div className="relative min-h-screen w-full flex items-center justify-center p-4">
    <style jsx>{`
      @keyframes breathingScale {
        0% { opacity: 0.95; transform: scale(1) translateX(0) translateY(0); }
        25% { opacity: 0.98; transform: scale(1.01) translateX(8px) translateY(-6px); }
        50% { opacity: 1; transform: scale(1.02) translateX(0) translateY(8px); }
        75% { opacity: 0.98; transform: scale(1.01) translateX(-8px) translateY(-4px); }
        100% { opacity: 0.95; transform: scale(1) translateX(0) translateY(0); }
      }

      @keyframes gridBreathing {
        0% { background-size: 25px 25px; }
        50% { background-size: 27px 27px; }
        100% { background-size: 25px 25px; }
      }

      @keyframes gradientShift {
        0% { background-position: 0% 0%; }
        50% { background-position: 100% 100%; }
        100% { background-position: 0% 0%; }
      }

      @keyframes depthBreathing1 {
        0%, 100% { opacity: 0.25; transform: translate(0, 0) scale(1); }
        50% { opacity: 0.35; transform: translate(15px, -15px) scale(1.05); }
      }

      @keyframes depthBreathing2 {
        0%, 100% { opacity: 0.18; transform: translate(0, 0) scale(1); }
        50% { opacity: 0.28; transform: translate(-20px, 12px) scale(1.05); }
      }

      .animate-breathing { animation: breathingScale 15s ease-in-out infinite; }
    `}</style>

    <div className="absolute inset-0 animate-breathing">
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, rgb(255,182,193) 0%, rgb(255,218,185) 20%, rgb(255,255,200) 40%, rgb(200,255,200) 60%, rgb(200,230,255) 80%, rgb(220,198,255) 100%)`,
          backgroundSize: '200% 200%',
          animation: 'gradientShift 20s ease-in-out infinite'
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(0deg, rgba(140,140,140,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(140,140,140,0.6) 1px, transparent 1px)`,
          backgroundSize: '25px 25px',
          animation: 'gridBreathing 16s ease-in-out infinite'
        }}
      />

      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%, rgba(255,200,200,0.08) 0%, transparent 50%)', animation: 'depthBreathing1 18s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 30%, rgba(200,220,255,0.08) 0%, transparent 50%)', animation: 'depthBreathing2 22s ease-in-out infinite' }} />
    </div>

    <div className="relative z-10 flex flex-col items-center">
      <div className="relative w-12 h-12">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
      <p className="mt-6 text-xl font-medium animate-pulse" style={{ color: elementColors.text }}>
        Loading journal...
      </p>
    </div>
  </div>
);

export default AnimatedLoader
