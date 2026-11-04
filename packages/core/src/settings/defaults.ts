import { SETTINGS_SCHEMA_VERSION, type ParentSettings } from './schema.ts';

export const DEFAULT_SETTINGS: Readonly<ParentSettings> = Object.freeze({
	schemaVersion: SETTINGS_SCHEMA_VERSION, language: 'bn-BD', numeralStyle: 'bengali',
	difficulty: 'beginner', soundEnabled: true, sfxEnabled: true, musicEnabled: false,
	volume: 0.8, islamicExpressionsEnabled: true, reducedMotion: false, darkMode: false,
	restReminderMinutes: 20
});

/** The app supplies the OS preference; core never reads platform APIs. */
export function createDefaultSettings(reducedMotion = false): ParentSettings {
	return { ...DEFAULT_SETTINGS, reducedMotion };
}
