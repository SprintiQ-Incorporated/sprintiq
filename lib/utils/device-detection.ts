/**
 * Device Detection Utility
 * 
 * Detects mobile devices for conditional rendering of mobile-optimized components
 */

/**
 * Check if the current device is a mobile device (phone or tablet)
 * Uses multiple detection methods for reliability
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') {
    return false; // SSR fallback
  }

  // Method 1: User Agent detection
  const userAgent = window.navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    'android',
    'webos',
    'iphone',
    'ipad',
    'ipod',
    'blackberry',
    'windows phone',
    'mobile'
  ];
  
  const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));

  // Method 2: Touch capability (less reliable alone, but helpful combined)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Method 3: Screen width (< 768px is typically mobile)
  const isSmallScreen = window.innerWidth < 768;

  // Return true if either UA indicates mobile OR (has touch AND small screen)
  return isMobileUA || (hasTouch && isSmallScreen);
}

/**
 * Check if device is specifically a tablet
 */
export function isTablet(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
  
  // Tablets typically have larger screens than phones
  const isTabletSize = window.innerWidth >= 768 && window.innerWidth <= 1024;
  
  return isTabletUA || (isTabletSize && 'ontouchstart' in window);
}

/**
 * Check if device is iOS (iPhone or iPad)
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * Check if device is Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
}

/**
 * Get device type as a string
 */
export function getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
  if (isTablet()) return 'tablet';
  if (isMobileDevice()) return 'mobile';
  return 'desktop';
}
