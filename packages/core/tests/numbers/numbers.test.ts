import { describe, expect, it } from 'vitest';
import { addQuantities, compareQuantities, nextInPattern, toBengaliNumeral, formatNumeral, createPattern, questionGenerator, createNumbersRound, countingPositions, COUNTABLE_SHAPES, createCountingMachine, NUMBERS_NARRATION, type NumberQuestion, type CountingState, type CountingEvent, type CountingEffect, type MathActivityKind } from '../../src/numbers/index.ts';
import type { Difficulty } from '../../src/types/colors.ts';
import { createFakeClock } from '../helpers/fakeClock.ts';

describe('number rules and numerals', () => {
	it('compares both sides and equality', () => {
		expect(compareQuantities(2, 1)).toBe('left'); expect(compareQuantities(1, 2)).toBe('right'); expect(compareQuantities(3, 3)).toBe('same');
	});
	it('adds within bounds and rejects negatives, fractions, overflow, NaN and infinity', () => {
		expect(addQuantities(2, 3, 5)).toBe(5); expect(addQuantities(0, 1, 5)).toBe(1);
		for (const [a, b, max] of [[3, 3, 5], [-1, 2, 5], [0.5, 1, 5], [NaN, 1, 5], [1, Infinity, 5], [1, 1, NaN], [Number.MAX_SAFE_INTEGER, 1, 10]]) expect(addQuantities(a!, b!, max!)).toBeNull();
	});
	it('handles pattern offsets and rejects an empty unit', () => {
		expect(nextInPattern(['a', 'b', 'a'], ['a', 'b'])).toBe('b');
		expect(nextInPattern([], ['a'])).toBe('a'); expect(() => nextInPattern([], [])).toThrow(RangeError);
	});
	it('formats 0–10, multi-digit and all three numeral styles', () => {
		const expected = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯', '১০'];
		expected.forEach((text, n) => expect(toBengaliNumeral(n)).toBe(text));
		expect(toBengaliNumeral(1234567890)).toBe('১২৩৪৫৬৭৮৯০');
		expect(formatNumeral(10, 'bengali')).toBe('১০'); expect(formatNumeral(10, 'english')).toBe('10'); expect(formatNumeral(10, 'both')).toBe('১০ / 10');
	});
	it('positions ten objects in two rows of five', () => {
		expect(countingPositions(10)).toEqual(Array.from({ length: 10 }, (_, i) => ({ row: i < 5 ? 0 : 1, column: i % 5 })));
		expect(() => countingPositions(11)).toThrow(RangeError);
	});
});

