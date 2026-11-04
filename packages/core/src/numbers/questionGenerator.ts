import type { Color, Difficulty } from '../types/colors.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import { compareQuantities, type CompareAnswer, type MathActivityKind } from './mathLogic.ts';
import { createPattern, type Pattern } from './patterns.ts';

export const COUNTABLE_SHAPES = ['football', 'apple', 'star', 'leaf', 'paint-drop', 'circle', 'square'] as const;
export type CountableShape = (typeof COUNTABLE_SHAPES)[number];
export interface CountObject { id: string; shape: CountableShape; color: Color }
export interface CountGroup { id: string; objects: CountObject[] }
export type NumberAnswer = number | CompareAnswer | string;
export interface AnswerOption { id: string; value: NumberAnswer; dots: number }
interface BaseQuestion {
	id: string; mode: 'numbers'; difficulty: Difficulty; instructionKey: string;
	kind: MathActivityKind; answer: NumberAnswer; expectedOutcome: string; options: AnswerOption[];
}
export interface CountQuestion extends BaseQuestion { kind: 'count'; answer: number; objects: CountObject[] }
export interface QuantityQuestion extends BaseQuestion { kind: 'numeral-to-quantity'; answer: number; quantity: number; reference: CountObject[]; groups: CountGroup[] }
export interface CompareQuestion extends BaseQuestion { kind: 'compare'; answer: CompareAnswer; left: CountGroup; right: CountGroup; ask: 'more' | 'fewer' }
export interface AddQuestion extends BaseQuestion { kind: 'add'; answer: number; left: CountGroup; right: CountGroup; showPlus: boolean }
export interface PatternQuestion extends BaseQuestion { kind: 'pattern'; answer: string; pattern: Pattern }
export type NumberQuestion = CountQuestion | QuantityQuestion | CompareQuestion | AddQuestion | PatternQuestion;

/** Seeded concrete activity data. Answer IDs are distinct from their typed values. */
export function questionGenerator(seed: number, kind: MathActivityKind, difficulty: Difficulty): NumberQuestion {
	if (kind === 'add' && difficulty === 'beginner') throw new RangeError('Addition is not offered at Beginner.');
	const rng = createRng(seed);
	const max = difficulty === 'beginner' ? 5 : 10;
	const optionCount = difficulty === 'beginner' ? 2 : 3;
	const integer = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
	const shape = COUNTABLE_SHAPES[integer(0, COUNTABLE_SHAPES.length - 1)]!;
	const objects = (count: number, id: string, color: Color = 'red'): CountObject[] => Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}`, shape, color }));
	const group = (count: number, id: string, color: Color = 'red'): CountGroup => ({ id, objects: objects(count, id, color) });
	const numericOptions = (answer: number, limit: number): AnswerOption[] => shuffle([
		answer, ...shuffle(Array.from({ length: limit }, (_, i) => i + 1).filter((value) => value !== answer), rng).slice(0, optionCount - 1)
	], rng).map((value) => ({ id: `answer-${value}`, value, dots: value }));
	const base = { id: `numbers.${difficulty}.${kind}.${seed}`, mode: 'numbers' as const, difficulty, instructionKey: `numbers.instruction.${kind}` };
	if (kind === 'count') {
		const answer = integer(1, max);
		return { ...base, kind, answer, expectedOutcome: String(answer), objects: objects(answer, 'object'), options: [] };
	}
	if (kind === 'numeral-to-quantity') {
		const answer = integer(1, max);
		const options = numericOptions(answer, max);
		return { ...base, kind, answer, expectedOutcome: String(answer), quantity: answer, reference: objects(answer, 'reference'), options, groups: options.map((option) => group(option.value as number, option.id)) };
	}
	if (kind === 'compare') {
		const leftCount = integer(1, max);
		const candidates = Array.from({ length: max }, (_, i) => i + 1).filter((n) => difficulty !== 'beginner' || Math.abs(n - leftCount) >= 2);
		const rightCount = candidates[integer(0, candidates.length - 1)]!;
		const ask = difficulty !== 'beginner' && rng() < 0.5 ? 'fewer' : 'more';
		const more = compareQuantities(leftCount, rightCount);
		const answer = ask === 'fewer' && more !== 'same' ? more === 'left' ? 'right' : 'left' : more;
		const values: CompareAnswer[] = difficulty === 'beginner' ? ['left', 'right'] : ['left', 'right', 'same'];
		return { ...base, instructionKey: `numbers.compare.${ask}`, kind, answer, expectedOutcome: answer, ask,
			left: group(leftCount, 'left'), right: group(rightCount, 'right', 'blue'), options: values.map((value) => ({ id: value, value, dots: value === 'left' ? leftCount : value === 'right' ? rightCount : Math.min(leftCount, rightCount) })) };
	}
	if (kind === 'add') {
		const limit = difficulty === 'explorer' ? 5 : 10;
		const a = integer(1, limit - 1), b = integer(1, limit - a), answer = a + b;
		return { ...base, kind, answer, expectedOutcome: String(answer), left: group(a, 'left'), right: group(b, 'right', 'blue'), showPlus: difficulty === 'advanced', options: numericOptions(answer, limit) };
	}
	const pattern = createPattern(seed, difficulty);
	return { ...base, kind: 'pattern', answer: pattern.answer.id, expectedOutcome: pattern.answer.id, pattern, options: pattern.options.map((token) => ({ id: token.id, value: token.id, dots: 1 })) };
}

/** Stable row/column positions for an app's responsive layout (NC-05). */
export function countingPositions(count: number): { row: number; column: number }[] {
	if (!Number.isInteger(count) || count < 0 || count > 10) throw new RangeError('Object count must be 0–10.');
	return Array.from({ length: count }, (_, index) => ({ row: Math.floor(index / 5), column: index % 5 }));
}

export function questionObjects(question: NumberQuestion): CountObject[] {
	if (question.kind === 'count') return question.objects;
	if (question.kind === 'numeral-to-quantity') return question.groups.find((group) => group.objects.length === question.answer)!.objects;
	if (question.kind === 'compare' || question.kind === 'add') return [...question.left.objects, ...question.right.objects];
	return [];
}
