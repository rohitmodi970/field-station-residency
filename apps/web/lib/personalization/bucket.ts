import type { EnergyBucket } from './types';

const BUCKET_VALUES: readonly EnergyBucket[] = ['clarity', 'growth', 'stability'];

export function isEnergyBucket(value: unknown): value is EnergyBucket {
  return typeof value === 'string' && BUCKET_VALUES.includes(value as EnergyBucket);
}

export function mapEnergyLevelToBucket(value: unknown): EnergyBucket | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('clarity')) return 'clarity';
  if (normalized.includes('growth')) return 'growth';
  if (normalized.includes('stability')) return 'stability';

  if (isEnergyBucket(normalized)) return normalized;
  return null;
}

export function getBucketLabel(bucket: EnergyBucket): string {
  if (bucket === 'clarity') return 'Seeking clarity';
  if (bucket === 'growth') return 'Ready for growth';
  return 'Craving stability';
}
