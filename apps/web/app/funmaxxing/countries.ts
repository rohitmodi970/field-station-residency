export interface Country {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
  mask?: string;
}

export const COUNTRIES: Country[] = [
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', mask: '(###) ###-####' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', mask: '##### ######' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', mask: '(###) ###-####' },
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', mask: '##### #####' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', mask: '#### ### ###' },
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', mask: '#### #######' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', mask: '## ## ## ## ##' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', mask: '###-####-####' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', mask: '#### ####' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', mask: '## ### ####' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', mask: '## ########' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', mask: '## ### ## ##' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪', mask: '### ### ## ##' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', mask: '### ### ###' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', mask: '### ### ####' },
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', mask: '(##) #####-####' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽', mask: '### ### ####' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪', mask: '## ### ####' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿', mask: '### ### ####' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷', mask: '##-####-####' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴', mask: '### ## ###' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰', mask: '## ## ## ##' },
  { name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮', mask: '### ### ####' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹', mask: '### ### ###' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪', mask: '### ## ## ##' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹', mask: '#### ######' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱', mask: '### ### ###' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', mask: '## ### ####' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦', mask: '## ### ####' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷', mask: '### ### ## ##' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱', mask: '##-###-####' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷', mask: '## ####-####' },
  { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱', mask: '# #### ####' },
  { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴', mask: '### ### ####' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭', mask: '#### ### ####' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩', mask: '###-####-####' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾', mask: '##-### ####' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭', mask: '## ### ####' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳', mask: '### ### ####' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰', mask: '#### ####' },
  { name: 'Taiwan', code: 'TW', dialCode: '+886', flag: '🇹🇼', mask: '### ### ###' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', mask: '### ### ####' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬', mask: '### ### ####' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪', mask: '### ######' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰', mask: '### #######' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩', mask: '####-######' },
  { name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷', mask: '### ### ####' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420', flag: '🇨🇿', mask: '### ### ###' },
  { name: 'Romania', code: 'RO', dialCode: '+40', flag: '🇷🇴', mask: '### ### ###' },
  { name: 'Hungary', code: 'HU', dialCode: '+36', flag: '🇭🇺', mask: '## ### ####' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦', mask: '## ### ####' },
];

const DEFAULT_COUNTRY: Country = COUNTRIES[0]!;

/**
 * Detects user's probable country based on navigator.language or timezone.
 */
export function detectCountry(): Country {
  if (typeof window === 'undefined') {
    return DEFAULT_COUNTRY; // US fallback
  }

  try {
    const lang = (navigator.language || '').toUpperCase();
    // Check if locale has country subtag, e.g. "en-GB", "en-US", "fr-FR", "pt-BR"
    const parts = lang.split('-');
    if (parts.length > 1) {
      const countryCode = parts[1];
      const match = COUNTRIES.find((c) => c.code === countryCode);
      if (match) return match;
    }

    // Try timezone detection
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('London')) return COUNTRIES.find((c) => c.code === 'GB') || DEFAULT_COUNTRY;
    if (tz.includes('Kolkata') || tz.includes('Calcutta')) return COUNTRIES.find((c) => c.code === 'IN') || DEFAULT_COUNTRY;
    if (tz.includes('Sydney') || tz.includes('Melbourne')) return COUNTRIES.find((c) => c.code === 'AU') || DEFAULT_COUNTRY;
    if (tz.includes('Tokyo')) return COUNTRIES.find((c) => c.code === 'JP') || DEFAULT_COUNTRY;
    if (tz.includes('Paris')) return COUNTRIES.find((c) => c.code === 'FR') || DEFAULT_COUNTRY;
    if (tz.includes('Berlin')) return COUNTRIES.find((c) => c.code === 'DE') || DEFAULT_COUNTRY;
    if (tz.includes('Toronto') || tz.includes('Vancouver')) return COUNTRIES.find((c) => c.code === 'CA') || DEFAULT_COUNTRY;
    if (tz.includes('Sao_Paulo')) return COUNTRIES.find((c) => c.code === 'BR') || DEFAULT_COUNTRY;
  } catch {
    // ignore
  }

  return DEFAULT_COUNTRY;
}

/**
 * Formats a phone number string progressively as the user types without heavy dependencies.
 */
export function formatPhoneNumber(value: string, country: Country): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  // If country is US/CA (NANP 10-digit format: (XXX) XXX-XXXX)
  if (country.code === 'US' || country.code === 'CA') {
    if (digits.length <= 3) {
      return digits;
    }
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }
    if (digits.length <= 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)} ${digits.slice(10, 14)}`;
  }

  // General progressive format: groups of 3-3-4 or 4-3-4
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10, 15)}`;
}

/**
 * Validates a formatted phone number.
 * Requires at least 7 digits and maximum 15 digits.
 */
export function validatePhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
