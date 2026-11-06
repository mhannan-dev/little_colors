import { writable } from 'svelte/store';
import type { Difficulty, Locale, NumeralStyle } from '@little-colors/core';

/**
 * PLACEHOLDER (spec 10): in-memory settings with spec defaults.
 * The language preference is saved locally. Other settings are in memory.
 */
export interface Settings {
	language: Locale;
	difficulty: Difficulty;
	soundEnabled: boolean;
	islamicExpressionsEnabled: boolean;
	volume: number;
	numeralStyle: NumeralStyle;
	/** Spec 10: defaults to the OS "reduce motion" preference (DS-26). */
	reducedMotion: boolean;
}

export const settings = writable<Settings>({
	language: 'en-US',
	difficulty: 'beginner',
	soundEnabled: true,
	islamicExpressionsEnabled: true,
	volume: 0.8,
	numeralStyle: 'bengali',
	reducedMotion:
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
});

const languageKey = 'rumi-language';

export function restoreLanguage(): void {
	try {
		const language = localStorage.getItem(languageKey);
		if (language === 'bn-BD' || language === 'en-US') {
			settings.update(current => ({ ...current, language }));
		}
	} catch {
		// Storage may be unavailable in private or restricted browser contexts.
	}
}

export function setLanguage(language: Locale): void {
	settings.update(current => ({ ...current, language }));
	try {
		localStorage.setItem(languageKey, language);
	} catch {
		// Keep the new language for the current session.
	}
}
