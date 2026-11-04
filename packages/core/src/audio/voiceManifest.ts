import type { Color, Locale } from '../types/colors.ts';

/** Spec 08 — every narration line lives here (AU-20..AU-23). */
export interface NarrationEntry {
	key: string;
	bn: string;
	en: string;
	/** Required when the line contains an Islamic expression (AU-21). */
	neutralBn?: string;
	neutralEn?: string;
	islamic: boolean;
	status: 'placeholder' | 'final';
}

export const COLOR_NAMES: Record<Color, { bn: string; en: string }> = {
	red: { bn: 'লাল', en: 'red' },
	yellow: { bn: 'হলুদ', en: 'yellow' },
	blue: { bn: 'নীল', en: 'blue' },
	orange: { bn: 'কমলা', en: 'orange' },
	green: { bn: 'সবুজ', en: 'green' },
	purple: { bn: 'বেগুনি', en: 'purple' }
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function line(key: string, bn: string, en: string): NarrationEntry {
	return { key, bn, en, islamic: false, status: 'placeholder' };
}

function islamicLine(
	key: string,
	bn: string,
	en: string,
	neutralBn: string,
	neutralEn: string
): NarrationEntry {
	return { key, bn, en, neutralBn, neutralEn, islamic: true, status: 'placeholder' };
}

const colorLines = (Object.keys(COLOR_NAMES) as Color[]).map((c) =>
	line(`color.${c}`, `এটা ${COLOR_NAMES[c].bn} রং!`, `This is ${COLOR_NAMES[c].en}!`)
);

const recipeLines: NarrationEntry[] = [
	['red-yellow', 'red', 'yellow', 'orange'],
	['blue-yellow', 'yellow', 'blue', 'green'],
	['blue-red', 'red', 'blue', 'purple']
].flatMap(([id, a, b, r]) => {
	const A = COLOR_NAMES[a as Color];
	const B = COLOR_NAMES[b as Color];
	const R = COLOR_NAMES[r as Color];
	return [
		line(`mix.intro.${id}`, `${A.bn} আর ${B.bn} রং মেশাই!`, `Let's mix ${A.en} and ${B.en}!`),
		line(
			`mix.result.${id}`,
			`${A.bn} আর ${B.bn} মিলে ${R.bn} রং হলো!`,
			`${cap(A.en)} and ${B.en} make ${R.en}!`
		)
	];
});

const targetLines = (['orange', 'green', 'purple'] as Color[]).map((c) =>
	line(`mix.target.${c}`, `চলো ${COLOR_NAMES[c].bn} রং বানাই!`, `Let's make ${COLOR_NAMES[c].en}!`)
);

export const VOICE_MANIFEST: readonly NarrationEntry[] = [
	islamicLine(
		'welcome.hello',
		'আসসালামু আলাইকুম! চলো খেলি!',
		'Assalamu alaikum! Let’s play!',
		'হ্যালো! চলো খেলি!',
		'Hello! Let’s play!'
	),
	line('mode.mixing', 'রং মেশানো', 'Color Mixing'),
	line('mode.matching', 'আকার মেলানো', 'Shape Matching'),
	line('mode.numbers', 'সংখ্যা গোনা', 'Numbers'),
	line('mode.coming-soon', 'এই খেলাটা শীঘ্রই আসছে!', 'This game is coming soon!'),
	...colorLines,
	...recipeLines,
	...targetLines,
	line('mix.retry', 'চলো আবার চেষ্টা করি!', "Let's try again!"),
	islamicLine(
		'feedback.celebrate',
		'মাশাআল্লাহ! খুব সুন্দর!',
		'MashaAllah! Beautiful!',
		'খুব সুন্দর!',
		'Beautiful!'
	),
	islamicLine(
		'feedback.completed',
		'আলহামদুলিল্লাহ! আমরা শিখেছি!',
		'Alhamdulillah! We learned it!',
		'আমরা শিখেছি!',
		'We learned it!'
	),
	line('feedback.try-again', 'আবার চেষ্টা করি!', "Let's try again!")
];

// Lookups (getNarration / narrationText) live in ./catalog.ts, which merges these base lines
// with each game mode's narration. They cannot live here: mode narration modules import
// COLOR_NAMES from this file, so importing them back would create a circular import.
export type { Locale };
