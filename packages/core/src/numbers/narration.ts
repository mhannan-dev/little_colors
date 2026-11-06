import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { NUMBER_VOCABULARY } from './numberVocabulary.ts';
import { THINKING_NARRATION } from './lessons/narration.ts';
import { PICNIC_NARRATION } from './lessons/picnicNarration.ts';
import { PLAYGROUND_NARRATION } from './lessons/playgroundNarration.ts';
import { TREASURE_NARRATION } from './lessons/treasureNarration.ts';
import { SHOP_NARRATION } from './lessons/shopNarration.ts';
import { TRAIN_NARRATION } from './lessons/trainNarration.ts';
import { LETTER_NARRATION } from './lessons/letterNarration.ts';
import { RALLY_NARRATION } from './lessons/rallyNarration.ts';
import { FRUIT_NARRATION } from './lessons/fruitNarration.ts';
import { FLOWER_NARRATION } from './lessons/flowerNarration.ts';
import { ANIMAL_NARRATION } from './lessons/animalNarration.ts';

export const NUMBERS_NARRATION: NarrationEntry[] = [
	...THINKING_NARRATION,
	...PICNIC_NARRATION,
	...PLAYGROUND_NARRATION,
	...TREASURE_NARRATION,
	...SHOP_NARRATION,
	...TRAIN_NARRATION,
	...LETTER_NARRATION,
	...RALLY_NARRATION,
	...FRUIT_NARRATION,
	...FLOWER_NARRATION,
	...ANIMAL_NARRATION,
	{ key: 'numbers.instruction.count', bn: 'চলো গুনি! কয়টি জিনিস?', en: "Let's count! How many objects?" },
	{ key: 'numbers.instruction.numeral-to-quantity', bn: 'সংখ্যার সঙ্গে জিনিসগুলো মেলাই!', en: 'Match the number to the objects!' },
	{ key: 'numbers.instruction.add', bn: 'সব মিলিয়ে কয়টি?', en: 'How many altogether?' },
	{ key: 'numbers.instruction.pattern', bn: 'এর পরে কোনটি আসবে?', en: 'What comes next?' },
	{ key: 'numbers.compare.more', bn: 'কোন দিকে বেশি?', en: 'Which side has more?' },
	{ key: 'numbers.compare.fewer', bn: 'কোন দিকে কম?', en: 'Which side has fewer?' },
	{ key: 'numbers.correct', bn: 'খুব ভালো! একসঙ্গে গুনে দেখি!', en: 'Very good! Let’s count together!' },
	{ key: 'numbers.retry', bn: 'চলো আবার গুনে দেখি!', en: "Let's count again!" },
	{ key: 'numbers.pattern.correct', bn: 'ঠিক তাই! সুন্দর করে মেলালে!', en: 'That’s right! The pattern matches!' },
	{ key: 'numbers.celebrate', bn: 'খুব সুন্দর!', en: 'Beautiful!' },
	...NUMBER_VOCABULARY.map((word) => ({ key: `number.${word.n}`, bn: word.bn, en: word.en })),
	...NUMBER_VOCABULARY.filter((word) => word.n > 0).map((word) => ({ key: `numbers.total.${word.n}`, bn: `মোট ${word.bn}টি!`, en: `${word.en} altogether!` })),
	...NUMBER_VOCABULARY.filter((word) => word.n > 0).flatMap((a) => NUMBER_VOCABULARY.filter((b) => b.n > 0 && a.n + b.n <= 10).map((b) => ({
		key: `numbers.add.${a.n}.${b.n}`, bn: `${a.bn} আর ${b.bn} মিলে ${NUMBER_VOCABULARY[a.n + b.n]!.bn}!`, en: `${a.en} and ${b.en} make ${NUMBER_VOCABULARY[a.n + b.n]!.en}!`
	})))
].map((entry) => ({ ...entry, islamic: false, status: 'placeholder' }));
