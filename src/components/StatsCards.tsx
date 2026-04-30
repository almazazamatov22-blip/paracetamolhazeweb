'use client';

import { Users, Activity, Calendar } from 'lucide-react';

interface StatsCardsProps {
  searchData?: {
    totalFollows: number;
    liveCount: number;
    accountAge: string;
    createdAt: string;
  };
  showSearchStats?: boolean;
}

function formatNumber(num: number | undefined | null): string {
  if (num == null) return '0';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function StatsCards({ searchData, showSearchStats }: StatsCardsProps) {
  // showSearchStats is now handled by the parent component

  return (
    <div className="w-full max-w-4xl mx-auto">
      {searchData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Subscriptions Card */}
          <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-5 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-twitch-purple/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-twitch-purple-light" />
              </div>
              <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Подписок
              </span>
            </div>
            <div className="text-4xl font-bold text-twitch-purple-light">
              {formatNumber(searchData.totalFollows)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">ВСЕГО</div>
          </div>

          {/* Live Card */}
          <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-5 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-live-red/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-live-red" />
              </div>
              <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Live
              </span>
            </div>
            <div className="text-4xl font-bold text-live-red">
              {formatNumber(searchData.liveCount)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">В ЭФИРЕ</div>
          </div>

          {/* Account Card */}
          <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-5 card-glow">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-success-green/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-success-green" />
              </div>
              <span className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                Аккаунт
              </span>
            </div>
            <div className="text-2xl font-bold text-success-green">
              {searchData.createdAt}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{searchData.accountAge}</div>
          </div>
        </div>
      )}
    </div>
  );
}
