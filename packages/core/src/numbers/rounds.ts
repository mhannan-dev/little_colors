import type { Difficulty } from '../types/colors.ts';
import { createRng } from '../learning/rng.ts';
import type { MathActivityKind } from './mathLogic.ts';
import { questionGenerator, type NumberQuestion } from './questionGenerator.ts';

export interface NumbersRound { mode: 'numbers'; difficulty: Difficulty; seed: number; activities: NumberQuestion[] }
export function createNumbersRound(difficulty: Difficulty, seed: number): NumbersRound {
	const rng = createRng(seed);
	const kinds: MathActivityKind[] = difficulty === 'beginner' ? ['count', 'numeral-to-quantity', 'compare', 'count', 'pattern']
		: difficulty === 'explorer' ? ['count', 'numeral-to-quantity', 'compare', 'add', 'pattern'] : ['numeral-to-quantity', 'compare', 'add', 'add', 'pattern'];
	const activities = kinds.map((kind, index) => {
		const activity = questionGenerator(Math.floor(rng() * 0x100000000), kind, difficulty);
		return { ...activity, id: `${activity.id}.${index}` };
	});
	// The Advanced round explicitly introduces equality; other generated compare questions vary.
	if (difficulty === 'advanced') {
		const question = activities[1];
		if (question?.kind === 'compare') {
			question.right.objects = question.left.objects.map((object, index) => ({ ...object, id: `right-${index}`, color: 'blue' }));
			question.answer = 'same'; question.expectedOutcome = 'same';
			question.options = question.options.map((option) => ({ ...option, dots: question.left.objects.length }));
		}
	}
	return { mode: 'numbers', difficulty, seed, activities };
}
