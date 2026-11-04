import type { Color } from '../types/colors.ts';

export type PrimaryColor = 'red' | 'yellow' | 'blue';
export type SecondaryColor = 'orange' | 'green' | 'purple';

export interface Recipe {
	id: 'red-yellow' | 'blue-yellow' | 'blue-red';
	inputs: [PrimaryColor, PrimaryColor];
	result: SecondaryColor;
}

/** Order used for Beginner rounds (spec 11, CP table). */
export const RECIPES: readonly Recipe[] = [
	{ id: 'red-yellow', inputs: ['red', 'yellow'], result: 'orange' },
	{ id: 'blue-yellow', inputs: ['yellow', 'blue'], result: 'green' },
	{ id: 'blue-red', inputs: ['red', 'blue'], result: 'purple' }
];

export function recipeForResult(result: Color): Recipe | undefined {
	return RECIPES.find((r) => r.result === result);
}
