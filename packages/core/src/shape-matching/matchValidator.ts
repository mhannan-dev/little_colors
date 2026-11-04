import type { Color } from '../types/colors.ts';
import type { ShapeKey } from './shapes.ts';

export interface MatchItem { id: string; shape: ShapeKey; color: Color }
export type MatchMode = 'shape' | 'color' | 'both';

export function isCorrectMatch(source: MatchItem, target: MatchItem, mode: MatchMode): boolean {
	if (mode === 'shape') return source.shape === target.shape;
	if (mode === 'color') return source.color === target.color;
	return source.shape === target.shape && source.color === target.color;
}
