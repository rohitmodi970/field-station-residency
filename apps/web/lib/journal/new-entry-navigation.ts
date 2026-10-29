export const JOURNAL_NEW_PROMPT_SESSION_KEY = 'journal:new-entry:prompt';
export const JOURNAL_NEW_PROMPT_CONTEXT_SESSION_KEY = 'journal:new-entry:prompt-context';
export const JOURNAL_NEW_MAX_PROMPT_LENGTH = 1200;

interface JournalPromptContext {
	text: string;
	explanation?: string;
}

export type JournalNewMode = 'write' | 'text' | 'voice' | 'quick' | 'mood';

export interface BuildJournalNewUrlOptions {
	mode?: JournalNewMode;
	source?: string;
	quick?: 'blank' | 'template' | 'ocr' | 'bulk';
	templateId?: string;
}

export function buildJournalNewUrl(options: BuildJournalNewUrlOptions = {}): string {
	const params = new URLSearchParams();

	if (options.source) {
		params.set('source', options.source);
	}

	if (options.mode) {
		params.set('mode', options.mode);
	}

	if (options.quick) {
		params.set('quick', options.quick);
	}

	if (options.templateId) {
		params.set('templateId', options.templateId);
	}

	const query = params.toString();
	return query ? `/journal/new?${query}` : '/journal/new';
}

export function setJournalPromptPrefill(prompt: string): void {
	if (typeof window === 'undefined') {
		return;
	}

	const normalized = prompt.trim();
	if (!normalized) {
		return;
	}

	const safePrompt = normalized.slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH);

	try {
		window.sessionStorage.setItem(JOURNAL_NEW_PROMPT_SESSION_KEY, safePrompt);
	} catch {
		// Ignore storage failures and allow fallback flows.
	}
}

export function consumeJournalPromptPrefill(): string {
	if (typeof window === 'undefined') {
		return '';
	}

	try {
		const value = window.sessionStorage.getItem(JOURNAL_NEW_PROMPT_SESSION_KEY) ?? '';
		window.sessionStorage.removeItem(JOURNAL_NEW_PROMPT_SESSION_KEY);
		return value.trim();
	} catch {
		return '';
	}
}

export function readJournalPromptPrefill(): string {
	if (typeof window === 'undefined') {
		return '';
	}

	try {
		const value = window.sessionStorage.getItem(JOURNAL_NEW_PROMPT_SESSION_KEY) ?? '';
		return value.trim();
	} catch {
		return '';
	}
}

export function clearJournalPromptPrefill(): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		window.sessionStorage.removeItem(JOURNAL_NEW_PROMPT_SESSION_KEY);
	} catch {
		// Ignore storage failures.
	}
}

export function setJournalPromptContext(prompt: JournalPromptContext): void {
	if (typeof window === 'undefined') {
		return;
	}

	const text = (prompt.text || '').trim().slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH);
	const explanation = (prompt.explanation || '').trim().slice(0, JOURNAL_NEW_MAX_PROMPT_LENGTH);

	if (!text) {
		return;
	}

	try {
		window.sessionStorage.setItem(
			JOURNAL_NEW_PROMPT_CONTEXT_SESSION_KEY,
			JSON.stringify({ text, explanation })
		);
	} catch {
		// Ignore storage failures and allow fallback flows.
	}
}

export function consumeJournalPromptContext(): JournalPromptContext | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const raw = window.sessionStorage.getItem(JOURNAL_NEW_PROMPT_CONTEXT_SESSION_KEY);
		window.sessionStorage.removeItem(JOURNAL_NEW_PROMPT_CONTEXT_SESSION_KEY);

		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw) as JournalPromptContext;
		const text = (parsed.text || '').trim();
		const explanation = (parsed.explanation || '').trim();

		if (!text) {
			return null;
		}

		return { text, explanation };
	} catch {
		return null;
	}
}

export function readJournalPromptContext(): JournalPromptContext | null {
	if (typeof window === 'undefined') {
		return null;
	}

	try {
		const raw = window.sessionStorage.getItem(JOURNAL_NEW_PROMPT_CONTEXT_SESSION_KEY);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw) as JournalPromptContext;
		const text = (parsed.text || '').trim();
		const explanation = (parsed.explanation || '').trim();

		if (!text) {
			return null;
		}

		return { text, explanation };
	} catch {
		return null;
	}
}

export function clearJournalPromptContext(): void {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		window.sessionStorage.removeItem(JOURNAL_NEW_PROMPT_CONTEXT_SESSION_KEY);
	} catch {
		// Ignore storage failures.
	}
}

export const JOURNAL_RETURN_URL_SESSION_KEY = 'journal:new-entry:return-url';

export function setJournalReturnUrl(url: string): void {
	if (typeof window === 'undefined') return;
	try {
		const normalized = (url || '').trim();
		if (normalized && !normalized.startsWith('/journal/new')) {
			window.sessionStorage.setItem(JOURNAL_RETURN_URL_SESSION_KEY, normalized);
		}
	} catch {
		// Ignore storage errors
	}
}

export function getJournalReturnUrl(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		return window.sessionStorage.getItem(JOURNAL_RETURN_URL_SESSION_KEY);
	} catch {
		return null;
	}
}

export function clearJournalReturnUrl(): void {
	if (typeof window === 'undefined') return;
	try {
		window.sessionStorage.removeItem(JOURNAL_RETURN_URL_SESSION_KEY);
	} catch {
		// Ignore storage errors
	}
}

export function navigateBackFromJournal(
	router: { back: () => void; push: (url: string) => void },
	fallback?: string
): void {
	if (typeof window === 'undefined') {
		router.push(fallback || '/journal');
		return;
	}

	// 1. Check if an explicit return URL was recorded in sessionStorage
	try {
		const returnUrl = window.sessionStorage.getItem(JOURNAL_RETURN_URL_SESSION_KEY);
		if (returnUrl && !returnUrl.startsWith('/journal/new')) {
			window.sessionStorage.removeItem(JOURNAL_RETURN_URL_SESSION_KEY);
			router.push(returnUrl);
			return;
		}
	} catch {
		// Ignore
	}

	// 2. Check document.referrer (must be same host and not /journal/new)
	try {
		if (document.referrer) {
			const url = new URL(document.referrer);
			if (url.host === window.location.host && !url.pathname.startsWith('/journal/new')) {
				router.push(url.pathname + url.search);
				return;
			}
		}
	} catch {
		// Ignore
	}

	// 3. Check browser history
	if (window.history.length > 1) {
		router.back();
		return;
	}

	// 4. Default fallback: check if source in searchParams indicates dashboard
	let resolvedFallback = fallback;
	if (!resolvedFallback) {
		try {
			const currentParams = new URLSearchParams(window.location.search);
			const source = currentParams.get('source');
			if (source && source.includes('dashboard')) {
				resolvedFallback = '/dashboard';
			} else {
				resolvedFallback = '/journal';
			}
		} catch {
			resolvedFallback = '/journal';
		}
	}

	router.push(resolvedFallback);
}
