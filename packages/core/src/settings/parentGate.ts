import { createRng, shuffle } from '../learning/rng.ts';

export interface GateQuestion { textBn: string; textEn: string; options: number[]; answer: number }
const BN_WORDS = ['শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়', 'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোলো', 'সতেরো', 'আঠারো', 'উনিশ', 'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আটাশ', 'ঊনত্রিশ', 'ত্রিশ'];
const EN_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty one', 'twenty two', 'twenty three', 'twenty four', 'twenty five', 'twenty six', 'twenty seven', 'twenty eight', 'twenty nine', 'thirty'];

/** Text only. No audio key: the adult gate must never narrate its question. */
export function createGateQuestion(seed: number): GateQuestion {
	const rng = createRng(seed);
	const answer = 11 + Math.floor(rng() * 20);
	const a = 1 + Math.floor(rng() * (answer - 1)), b = answer - a;
	const distractors = shuffle(Array.from({ length: 20 }, (_, i) => i + 11).filter((n) => n !== answer), rng).slice(0, 3);
	return { textBn: `${BN_WORDS[a]} যোগ ${BN_WORDS[b]} কত?`, textEn: `What is ${EN_WORDS[a]} plus ${EN_WORDS[b]}?`, options: shuffle([answer, ...distractors], rng), answer };
}
