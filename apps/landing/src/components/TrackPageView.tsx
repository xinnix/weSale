'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const SESSION_KEY = 'wesale_sid';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return '';
  }
}

export function TrackPageView() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const utmSource = searchParams.get('utm_source');
    const utmMedium = searchParams.get('utm_medium');
    const utmCampaign = searchParams.get('utm_campaign');

    const sid = getOrCreateSessionId();
    const payload: Record<string, string | null> = {
      path: window.location.pathname,
      referrer: document.referrer || null,
      utmSource,
      utmMedium,
      utmCampaign,
      sessionId: sid,
    };

    const endpoint = process.env.NEXT_PUBLIC_TRACK_ENDPOINT || '/api/landing/track';
    const url = endpoint.startsWith('http') ? endpoint : `${window.location.origin}${endpoint}`;

    const body = JSON.stringify(payload);
    // sendBeacon for reliability on unload; fall back to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const queued = navigator.sendBeacon(url, blob);
      if (queued) return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // silent fail — tracking must not break the page
    });
  }, [searchParams]);

  return null;
}