const keys = new Set(NUMBERS_NARRATION.map((entry) => entry.key));
const difficulties: Difficulty[] = ['beginner', 'explorer', 'advanced'];
const kinds: MathActivityKind[] = ['count', 'numeral-to-quantity', 'compare', 'add', 'pattern'];
describe('number generators (NC-03, NC-04, NC-20 to NC-24, QA-03)', () => {
	it.each(difficulties.flatMap((difficulty) => kinds.filter((kind) => difficulty !== 'beginner' || kind !== 'add').map((kind) => ({ difficulty, kind }))))('$difficulty / $kind: 1,000 reproducible seeds, valid answers and concrete objects', ({ difficulty, kind }) => {
		for (let seed = 0; seed < 1000; seed++) {
			const q = questionGenerator(seed, kind, difficulty);
			expect(questionGenerator(seed, kind, difficulty)).toEqual(q);
			expect(keys.has(q.instructionKey), q.instructionKey).toBe(true);
			if (q.kind !== 'count') {
				expect(q.options).toHaveLength(difficulty === 'beginner' ? 2 : 3);
				expect(new Set(q.options.map((o) => o.value)).size).toBe(q.options.length);
				expect(q.options.filter((o) => o.value === q.answer)).toHaveLength(1);
				for (const option of q.options) if (typeof option.value === 'number') expect(option.dots).toBe(option.value);
			}
			const max = difficulty === 'beginner' ? 5 : 10;
			const groups = q.kind === 'count' ? [q.objects] : q.kind === 'numeral-to-quantity' ? [q.reference, ...q.groups.map((g) => g.objects)] : q.kind === 'compare' || q.kind === 'add' ? [q.left.objects, q.right.objects] : [];
			for (const group of groups) {
				expect(group.length).toBeGreaterThanOrEqual(1); expect(group.length).toBeLessThanOrEqual(max);
				expect(new Set(group.map((o) => o.color)).size).toBe(1); expect(new Set(group.map((o) => o.shape)).size).toBe(1);
				expect(new Set(group.map((o) => o.id)).size).toBe(group.length);
				for (const object of group) expect(COUNTABLE_SHAPES).toContain(object.shape);
			}
			if (q.kind === 'numeral-to-quantity') expect(q.reference).toHaveLength(q.quantity);
			if (q.kind === 'compare') {
				const left = q.left.objects.length, right = q.right.objects.length;
				if (difficulty === 'beginner') { expect(Math.abs(left - right)).toBeGreaterThanOrEqual(2); expect(q.ask).toBe('more'); }
				const answer = left === right ? 'same' : (q.ask === 'more' ? left > right : left < right) ? 'left' : 'right';
				expect(q.answer).toBe(answer);
			}
			if (q.kind === 'add') {
				expect(q.answer).toBe(q.left.objects.length + q.right.objects.length);
				expect(q.answer).toBeLessThanOrEqual(difficulty === 'explorer' ? 5 : 10); expect(q.showPlus).toBe(difficulty === 'advanced');
			}
			if (q.kind === 'pattern') {
				expect(q.pattern).toEqual(createPattern(seed, difficulty));
				expect(q.pattern.answer).toEqual(nextInPattern(q.pattern.sequence, q.pattern.unit));
				expect(new Set(q.pattern.options.map((o) => o.shape)).size).toBe(q.pattern.options.length);
				expect(new Set(q.pattern.options.map((o) => o.color)).size).toBe(q.pattern.options.length);
				if (difficulty === 'beginner') expect(q.pattern.kind).toBe('AB');
				if (difficulty === 'advanced') expect(q.pattern.kind).toBe('ABC');
			}
		}
	}, 60_000);
	it('does not generate Beginner addition', () => expect(() => questionGenerator(1, 'add', 'beginner')).toThrow(RangeError));
	it.each(difficulties)('%s rounds follow the curriculum and are reproducible', (difficulty) => {
		const expected = difficulty === 'beginner' ? ['count', 'numeral-to-quantity', 'compare', 'count', 'pattern'] : difficulty === 'explorer' ? ['count', 'numeral-to-quantity', 'compare', 'add', 'pattern'] : ['numeral-to-quantity', 'compare', 'add', 'add', 'pattern'];
		for (let seed = 0; seed < 1000; seed++) {
			const round = createNumbersRound(difficulty, seed);
			expect(round.activities.map((a) => a.kind)).toEqual(expected);
			expect(createNumbersRound(difficulty, seed)).toEqual(round);
			if (difficulty === 'advanced') expect(round.activities[1]!.answer).toBe('same');
		}
	}, 60_000);
});

