import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng, shuffle, type Rng } from '../learning/rng.ts';
import type { ChoiceActivity } from '../minigames/choiceMachine.ts';
import { NUMBER_VOCABULARY } from '../numbers/numberVocabulary.ts';
import type { Difficulty } from '../types/colors.ts';

/**
 * Letters and numbers for the 3D games ("ABC & ১২৩ blocks" and "Rumi's toy car").
 * Every symbol has a name a young child would hear from a parent or teacher.
 */
export type SymbolSet = 'abc' | 'bangla' | '123';

export interface SymbolDef {
	id: string;
	/** What is drawn on the block/sign. Numbers are drawn per the numeral setting. */
	glyph: string;
	/** Spoken name in Bengali, e.g. "বি", "স্বরে অ", "তিন". */
	bn: string;
	/** Spoken name in English, e.g. "B", "the Bangla letter o", "three". */
	en: string;
}

const ABC_BN = ['এ', 'বি', 'সি', 'ডি', 'ই', 'এফ', 'জি', 'এইচ', 'আই', 'জে', 'কে', 'এল', 'এম', 'এন', 'ও', 'পি', 'কিউ', 'আর', 'এস', 'টি', 'ইউ', 'ভি', 'ডাবলিউ', 'এক্স', 'ওয়াই', 'জেড'];

const BANGLA_VOWELS: SymbolDef[] = [
	{ id: 'o', glyph: 'অ', bn: 'স্বরে অ', en: 'the Bangla letter o' },
	{ id: 'aa', glyph: 'আ', bn: 'স্বরে আ', en: 'the Bangla letter aa' },
	{ id: 'i', glyph: 'ই', bn: 'হ্রস্ব ই', en: 'the Bangla letter short i' },
	{ id: 'ii', glyph: 'ঈ', bn: 'দীর্ঘ ঈ', en: 'the Bangla letter long ee' },
	{ id: 'u', glyph: 'উ', bn: 'হ্রস্ব উ', en: 'the Bangla letter short u' },
	{ id: 'uu', glyph: 'ঊ', bn: 'দীর্ঘ ঊ', en: 'the Bangla letter long oo' },
	{ id: 'ri', glyph: 'ঋ', bn: 'ঋ', en: 'the Bangla letter ri' },
	{ id: 'e', glyph: 'এ', bn: 'এ', en: 'the Bangla letter e' },
	{ id: 'oi', glyph: 'ঐ', bn: 'ঐ', en: 'the Bangla letter oi' },
	{ id: 'oo', glyph: 'ও', bn: 'ও', en: 'the Bangla letter o (ও)' },
	{ id: 'ou', glyph: 'ঔ', bn: 'ঔ', en: 'the Bangla letter ou' }
];

export const SYMBOLS: Record<SymbolSet, readonly SymbolDef[]> = {
	abc: ABC_BN.map((bn, i) => {
		const letter = String.fromCharCode(65 + i);
		return { id: letter.toLowerCase(), glyph: letter, bn, en: letter };
	}),
	bangla: BANGLA_VOWELS,
	'123': Array.from({ length: 10 }, (_, i) => {
		const n = i + 1;
		return { id: String(n), glyph: String(n), bn: NUMBER_VOCABULARY[n]!.bn, en: NUMBER_VOCABULARY[n]!.en };
	})
};

export const symbolDef = (set: SymbolSet, id: string) => SYMBOLS[set].find((s) => s.id === id)!;

/** Smaller pools at lower difficulty so the first letters/numbers come first. */
export function symbolPool(set: SymbolSet, difficulty: Difficulty): readonly SymbolDef[] {
	const all = SYMBOLS[set];
	const size =
		set === 'abc' ? { beginner: 10, explorer: 18, advanced: 26 }[difficulty]
		: set === 'bangla' ? { beginner: 6, explorer: 11, advanced: 11 }[difficulty]
		: { beginner: 5, explorer: 10, advanced: 10 }[difficulty];
	return all.slice(0, size);
}

export type Play3DGame = 'abc3d' | 'car3d' | 'race3d';
export type Play3DData = { set: SymbolSet };

export const PLAY3D_ROUND_LENGTH = 5;

