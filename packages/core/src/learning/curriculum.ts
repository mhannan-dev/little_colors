import { RECIPES } from '../color-mixing/recipes.ts';
import type { Color, Difficulty } from '../types/colors.ts';
import { createRng, shuffle } from './rng.ts';

export interface MixingActivity {
	id: string;
	mode: 'mixing';
	difficulty: Difficulty;
	instructionKey: string;
	offered: Color[];
	target: Color | null;
	expectedOutcome: Color;
}

export interface MixingRound {
	mode: 'mixing';
	difficulty: Difficulty;
	seed: number;
	activities: MixingActivity[];
}

const PRIMARIES: Color[] = ['red', 'yellow', 'blue'];

/** Spec 11 — Color Mixing rounds: 3 activities, one per recipe. */
export function createMixingRound(difficulty: Difficulty, seed: number): MixingRound {
	const rng = createRng(seed);
	const recipes = difficulty === 'beginner' ? [...RECIPES] : shuffle(RECIPES, rng);

	const activities = recipes.map((recipe): MixingActivity => {
		if (difficulty === 'advanced') {
			return {
				id: `mixing.advanced.${recipe.id}`,
				mode: 'mixing',
				difficulty,
				instructionKey: `mix.target.${recipe.result}`,
				offered: shuffle(PRIMARIES, rng),
				target: recipe.result,
				expectedOutcome: recipe.result
			};
		}
		const offered: Color[] =
			difficulty === 'explorer' ? shuffle(recipe.inputs, rng) : [...recipe.inputs];
		return {
			id: `mixing.${difficulty}.${recipe.id}`,
			mode: 'mixing',
			difficulty,
			instructionKey: `mix.intro.${recipe.id}`,
			offered,
			target: null,
			expectedOutcome: recipe.result
		};
	});

	return { mode: 'mixing', difficulty, seed, activities };
}
