import type { Color, Difficulty } from '../types/colors.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import type { ShapeKey } from '../shape-matching/shapes.ts';
import { SHAPES } from '../shape-matching/shapes.ts';
import { nextInPattern } from './mathLogic.ts';

export interface PatternToken { id: string; color: Color; shape: ShapeKey }
export interface Pattern { kind: 'AB' | 'AAB' | 'ABC'; unit: PatternToken[]; sequence: PatternToken[]; answer: PatternToken; options: PatternToken[] }
export function createPattern(seed: number, difficulty: Difficulty): Pattern {
	const rng = createRng(seed);
	const colors = shuffle(['red', 'yellow', 'blue'] as const, rng);
	const shapes = shuffle(SHAPES, rng);
	const tokens: PatternToken[] = colors.map((color, i) => ({ id: `${color}.${shapes[i]!.key}`, color, shape: shapes[i]!.key }));
	const kind = difficulty === 'advanced' ? 'ABC' : difficulty === 'explorer' && rng() < 0.5 ? 'AAB' : 'AB';
	const unit = kind === 'ABC' ? tokens : kind === 'AAB' ? [tokens[0]!, tokens[0]!, tokens[1]!] : tokens.slice(0, 2);
	const length = unit.length * 2 + Math.floor(rng() * unit.length);
	const sequence = Array.from({ length }, (_, i) => unit[i % unit.length]!);
	return { kind, unit, sequence, answer: nextInPattern(sequence, unit), options: shuffle(tokens.slice(0, difficulty === 'beginner' ? 2 : 3), rng) };
}
