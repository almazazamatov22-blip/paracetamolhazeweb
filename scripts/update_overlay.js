const fs = require('fs');

const FILE_PATH = 'src/app/tomal/overlay/page.tsx';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// Add import { supabase }
if (!content.includes('import { supabase } from \'@/lib/supabase\';')) {
  content = content.replace(
    /import \{ useCallback, useEffect, useMemo, useRef, useState \} from 'react';/,
    "import { useCallback, useEffect, useMemo, useRef, useState } from 'react';\nimport { supabase } from '@/lib/supabase';"
  );
}

// Replace useEffect
const useEffectRegex = /  useEffect\(\(\) => \{[\s\S]*?  \}, \[applyState\]\);/m;

const newUseEffect = `  useEffect(() => {
    let active = true;
    let isFetching = false;
    let lastUpdatedAt = '';
    let pollingIntervalId: number | null = null;
    let channel: any = null;

    const fetchState = async () => {
      if (isFetching) return;
      isFetching = true;
      try {
        const response = await fetch(\`/api/tomal?t=\${Date.now()}\`, { cache: 'no-store' });
        if (!response.ok) {
          isFetching = false;
          return;
        }
        const data = await response.json();
        if (active && data) {
          const normalized = normalizeState(data);
          if (!lastUpdatedAt || normalized.updatedAt >= lastUpdatedAt) {
            lastUpdatedAt = normalized.updatedAt;
            applyState(normalized);
          }
        }
      } catch {
        // on error, keep the last known state working
      } finally {
        isFetching = false;
      }
    };

    const startPolling = () => {
      if (pollingIntervalId === null) {
        pollingIntervalId = window.setInterval(fetchState, POLLING_INTERVAL);
      }
    };

    const stopPolling = () => {
      if (pollingIntervalId !== null) {
        window.clearInterval(pollingIntervalId);
        pollingIntervalId = null;
      }
    };

    void fetchState();

    channel = supabase
      .channel('tomal-overlay-hybrid')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'overlay_configs',
          filter: 'user_id=eq.tomal-global',
        },
        (payload) => {
          if (!active) return;
          const nextRow = payload.new as { overlay_type?: string; settings?: Record<string, unknown> } | null;
          
          if (nextRow?.overlay_type === 'tomal') {
            const nextState = nextRow.settings?.tomal;
            if (nextState && typeof nextState === 'object') {
              const normalized = normalizeState(nextState as Partial<TomalState>);
              if (!lastUpdatedAt || normalized.updatedAt >= lastUpdatedAt) {
                lastUpdatedAt = normalized.updatedAt;
                applyState(normalized);
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === 'SUBSCRIBED') {
          stopPolling();
          void fetchState();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling();
        }
      });

    return () => {
      active = false;
      stopPolling();
      if (animationTimerRef.current) window.clearTimeout(animationTimerRef.current);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [applyState]);`;

content = content.replace(useEffectRegex, newUseEffect);

fs.writeFileSync(FILE_PATH, content);
