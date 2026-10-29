import fs from 'node:fs';
import path from 'node:path';

function getEnvKeyFromDisk(key: string): string {
  try {
    const candidates = [
      path.join(process.cwd(), '.env'),
      path.join(process.cwd(), '.env.local'),
      path.join(process.cwd(), 'apps', 'web', '.env'),
      path.join(process.cwd(), '..', '.env'),
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(new RegExp(`^${key}\\s*=\\s*(.*)$`, 'm'));
        if (match && match[1]) {
          return match[1].trim().replace(/^['"`]|['"`]$/g, '');
        }
      }
    }
  } catch {
    // Ignore file read error in edge/browser runtimes
  }
  return '';
}

export interface ImentivConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret: string;
  webhookBaseUrl: string;
  defaultLanguage: string;
  timeoutMs: number;
}

export function getImentivConfig(): ImentivConfig {

  const rawKey =
    process.env.IMENTIV_API_KEY ||
    process.env.IMENTIV_AI_API_KEY ||
    process.env.IMENTIV_KEY ||
    process.env.NEXT_PUBLIC_IMENTIV_API_KEY ||
    getEnvKeyFromDisk('IMENTIV_API_KEY') ||
    getEnvKeyFromDisk('IMENTIV_AI_API_KEY') ||
    '';

  const apiKey = rawKey.trim().replace(/^['"`]|['"`]$/g, '');

  const baseUrl = (
    process.env.IMENTIV_API_BASE_URL ||
    process.env.IMENTIV_BASE_URL ||
    getEnvKeyFromDisk('IMENTIV_API_BASE_URL') ||
    'https://api.imentiv.ai'
  ).trim().replace(/\/+$/, '');



  const webhookSecret =
    process.env.IMENTIV_WEBHOOK_SECRET ||
    process.env.WEBHOOK_SECRET ||
    '';

  const webhookBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.WEBHOOK_BASE_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '');

  const defaultLanguage = process.env.IMENTIV_DEFAULT_LANGUAGE || 'en';
  const timeoutMs = parseInt(process.env.IMENTIV_TIMEOUT_MS || '60000', 10);

  return {
    apiKey,
    baseUrl,
    webhookSecret,
    webhookBaseUrl,
    defaultLanguage,
    timeoutMs,
  };
}

export function isImentivConfigured(): boolean {
  const config = getImentivConfig();
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
}

export interface ImentivValidationResult {
  isValid: boolean;
  missingFields: string[];
  config: {
    baseUrl: string;
    webhookBaseUrl: string;
    defaultLanguage: string;
    hasApiKey: boolean;
    hasWebhookSecret: boolean;
  };
}

export function validateImentivConfig(): ImentivValidationResult {
  const config = getImentivConfig();
  const missing: string[] = [];

  if (!config.apiKey) missing.push('IMENTIV_API_KEY');
  if (!config.baseUrl) missing.push('IMENTIV_API_BASE_URL');

  return {
    isValid: missing.length === 0,
    missingFields: missing,
    config: {
      baseUrl: config.baseUrl,
      webhookBaseUrl: config.webhookBaseUrl,
      defaultLanguage: config.defaultLanguage,
      hasApiKey: Boolean(config.apiKey),
      hasWebhookSecret: Boolean(config.webhookSecret),
    },
  };
}

