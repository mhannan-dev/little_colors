import { COLOR_NAMES, type NarrationEntry } from '../audio/voiceManifest.ts';
import { NUMBER_VOCABULARY } from '../numbers/numberVocabulary.ts';
import { COLORS } from '../types/colors.ts';

/** Bengali counted form: একটা, দুইটা, তিনটা … দশটা */
const countWord = (n: number) => `${NUMBER_VOCABULARY[n]!.bn}টা`;
const en = (n: number) => NUMBER_VOCABULARY[n]!.en;
const one = (n: number, singular: string, plural: string) => (n === 1 ? singular : plural);

const entry = (key: string, bn: string, enText: string): NarrationEntry => ({
	key,
	bn,
	en: enText,
	islamic: false,
	status: 'placeholder'
});

const ONE_TO_FIVE = [1, 2, 3, 4, 5];
const ONE_TO_TEN = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export const MINIGAME_NARRATION: NarrationEntry[] = [
	// Football
	...COLORS.flatMap((c) => [
		entry(`football.to.${c}`, `${COLOR_NAMES[c].bn} গোলে বল পাঠাই!`, `Kick the ball into the ${COLOR_NAMES[c].en} goal!`),
		entry(`football.goal.${c}`, `গোল! ${COLOR_NAMES[c].bn} গোল!`, `Goal! The ${COLOR_NAMES[c].en} goal!`)
	]),
	...ONE_TO_FIVE.flatMap((n) => [
		entry(`football.to.number.${n}`, `${NUMBER_VOCABULARY[n]!.bn} নম্বর গোলে বল পাঠাই!`, `Kick the ball into goal number ${en(n)}!`),
		entry(`football.goal.number.${n}`, `গোল! ${NUMBER_VOCABULARY[n]!.bn} নম্বর গোল!`, `Goal! Goal number ${en(n)}!`)
	]),
	// Garage
	...COLORS.flatMap((c) => [
		entry(`car.park.${c}`, `${COLOR_NAMES[c].bn} গাড়িটা কোন গ্যারেজে যাবে?`, `Which garage is for the ${COLOR_NAMES[c].en} car?`),
		entry(`car.parked.${c}`, `${COLOR_NAMES[c].bn} গাড়ি ${COLOR_NAMES[c].bn} গ্যারেজে!`, `The ${COLOR_NAMES[c].en} car is in the ${COLOR_NAMES[c].en} garage!`)
	]),
	entry('car.park.count', 'গাড়িতে কয়জন যাত্রী? সেই নম্বরের গ্যারেজে রাখি!', 'How many passengers? Park in that number’s garage!'),
	...ONE_TO_FIVE.map((n) =>
		entry(
			`car.parked.count.${n}`,
			`${NUMBER_VOCABULARY[n]!.bn}জন যাত্রী, ${NUMBER_VOCABULARY[n]!.bn} নম্বর গ্যারেজ!`,
			`${en(n)} ${one(n, 'passenger', 'passengers')}, garage number ${en(n)}!`
		)
	),
	// Birds
	entry('birds.count', 'ডালে কয়টা পাখি?', 'How many birds are on the branch?'),
	entry('birds.add', 'দুই ডালে মিলে কয়টা পাখি?', 'How many birds on both branches?'),
	...ONE_TO_TEN.map((n) =>
		entry(`birds.total.${n}`, `মোট ${countWord(n)} পাখি!`, `${en(n)} ${one(n, 'bird', 'birds')} in all!`)
	)
];
