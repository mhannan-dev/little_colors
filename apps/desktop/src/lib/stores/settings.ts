import { writable } from 'svelte/store';
import type { Difficulty, Locale, NumeralStyle } from '@little-colors/core';

/**
 * PLACEHOLDER (spec 10): in-memory settings with spec defaults.
 * Persistence, the parent gate, and the settings screen arrive in Phase 6.
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
	language: 'bn-BD',
	difficulty: 'beginner',
	soundEnabled: true,
	islamicExpressionsEnabled: true,
	volume: 0.8,
	numeralStyle: 'bengali',
	reducedMotion:
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
});
