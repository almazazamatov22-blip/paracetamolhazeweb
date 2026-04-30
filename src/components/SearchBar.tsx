'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (username: string) => void;
  isLoading: boolean;
  initialUsername?: string;
}

export default function SearchBar({ onSearch, isLoading, initialUsername = '' }: SearchBarProps) {
  const [username, setUsername] = useState(initialUsername);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsername(initialUsername);
  }, [initialUsername]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed) {
      onSearch(trimmed);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="relative flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <Search className="w-5 h-5 text-muted-foreground" />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Введите никнейм пользователя..."
            className="w-full h-14 pl-12 pr-4 bg-[#1f1f23] border border-[#2f2f35] rounded-xl text-foreground placeholder:text-muted-foreground text-base focus:outline-none focus:border-twitch-purple focus:ring-1 focus:ring-twitch-purple transition-all"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !username.trim()}
          className="h-14 px-8 bg-twitch-purple hover:bg-twitch-purple-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Search className="w-5 h-5" />
              <span>ПОИСК</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
