/**
 * Platform detection utilities for the client side.
 * 
 * Note: navigator.platform is deprecated but still widely supported.
 * This utility provides a consistent way to detect the platform across components.
 */

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';

/**
 * Detects the current platform based on available browser APIs.
 * 
 * Detection strategy:
 * 1. Check navigator.userAgentData (modern, preferred)
 * 2. Fall back to navigator.platform (deprecated but reliable)
 * 3. Fall back to user agent string parsing
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }

  // Try modern userAgentData API first (Chromium 90+)
  const navigatorWithUAData = navigator as Navigator & {
    userAgentData?: {
      platform?: string;
    };
  };

  if (navigatorWithUAData.userAgentData?.platform) {
    const platform = navigatorWithUAData.userAgentData.platform.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('linux')) return 'linux';
  }

  // Fall back to navigator.platform (deprecated but widely supported)
  if (navigator.platform) {
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'windows';
    if (platform.includes('linux')) return 'linux';
  }

  // Last resort: parse user agent
  if (navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'mac';
    if (ua.includes('win')) return 'windows';
    if (ua.includes('linux')) return 'linux';
  }

  return 'unknown';
}

/**
 * Checks if the current platform is macOS
 */
export function isMac(): boolean {
  return detectPlatform() === 'mac';
}

/**
 * Checks if the current platform is Windows
 */
export function isWindows(): boolean {
  return detectPlatform() === 'windows';
}

/**
 * Checks if the current platform is Linux
 */
export function isLinux(): boolean {
  return detectPlatform() === 'linux';
}
