import { COLOR_NAMES, type NarrationEntry } from '../audio/voiceManifest.ts';
import { COLORS } from '../types/colors.ts';
import { SHAPES } from './shapes.ts';

export const MATCHING_NARRATION: NarrationEntry[] = [
	{ key: 'match.instruction.color', bn: 'একই রং মেলাই!', en: 'Match the same color!' },
	{ key: 'match.instruction.shape', bn: 'একই আকার মেলাই!', en: 'Match the same shape!' },
	{ key: 'match.instruction.both', bn: 'একই রং আর আকার মেলাই!', en: 'Match the same color and shape!' },
	{ key: 'match.retry', bn: 'আবার চেষ্টা করি!', en: "Let's try again!" },
	{ key: 'match.celebrate', bn: 'খুব ভালো!', en: 'Very good!' },
	...COLORS.flatMap((color) => SHAPES.flatMap((shape) => ['name', 'correct'].map((kind) => ({
		key: `match.${kind}.${color}.${shape.key}`,
		bn: `এটা ${COLOR_NAMES[color].bn} ${shape.bn}!`,
		en: `This is a ${COLOR_NAMES[color].en} ${shape.en}!`
	}))))
].map((entry) => ({ ...entry, islamic: false, status: 'placeholder' }));
