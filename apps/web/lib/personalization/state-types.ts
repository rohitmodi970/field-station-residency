import type { EnergyBucket } from './types';

export interface BucketState {
  bucket: EnergyBucket | null;
  reflection: string | null;
  commitment: boolean;
  requiresSelection: boolean;
}
