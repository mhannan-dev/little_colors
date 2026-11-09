import type { Locale } from '../types/colors.ts';
import { MATCHING_NARRATION } from '../shape-matching/narration.ts';
import { NUMBERS_NARRATION } from '../numbers/narration.ts';
import { MINIGAME_NARRATION } from '../minigames/narration.ts';
import { FLAG_NARRATION } from '../flags/pictureFlags.ts';
import { PLAY3D_NARRATION } from '../play3d/symbols.ts';
import { KITCHEN_NARRATION } from '../kitchen/kitchen.ts';
import { VOICE_MANIFEST, type NarrationEntry } from './voiceManifest.ts';

/**
 * Spec 08 — the complete narration catalog: shared/color-mixing lines plus each mode's lines.
 * Every narration key the app can speak must resolve here (AU-20..AU-23).
 */
export const NARRATION_CATALOG: readonly NarrationEntry[] = [
	...VOICE_MANIFEST,
	...MATCHING_NARRATION,
	...NUMBERS_NARRATION,
	...MINIGAME_NARRATION,
	...FLAG_NARRATION,
	...PLAY3D_NARRATION,
	...KITCHEN_NARRATION
];

const BY_KEY = new Map<string, NarrationEntry>();
for (const entry of NARRATION_CATALOG) {
	// First definition wins; duplicates are reported by the catalog test.
	if (!BY_KEY.has(entry.key)) BY_KEY.set(entry.key, entry);
}

export function getNarration(key: string): NarrationEntry | undefined {
	return BY_KEY.get(key);
}

/** Text to show/speak for a key, honoring the Islamic-expressions setting (AU-30). */
export function narrationText(
	key: string,
	locale: Locale,
	islamicExpressionsEnabled: boolean
): string {
	const entry = BY_KEY.get(key);
	if (!entry) return '';
	const bn = locale === 'bn-BD';
	if (entry.islamic && !islamicExpressionsEnabled) {
		return (bn ? entry.neutralBn : entry.neutralEn) ?? '';
	}
	return bn ? entry.bn : entry.en;
}