/** Blocks: more blocks at higher difficulty. Car and race: always three lanes. */
export const optionCountFor = (game: Play3DGame, d: Difficulty) =>
	game !== 'abc3d' ? 3 : { beginner: 3, explorer: 4, advanced: 5 }[d];

export interface Play3DRound {
	game: Play3DGame;
	set: SymbolSet;
	difficulty: Difficulty;
	seed: number;
	activities: ChoiceActivity<Play3DData>[];
}

const PREFIX: Record<Play3DGame, string> = { abc3d: 'abc3d.find', car3d: 'drive.catch', race3d: 'race.boost' };

export function createPlay3DRound(game: Play3DGame, set: SymbolSet, difficulty: Difficulty, seed: number): Play3DRound {
	const rng: Rng = createRng(seed);
	const pool = symbolPool(set, difficulty);
	const count = Math.min(optionCountFor(game, difficulty), pool.length);
	// Targets: no symbol asked twice in a round.
	const targets = shuffle(pool, rng).slice(0, PLAY3D_ROUND_LENGTH);
	const activities = targets.map((target, index): ChoiceActivity<Play3DData> => {
		const others = shuffle(pool.filter((s) => s.id !== target.id), rng).slice(0, count - 1);
		const options = shuffle([target, ...others], rng).map((s) => ({ id: `${set}-${s.id}`, symbol: s.id }));
		return {
			id: `${game}.${set}.${difficulty}.${seed}.${index}`,
			game,
			difficulty,
			instructionKey: `${PREFIX[game]}.${set}.${target.id}`,
			correctKey: `abc3d.correct.${set}.${target.id}`,
			options,
			answerId: `${set}-${target.id}`,
			data: { set }
		};
	});
	return { game, set, difficulty, seed, activities };
}

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const PLAY3D_NARRATION: NarrationEntry[] = [
	line('mode.abc3d', 'ABC আর ১২৩ ব্লক', 'ABC & 123 Blocks'),
	line('mode.car3d', 'রুমির খেলনা গাড়ি', "Rumi's Toy Car"),
	line('play3d.set.abc', 'ইংরেজি অক্ষর', 'English letters'),
	line('play3d.set.bangla', 'বাংলা অক্ষর', 'Bangla letters'),
	line('play3d.set.123', 'সংখ্যা', 'Numbers'),
	line('drive.left', 'বাঁয়ে', 'Left'),
	line('drive.right', 'ডানে', 'Right'),
	// Race with friends: nobody ever loses; everyone finishes together.
	line('mode.race3d', 'বন্ধুদের সাথে রেস', 'Race with Friends'),
	line('race.start', 'চলো, বন্ধুদের সাথে রেস করি! রেডি, স্টেডি, গো!', "Let's race with our friends! Ready, steady, go!"),
	line('race.free.card', 'শুধু চালাই', 'Just drive'),
	line('race.free.start', 'চলো, ইচ্ছেমতো গাড়ি চালাই! বেলুনের দিকে গেলে বেলুন ফাটে!', "Let's drive wherever we like! Drive into a balloon to pop it!"),
	line('race.free.lap', 'এক পাক ঘুরে এলাম! চলো আরেক পাক!', "That's one lap! Let's go around again!"),
	line('race.free.vroom', 'ভ্রুম!', 'Vroom!'),
	line('race.finish', 'সবাই একসাথে পৌঁছে গেছি! দারুণ রেস!', 'We all made it together! What a race!'),
	...(Object.keys(SYMBOLS) as SymbolSet[]).flatMap((set) =>
		SYMBOLS[set].flatMap((s) => [
			line(`abc3d.find.${set}.${s.id}`, `${s.bn} কোনটা?`, `Where is ${s.en}?`),
			line(`drive.catch.${set}.${s.id}`, `গাড়ি চালিয়ে ${s.bn} ধরো!`, `Drive to catch ${s.en}!`),
				line(`race.boost.${set}.${s.id}`, `${s.bn}-এর উপর দিয়ে চালাও!`, `Drive over ${s.en}!`),
			line(`abc3d.correct.${set}.${s.id}`, `ঠিক! এটা ${s.bn}!`, `Yes! This is ${s.en}!`)
		])
	)
];
