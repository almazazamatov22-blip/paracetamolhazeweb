'use client';

import Image from 'next/image';

export interface FollowNode {
  id: string;
  login: string;
  displayName: string;
  profileImageURL: string;
}

export interface FollowEdge {
  node: FollowNode;
  followedAt: string;
  isLive: boolean;
  stream: {
    title?: string;
    gameName?: string;
    viewerCount?: number;
  } | null;
  followedAtDisplay: {
    date: string;
    time: string;
  };
}

interface FollowCardProps {
  edge: FollowEdge;
}

export default function FollowCard({ edge }: FollowCardProps) {
  const { node, isLive, stream, followedAtDisplay } = edge;

  return (
    <a
      href={`https://twitch.tv/${node.login}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-[#18181b] rounded-2xl border border-[#2f2f35] overflow-hidden card-glow hover:transform hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative">
        {/* Profile image */}
        <div className="aspect-square w-full bg-[#1f1f23] flex items-center justify-center overflow-hidden">
          <Image
            src={node.profileImageURL || '/placeholder-avatar.png'}
            alt={node.displayName}
            width={120}
            height={120}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        </div>

        {/* Live badge */}
        {isLive && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-live-red px-2 py-1 rounded-lg animate-live-pulse">
            <span className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="text-xs font-bold text-white">LIVE</span>
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="p-3">
        <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-twitch-purple-light transition-colors">
          {node.displayName}
        </h3>

        {/* Date and time */}
        <div className="flex gap-1.5 mt-2">
          <span className="text-xs bg-twitch-purple/15 text-twitch-purple-light px-2 py-0.5 rounded-md font-medium">
            {followedAtDisplay?.date}
          </span>
          <span className="text-xs bg-twitch-purple/15 text-twitch-purple-light px-2 py-0.5 rounded-md font-medium">
            {followedAtDisplay?.time}
          </span>
        </div>

        {/* Stream info */}
        {isLive && stream && (
          <div className="mt-2 pt-2 border-t border-[#2f2f35]">
            {stream.gameName && (
              <p className="text-xs text-muted-foreground truncate">{stream.gameName}</p>
            )}
            {stream.viewerCount !== undefined && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 bg-live-red rounded-full" />
                <span className="text-xs text-live-red font-medium">
                  {stream.viewerCount.toLocaleString('ru-RU')} зрителей
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </a>
  );
}
