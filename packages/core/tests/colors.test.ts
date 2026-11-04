import { describe, expect, it } from 'vitest';
import { COLORS } from '../src/index.ts';

describe('colors', () => {
	it('defines the six learning colors', () => {
		expect(COLORS).toEqual(['red', 'yellow', 'blue', 'orange', 'green', 'purple']);
	});
});
