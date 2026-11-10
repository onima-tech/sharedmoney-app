/**
 * Device Detection Utility
 * Detects iOS, Android, or Desktop
 */
export function detectDevice(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform.toLowerCase();
  
  // iOS detection
  const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                (platform === 'macintel' && navigator.maxTouchPoints > 1);
  
  // Android detection
  const isAndroid = /android/.test(userAgent);
  
  if (isIOS) return 'ios';
  if (isAndroid) return 'android';
  return 'desktop';
}

