import { writable } from 'svelte/store';
import type { Difficulty, Locale } from '@little-colors/core';

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
}

export const settings = writable<Settings>({
	language: 'bn-BD',
	difficulty: 'beginner',
	soundEnabled: true,
	islamicExpressionsEnabled: true,
	volume: 0.8
});
