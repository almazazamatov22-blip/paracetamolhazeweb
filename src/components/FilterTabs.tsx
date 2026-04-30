'use client';

import { Tv, Clock, AlertTriangle, Sparkles, LayoutGrid } from 'lucide-react';

export type FilterType = 'all' | 'live' | 'new' | 'old' | 'analysis';

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  liveCount: number;
}

const filters: { key: FilterType; label: string; icon: React.ReactNode; color?: string }[] = [
  { key: 'all', label: 'ВСЕ', icon: <LayoutGrid className="w-4 h-4" /> },
  { key: 'live', label: 'LIVE', icon: <Tv className="w-4 h-4" />, color: 'text-live-red' },
  { key: 'new', label: 'НОВЫЕ', icon: <Clock className="w-4 h-4" />, color: 'text-success-green' },
  { key: 'old', label: 'СТАРЫЕ', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-warning-orange' },
  { key: 'analysis', label: 'АНАЛИЗ', icon: <Sparkles className="w-4 h-4" />, color: 'text-pink-400' },
];

export default function FilterTabs({ activeFilter, onFilterChange, liveCount }: FilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {filters.map((filter) => (
        <button
          key={filter.key}
          onClick={() => onFilterChange(filter.key)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
            ${activeFilter === filter.key
              ? 'bg-twitch-purple text-white shadow-lg shadow-twitch-purple/25'
              : 'bg-[#1f1f23] text-muted-foreground hover:bg-[#2f2f35] hover:text-foreground border border-[#2f2f35]'
            }
          `}
        >
          {filter.icon}
          <span>{filter.label}</span>
          {filter.key === 'live' && liveCount > 0 && (
            <span className={`
              px-1.5 py-0.5 rounded-full text-xs font-bold
              ${activeFilter === filter.key ? 'bg-white/20 text-white' : 'bg-live-red/20 text-live-red'}
            `}>
              {liveCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
