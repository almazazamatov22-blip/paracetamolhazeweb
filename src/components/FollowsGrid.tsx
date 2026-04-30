'use client';

import { useState, useMemo } from 'react';
import FollowCard, { FollowEdge, FilterType } from './FollowCard';
import { BarChart3, TrendingUp, Clock, Users } from 'lucide-react';

interface FollowsGridProps {
  edges: FollowEdge[];
  activeFilter: FilterType;
  isLoading: boolean;
}

export default function FollowsGrid({ edges, activeFilter, isLoading }: FollowsGridProps) {
  const [sortBy, setSortBy] = useState<'date_asc' | 'date_desc'>('date_desc');

  const filteredEdges = useMemo(() => {
    let filtered = [...edges];

    if (activeFilter === 'live') {
      filtered = filtered.filter(e => e.isLive);
    } else if (activeFilter === 'new') {
      // Last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(e => new Date(e.followedAt) >= thirtyDaysAgo);
    } else if (activeFilter === 'old') {
      // More than 1 year ago
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      filtered = filtered.filter(e => new Date(e.followedAt) < oneYearAgo);
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.followedAt).getTime();
      const dateB = new Date(b.followedAt).getTime();
      return sortBy === 'date_desc' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [edges, activeFilter, sortBy]);

  // Analysis view
  if (activeFilter === 'analysis') {
    return <AnalysisView edges={edges} />;
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bg-[#18181b] rounded-2xl border border-[#2f2f35] overflow-hidden">
            <div className="aspect-square loading-shimmer" />
            <div className="p-3 space-y-2">
              <div className="h-4 loading-shimmer rounded" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 loading-shimmer rounded" />
                <div className="h-5 w-12 loading-shimmer rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (filteredEdges.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-semibold text-foreground mb-2">Ничего не найдено</h3>
        <p className="text-muted-foreground">
          {activeFilter === 'live'
            ? 'Нет стримеров в эфире'
            : activeFilter === 'new'
            ? 'Нет новых подписок за последние 30 дней'
            : activeFilter === 'old'
            ? 'Нет подписок старше 1 года'
            : 'Список подписок пуст'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-muted-foreground">
          Показано: <span className="text-foreground font-medium">{filteredEdges.length}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Сортировка:</span>
          <button
            onClick={() => setSortBy(sortBy === 'date_desc' ? 'date_asc' : 'date_desc')}
            className="text-xs bg-[#1f1f23] text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-[#2f2f35] transition-colors"
          >
            {sortBy === 'date_desc' ? 'Сначала новые' : 'Сначала старые'}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {filteredEdges.map((edge) => (
          <FollowCard key={edge.node.id} edge={edge} />
        ))}
      </div>
    </div>
  );
}

function AnalysisView({ edges }: { edges: FollowEdge[] }) {
  const analysis = useMemo(() => {
    const now = new Date();
    const totalFollows = edges.length;
    const liveCount = edges.filter(e => e.isLive).length;

    // Follows by month
    const monthlyData: Record<string, number> = {};
    edges.forEach(e => {
      const date = new Date(e.followedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[key] = (monthlyData[key] || 0) + 1;
    });

    const months = Object.entries(monthlyData).sort((a, b) => a[0].localeCompare(b[0]));
    const mostActiveMonth = months.reduce((max, cur) => cur[1] > max[1] ? cur : max, ['', 0]);

    // Follows by year
    const yearlyData: Record<string, number> = {};
    edges.forEach(e => {
      const date = new Date(e.followedAt);
      const key = `${date.getFullYear()}`;
      yearlyData[key] = (yearlyData[key] || 0) + 1;
    });

    const years = Object.entries(yearlyData).sort((a, b) => a[0].localeCompare(b[0]));

    // Recent follows (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = edges.filter(e => new Date(e.followedAt) >= sevenDaysAgo).length;

    // Oldest follow
    const sortedByDate = [...edges].sort((a, b) => new Date(a.followedAt).getTime() - new Date(b.followedAt).getTime());
    const oldestFollow = sortedByDate[0];
    const newestFollow = sortedByDate[sortedByDate.length - 1];

    // Average follows per month (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const recentFollows = edges.filter(e => new Date(e.followedAt) >= twelveMonthsAgo);
    const avgPerMonth = (recentFollows.length / 12).toFixed(1);

    return {
      totalFollows,
      liveCount,
      months,
      mostActiveMonth,
      years,
      recentCount,
      oldestFollow,
      newestFollow,
      avgPerMonth,
    };
  }, [edges]);

  const maxMonthlyCount = Math.max(...analysis.months.map(([, count]) => count), 1);

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-twitch-purple-light" />}
          label="Подписок в неделю"
          value={analysis.recentCount.toString()}
          color="text-twitch-purple-light"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-success-green" />}
          label="Среднее / мес"
          value={analysis.avgPerMonth}
          color="text-success-green"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-warning-orange" />}
          label="Всего подписок"
          value={analysis.totalFollows.toString()}
          color="text-warning-orange"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 text-live-red" />}
          label="В эфире сейчас"
          value={analysis.liveCount.toString()}
          color="text-live-red"
        />
      </div>

      {/* Monthly activity chart */}
      <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-twitch-purple-light" />
          Активность по месяцам
        </h3>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {analysis.months.slice(-12).map(([month, count]) => {
            const percentage = (count / maxMonthlyCount) * 100;
            return (
              <div key={month} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 shrink-0">{month}</span>
                <div className="flex-1 h-6 bg-[#1f1f23] rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-twitch-purple to-twitch-purple-light rounded-lg transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-foreground font-medium w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Yearly distribution */}
      <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-twitch-purple-light" />
          Распределение по годам
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {analysis.years.map(([year, count]) => (
            <div key={year} className="bg-[#1f1f23] rounded-xl p-3 text-center card-glow">
              <div className="text-lg font-bold text-twitch-purple-light">{count}</div>
              <div className="text-xs text-muted-foreground">{year}</div>
            </div>
          ))}
        </div>
      </div>

      {/* First and last follow */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {analysis.oldestFollow && (
          <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Первая подписка</span>
            <div className="flex items-center gap-3 mt-2">
              <img
                src={analysis.oldestFollow.node.profileImageURL}
                alt={analysis.oldestFollow.node.displayName}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <div className="text-sm font-semibold text-foreground">{analysis.oldestFollow.node.displayName}</div>
                <div className="text-xs text-muted-foreground">{analysis.oldestFollow.followedAtDisplay?.date}</div>
              </div>
            </div>
          </div>
        )}
        {analysis.newestFollow && (
          <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-5">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Последняя подписка</span>
            <div className="flex items-center gap-3 mt-2">
              <img
                src={analysis.newestFollow.node.profileImageURL}
                alt={analysis.newestFollow.node.displayName}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <div className="text-sm font-semibold text-foreground">{analysis.newestFollow.node.displayName}</div>
                <div className="text-xs text-muted-foreground">{analysis.newestFollow.followedAtDisplay?.date}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] p-4 card-glow">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
