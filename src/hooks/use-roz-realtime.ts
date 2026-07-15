import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export type RealtimeStatus = 'connecting' | 'online' | 'reconnecting' | 'error';

interface UseRozRealtimeProps {
  userId: string | undefined;
  onUpdate: (rozState: any) => void;
  onStatusChange?: (status: RealtimeStatus) => void;
  onRequireRefetch?: () => void;
}

export function useRozRealtime({ userId, onUpdate, onStatusChange, onRequireRefetch }: UseRozRealtimeProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<RealtimeStatus>('connecting');
  const lastUpdateRef = useRef<number>(Date.now());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibilityHandlerRef = useRef<() => void>();

  const setStatus = useCallback(
    (status: RealtimeStatus) => {
      if (statusRef.current !== status) {
        statusRef.current = status;
        onStatusChange?.(status);
      }
    },
    [onStatusChange]
  );

  const connect = useCallback(() => {
    if (!userId) return;

    // Clean up existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    setStatus('connecting');

    const channelName = `roz-state:${userId}`;
    const channel = supabase.channel(channelName);
    channelRef.current = channel;

    channel
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'overlay_configs',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          lastUpdateRef.current = Date.now();
          const row = payload.new;
          if (row && row.settings && row.settings.roz) {
            onUpdate(row.settings.roz);
          }
        }
      )
      .subscribe((status: string, err?: Error) => {
        if (status === 'SUBSCRIBED') {
          setStatus('online');
        } else if (status === 'CHANNEL_ERROR') {
          setStatus('error');
          // Try to reconnect after 5 seconds
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        } else if (status === 'TIMED_OUT') {
          setStatus('error');
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        } else if (status === 'CLOSED') {
          if (statusRef.current !== 'error') {
            setStatus('connecting');
          }
        }
      });
  }, [userId, onUpdate, setStatus]);

  useEffect(() => {
    if (userId) {
      connect();
    } else {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [userId, connect]);

  useEffect(() => {
    // Visibility change handler for recovery after sleep/long inactivity
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
        // If it's been more than 60 seconds since last update, we might have missed events while asleep.
        // Force a refetch of the state to ensure consistency.
        if (timeSinceLastUpdate > 60000) {
          onRequireRefetch?.();
        }
        
        // Ensure connection is active
        if (statusRef.current === 'error' || !channelRef.current) {
          connect();
        }
      }
    };
    
    visibilityHandlerRef.current = handleVisibilityChange;
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      }
    };
  }, [connect, onRequireRefetch]);
}