function setup(q: NumberQuestion = questionGenerator(1, 'numeral-to-quantity', 'beginner')) {
	const clock = createFakeClock();
	const m = createCountingMachine(q, clock);
	const effects: CountingEffect[] = [];
	m.onEffect((effect) => effects.push(effect));
	return { m, clock, effects, q };
}
function answer(m: ReturnType<typeof createCountingMachine>, correct = true) {
	const option = m.context.question.options.find((option) => (option.value === m.context.question.answer) === correct)!;
	m.send({ type: 'SELECT_ANSWER', answerId: option.id }); m.send({ type: 'ANSWER_READY' }); m.send({ type: 'VALIDATE' });
}
describe('counting machine transition table', () => {
	it('counts out of order with exact narration/highlight steps and no double counting', () => {
		const q = questionGenerator(1, 'count', 'advanced');
		if (q.kind !== 'count') throw new Error('wrong kind');
		const { m, effects } = setup(q);
		const objects = [...q.objects].reverse();
		expect(m.send({ type: 'TAP_OBJECT', objectId: 'missing' })).toBe(false);
		objects.forEach((object, index) => {
			m.send({ type: 'TAP_OBJECT', objectId: object.id });
			if (objects.length === 1) m.send({ type: 'COUNT_DONE' });
			expect(m.context.countedIds).toHaveLength(index + 1);
			if (index < objects.length - 1) {
				m.send({ type: 'TAP_OBJECT', objectId: object.id });
				expect(effects.at(-1)).toEqual({ type: 'wiggle', objectId: object.id });
			}
		});
		expect(m.state).toBe('CORRECT');
		expect(effects.filter((e) => e.type === 'counted')).toEqual(objects.map((o, i) => ({ type: 'counted', objectId: o.id, number: i + 1, key: `number.${i + 1}` })));
		expect(effects.at(-1)).toEqual({ type: 'total', number: objects.length, key: `numbers.total.${objects.length}` });
	});
	it('completes a singleton count through the countComplete handshake', () => {
		const q = Array.from({ length: 100 }, (_, seed) => questionGenerator(seed, 'count', 'beginner')).find((q) => q.kind === 'count' && q.objects.length === 1)!;
		if (q.kind !== 'count') throw new Error('wrong kind');
		const { m, effects } = setup(q);
		m.send({ type: 'TAP_OBJECT', objectId: q.objects[0]!.id });
		expect(m.state).toBe('COUNTING'); expect(effects.at(-1)).toEqual({ type: 'countComplete' });
		m.send({ type: 'COUNT_DONE' }); expect(m.state).toBe('CORRECT');
	});
	it.each(['numeral-to-quantity', 'compare', 'add', 'pattern'] as MathActivityKind[])('validates %s, rejects duplicate answers, and completes independently of audio', (kind) => {
		const { m, clock, effects } = setup(questionGenerator(7, kind, 'explorer'));
		answer(m);
		expect(m.state).toBe('CORRECT');
		expect(m.send({ type: 'SELECT_ANSWER', answerId: m.context.question.options[0]!.id })).toBe(false);
		expect(m.send({ type: 'RESULT_SHOWN' })).toBe(false);
		clock.advanceBy(1499); expect(m.send({ type: 'RESULT_SHOWN' })).toBe(false);
		clock.advanceBy(1); m.send({ type: 'RESULT_SHOWN' }); expect(m.state).toBe('CELEBRATING');
		m.send({ type: 'CELEBRATION_DONE' }); expect(m.state).toBe('COMPLETE');
		expect(m.send({ type: 'CELEBRATION_DONE' })).toBe(false);
		expect(effects.filter((e) => e.type === 'complete')).toHaveLength(1);
		const completed = effects.find((e) => e.type === 'complete');
		if (completed?.type === 'complete') expect(completed.countedUpTo).toBeLessThanOrEqual(10);
		m.send({ type: 'NEXT' }); expect(m.state).toBe('READY');
	});
	it('retries gently, enables hints after two misses, locks answers until HINT_DONE', () => {
		const { m, effects } = setup();
		expect(m.send({ type: 'SELECT_ANSWER', answerId: 'missing' })).toBe(false);
		expect(m.send({ type: 'HINT' })).toBe(false);
		for (let i = 1; i <= 2; i++) {
			answer(m, false); expect(m.state).toBe('TRY_AGAIN'); expect(m.context.attempts).toBe(i);
			m.send({ type: 'FEEDBACK_DONE' }); expect(m.context.hintEnabled).toBe(i === 2);
		}
		m.send({ type: 'HINT' }); expect(m.context.hinting).toBe(true); expect(m.context.hintsUsed).toBe(1);
		expect(m.send({ type: 'SELECT_ANSWER', answerId: m.context.question.options[0]!.id })).toBe(false);
		expect(m.send({ type: 'HINT' })).toBe(false);
		m.send({ type: 'HINT_DONE' }); expect(m.context.hinting).toBe(false);
		expect(effects).toContainEqual({ type: 'narrate', key: 'numbers.retry' });
	});
	it('count hints lock object taps without counting for the child', () => {
		const { m } = setup(questionGenerator(1, 'count', 'beginner'));
		m.send({ type: 'HINT' });
		if (m.context.question.kind !== 'count') throw new Error('wrong kind');
		expect(m.send({ type: 'TAP_OBJECT', objectId: m.context.question.objects[0]!.id })).toBe(false);
		expect(m.context.countedIds).toEqual([]);
		m.reset(); expect(m.context.hinting).toBe(false);
	});
});

