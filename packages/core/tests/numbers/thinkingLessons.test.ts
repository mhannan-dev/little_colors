import { describe, expect, it } from 'vitest';
import { THINKING_KINDS, createThinkingLesson, createThinkingRound, initialThinkingProgress, thinkingReducer, thinkingHint, findGridPath, moveOnGrid, sameCell, THINKING_DIRECTIONS, type ThinkingAgeBand, type ThinkingLesson, type GridDirection } from '../../src/numbers/lessons/thinkingLessons.ts';
import { THINKING_NARRATION } from '../../src/numbers/lessons/narration.ts';
import { getNarration } from '../../src/audio/catalog.ts';

describe('age-banded thinking generators', () => {
	it.each((['5-7', '8-10'] as ThinkingAgeBand[]).flatMap((age) => THINKING_KINDS.map((kind) => ({ age, kind }))))('$age / $kind stays deterministic, solvable and unambiguous for 1,000 seeds', ({ age, kind }) => {
		for (let seed = 0; seed < 1000; seed++) {
			const lesson = createThinkingLesson(kind, age, seed);
			expect(createThinkingLesson(kind, age, seed)).toEqual(lesson);
			expect(getNarration(lesson.instructionKey)).toBeDefined();
			if (lesson.kind === 'odd-one-out') {
				const groups = new Map<string, string[]>();
				for (const option of lesson.options) {
					const key = String(lesson.attribute === 'shape' ? option.token.shape : option.quantity);
					groups.set(key, [...(groups.get(key) ?? []), option.id]);
				}
				expect(groups.size).toBe(2);
				expect([...groups.values()].find((ids) => ids.length === 1)).toEqual([lesson.answerId]);
				expect(lesson.options).toHaveLength(age === '5-7' ? 4 : 6);
			} else if (lesson.kind === 'sequence-memory') {
				expect(lesson.sequence).toHaveLength(age === '5-7' ? 3 : 5);
				expect(new Set(lesson.sequence.map((token) => token.id)).size).toBeGreaterThanOrEqual(2);
				expect(new Set(lesson.options.map((token) => token.shape)).size).toBe(lesson.options.length);
				expect(new Set(lesson.options.map((token) => token.color)).size).toBeLessThanOrEqual(3);
				for (const token of lesson.sequence) expect(lesson.options.some((option) => option.id === token.id)).toBe(true);
			} else if (lesson.kind === 'number-pattern') {
				const expected = lesson.sequence[3]! + lesson.step;
				expect(lesson.options.find((option) => option.id === lesson.answerId)?.value).toBe(expected);
				expect(new Set(lesson.options.map((option) => option.value)).size).toBe(lesson.options.length);
				expect(lesson.options.every((option) => option.value >= 1 && option.value <= (age === '5-7' ? 10 : 20))).toBe(true);
				for (let i = 1; i < lesson.sequence.length; i++) expect(lesson.sequence[i]! - lesson.sequence[i - 1]!).toBe(lesson.step);
			} else {
				const path = findGridPath(lesson)!;
				expect(path.length).toBeGreaterThanOrEqual(lesson.size * 2 - 2);
				expect(sameCell(path[path.length - 1]!, lesson.goal)).toBe(true);
				let from = lesson.start;
				for (const cell of path) { expect(Math.abs(cell.row - from.row) + Math.abs(cell.column - from.column)).toBe(1); expect(lesson.walls.some((wall) => sameCell(wall, cell))).toBe(false); from = cell; }
				expect(lesson.walls.some((wall) => sameCell(wall, lesson.start) || sameCell(wall, lesson.goal))).toBe(false);
			}
			const round = createThinkingRound(kind, age, seed);
			expect(round).toHaveLength(3); expect(new Set(round.map((lesson) => lesson.id)).size).toBe(3);
			expect(createThinkingRound(kind, age, seed)).toEqual(round);
		}
	}, 60_000);
});

