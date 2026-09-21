"use client";

import { useEffect, useRef, useCallback } from "react";

interface UseRealtimeOptions {
  interval?: number; // ms, default 30000 (30s)
  enabled?: boolean;
  onTick: () => void | Promise<void>;
}

export function useRealtime({
  interval = 30_000,
  enabled = true,
  onTick,
}: UseRealtimeOptions) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      onTickRef.current();
    }, interval);
  }, [interval]);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) { stop(); return; }
    start();
    return stop;
  }, [enabled, start, stop]);

  return { start, stop };
}
