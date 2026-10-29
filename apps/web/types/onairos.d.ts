// TypeScript declaration for 'onairos' SDK
// Provides ambient module typings for Onairos web integration

declare module 'onairos' {
  import React from 'react';

  export interface OnairosCompleteData {
    token?: string;
    apiUrl?: string;
    userHash?: string;
    appName?: string;
    approvedData?: string[];
    testMode?: boolean;
    timestamp?: string;
    apiResponse?: any;
    authorizedData?: {
      traits?: boolean;
      personality?: boolean;
      preferences?: boolean;
      rawData?: boolean;
      rawMemories?: boolean;
      llmData?: boolean;
    };
    rawMemoriesPolicy?: { offered: boolean; code?: string; connectorPlatforms?: string[] };
    traitIntent?: Record<string, unknown>;
    training?: { ready: boolean; statusUrl?: string; pollIntervalMs?: number; neverTrained?: boolean };
    usage?: any;
    userData?: any;
    userDataSummary?: any;
    prettyPrint?: string;
    connectedSources?: string[];
    ascendContext?: any;
    success?: boolean;
    simulated?: boolean;
    error?: string;
    cancelled?: boolean;
    [key: string]: any;
  }

  export interface OnairosProps {
    webpageName: string;
    requestData: any;
    onComplete?: (data: OnairosCompleteData, error?: Error) => void;
    autoFetch?: boolean;
    testMode?: boolean;
    proofMode?: boolean;
    textLayout?: 'right' | 'left' | 'below' | 'none';
    textColor?: 'black' | 'white';
    login?: boolean;
    loginReturn?: (data: any, error?: Error) => void;
    buttonType?: 'pill' | 'icon' | 'rectangle';
    appIcon?: string | null;
    dataRequestTitle?: string | null;
    privacyPolicyUrl?: string | null;
    priorityPlatform?: string | null;
    rawMemoriesOnly?: boolean;
    rawMemoriesConfig?: any;
    topicFilter?: string | null;
    allowedPlatforms?: string[] | null;
    autoOpen?: boolean;
    skipWelcome?: boolean;
    showIcon?: boolean;
    buttonText?: string;
    redirectUrl?: string;
    autoSignIn?: boolean;
    trainingScreenMode?: 'mock' | 'fast' | 'real' | 'none';
    closeOnConsent?: boolean;
    children?: ((props: any) => React.ReactNode) | React.ReactNode;
    [key: string]: any;
  }

  export interface OnairosReconnectCompleteData {
    connectedAccounts: string[];
    userData: any;
    timestamp: string;
  }

  export interface OnairosReconnectButtonProps {
    buttonText?: string;
    buttonClass?: string;
    buttonStyle?: React.CSSProperties;
    appIcon?: string;
    appName?: string;
    onComplete?: (data: OnairosReconnectCompleteData) => void;
    onNoUserData?: () => void;
    priorityPlatform?: string;
    rawMemoriesOnly?: boolean;
    rawMemoriesConfig?: any;
  }

  export function initializeApiKey(config: {
    apiKey: string;
    environment?: string;
    enableLogging?: boolean;
    platform?: string;
    [key: string]: any;
  }): Promise<any>;

  export const OnairosButton: React.ComponentType<OnairosProps>;
  export const Onairos: React.ComponentType<OnairosProps>;
  export const OnairosReconnectButton: React.ComponentType<OnairosReconnectButtonProps>;
  export function openOnairosOverlay(options?: any): Promise<any>;

  export function disconnectPlatform(platform: string, username: string): Promise<any>;
  export function disconnectMultiplePlatforms(platforms: string[], username: string): Promise<any>;
  export function hasAuthToken(): boolean;
  export function getSupportedPlatforms(): string[];
  export function isPlatformSupported(platform: string): boolean;

  const defaultExport: React.ComponentType<OnairosProps>;
  export default defaultExport;
}

// Module-level exports for direct imports from '@/types/onairos'
export type OnairosCompleteData = import('onairos').OnairosCompleteData;
export type OnairosProps = import('onairos').OnairosProps;
export type OnairosReconnectCompleteData = import('onairos').OnairosReconnectCompleteData;
export type OnairosReconnectButtonProps = import('onairos').OnairosReconnectButtonProps;

