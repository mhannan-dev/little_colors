import { createRng, shuffle } from '../../learning/rng.ts';
import type { ThinkingAgeBand } from './thinkingLessons.ts';

export interface AlphabetEntry { letter: string; word: string; picture: string }
export const ENGLISH_ALPHABET: readonly AlphabetEntry[] = [
	['A','Apple','🍎'],['B','Ball','⚽'],['C','Cat','🐱'],['D','Dog','🐶'],['E','Elephant','🐘'],
	['F','Fish','🐟'],['G','Grapes','🍇'],['H','Hat','🎩'],['I','Ice cream','🍦'],['J','Juice','🧃'],
	['K','Kite','🪁'],['L','Lion','🦁'],['M','Moon','🌙'],['N','Nest','🪺'],['O','Owl','🦉'],
	['P','Penguin','🐧'],['Q','Queen','👸'],['R','Rainbow','🌈'],['S','Sun','☀️'],['T','Turtle','🐢'],
	['U','Umbrella','☂️'],['V','Violin','🎻'],['W','Whale','🐳'],['X','Xylophone','xylophone'],
	['Y','Yo-yo','yo-yo'],['Z','Zebra','🦓']
].map(([letter, word, picture]) => ({ letter: letter!, word: word!, picture: picture! }));
export type LetterQuestion =
	{ kind: 'match'; target: string; answer: string; options: string[] } |
	{ kind: 'sequence'; sequence: string[]; gap: number; answer: string; options: string[] } |
	{ kind: 'word'; entry: AlphabetEntry; spelling: boolean; answer: string; options: string[] };
export interface EnglishLetterPlan { ageBand: ThinkingAgeBand; seed: number; questions: LetterQuestion[] }
export interface EnglishLetterProgress { phase: 'play' | 'complete' | 'finished'; index: number; filled: number; hint: boolean; feedbackKey: string }
export type EnglishLetterAction = { type: 'ANSWER'; letter: string } | { type: 'HINT' } | { type: 'RESET' } | { type: 'NEXT' };

export function createEnglishLetterGame(ageBand: ThinkingAgeBand, seed: number): EnglishLetterPlan {
	const rng = createRng(seed), older = ageBand === '8-10';
	const alphabet = ENGLISH_ALPHABET.map((entry) => entry.letter);
	const options = (answers: string[], lower = false) => shuffle([...new Set([...answers,
		...shuffle(alphabet.filter((letter) => !answers.includes(letter)), rng).slice(0, Math.max(0, (older ? 5 : 3) - new Set(answers).size))])], rng).map((letter) => lower ? letter.toLowerCase() : letter);
	const targets = shuffle(alphabet, rng);
	const words = shuffle(older ? ENGLISH_ALPHABET.filter((entry) => ['Cat','Dog','Hat','Sun'].includes(entry.word)) : ENGLISH_ALPHABET, rng);
	const questions: LetterQuestion[] = [];
	for (let i = 0; i < 2; i++) {
		const letter = targets[i]!, reverse = older && rng() < .5;
		questions.push({ kind: 'match', target: reverse ? letter.toLowerCase() : letter, answer: reverse ? letter : letter.toLowerCase(), options: options([letter], !reverse) });
		const length = older ? 5 : 3, start = Math.floor(rng() * (27 - length));
		const sequence = alphabet.slice(start, start + length), gap = older ? 1 + Math.floor(rng() * 3) : 1;
		questions.push({ kind: 'sequence', sequence, gap, answer: sequence[gap]!, options: options([sequence[gap]!]) });
		const entry = words[i]!, answer = older ? entry.word.toUpperCase() : entry.letter;
		questions.push({ kind: 'word', entry, spelling: older, answer, options: options([...new Set(answer.split(''))]) });
	}
	return { ageBand, seed, questions };
}
export const initialEnglishLetterProgress = (): EnglishLetterProgress => ({ phase: 'play', index: 0, filled: 0, hint: false, feedbackKey: 'letters.instruction.match' });
export function englishLetterReducer(plan: EnglishLetterPlan, state: EnglishLetterProgress, action: EnglishLetterAction): EnglishLetterProgress {
	if (action.type === 'NEXT') {
		if (state.phase !== 'complete') return state;
		const index = state.index + 1;
		return index === plan.questions.length ? { ...state, phase: 'finished', feedbackKey: 'letters.done' }
			: { ...state, index, filled: 0, phase: 'play', hint: false, feedbackKey: letterInstruction(plan.questions[index]!) };
	}
	if (state.phase !== 'play') return state;
	const question = plan.questions[state.index]!;
	if (action.type === 'HINT') return { ...state, hint: true, feedbackKey: 'letters.hint' };
	if (action.type === 'RESET') return { ...state, filled: 0, hint: false, feedbackKey: letterInstruction(question) };
	if (!question.options.includes(action.letter) || action.letter !== question.answer[state.filled]) return { ...state, feedbackKey: 'letters.retry' };
	const filled = state.filled + 1;
	return { ...state, filled, hint: false, phase: filled === question.answer.length ? 'complete' : 'play', feedbackKey: filled === question.answer.length ? 'letters.correct' : 'letters.part' };
}
export const letterInstruction = (question: LetterQuestion) => question.kind === 'word' ? question.spelling ? 'letters.instruction.spell' : 'letters.instruction.word' : `letters.instruction.${question.kind}`;
