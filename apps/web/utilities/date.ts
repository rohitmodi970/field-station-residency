// Safe date parsing and formatting helpers used across the app
export const parseDateSafely = (dateString?: string | null): Date | null => {
  if (!dateString) return null;
  // Handle date-only strings (YYYY-MM-DD) as local midnight to avoid
  // cross-browser differences where some engines treat them as UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(`${dateString}T00:00:00`);
  }
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? null : d;
};

export const formatDateForDisplay = (dateString?: string | null, locale = 'en-US'): string => {
  const d = parseDateSafely(dateString);
  if (!d) return '-';
  return d.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

export const formatTimeForDisplay = (dateString?: string | null, useUTC = false, locale = 'en-US'): string => {
  const d = parseDateSafely(dateString);
  if (!d) return '-';
  if (useUTC) {
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
  }
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
};

export const formatDateTimeForDisplay = (dateString?: string | null, locale = 'en-US'): string => {
  const d = parseDateSafely(dateString);
  if (!d) return '-';
  return d.toLocaleString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Format a Date object into ISO YYYY-MM-DD used elsewhere for grouping/comparison
export const formatISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default {
  parseDateSafely,
  formatDateForDisplay,
  formatTimeForDisplay,
  formatDateTimeForDisplay,
  formatISODate,
};
