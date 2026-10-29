"use client"
import React from 'react'
import { motion } from 'framer-motion'

// Active indicator component
interface ActiveIndicatorProps {
    isActive: boolean;
    color: string;
    id?: string;
}

const ActiveIndicator: React.FC<ActiveIndicatorProps> = ({ isActive, color, id }) => {
    if (!isActive) return null;
    
    return (
        <motion.div
            className="absolute right-0 -mr-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
            // Use unique layoutId per item to prevent cross-item animation glitches
            layoutId={id ? `activeIndicator-${id}` : undefined}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
    );
};

export default ActiveIndicator
