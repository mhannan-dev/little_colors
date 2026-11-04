import { describe, expect, it } from 'vitest';
import { emptyProgress, migrateProgress, createProgressService, PROGRESS_STORAGE_KEY, type ProgressActivity } from '../../src/progress/index.ts';
import { createMemoryStorageAdapter } from '../../src/storage/memoryStorageAdapter.ts';
import { createFakeClock } from '../helpers/fakeClock.ts';
import type { StorageAdapter } from '../../src/storage/StorageAdapter.ts';
import type { Difficulty, GameMode } from '../../src/types/colors.ts';

const activity: ProgressActivity = { id: 'mixing.1', mode: 'mixing', difficulty: 'beginner' };
const clock = () => createFakeClock(Date.UTC(2026, 10, 4));
describe('progress schema and migration (CP-30 to CP-32)', () => {
	it('creates independent empty matrices/arrays and round trips serialization', () => {
		const first = emptyProgress(); first.completedRounds.mixing.beginner = 3;
		expect(emptyProgress().completedRounds.mixing.beginner).toBe(0);
		expect(migrateProgress(JSON.stringify(first))).toEqual(first);
	});
	it('migrates v0/unversioned partial data with known fields and drops unknown metadata', () => {
		const result = migrateProgress({ schemaVersion: 0, completedActivityIds: ['old', 'old'], countedUpTo: 3, completedRounds: { mixing: { beginner: 2 } }, childName: 'unused' });
		expect(result).toMatchObject({ schemaVersion: 1, completedActivityIds: ['old'], countedUpTo: 3 });
		expect(result.completedRounds.mixing.beginner).toBe(2); expect(result.completedRounds.numbers.advanced).toBe(0); expect('childName' in result).toBe(false);
	});
	it.each([null, [], '{bad', { schemaVersion: 9 }, { ...emptyProgress(), countedUpTo: 11 }, { ...emptyProgress(), discoveredColors: ['invalid'] }, { ...emptyProgress(), lastPlayedAt: 'invalid' }, { ...emptyProgress(), hintsUsed: { mixing: { beginner: -1 } } }])('resets corrupt or unknown data (%j)', (data) => expect(migrateProgress(data)).toEqual(emptyProgress()));
});

