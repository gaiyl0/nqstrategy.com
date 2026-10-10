"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { createPointReader, subscribePointRefresh } from '@/lib/point-refresh.mjs';

export default function usePointSnapshot(userId, { disabled = false, summary = false } = {}) {
  const [snapshot, setSnapshot] = useState(null);
  const reader = useRef(null);
  useEffect(() => {
    if (disabled || !userId) return;
    const active = createPointReader(async signal => (await apiFetch(summary ? '/api/points?view=summary' : '/api/points', { signal, cache: 'no-store' })).json(), update => {
      setSnapshot(previous => ({ ...(previous?.userId === userId ? previous : {}), ...update, userId }));
    });
    reader.current = active;
    void active.refresh();
    const unsubscribe = subscribePointRefresh(active.refresh);
    return () => { unsubscribe(); active.dispose(); if (reader.current === active) reader.current = null; };
  }, [userId, disabled, summary]);
  const retry = useCallback(() => reader.current?.refresh(), []);
  const current = !disabled && snapshot?.userId === userId ? snapshot : null;
  return { points: current?.data ?? null, error: Boolean(current?.error), loading: Boolean(userId && !disabled && (!current || current.loading)), retry };
}
