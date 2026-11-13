import { describe, expect, it } from 'vitest';
import { createMathQuestion } from '../../src/numbers/simpleMath.ts';

describe('simple math questions', () => {
	it('keeps arithmetic, picture counts and distinct choices within each range', () => {
		for (const mode of ['add', 'subtract', 'mixed'] as const) {
			for (const limit of [10, 20] as const) {
				let seed = 42;
				const random = () => {
					seed = (seed * 1664525 + 1013904223) >>> 0;
					return seed / 2 ** 32;
				};
				for (let round = 0; round < 100; round++) {
					const q = createMathQuestion(mode, limit, random);
					expect(q.answer).toBe(q.operation === 'add' ? q.left + q.right : q.left - q.right);
					expect(new Set(q.choices).size).toBe(4);
					expect(q.choices.filter(value => value === q.answer)).toHaveLength(1);
					expect([q.left, q.right, q.answer, ...q.choices].every(value => Number.isInteger(value) && value >= 0 && value <= limit)).toBe(true);
					if (mode !== 'mixed') expect(q.operation).toBe(mode);
				}
			}
		}
	});
	it('supports random boundary values without retry loops', () => {
		for (const random of [() => 0, () => 0.999999]) {
			for (const mode of ['add', 'subtract', 'mixed'] as const) {
				expect(new Set(createMathQuestion(mode, 20, random).choices).size).toBe(4);
			}
		}
	});
});
