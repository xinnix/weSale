/**
 * Detect if the current browser is WeChat's built-in browser.
 * WeChat Android UA contains "MicroMessenger", iOS contains "MicroMessenger" as well.
 */
export function isWechatBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

/**
 * Open WeChat customer service entry.
 * In WeChat browser: opens the KF URL directly (triggers native CS dialog).
 * In regular browser: returns false so caller can show QR code popup.
 */
export function openWechatKf(): boolean {
  const kfUrl = process.env.NEXT_PUBLIC_KF_URL;
  if (!kfUrl) {
    console.warn('NEXT_PUBLIC_KF_URL is not configured');
    return false;
  }

  if (isWechatBrowser()) {
    window.location.href = kfUrl;
    return true;
  }

  return false;
}