const statePaths: Record<CountingState, CountingEvent[]> = {
	READY: [], COUNTING: [], ANSWER_SELECTED: [], VALIDATING: [], CORRECT: [], TRY_AGAIN: [], CELEBRATING: [], COMPLETE: []
};
function atState(state: CountingState) {
	const data = setup(state === 'COUNTING' ? questionGenerator(1, 'count', 'advanced') : undefined);
	const { m, clock } = data;
	if (state === 'COUNTING' && m.context.question.kind === 'count') m.send({ type: 'TAP_OBJECT', objectId: m.context.question.objects[0]!.id });
	else if (state !== 'READY') {
		const option = m.context.question.options.find((o) => (o.value === m.context.question.answer) === (state !== 'TRY_AGAIN'))!;
		m.send({ type: 'SELECT_ANSWER', answerId: option.id });
		if (state !== 'ANSWER_SELECTED') m.send({ type: 'ANSWER_READY' });
		if (!['ANSWER_SELECTED', 'VALIDATING'].includes(state)) m.send({ type: 'VALIDATE' });
		if (state === 'CELEBRATING' || state === 'COMPLETE') { clock.advanceBy(1500); m.send({ type: 'RESULT_SHOWN' }); }
		if (state === 'COMPLETE') m.send({ type: 'CELEBRATION_DONE' });
	}
	expect(m.state).toBe(state); data.effects.length = 0;
	return data;
}
describe('counting reset/ignored-event matrix', () => {
	it.each(Object.keys(statePaths) as CountingState[])('both reset APIs clear %s and emit cancellation', (state) => {
		for (const event of [true, false]) {
			const { m, effects } = atState(state);
			if (event) m.send({ type: 'RESET' }); else m.reset();
			expect(m.state).toBe('READY'); expect(m.context.countedIds).toEqual([]); expect(m.context.attempts).toBe(0);
			expect(m.context.selectedAnswerId).toBeNull(); expect(m.context.resultEnteredAt).toBeNull();
			expect(effects).toEqual([{ type: 'cancelAll' }]);
		}
	});
	const allowed: Record<CountingState, string[]> = { READY: ['TAP_OBJECT', 'SELECT_ANSWER', 'HINT', 'HINT_DONE'], COUNTING: ['TAP_OBJECT', 'COUNT_DONE'], ANSWER_SELECTED: ['ANSWER_READY'], VALIDATING: ['VALIDATE'], CORRECT: ['RESULT_SHOWN'], TRY_AGAIN: ['FEEDBACK_DONE'], CELEBRATING: ['CELEBRATION_DONE'], COMPLETE: ['NEXT'] };
	const events: CountingEvent[] = [{ type: 'TAP_OBJECT', objectId: 'object-0' }, { type: 'SELECT_ANSWER', answerId: 'missing' }, ...(['ANSWER_READY', 'VALIDATE', 'COUNT_DONE', 'FEEDBACK_DONE', 'HINT', 'HINT_DONE', 'RESULT_SHOWN', 'CELEBRATION_DONE', 'NEXT'] as const).map((type) => ({ type }))];
	it.each((Object.keys(statePaths) as CountingState[]).flatMap((state) => events.filter((e) => !allowed[state].includes(e.type)).map((event) => ({ state, event }))))('$state ignores $event.type', ({ state, event }) => {
		const { m, effects } = atState(state); const context = m.context;
		expect(m.send(event)).toBe(false); expect(m.context).toBe(context); expect(effects).toEqual([]);
	});
	it('provides unique bilingual entries for instructions, effects, and every hint step', () => {
		expect(keys.size).toBe(NUMBERS_NARRATION.length);
		for (const entry of NUMBERS_NARRATION) { expect(entry.bn).toBeTruthy(); expect(entry.en).toBeTruthy(); expect(entry.status).toBe('placeholder'); }
		for (const kind of kinds.filter((k) => k !== 'count')) {
			const { m, effects } = setup(questionGenerator(77, kind, 'advanced'));
			answer(m);
			for (const effect of effects) {
				if (effect.type === 'narrate' || effect.type === 'total' || effect.type === 'counted') expect(keys.has(effect.key), effect.key).toBe(true);
				if (effect.type === 'explain' || effect.type === 'hint') for (const step of effect.steps) expect(keys.has(step.key), step.key).toBe(true);
			}
		}
	});
});
