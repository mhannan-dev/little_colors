import { describe, expect, it, vi } from 'vitest';
import { createDefaultSettings, DEFAULT_SETTINGS, migrateSettings, createSettingsService, createGateQuestion, SETTINGS_STORAGE_KEY } from '../../src/settings/index.ts';
import { createMemoryStorageAdapter } from '../../src/storage/memoryStorageAdapter.ts';
import type { StorageAdapter } from '../../src/storage/StorageAdapter.ts';

describe('settings schema, defaults and migrations (PS-20 to PS-23)', () => {
	it('defines safe defaults once and accepts the injected OS motion preference', () => {
		expect(createDefaultSettings()).toEqual(DEFAULT_SETTINGS);
		expect(createDefaultSettings(true).reducedMotion).toBe(true);
		expect(DEFAULT_SETTINGS).toMatchObject({ language: 'bn-BD', numeralStyle: 'bengali', difficulty: 'beginner', volume: 0.8, musicEnabled: false, restReminderMinutes: 20 });
		const mutable = createDefaultSettings(); mutable.language = 'en-US'; expect(createDefaultSettings().language).toBe('bn-BD');
	});
	it('upgrades v0/unversioned data and parses serialized settings', () => {
		for (const schemaVersion of [undefined, 0, 1]) {
			const value = { schemaVersion, language: 'en-US', soundEnabled: false, restReminderMinutes: 0 };
			expect(migrateSettings(JSON.stringify(value))).toMatchObject({ schemaVersion: 1, language: 'en-US', soundEnabled: false, restReminderMinutes: 0 });
		}
	});
	it.each([null, undefined, [], 3, true, '{broken', { schemaVersion: 99, language: 'en-US' }])('recovers from corrupt or future data (%j)', (value) => expect(migrateSettings(value)).toEqual(createDefaultSettings()));
	it('repairs invalid fields individually and drops unknown/private fields', () => {
		const result = migrateSettings({ language: 'en-US', volume: NaN, restReminderMinutes: 12, difficulty: 'hard', soundEnabled: 'false', childName: 'unused', darkMode: true });
		expect(result).toEqual({ ...createDefaultSettings(), language: 'en-US', darkMode: true });
		expect('childName' in result).toBe(false);
	});
	it('accepts every supported rest threshold, off, and zero volume', () => {
		for (const rest of [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]) expect(migrateSettings({ restReminderMinutes: rest, volume: 0 })).toMatchObject({ restReminderMinutes: rest, volume: 0 });
	});
});

describe('settings service (PS-10, PS-23)', () => {
	it('loads lazily, updates only patched fields, and persists under the settings key', async () => {
		const storage = createMemoryStorageAdapter();
		await storage.set(SETTINGS_STORAGE_KEY, { ...createDefaultSettings(), language: 'en-US' });
		const service = createSettingsService(storage);
		await service.update({ numeralStyle: 'both' });
		expect(await service.load()).toMatchObject({ language: 'en-US', numeralStyle: 'both' });
		expect(await storage.get(SETTINGS_STORAGE_KEY)).toEqual(await service.load());
		const next = createSettingsService(storage); expect(await next.load()).toEqual(await service.load());
	});
	it('publishes immediately before a slow save finishes and isolates subscribers', async () => {
		let release: () => void = () => {};
		const storage: StorageAdapter = { get: async () => null, set: () => new Promise<void>((resolve) => { release = resolve; }), remove: async () => {} };
		const service = createSettingsService(storage);
		await service.load();
		let sawChange: () => void = () => {};
		const changed = new Promise<void>((resolve) => { sawChange = resolve; });
		service.subscribe((settings) => { if (settings.language === 'en-US') sawChange(); settings.darkMode = true; });
		const update = service.update({ language: 'en-US' });
		await changed;
		release(); await update;
		expect((await service.load()).darkMode).toBe(false);
	});
	it('serializes overlapping updates and protects returned snapshots', async () => {
		const storage = createMemoryStorageAdapter();
		const service = createSettingsService(storage);
		await Promise.all([service.update({ language: 'en-US' }), service.update({ volume: 0.2 }), service.update({ darkMode: true })]);
		const result = await service.load();
		expect(result).toMatchObject({ language: 'en-US', volume: 0.2, darkMode: true });
		result.language = 'bn-BD';
		expect((await service.load()).language).toBe('en-US');
		expect(await storage.get(SETTINGS_STORAGE_KEY)).toEqual(await service.load());
	});
	it('continues in memory when reading and writing throw', async () => {
		const unavailable: StorageAdapter = { get: async () => { throw new Error('unavailable'); }, set: async () => { throw new Error('unavailable'); }, remove: async () => { throw new Error('unavailable'); } };
		const service = createSettingsService(unavailable, { reducedMotion: true });
		expect((await service.load()).reducedMotion).toBe(true);
		await service.update({ language: 'en-US' });
		expect((await service.load()).language).toBe('en-US');
	});
	it('supports immediate subscriptions, duplicate callbacks and idempotent unsubscribe', async () => {
		const service = createSettingsService(createMemoryStorageAdapter()); await service.load();
		const listener = vi.fn(); const off = service.subscribe(listener); service.subscribe(listener);
		expect(listener).toHaveBeenCalledTimes(2); off(); off();
		await service.update({ volume: 0.1 }); expect(listener).toHaveBeenCalledTimes(3);
	});
});

describe('parent gate question generator (PS-02, PS-03)', () => {
	it('uses word-only bilingual questions, four unique options, sums 11–30 and seeded reproducibility over 1,000 seeds', () => {
		const english = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty one', 'twenty two', 'twenty three', 'twenty four', 'twenty five', 'twenty six', 'twenty seven', 'twenty eight', 'twenty nine'];
		const answers = new Set<number>();
		for (let seed = 0; seed < 1000; seed++) {
			const question = createGateQuestion(seed);
			expect(createGateQuestion(seed)).toEqual(question);
			expect(question.options).toHaveLength(4); expect(new Set(question.options).size).toBe(4);
			expect(question.options).toContain(question.answer); expect(question.answer).toBeGreaterThanOrEqual(11); expect(question.answer).toBeLessThanOrEqual(30);
			expect(question.textBn).not.toMatch(/[0-9০-৯]/); expect(question.textEn).not.toMatch(/\d/);
			const match = question.textEn.match(/^What is (.+) plus (.+)\?$/)!;
			expect(english.indexOf(match[1]!) + english.indexOf(match[2]!)).toBe(question.answer);
			answers.add(question.answer);
		}
		expect(answers.size).toBe(20);
	}, 60_000);
});
