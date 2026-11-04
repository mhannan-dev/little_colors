import type { Color, Difficulty, GameMode } from '../types/colors.ts';

export interface PlayerProgress {
	schemaVersion: number;
	completedActivityIds: string[];
	discoveredColors: Color[];
	discoveredShapes: string[];
	countedUpTo: number;
	completedRounds: Record<GameMode, Record<Difficulty, number>>;
	hintsUsed: Record<GameMode, Record<Difficulty, number>>;
	lastPlayedAt: string | null;
}
export const PROGRESS_SCHEMA_VERSION = 1;
export const PROGRESS_STORAGE_KEY = 'lc.progress.v1';
export const PROGRESS_MODES: GameMode[] = ['mixing', 'matching', 'numbers'];
export const PROGRESS_DIFFICULTIES: Difficulty[] = ['beginner', 'explorer', 'advanced'];
export const ROUND_ACTIVITY_COUNTS: Record<GameMode, number> = { mixing: 3, matching: 5, numbers: 5 };
export function emptyProgress(): PlayerProgress {
	const matrix = (): PlayerProgress['completedRounds'] => ({
		mixing: { beginner: 0, explorer: 0, advanced: 0 }, matching: { beginner: 0, explorer: 0, advanced: 0 }, numbers: { beginner: 0, explorer: 0, advanced: 0 }
	});
	return { schemaVersion: PROGRESS_SCHEMA_VERSION, completedActivityIds: [], discoveredColors: [], discoveredShapes: [], countedUpTo: 0, completedRounds: matrix(), hintsUsed: matrix(), lastPlayedAt: null };
}
