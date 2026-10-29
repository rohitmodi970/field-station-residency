import { motion } from 'framer-motion';
import { Bell, User, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeaderProps {
  userName?: string;
  integrityScore?: number;
}

export const Header = ({ userName = 'there', integrityScore = 85 }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50">
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logos */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-primary-foreground">
              <path
                d="M12 3L4 9V21H9V14H15V21H20V9L12 3Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-xl font-display text-foreground">Force</span>
        </motion.div>

        {/* Right side */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          {/* Integrity Score */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
            <div className="w-2 h-2 rounded-full bg-balance" />
            <span className="text-sm font-medium text-foreground">{integrityScore}%</span>
            <span className="text-xs text-muted-foreground">Integrity</span>
          </div>

          {/* Notifications */}
          <button className="relative p-2 rounded-lg hover:bg-secondary transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-personal" />
          </button>

          {/* User menu */}
          <button className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-secondary hover:bg-secondary/80 transition-colors">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </motion.div>
      </div>
    </header>
  );
};
