import { readBuild, type Block } from './blocks.ts';

/**
 * "My builds": finished creations the child chose to keep. Children can't type names, so each
 * one is shown as a small picture. Stored on this device only (no account, no network).
 */
export const SAVED_KEY = 'lc.blocks3d.saved.v1';
export const MAX_SAVED = 12;

export interface SavedBuild {
	id: string;
	savedAt: number;
	blocks: Block[];
	/** Small JPEG/PNG data URL of the build, for the gallery. */
	thumb: string;
}

const THUMB = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

/** Corrupt or foreign data never breaks the game: bad entries are dropped. */
export function readSaved(raw: string | null): SavedBuild[] {
	if (!raw) return [];
	try {
		const data: unknown = JSON.parse(raw);
		if (!Array.isArray(data)) return [];
		const seen = new Set<string>();
		const out: SavedBuild[] = [];
		for (const item of data) {
			if (!item || typeof item !== 'object') continue;
			const { id, savedAt, blocks, thumb } = item as Record<string, unknown>;
			if (typeof id !== 'string' || !id || seen.has(id) || typeof savedAt !== 'number') continue;
			if (typeof thumb !== 'string' || !THUMB.test(thumb)) continue;
			const clean = readBuild(JSON.stringify(blocks));
			if (clean.length === 0) continue;
			seen.add(id);
			out.push({ id, savedAt, blocks: clean, thumb });
		}
		return out.slice(0, MAX_SAVED);
	} catch {
		return [];
	}
}

const sameBuild = (a: Block[], b: Block[]) => {
	if (a.length !== b.length) return false;
	const key = (x: Block) => `${x.x},${x.y},${x.z},${x.color},${x.locked ? 1 : 0}`;
	const set = new Set(a.map(key));
	return b.every((x) => set.has(key(x)));
};

export type SaveResult =
	| { status: 'saved'; list: SavedBuild[]; entry: SavedBuild }
	| { status: 'already'; list: SavedBuild[]; entry: SavedBuild }
	| { status: 'empty' | 'full'; list: SavedBuild[] };

/** Newest first. Saving the same build twice keeps one copy. Never silently drops an old build. */
export function addSaved(list: SavedBuild[], blocks: Block[], thumb: string, now: number): SaveResult {
	if (blocks.length === 0) return { status: 'empty', list };
	const twin = list.find((s) => sameBuild(s.blocks, blocks));
	if (twin) return { status: 'already', list, entry: twin };
	if (list.length >= MAX_SAVED) return { status: 'full', list };
	const entry: SavedBuild = { id: `b${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, savedAt: now, blocks: blocks.map((b) => ({ ...b })), thumb };
	return { status: 'saved', list: [entry, ...list], entry };
}

export const removeSaved = (list: SavedBuild[], id: string) => list.filter((s) => s.id !== id);
