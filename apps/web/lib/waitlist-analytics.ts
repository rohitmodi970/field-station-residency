/**
 * Waitlist Analytics Utility
 * Tracks user behavior and time spent on waitlist page
 */

export interface WaitlistAnalytics {
  timeSpentSeconds: number;
  userAgent: string;
  referrer: string;
  utmParams: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

export class WaitlistTracker {
  private startTime: number;
  private utmParams: WaitlistAnalytics['utmParams'];

  constructor() {
    this.startTime = Date.now();
    this.utmParams = this.extractUtmParams();
  }

  /**
   * Extract UTM parameters from URL
   */
  private extractUtmParams(): WaitlistAnalytics['utmParams'] {
    if (typeof window === 'undefined') return {};

    const params = new URLSearchParams(window.location.search);
    
    return {
      source: params.get('utm_source') || undefined,
      medium: params.get('utm_medium') || undefined,
      campaign: params.get('utm_campaign') || undefined,
      term: params.get('utm_term') || undefined,
      content: params.get('utm_content') || undefined,
    };
  }

  /**
   * Get current time spent in seconds
   */
  getTimeSpent(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get complete analytics data
   */
  getAnalytics(): WaitlistAnalytics {
    return {
      timeSpentSeconds: this.getTimeSpent(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
      referrer: typeof window !== 'undefined' ? document.referrer : '',
      utmParams: this.utmParams,
    };
  }

  /**
   * Reset the timer (useful for form resubmissions)
   */
  reset(): void {
    this.startTime = Date.now();
  }
}

/**
 * Parse user agent to extract browser and device info
 * This is done server-side for accuracy
 */
export function parseUserAgent(userAgent: string) {
  const ua = userAgent.toLowerCase();

  // Browser detection
  let browserType = 'Unknown';
  let browserVersion = '';
  
  if (ua.includes('edg/')) {
    browserType = 'Edge';
    browserVersion = ua.match(/edg\/(\d+)/)?.[1] || '';
  } else if (ua.includes('chrome/')) {
    browserType = 'Chrome';
    browserVersion = ua.match(/chrome\/(\d+)/)?.[1] || '';
  } else if (ua.includes('firefox/')) {
    browserType = 'Firefox';
    browserVersion = ua.match(/firefox\/(\d+)/)?.[1] || '';
  } else if (ua.includes('safari/')) {
    browserType = 'Safari';
    browserVersion = ua.match(/version\/(\d+)/)?.[1] || '';
  }

  // Device detection
  let deviceType = 'Desktop';
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|opera mobi|iemobile/i.test(ua)) {
    deviceType = 'Mobile';
  }

  // OS detection
  let os = 'Unknown';
  let osVersion = '';
  
  if (ua.includes('windows nt')) {
    os = 'Windows';
    const version = ua.match(/windows nt (\d+\.\d+)/)?.[1];
    if (version === '10.0') osVersion = '10/11';
    else if (version === '6.3') osVersion = '8.1';
    else if (version === '6.2') osVersion = '8';
    else if (version === '6.1') osVersion = '7';
  } else if (ua.includes('mac os x')) {
    os = 'macOS';
    osVersion = ua.match(/mac os x (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('android')) {
    os = 'Android';
    osVersion = ua.match(/android (\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
    osVersion = ua.match(/os (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  }

  return {
    browserType,
    browserVersion,
    deviceType,
    os,
    osVersion,
  };
}
