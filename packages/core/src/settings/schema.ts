import type { Difficulty, Locale } from '../types/colors.ts';

export interface ParentSettings {
	schemaVersion: number;
	language: Locale;
	numeralStyle: 'bengali' | 'english' | 'both';
	difficulty: Difficulty;
	soundEnabled: boolean;
	sfxEnabled: boolean;
	musicEnabled: boolean;
	volume: number;
	islamicExpressionsEnabled: boolean;
	reducedMotion: boolean;
	darkMode: boolean;
	/** Zero means reminders are off. */
	restReminderMinutes: number;
}
export const SETTINGS_SCHEMA_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'lc.settings.v1';
