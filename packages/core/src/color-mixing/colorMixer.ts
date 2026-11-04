import type { Color } from '../types/colors.ts';

const MIXING_RECIPES: Record<string, Color> = {
	'red+yellow': 'orange',
	'blue+yellow': 'green',
	'blue+red': 'purple'
};

/** Simplified educational paint mixing (CM-01..CM-04). Order-independent, no RGB math. */
export function mixColors(first: Color, second: Color): Color | null {
	const key = [first, second].sort().join('+');
	return MIXING_RECIPES[key] ?? null;
}
