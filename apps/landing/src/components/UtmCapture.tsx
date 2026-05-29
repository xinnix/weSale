'use client';

import { useUtm } from '@/hooks/useUtm';

/**
 * Client component that mounts useUtm to capture URL parameters.
 * Renders nothing visible.
 */
export function UtmCapture() {
  useUtm();
  return null;
}
