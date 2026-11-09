import { describe, expect, it } from 'vitest';
import { COLOR_BLOCK_LEVELS, colorBlockHint, slideColorBlock } from '../../src/numbers/lessons/colorBlocks.ts';

describe('color blocks', () => {
	it('stops at walls and occupied squares and only clears the matching gate', () => {
		const level = COLOR_BLOCK_LEVELS[2];
		expect(slideColorBlock(level, level.start, 'r', 'up')).toBe(level.start);
		expect(slideColorBlock(level, level.start, 'r', 'left', 4)).toEqual({ r: 12, b: 11 });
		expect(slideColorBlock(level, level.start, 'r', 'right', 4)).toEqual({ r: 14, b: 11 });
		expect(slideColorBlock(level, { r: 11 }, 'r', 'left')).toEqual({});
	});

	it.each(COLOR_BLOCK_LEVELS.map((level, index) => ({ level, index })))('solves puzzle $index by following hints', ({ level }) => {
		let board = level.start;
		for (let i = 0; Object.keys(board).length && i < 100; i++) {
			const hint = colorBlockHint(level, board);
			expect(hint).toBeDefined();
			board = slideColorBlock(level, board, hint!.id, hint!.direction);
		}
		expect(board).toEqual({});
	});
});
