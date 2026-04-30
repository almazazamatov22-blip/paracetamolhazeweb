'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, User } from 'lucide-react';
import SearchBar from '@/components/SearchBar';
import StatsCards from '@/components/StatsCards';
import FilterTabs, { FilterType } from '@/components/FilterTabs';
import FollowsGrid, { FollowEdge } from '@/components/FollowsGrid';

interface TwitchUser {
  id: string;
  login: string;
  displayName: string;
  description: string;
  createdAt: string;
  profileImageURL: string;
  followers?: { totalCount: number };
}

interface GlobalStats {
  total_searches: number;
  unique_users: number;
}

function calculateAccountAge(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - created.getTime();

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const years = Math.floor(days / 365);

  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${pluralize(years, 'год', 'года', 'лет')}`);
  const remainingDays = days - years * 365;
  const remainingWeeks = Math.floor(remainingDays / 7);
  if (remainingWeeks > 0) parts.push(`${remainingWeeks} ${pluralize(remainingWeeks, 'неделя', 'недели', 'недель')}`);
  const extraDays = remainingDays - remainingWeeks * 7;
  if (extraDays > 0) parts.push(`${extraDays} ${pluralize(extraDays, 'день', 'дня', 'дней')}`);

  return parts.length > 0 ? parts.join(' ') : 'менее дня';
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (lastDigit > 1 && lastDigit < 5) return few;
  if (lastDigit === 1) return one;
  return many;
}

function formatDateRu(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState<TwitchUser | null>(null);
  const [follows, setFollows] = useState<FollowEdge[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [totalFollows, setTotalFollows] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [hasSearched, setHasSearched] = useState(false);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);

  // Load global stats on mount
  useEffect(() => {
    fetch('/api/twitch/stats')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.success) setGlobalStats(data);
      })
      .catch(() => {});
  }, []);

  const handleSearch = useCallback(async (searchUsername: string) => {
    setIsLoading(true);
    setError(null);
    setActiveFilter('all');
    setUsername(searchUsername);
    setHasSearched(true);

    try {
      const [userRes, followsRes] = await Promise.all([
        fetch(`/api/twitch/user?username=${encodeURIComponent(searchUsername)}`),
        fetch(`/api/twitch/follows?username=${encodeURIComponent(searchUsername)}&limit=10000`),
      ]);

      if (!userRes.ok || !followsRes.ok) {
        throw new Error('Не удалось загрузить данные');
      }

      const userDataJson = await userRes.json();
      const followsDataJson = await followsRes.json();

      if (!userDataJson.success) {
        throw new Error('Пользователь не найден');
      }

      const user = userDataJson.data.user;
      setUserData(user);

      if (followsDataJson.success) {
        const edges = followsDataJson.data.user?.follows?.edges || [];
        setFollows(edges);
        setTotalFollows(followsDataJson.totalCount || edges.length);
        setLiveCount(followsDataJson.liveCount || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
      setUserData(null);
      setFollows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleBack = () => {
    setUserData(null);
    setFollows([]);
    setUsername('');
    setError(null);
    setActiveFilter('all');
    setHasSearched(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0e0e10] bg-grid-pattern relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-twitch-purple/5 rounded-full blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="border-b border-[#2f2f35]/50 backdrop-blur-sm bg-[#0e0e10]/80 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasSearched && (
                <button
                  onClick={handleBack}
                  className="w-9 h-9 rounded-lg bg-[#1f1f23] border border-[#2f2f35] flex items-center justify-center hover:bg-[#2f2f35] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <h1 className="text-xl font-bold tracking-tight text-foreground">ЧЕК</h1>
            </div>

            {userData && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 bg-[#1f1f23] rounded-xl px-3 py-2 border border-[#2f2f35]">
                  <img
                    src={userData.profileImageURL}
                    alt={userData.displayName}
                    className="w-6 h-6 rounded-full"
                  />
                  <span className="text-sm font-medium text-foreground">{userData.displayName}</span>
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
          <AnimatePresence mode="wait">
            {!hasSearched ? (
              /* Landing Page */
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] gap-10"
              >
                {/* Hero */}
                <div className="text-center space-y-4">
                  <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight">
                    Получите полный список{' '}
                    <span className="gradient-text">подписок</span>
                    <br />
                    с live статусом стримеров
                  </h2>
                  <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
                    Проверьте на кого подписан любой пользователь Twitch и узнайте, кто сейчас в эфире
                  </p>
                </div>

                {/* Search */}
                <SearchBar onSearch={handleSearch} isLoading={isLoading} />

                {/* Global Stats */}
                {globalStats && (
                  <div className="w-full max-w-2xl mx-auto">
                    <div className="bg-[#18181b] rounded-2xl border border-[#2f2f35] overflow-hidden">
                      <div className="bg-twitch-purple/20 px-6 py-3 border-b border-[#2f2f35]">
                        <h3 className="text-sm font-semibold tracking-wider text-twitch-purple-light uppercase">
                          Статистика поиска
                        </h3>
                      </div>
                      <div className="p-6 grid grid-cols-2 gap-6">
                        <div className="text-center">
                          <div className="text-3xl md:text-4xl font-bold text-foreground">
                            {globalStats.unique_users.toLocaleString('ru-RU')}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            РАЗНЫХ ПОЛЬЗОВАТЕЛЕЙ ПРОВЕРЕНО
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-3xl md:text-4xl font-bold text-foreground">
                            {globalStats.total_searches.toLocaleString('ru-RU')}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            ВСЕГО ЗАПРОСОВ ПОИСКА
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              /* Results Page */
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {/* User profile header */}
                {userData && (
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 bg-[#18181b] rounded-2xl border border-[#2f2f35] p-6">
                    <img
                      src={userData.profileImageURL}
                      alt={userData.displayName}
                      className="w-20 h-20 rounded-2xl border-2 border-twitch-purple/30"
                    />
                    <div className="text-center sm:text-left">
                      <h2 className="text-2xl font-bold text-foreground">{userData.displayName}</h2>
                      <p className="text-sm text-muted-foreground mt-0.5">@{userData.login}</p>
                      {userData.followers && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="text-foreground font-medium">{userData.followers.totalCount.toLocaleString('ru-RU')}</span> подписчиков
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Search bar */}
                <SearchBar onSearch={handleSearch} isLoading={isLoading} initialUsername={username} />

                {/* Error */}
                {error && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-6 text-center">
                    <p className="text-destructive font-medium">{error}</p>
                    <p className="text-sm text-muted-foreground mt-1">Проверьте правильность никнейма и попробуйте снова</p>
                  </div>
                )}

                {/* Stats cards */}
                {userData && !error && (
                  <StatsCards
                    searchData={{
                      totalFollows,
                      liveCount,
                      accountAge: calculateAccountAge(userData.createdAt),
                      createdAt: formatDateRu(userData.createdAt),
                    }}
                    showSearchStats={false}
                  />
                )}

                {/* Filters */}
                {follows.length > 0 && !error && (
                  <FilterTabs
                    activeFilter={activeFilter}
                    onFilterChange={setActiveFilter}
                    liveCount={liveCount}
                  />
                )}

                {/* Results grid */}
                {!error && (
                  <FollowsGrid
                    edges={follows}
                    activeFilter={activeFilter}
                    isLoading={isLoading}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#2f2f35]/50 mt-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 text-center space-y-2">
            <p className="text-twitch-purple font-semibold text-sm">Твич Фолловер Чеккер</p>
            <p className="text-muted-foreground text-xs">
              Powered by PARACETAMOLHAZE
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
