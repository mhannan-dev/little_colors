import type { Color, Difficulty, GameMode } from '../types/colors.ts';
import type { StorageAdapter } from '../storage/StorageAdapter.ts';
import type { Clock } from '../session/Clock.ts';
import { migrateProgress } from './migrations.ts';
import { emptyProgress, PROGRESS_STORAGE_KEY, ROUND_ACTIVITY_COUNTS, type PlayerProgress } from './schema.ts';

export interface ProgressActivity { id: string; mode: GameMode; difficulty: Difficulty }
export interface ActivityOutcome { hintsUsed: number; discovered?: { colors?: Color[]; shapes?: string[]; countedUpTo?: number } }
export interface ProgressService {
	load(): Promise<PlayerProgress>;
	recordActivity(activity: ProgressActivity, outcome: ActivityOutcome): Promise<void>;
	recordRoundComplete(mode: GameMode, difficulty: Difficulty): Promise<void>;
	getRecommendation(mode: GameMode): Difficulty | null;
	reset(): Promise<void>;
}

/** clock.now() is epoch milliseconds here, for the ISO last-played date. */
export function createProgressService(storage: StorageAdapter, clock: Pick<Clock, 'now'>, getDifficulty: () => Difficulty): ProgressService {
	let progress = emptyProgress();
	let loaded: Promise<void> | undefined;
	let queue: Promise<unknown> = Promise.resolve();
	const copy = () => JSON.parse(JSON.stringify(progress)) as PlayerProgress;
	const load = () => loaded ??= (async () => {
		try { progress = migrateProgress(await storage.get<unknown>(PROGRESS_STORAGE_KEY)); } catch { progress = emptyProgress(); }
	})();
	function serial<T>(operation: () => Promise<T>): Promise<T> {
		const next = queue.then(operation); queue = next.catch(() => undefined); return next;
	}
	const persist = async () => { try { await storage.set(PROGRESS_STORAGE_KEY, copy()); } catch { /* Keep session progress in memory. */ } };
	return {
		load: () => serial(async () => { await load(); return copy(); }),
		recordActivity(activity, outcome) {
			const entry = { ...activity };
			const discovered = { colors: [...(outcome.discovered?.colors ?? [])], shapes: [...(outcome.discovered?.shapes ?? [])], countedUpTo: outcome.discovered?.countedUpTo ?? 0 };
			const hints = outcome.hintsUsed;
			return serial(async () => {
				await load();
				if (progress.completedActivityIds.includes(entry.id)) return;
				if (!entry.id || !Number.isSafeInteger(hints) || hints < 0 || !Number.isInteger(discovered.countedUpTo) || discovered.countedUpTo < 0 || discovered.countedUpTo > 10) throw new RangeError('Invalid activity outcome.');
				const next = copy();
				next.completedActivityIds.push(entry.id);
				next.hintsUsed[entry.mode][entry.difficulty] += hints;
				next.discoveredColors = [...new Set([...next.discoveredColors, ...discovered.colors])];
				next.discoveredShapes = [...new Set([...next.discoveredShapes, ...discovered.shapes])];
				next.countedUpTo = Math.max(next.countedUpTo, discovered.countedUpTo);
				next.lastPlayedAt = new Date(clock.now()).toISOString();
				const validated = migrateProgress(next);
				if (!validated.completedActivityIds.includes(entry.id)) throw new RangeError('Invalid discovery data.');
				progress = validated;
				await persist();
			});
		},
		recordRoundComplete: (mode, difficulty) => serial(async () => {
			await load(); progress.completedRounds[mode][difficulty] += 1;
			progress.lastPlayedAt = new Date(clock.now()).toISOString(); await persist();
		}),
		getRecommendation(mode) {
			const difficulty = getDifficulty();
			if (difficulty === 'advanced') return null;
			const rounds = progress.completedRounds[mode][difficulty];
			if (rounds < 3 || progress.hintsUsed[mode][difficulty] > rounds * ROUND_ACTIVITY_COUNTS[mode]) return null;
			return difficulty === 'beginner' ? 'explorer' : 'advanced';
		},
		reset: () => serial(async () => { await load(); progress = emptyProgress(); await persist(); })
	};
}
