/**
 * Onairos API Client Service
 * Interacts directly with Onairos API2 (production: https://api2.onairos.uk)
 * using the registered Developer API Key (from onairos platform)
 */

const ONAIROS_BASE_URL = 'https://api2.onairos.uk';

export interface OnairosValidationResult {
  valid: boolean;
  developer?: {
    id: string;
    name: string;
    plan: string;
  };
  keyName?: string;
  permissions?: string[];
  rateLimits?: {
    remaining: number;
    resetTime: number;
  };
  error?: string;
}

/**
 * Get configured Developer API Key from environment
 */
export function getOnairosApiKey(): string | null {
  return (
    process.env.ONAIROS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_ONAIROS_API_KEY?.trim() ||
    null
  );
}

/**
 * Standard developer authentication headers
 */
export function getOnairosHeaders(apiKey?: string): Record<string, string> {
  const key = apiKey || getOnairosApiKey();
  return {
    'Content-Type': 'application/json',
    ...(key ? { Authorization: `Bearer ${key}`, 'x-api-key': key } : {}),
    'X-API-Key-Type': 'developer',
    'X-SDK-Environment': 'production',
    'User-Agent': 'ForceV2/1.0.0',
    'X-Timestamp': new Date().toISOString(),
  };
}

/**
 * Validate Developer API Key against Onairos backend
 */
export async function validateOnairosApiKey(
  customKey?: string
): Promise<OnairosValidationResult> {
  const key = customKey || getOnairosApiKey();

  if (!key) {
    return {
      valid: false,
      error: 'No ONAIROS_API_KEY configured in environment.',
    };
  }

  try {
    const res = await fetch(`${ONAIROS_BASE_URL}/auth/validate-key`, {
      method: 'POST',
      headers: getOnairosHeaders(key),
      body: JSON.stringify({ apiKey: key }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        valid: false,
        error: `Validation failed with status ${res.status}: ${errText}`,
      };
    }

    const data = await res.json();
    return {
      valid: data.success === true,
      developer: data.developer,
      keyName: data.apiKey?.name,
      permissions: data.permissions,
      rateLimits: data.rateLimits,
    };
  } catch (err: any) {
    return {
      valid: false,
      error: err.message || 'Network error connecting to Onairos API',
    };
  }
}

/**
 * Pre-verify email passthrough for frictionless user connection
 */
export async function preVerifyOnairosEmail(
  email: string,
  customKey?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const key = customKey || getOnairosApiKey();
  if (!key) {
    return { success: false, error: 'No ONAIROS_API_KEY configured.' };
  }

  try {
    const res = await fetch(`${ONAIROS_BASE_URL}/email/pre-verified`, {
      method: 'POST',
      headers: getOnairosHeaders(key),
      body: JSON.stringify({
        email,
        preVerified: true,
        source: 'sdk_passthrough',
      }),
    });

    const json = await res.json();
    return {
      success: res.ok && json.success === true,
      data: json,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error executing email pre-verification',
    };
  }
}
