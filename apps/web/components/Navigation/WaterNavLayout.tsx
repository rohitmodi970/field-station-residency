"use client";

import React, { ReactNode } from 'react';
import WaterNavBar from './WaterNavBar';

interface WaterNavLayoutProps {
  children: ReactNode;
  showNav?: boolean;
}

/**
 * Layout component that includes the water navigation bar
 * Use this to wrap pages that should have the floating bottom navigation
 */
const WaterNavLayout: React.FC<WaterNavLayoutProps> = ({ 
  children, 
  showNav = true 
}) => {
  return (
    <div className="relative min-h-screen">
      {/* Main content */}
      <div className="pb-28">
        {children}
      </div>
      
      {/* Water Navigation Bar */}
      {showNav && <WaterNavBar />}
    </div>
  );
};

export default WaterNavLayout;