describe('progress service and recommendation (CP-20 to CP-22, CP-33 to CP-35)', () => {
	it('records completed activities once, deduplicates discoveries, tracks maximum count and ISO date', async () => {
		const storage = createMemoryStorageAdapter(); const time = clock();
		const service = createProgressService(storage, time, () => 'beginner');
		await service.recordActivity(activity, { hintsUsed: 1, discovered: { colors: ['orange', 'orange'], shapes: ['circle'], countedUpTo: 3 } });
		await service.recordActivity(activity, { hintsUsed: 9, discovered: { countedUpTo: 9 } });
		await service.recordActivity({ ...activity, id: 'second' }, { hintsUsed: 0, discovered: { colors: ['green'], countedUpTo: 2 } });
		const progress = await service.load();
		expect(progress.completedActivityIds).toEqual(['mixing.1', 'second']); expect(progress.hintsUsed.mixing.beginner).toBe(1);
		expect(progress.discoveredColors).toEqual(['orange', 'green']); expect(progress.discoveredShapes).toEqual(['circle']); expect(progress.countedUpTo).toBe(3);
		expect(progress.lastPlayedAt).toBe('2026-11-04T00:00:00.000Z'); expect(await storage.get(PROGRESS_STORAGE_KEY)).toEqual(progress);
	});
	it('does not save a mid-activity state and restores completed progress on a new service', async () => {
		const storage = createMemoryStorageAdapter(); const service = createProgressService(storage, clock(), () => 'beginner');
		await service.load(); expect(await storage.get(PROGRESS_STORAGE_KEY)).toBeNull();
		await service.recordActivity(activity, { hintsUsed: 0 });
		expect(await createProgressService(storage, clock(), () => 'beginner').load()).toEqual(await service.load());
	});
	it.each(['mixing', 'matching', 'numbers'] as GameMode[])('%s recommendations require exactly three rounds and ≤1 hint/activity', async (mode) => {
		const storage = createMemoryStorageAdapter(); const saved = emptyProgress();
		const count = mode === 'mixing' ? 3 : 5;
		saved.completedRounds[mode].beginner = 2; saved.hintsUsed[mode].beginner = 3 * count;
		await storage.set(PROGRESS_STORAGE_KEY, saved);
		let difficulty: Difficulty = 'beginner'; const service = createProgressService(storage, clock(), () => difficulty);
		await service.load(); expect(service.getRecommendation(mode)).toBeNull();
		await service.recordRoundComplete(mode, 'beginner'); expect(service.getRecommendation(mode)).toBe('explorer');
		await service.recordActivity({ id: 'excess', mode, difficulty }, { hintsUsed: 1 }); expect(service.getRecommendation(mode)).toBeNull();
		difficulty = 'explorer'; expect(service.getRecommendation(mode)).toBeNull();
		for (let i = 0; i < 3; i++) await service.recordRoundComplete(mode, difficulty);
		expect(service.getRecommendation(mode)).toBe('advanced');
		difficulty = 'advanced'; expect(service.getRecommendation(mode)).toBeNull();
	});
	it('reset clears only progress, including disk state, and preserves settings', async () => {
		const storage = createMemoryStorageAdapter(); await storage.set('lc.settings.v1', { language: 'en-US' });
		const service = createProgressService(storage, clock(), () => 'beginner');
		await service.recordActivity(activity, { hintsUsed: 0 }); await service.reset();
		expect(await service.load()).toEqual(emptyProgress()); expect(await storage.get(PROGRESS_STORAGE_KEY)).toEqual(emptyProgress());
		expect(await storage.get('lc.settings.v1')).toEqual({ language: 'en-US' });
	});
	it('serializes concurrent records and protects snapshots from mutations', async () => {
		const storage = createMemoryStorageAdapter(); const service = createProgressService(storage, clock(), () => 'beginner');
		await Promise.all(Array.from({ length: 10 }, (_, index) => service.recordActivity({ ...activity, id: `activity-${index}` }, { hintsUsed: 1 })));
		const loaded = await service.load(); expect(loaded.completedActivityIds).toHaveLength(10); expect(loaded.hintsUsed.mixing.beginner).toBe(10);
		loaded.completedActivityIds.length = 0; loaded.hintsUsed.mixing.beginner = 0;
		expect((await service.load()).completedActivityIds).toHaveLength(10); expect(await storage.get(PROGRESS_STORAGE_KEY)).toEqual(await service.load());
	});
	it('uses memory when storage is unavailable, including reset', async () => {
		const storage: StorageAdapter = { get: async () => { throw new Error('blocked'); }, set: async () => { throw new Error('quota'); }, remove: async () => { throw new Error('blocked'); } };
		const service = createProgressService(storage, clock(), () => 'beginner');
		await service.recordActivity(activity, { hintsUsed: 2 }); expect((await service.load()).completedActivityIds).toEqual([activity.id]);
		await service.reset(); expect(await service.load()).toEqual(emptyProgress());
	});
	it('rejects invalid outcomes without damaging saved progress or blocking the next queued record', async () => {
		const service = createProgressService(createMemoryStorageAdapter(), clock(), () => 'beginner');
		await expect(service.recordActivity(activity, { hintsUsed: -1 })).rejects.toThrow(RangeError);
		await expect(service.recordActivity(activity, { hintsUsed: 0, discovered: { shapes: ['invalid'] } })).rejects.toThrow(RangeError);
		expect(await service.load()).toEqual(emptyProgress());
		await service.recordActivity(activity, { hintsUsed: 0 }); expect((await service.load()).completedActivityIds).toEqual([activity.id]);
	});
});
