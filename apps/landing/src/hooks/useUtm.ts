'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
const STORAGE_KEY = 'wesale_utm';

type UtmParams = Record<(typeof UTM_KEYS)[number], string | null>;

/**
 * Captures UTM parameters from the URL and persists them to localStorage.
 * Subsequent visits preserve the first-touch UTM values unless overridden
 * by new URL parameters (last-touch for explicit overrides).
 */
export function useUtm(): UtmParams {
  const searchParams = useSearchParams();

  useEffect(() => {
    const urlUtm: Partial<UtmParams> = {};
    let hasUrlUtm = false;

    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        urlUtm[key] = value;
        hasUrlUtm = true;
      }
    }

    if (hasUrlUtm) {
      try {
        const existing = getStoredUtm();
        const merged = { ...existing, ...urlUtm };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // localStorage unavailable (SSR, privacy mode)
      }
    }
  }, [searchParams]);

  // Return current values for convenience (reads from URL first, then storage)
  const result = {} as UtmParams;
  for (const key of UTM_KEYS) {
    result[key] = searchParams.get(key) || getStoredUtm()[key] || null;
  }
  return result;
}

function getStoredUtm(): Partial<UtmParams> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Get stored UTM params (safe for SSR) */
export function getUtmParams(): Partial<UtmParams> {
  return getStoredUtm();
}
