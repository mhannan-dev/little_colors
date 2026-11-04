import { createDefaultSettings } from './defaults.ts';
import { SETTINGS_SCHEMA_VERSION, type ParentSettings } from './schema.ts';

export function migrateSettings(data: unknown, defaults: ParentSettings = createDefaultSettings()): ParentSettings {
	if (typeof data === 'string') { try { data = JSON.parse(data) as unknown; } catch { return { ...defaults }; } }
	if (!data || typeof data !== 'object' || Array.isArray(data)) return { ...defaults };
	const value = data as Record<string, unknown>;
	// Version 0 is the unversioned development schema, with the same field names.
	if (value.schemaVersion !== undefined && value.schemaVersion !== 0 && value.schemaVersion !== SETTINGS_SCHEMA_VERSION) return { ...defaults };
	const result = { ...defaults, schemaVersion: SETTINGS_SCHEMA_VERSION };
	if (value.language === 'bn-BD' || value.language === 'en-US') result.language = value.language;
	if (value.numeralStyle === 'bengali' || value.numeralStyle === 'english' || value.numeralStyle === 'both') result.numeralStyle = value.numeralStyle;
	if (value.difficulty === 'beginner' || value.difficulty === 'explorer' || value.difficulty === 'advanced') result.difficulty = value.difficulty;
	const flags = ['soundEnabled', 'sfxEnabled', 'musicEnabled', 'islamicExpressionsEnabled', 'reducedMotion', 'darkMode'] as const;
	for (const key of flags) if (typeof value[key] === 'boolean') result[key] = value[key];
	if (typeof value.volume === 'number' && Number.isFinite(value.volume) && value.volume >= 0 && value.volume <= 1) result.volume = value.volume;
	const rest = value.restReminderMinutes;
	if (typeof rest === 'number' && (rest === 0 || (Number.isInteger(rest) && rest >= 10 && rest <= 60 && rest % 5 === 0))) result.restReminderMinutes = rest;
	return result;
}