function complete(lesson: ThinkingLesson) {
	let progress = initialThinkingProgress(lesson);
	if (lesson.kind === 'sequence-memory') {
		progress = thinkingReducer(lesson, progress, { type: 'REMEMBER' });
		for (const token of lesson.sequence) progress = thinkingReducer(lesson, progress, { type: 'ANSWER', optionId: token.id });
	} else if (lesson.kind === 'grid-path') {
		for (const cell of findGridPath(lesson)!) {
			const direction = THINKING_DIRECTIONS.find((direction) => { const next = moveOnGrid(lesson, progress.position, direction); return next && sameCell(next, cell); })!;
			progress = thinkingReducer(lesson, progress, { type: 'MOVE', direction });
		}
	} else progress = thinkingReducer(lesson, progress, { type: 'ANSWER', optionId: lesson.answerId });
	return progress;
}
describe('thinking interaction rules', () => {
	it.each(THINKING_KINDS)('%s completes only through input, ignores extra actions, and resets cleanly', (kind) => {
		const lesson = createThinkingLesson(kind, '8-10', 12);
		const initial = initialThinkingProgress(lesson);
		expect(thinkingReducer(lesson, initial, { type: 'ANSWER', optionId: 'unknown' })).toBe(initial);
		const done = complete(lesson);
		expect(done.phase).toBe('success'); expect(done.feedbackKey).toBe('thinking.success');
		expect(thinkingReducer(lesson, done, { type: 'ANSWER', optionId: 'unknown' })).toBe(done);
		expect(thinkingReducer(lesson, done, { type: 'MOVE', direction: 'up' })).toBe(done);
		expect(thinkingReducer(lesson, done, { type: 'RESET' })).toEqual(initial);
	});
	it('memory remains visible until the child chooses to hide it, and an error preserves earlier recall', () => {
		const lesson = createThinkingLesson('sequence-memory', '5-7', 13);
		if (lesson.kind !== 'sequence-memory') throw new Error('wrong lesson');
		let state = initialThinkingProgress(lesson);
		expect(state.phase).toBe('observe');
		expect(thinkingReducer(lesson, state, { type: 'ANSWER', optionId: lesson.sequence[0]!.id })).toBe(state);
		state = thinkingReducer(lesson, state, { type: 'REMEMBER' });
		state = thinkingReducer(lesson, state, { type: 'ANSWER', optionId: lesson.sequence[0]!.id });
		const wrong = lesson.options.find((token) => token.id !== lesson.sequence[1]!.id)!;
		state = thinkingReducer(lesson, state, { type: 'ANSWER', optionId: wrong.id });
		expect(state.memoryIndex).toBe(1); expect(state.phase).toBe('play'); expect(state.attempts).toBe(1);
	});
	it.each(['odd-one-out', 'sequence-memory', 'number-pattern'] as const)('%s hints become available after two misses and never choose an answer', (kind) => {
		const lesson = createThinkingLesson(kind, '5-7', 8);
		if (lesson.kind === 'grid-path') throw new Error('wrong lesson');
		let state = initialThinkingProgress(lesson);
		if (lesson.kind === 'sequence-memory') state = thinkingReducer(lesson, state, { type: 'REMEMBER' });
		expect(thinkingReducer(lesson, state, { type: 'HINT' })).toBe(state);
		const answer = lesson.kind === 'sequence-memory' ? lesson.sequence[0]!.id : lesson.answerId;
		const wrong = lesson.options.find((option) => option.id !== answer)!;
		for (let i = 0; i < 2; i++) state = thinkingReducer(lesson, state, { type: 'ANSWER', optionId: wrong.id });
		state = thinkingReducer(lesson, state, { type: 'HINT' });
		expect(state.phase).toBe('play'); expect(state.hintVisible).toBe(true); expect(state.hintsUsed).toBe(1); expect(thinkingHint(lesson, state).kind).toBe(kind);
		expect(thinkingReducer(lesson, state, { type: 'HINT' })).toBe(state);
	});
	it('blocked moves preserve position, and a path hint names an adjacent reachable cell', () => {
		const lesson = createThinkingLesson('grid-path', '8-10', 99);
		if (lesson.kind !== 'grid-path') throw new Error('wrong lesson');
		let state = initialThinkingProgress(lesson);
		for (let i = 0; i < 2; i++) state = thinkingReducer(lesson, state, { type: 'MOVE', direction: 'left' });
		expect(state.position).toEqual(lesson.start); expect(state.attempts).toBe(2);
		state = thinkingReducer(lesson, state, { type: 'HINT' });
		const hint = thinkingHint(lesson, state);
		expect(hint.kind).toBe('grid-path');
		if (hint.kind === 'grid-path') expect(Math.abs(hint.cell!.row - state.position.row) + Math.abs(hint.cell!.column - state.position.column)).toBe(1);
		expect(state.position).toEqual(lesson.start);
	});
	it('returns null for an unreachable grid instead of suggesting an invalid move', () => {
		const lesson = createThinkingLesson('grid-path', '5-7', 3);
		if (lesson.kind !== 'grid-path') throw new Error('wrong lesson');
		lesson.walls = [{ row: 1, column: 0 }, { row: 2, column: 1 }];
		expect(findGridPath(lesson)).toBeNull();
	});
	it('has unique bilingual, unreviewed narration entries registered in the app catalog', () => {
		expect(new Set(THINKING_NARRATION.map((entry) => entry.key)).size).toBe(THINKING_NARRATION.length);
		for (const entry of THINKING_NARRATION) { expect(getNarration(entry.key)).toEqual(entry); expect(entry.bn).toBeTruthy(); expect(entry.en).toBeTruthy(); expect(entry.status).toBe('placeholder'); }
	});
});
