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
	line('mode.football', 'ফুটবল', 'Football'),
	line('mode.car', 'গাড়ি', 'Car'),
	line('mode.garden3d', 'থ্রিডি ফুলের বাগান', '3D Flower Garden'),
	line('garden3d.intro', 'তীর চিহ্ন চেপে হাঁটি আর পাঁচটি ফুল কুড়াই!', 'Use the arrows to walk and collect five flowers!'),
	line('garden3d.done', 'পাঁচটি ফুল পেয়েছি! কী সুন্দর বাগান!', 'We found five flowers! What a lovely garden!'),
	line('mode.blocks3d', 'থ্রিডি ব্লক বিল্ডিং', '3D Block Building'),
	line('blocks.intro', 'ঘরে ট্যাপ করে ব্লক বসাই। যা ইচ্ছে বানাই!', 'Tap a tile to add a block. Build anything!'),
	line('blocks.add', 'ব্লক বসাই', 'Add a block'),
	line('blocks.erase', 'ব্লক সরাই', 'Remove a block'),
	line('blocks.limit', 'অন্য জায়গায় ব্লক বসাই। আট তলা পর্যন্ত বানানো যায়।', 'Try another spot. We can build up to eight blocks high.'),
	line('blocks.template', 'এবার নিজের মতো করে সাজাই!', 'Now make it your own!'),
	line('mode.flag', 'দেশের পতাকা', 'Country Flag'),
	line('mode.bird', 'পাখি', 'Bird'),
	line('mode.holy-puzzle', 'মসজিদ ও কাবার পাজল', 'Mosque and Kaaba Puzzle'),
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
	line('feedback.try-again', 'আবার চেষ্টা করি!', "Let's try again!"),
	// Spoken names of child-facing buttons (PR-26) and the idle nudge after success.
	line('ui.play', 'খেলি!', "Let's play!"),
	line('ui.next', 'পরেরটা', 'Next'),
	line('ui.replay', 'আবার খেলি', 'Play again'),
	line('ui.choose-game', 'অন্য খেলা', 'Another game'),
	line('ui.hint', 'সাহায্য', 'Help'),
	line('ui.reset', 'আবার শুরু', 'Start over'),
	line('ui.tap-next', 'দারুণ! এবার সবুজ তীরে চাপ দাও!', 'Great! Now tap the green arrow!')
];

// Lookups (getNarration / narrationText) live in ./catalog.ts, which merges these base lines
// with each game mode's narration. They cannot live here: mode narration modules import
// COLOR_NAMES from this file, so importing them back would create a circular import.
export type { Locale };
