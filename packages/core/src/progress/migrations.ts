import { COLORS } from '../types/colors.ts';
import { SHAPES } from '../shape-matching/shapes.ts';
import { emptyProgress, PROGRESS_SCHEMA_VERSION, PROGRESS_MODES, PROGRESS_DIFFICULTIES, type PlayerProgress } from './schema.ts';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const counter = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);

/** Corrupt/future progress resets safely; v0 fills missing fields from empty data. */
export function migrateProgress(data: unknown): PlayerProgress {
	if (typeof data === 'string') { try { data = JSON.parse(data) as unknown; } catch { return emptyProgress(); } }
	if (!object(data)) return emptyProgress();
	if (data.schemaVersion !== undefined && data.schemaVersion !== 0 && data.schemaVersion !== PROGRESS_SCHEMA_VERSION) return emptyProgress();
	const legacy = data.schemaVersion === undefined || data.schemaVersion === 0;
	const source: Record<string, unknown> = legacy ? { ...emptyProgress(), ...data } : data;
	const result = emptyProgress();
	if (!strings(source.completedActivityIds) || !strings(source.discoveredColors) || !strings(source.discoveredShapes)) return emptyProgress();
	if (!source.discoveredColors.every((c) => (COLORS as readonly string[]).includes(c))) return emptyProgress();
	if (!source.discoveredShapes.every((s) => SHAPES.some((shape) => shape.key === s))) return emptyProgress();
	if (!counter(source.countedUpTo) || source.countedUpTo > 10) return emptyProgress();
	if (source.lastPlayedAt !== null && (typeof source.lastPlayedAt !== 'string' || !Number.isFinite(Date.parse(source.lastPlayedAt)))) return emptyProgress();
	for (const field of ['completedRounds', 'hintsUsed'] as const) {
		const matrix = source[field];
		if (!object(matrix)) return emptyProgress();
		for (const mode of PROGRESS_MODES) {
			const levels = matrix[mode];
			if (levels === undefined && legacy) continue;
			if (!object(levels)) return emptyProgress();
			for (const difficulty of PROGRESS_DIFFICULTIES) {
				const value = levels[difficulty];
				if (value === undefined && legacy) continue;
				if (!counter(value)) return emptyProgress();
				result[field][mode][difficulty] = value;
			}
		}
	}
	result.completedActivityIds = [...new Set(source.completedActivityIds)];
	result.discoveredColors = [...new Set(source.discoveredColors)] as PlayerProgress['discoveredColors'];
	result.discoveredShapes = [...new Set(source.discoveredShapes)];
	result.countedUpTo = source.countedUpTo;
	result.lastPlayedAt = source.lastPlayedAt as string | null;
	return result;
}
