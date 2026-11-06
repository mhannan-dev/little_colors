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
	/**
	 * true = digits follow the language (বাংলা → ১২৩, English → 123). A parent who picks a
	 * style explicitly (setNumeralStyle) turns this off so the choice sticks.
	 */
	numeralStyleAuto: boolean;
	/** Spec 10: defaults to the OS "reduce motion" preference (DS-26). */
	reducedMotion: boolean;
}

const numeralsFor = (language: Locale): NumeralStyle => (language === 'bn-BD' ? 'bengali' : 'english');

/** Apply a language change, keeping digits in step with it unless a parent chose a style. */
function withLanguage(current: Settings, language: Locale): Settings {
	return {
		...current,
		language,
		numeralStyle: current.numeralStyleAuto ? numeralsFor(language) : current.numeralStyle
	};
}

const DEFAULT_LANGUAGE: Locale = 'en-US';

export const settings = writable<Settings>({
	language: DEFAULT_LANGUAGE,
	difficulty: 'beginner',
	soundEnabled: true,
	islamicExpressionsEnabled: true,
	volume: 0.8,
	numeralStyle: numeralsFor(DEFAULT_LANGUAGE),
	numeralStyleAuto: true,
	reducedMotion:
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
});

const languageKey = 'rumi-language';

export function restoreLanguage(): void {
	try {
		const language = localStorage.getItem(languageKey);
		if (language === 'bn-BD' || language === 'en-US') {
			settings.update(current => withLanguage(current, language));
		}
	} catch {
		// Storage may be unavailable in private or restricted browser contexts.
	}
}

/** Parent choice (spec 10): fixed digits regardless of language. */
export function setNumeralStyle(numeralStyle: NumeralStyle): void {
	settings.update(current => ({ ...current, numeralStyle, numeralStyleAuto: false }));
}

export function setLanguage(language: Locale): void {
	settings.update(current => withLanguage(current, language));
	try {
		localStorage.setItem(languageKey, language);
	} catch {
		// Keep the new language for the current session.
	}
}
