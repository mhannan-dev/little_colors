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
import { COLOR_BLOCKS_NARRATION } from './lessons/colorBlocksNarration.ts';

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
	...COLOR_BLOCKS_NARRATION,
	{ key: 'mode.table-tennis', bn: 'থ্রিডি টেবিল টেনিস', en: '3D Table Tennis' },
	{ key: 'table-tennis.intro', bn: 'লাল প্যাডল সরিয়ে বল ফেরত দাও! শুরু করতে বল ছাড়ো বোতাম চাপো।', en: 'Move your red paddle to return the ball! Tap Serve to begin.' },
	{ key: 'table-tennis.ready', bn: 'বল ছাড়ো, একসঙ্গে খেলি!', en: 'Serve when you are ready. Let’s play together!' },
	{ key: 'table-tennis.return', bn: 'দারুণ! বল ফেরত দিয়েছ!', en: 'Lovely return! Keep playing!' },
	{ key: 'table-tennis.again', bn: 'আবার বল ছাড়ি! প্যাডলটি বলের সামনে রাখো।', en: 'Let’s serve again! Move your paddle in front of the ball.' },
	// Simple Math (Codex, finished by Claude): no stars or score (PR-07), gentle retries (PR-08).
	{ key: "mode.simple-math", bn: "সহজ অঙ্ক", en: "Simple Math" },
	{ key: "simple-math.intro", bn: "আপেল গুনি আর যোগ-বিয়োগ করি! ঠিক সংখ্যাটায় ট্যাপ করো।", en: "Let's count apples and add or take away! Tap the right number." },
	{ key: "simple-math.plus", bn: "যোগ", en: "plus" },
	{ key: "simple-math.minus", bn: "বিয়োগ", en: "minus" },
	{ key: "simple-math.how-many", bn: "কয়টি হলো?", en: "How many is that?" },
	{ key: "simple-math.retry", bn: "এখনো না! চলো আবার আপেলগুলো গুনি।", en: "Not yet! Let's count the apples again." },
	{ key: "simple-math.correct", bn: "দারুণ! ঠিক হয়েছে!", en: "Well done! That's right!" },
	{ key: "simple-math.complete", bn: "অনেক অঙ্ক করলাম! তুমি দারুণ গুনতে পারো!", en: "We did lots of sums! You count so well!" },
	{ key: "simple-math.add", bn: "যোগ", en: "Adding" },
	{ key: "simple-math.subtract", bn: "বিয়োগ", en: "Taking away" },
	{ key: "simple-math.mixed", bn: "যোগ-বিয়োগ", en: "Mix it up" },
	{ key: "simple-math.up-to-10", bn: "১০ পর্যন্ত", en: "Up to 10" },
	{ key: "simple-math.up-to-20", bn: "২০ পর্যন্ত", en: "Up to 20" },
	{ key: 'mode.city-bus-driver', bn: 'শহরের বাস চালক', en: 'City Bus Driver' },
	{ key: 'mode.formula-circuit', bn: 'ফর্মুলা সার্কিট', en: 'Formula Circuit' },
	{ key: 'mode.counter-rush', bn: 'কাউন্টার রাশ', en: 'Counter Rush' },
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
