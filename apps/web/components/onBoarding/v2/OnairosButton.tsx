'use client';

import React from 'react';
import OnairosSdkConnector from './OnairosSdkConnector';
import type { OnairosExportedData } from '@/lib/onairos';

export interface OnairosButtonProps {
  apiKey?: string | null;
  userEmail?: string | null;
  testMode?: boolean;
  allowedPlatforms?: string[] | null;
  webpageName?: string;
  requestData?: any;
  buttonText?: string;
  onComplete: (data: any, exported?: OnairosExportedData) => void;
  onError?: (err: any) => void;
}

/**
 * OnairosButton — Drop-in Web Onboarding Button
 *
 * Implements the Onairos onboarding button with pre-configured API key initialization
 * and data extraction callback per node_modules/onairos/llm.txt.
 */
export default function OnairosButton(props: OnairosButtonProps) {
  return <OnairosSdkConnector {...props} />;
}

export { OnairosButton };
