import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import type { Difficulty } from '../types/colors.ts';

/**
 * Shape Sorter (আকৃতি মেলাও): a 3D wooden shape-sorter box for ages 2–5. Pick up a shape and
 * put it in the hole that matches. The right hole: "plop!" and Rumi names the shape. Another
 * hole: the shape gently bounces back and Rumi says its name (PR-08); after two tries the right
 * hole glows (PR-22). No clock, no score (PR-07). When the box is full the lid pops and every
 * shape jumps out to play again.
 */
export type SortShape = 'circle' | 'square' | 'triangle' | 'star' | 'heart';
export type SortColor = 'red' | 'yellow' | 'blue' | 'green' | 'orange' | 'purple';

export const SORT_SHAPES: Record<SortShape, { bn: string; en: string }> = {
	circle: { bn: 'গোল', en: 'circle' },
	square: { bn: 'চারকোনা', en: 'square' },
	triangle: { bn: 'তিনকোনা', en: 'triangle' },
	star: { bn: 'তারা', en: 'star' },
	heart: { bn: 'লাভ', en: 'heart' }
};
export const SORT_COLORS: Record<SortColor, string> = {
	red: '#E5484D',
	yellow: '#F2C94C',
	blue: '#3478D4',
	green: '#35A66A',
	orange: '#F28C28',
	purple: '#8A5AC2'
};

export interface SortPiece {
	id: string;
	shape: SortShape;
	color: SortColor;
}
export interface SorterRound {
	holes: SortShape[];
	pieces: SortPiece[];
}

const SIZE: Record<Difficulty, { holes: number; pieces: number }> = {
	beginner: { holes: 3, pieces: 4 },
	explorer: { holes: 4, pieces: 6 },
	advanced: { holes: 5, pieces: 8 }
};
/** Easiest shapes first: a beginner box has circle, square and triangle. */
const ORDER: SortShape[] = ['circle', 'square', 'triangle', 'star', 'heart'];

export function createSorterRound(difficulty: Difficulty, seed: number): SorterRound {
	const rng = createRng(seed);
	const { holes: h, pieces: n } = SIZE[difficulty];
	const holeShapes = ORDER.slice(0, h);
	const holes = shuffle(holeShapes, rng);
	const colors = shuffle(Object.keys(SORT_COLORS) as SortColor[], rng);
	// Every hole gets at least one piece; the rest are random. Colours vary so colour isn't the clue.
	const shapes = [...holeShapes, ...Array.from({ length: n - h }, () => holeShapes[Math.floor(rng() * h)]!)];
	const pieces = shuffle(shapes, rng).map((shape, i) => ({ id: `piece-${i}`, shape, color: colors[i % colors.length]! }));
	return { holes, pieces };
}

/** Does this piece fit this hole? (Pure, so the "bounce back" rule is testable.) */
export const fits = (piece: SortShape, hole: SortShape) => piece === hole;
/** After this many tries with one piece, the right hole glows. */
export const HINT_AFTER = 2;

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const SORTER_NARRATION: NarrationEntry[] = [
	line('mode.sorter', 'আকৃতির বাক্স', 'Shape Sorter Box'),
	line('sorter.start', 'একটা আকৃতি ধরো, মিলে যাওয়া গর্তে ফেলো!', 'Pick up a shape and drop it in the hole that matches!'),
	line('sorter.pick', 'এবার গর্তে ট্যাপ করো।', 'Now tap a hole.'),
	line('sorter.plop', 'টুপ! মিলে গেছে!', 'Plop! It fits!'),
	line('sorter.not-this', 'এই গর্তে ঢুকছে না। আরেকটা গর্ত দেখি!', "That one doesn't fit. Let's try another hole!"),
	line('sorter.full', 'বাক্স ভরে গেছে! ঢাকনা খুলি… উইইই!', 'The box is full! Open the lid… wheee!'),
	...(Object.keys(SORT_SHAPES) as SortShape[]).flatMap((s) => [
		line(`sorter.shape.${s}`, SORT_SHAPES[s].bn, SORT_SHAPES[s].en),
		line(`sorter.hole.${s}`, `এটা ${SORT_SHAPES[s].bn} গর্ত`, `This is the ${SORT_SHAPES[s].en} hole`),
		line(`sorter.is.${s}`, `এটা ${SORT_SHAPES[s].bn}! ${SORT_SHAPES[s].bn} গর্ত খুঁজি।`, `This is a ${SORT_SHAPES[s].en}! Let's find the ${SORT_SHAPES[s].en} hole.`)
	])
];
