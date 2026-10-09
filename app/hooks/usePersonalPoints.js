"use client";

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function usePersonalPoints(userId, disabled = false) {
  const [snapshot, setSnapshot] = useState(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (disabled || !userId) return;
    const controller = new AbortController();
    let active = true;
    apiFetch('/api/points', { signal: controller.signal, cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (!data.success) throw new Error('POINT_SUMMARY_UNAVAILABLE');
        if (active) setSnapshot({ userId, data, error: false });
      })
      .catch(() => {
        if (active) setSnapshot(previous => ({
          userId, data: previous?.userId === userId ? previous.data : null, error: true,
        }));
      });
    return () => { active = false; controller.abort(); };
  }, [userId, disabled, refresh]);
  const current = !disabled && snapshot?.userId === userId ? snapshot : null;
  return {
    points: current?.data ?? null,
    error: Boolean(current?.error),
    retry: () => {
      setSnapshot(previous => previous?.userId === userId ? { ...previous, error: false } : previous);
      setRefresh(previous => previous + 1);
    },
  };
}
