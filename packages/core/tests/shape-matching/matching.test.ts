import { describe, expect, it } from 'vitest';
import { createMatchingActivity, createMatchingMachine, createMatchingRound, isCorrectMatch, MATCHING_NARRATION, SHAPES, type MatchingActivity, type MatchingEffect, type MatchingEvent, type MatchingState } from '../../src/shape-matching/index.ts';
import type { Difficulty } from '../../src/types/colors.ts';

const activity: MatchingActivity = {
	id: 'test', mode: 'matching', difficulty: 'advanced', matchMode: 'both', instructionKey: 'match.instruction.both', expectedOutcome: 'matched',
	sources: [{ id: 'a', shape: 'circle', color: 'red' }, { id: 'b', shape: 'star', color: 'blue' }],
	targets: [{ id: 'x', shape: 'circle', color: 'red' }, { id: 'y', shape: 'star', color: 'blue' }, { id: 'z', shape: 'square', color: 'green' }]
};
const correct: MatchingEvent[] = [{ type: 'TAP_SOURCE', itemId: 'a' }, { type: 'TAP_TARGET', targetId: 'x' }, { type: 'VALIDATE' }];
const paths: Record<MatchingState, MatchingEvent[]> = {
	IDLE: [], SOURCE_SELECTED: correct.slice(0, 1), DRAGGING: [{ type: 'DRAG_START', itemId: 'a' }],
	VALIDATING: correct.slice(0, 2), SNAPPED: correct,
	RETURNING: [{ type: 'DRAG_START', itemId: 'a' }, { type: 'DRAG_CANCEL' }],
	CELEBRATING: [...correct, { type: 'SNAP_DONE' }, { type: 'TAP_SOURCE', itemId: 'b' }, { type: 'TAP_TARGET', targetId: 'y' }, { type: 'VALIDATE' }, { type: 'SNAP_DONE' }],
	COMPLETE: [...correct, { type: 'SNAP_DONE' }, { type: 'TAP_SOURCE', itemId: 'b' }, { type: 'TAP_TARGET', targetId: 'y' }, { type: 'VALIDATE' }, { type: 'SNAP_DONE' }, { type: 'CELEBRATION_DONE' }]
};
function setup(state: MatchingState = 'IDLE') {
	const m = createMatchingMachine(activity);
	paths[state].forEach((event) => m.send(event));
	expect(m.state).toBe(state);
	const effects: MatchingEffect[] = [];
	m.onEffect((effect) => effects.push(effect));
	return { m, effects };
}

describe('matching pure rules (SM-10 to SM-13)', () => {
	it('compares only the requested attributes', () => {
		const source = activity.sources[0]!;
		const otherColor = { ...source, color: 'blue' as const };
		const otherShape = { ...source, shape: 'star' as const };
		expect(isCorrectMatch(source, otherColor, 'shape')).toBe(true);
		expect(isCorrectMatch(source, otherShape, 'shape')).toBe(false);
		expect(isCorrectMatch(source, otherShape, 'color')).toBe(true);
		expect(isCorrectMatch(source, otherColor, 'color')).toBe(false);
		expect(isCorrectMatch(source, otherColor, 'both')).toBe(false);
		expect(isCorrectMatch(source, source, 'both')).toBe(true);
	});
	it('has all eight safe shape definitions', () => {
		expect(SHAPES).toHaveLength(8);
		expect(new Set(SHAPES.map((s) => s.key)).size).toBe(8);
	});
	it.each(['beginner', 'explorer', 'advanced'] as Difficulty[])('%s: deterministic, exactly one target/source, unique distractors and ≤3 colors across 1,000 seeds', (difficulty) => {
		for (let seed = 0; seed < 1000; seed++) {
			const a = createMatchingActivity(seed, difficulty);
			expect(createMatchingActivity(seed, difficulty)).toEqual(a);
			expect(a.targets).toHaveLength(difficulty === 'beginner' ? 2 : 3);
			expect(a.sources.length).toBeGreaterThanOrEqual(difficulty === 'advanced' ? 2 : 1);
			expect(a.sources.length).toBeLessThanOrEqual(difficulty === 'beginner' ? 1 : difficulty === 'explorer' ? 2 : 3);
			for (const source of a.sources) expect(a.targets.filter((target) => isCorrectMatch(source, target, a.matchMode))).toHaveLength(1);
			expect(new Set([...a.sources, ...a.targets].map((item) => item.color)).size).toBeLessThanOrEqual(3);
			const attribute = a.matchMode === 'color' ? 'color' : 'shape';
			expect(new Set(a.targets.map((item) => item[attribute])).size).toBe(a.targets.length);
			const round = createMatchingRound(difficulty, seed);
			expect(round.activities).toHaveLength(5);
			expect(createMatchingRound(difficulty, seed)).toEqual(round);
			if (difficulty === 'beginner') expect(round.activities.map((a) => a.matchMode)).toEqual(['color', 'shape', 'color', 'shape', 'color']);
			if (difficulty === 'advanced') expect(round.activities.every((a) => a.matchMode === 'both')).toBe(true);
		}
	}, 60_000);
});

describe('matching transitions', () => {
	it('selects and switches source, clears on empty, rejects unknown items and targets', () => {
		const { m } = setup();
		expect(m.send({ type: 'TAP_SOURCE', itemId: 'missing' })).toBe(false);
		m.send({ type: 'TAP_SOURCE', itemId: 'a' });
		m.send({ type: 'TAP_SOURCE', itemId: 'b' });
		expect(m.context.selectedId).toBe('b');
		expect(m.send({ type: 'TAP_TARGET', targetId: 'missing' })).toBe(false);
		m.send({ type: 'TAP_EMPTY' });
		expect(m.state).toBe('IDLE');
		expect(m.context.selectedId).toBeNull();
	});
	it('validates correct tap and drag, snaps remaining items, celebrates and records once', () => {
		const { m, effects } = setup();
		correct.forEach((event) => m.send(event));
		expect(m.state).toBe('SNAPPED');
		expect(m.context.matchedIds).toEqual(['a']);
		m.send({ type: 'SNAP_DONE' });
		expect(m.state).toBe('IDLE');
		expect(m.send({ type: 'TAP_SOURCE', itemId: 'a' })).toBe(false);
		expect(m.send({ type: 'DRAG_START', itemId: 'a' })).toBe(false);
		m.send({ type: 'DRAG_START', itemId: 'b' });
		expect(m.send({ type: 'DRAG_START', itemId: 'a' })).toBe(false);
		m.send({ type: 'DROP', targetId: 'y' });
		m.send({ type: 'VALIDATE' });
		m.send({ type: 'SNAP_DONE' });
		expect(m.state).toBe('CELEBRATING');
		m.send({ type: 'CELEBRATION_DONE' });
		expect(m.send({ type: 'CELEBRATION_DONE' })).toBe(false);
		expect(m.state).toBe('COMPLETE');
		expect(effects.filter((e) => e.type === 'complete')).toHaveLength(1);
		m.send({ type: 'NEXT' });
		expect(m.state).toBe('IDLE');
		expect(m.context.matchedIds).toEqual([]);
	});
	it('incorrect matches enable hints after two returned attempts without forcing an answer', () => {
		const { m, effects } = setup();
		expect(m.send({ type: 'HINT' })).toBe(false);
		for (let attempt = 1; attempt <= 2; attempt++) {
			m.send({ type: 'TAP_SOURCE', itemId: 'a' });
			m.send({ type: 'TAP_TARGET', targetId: 'z' });
			m.send({ type: 'VALIDATE' });
			expect(m.state).toBe('RETURNING');
			expect(m.context.attempts).toBe(attempt);
			m.send({ type: 'RETURN_DONE' });
			expect(m.context.hintEnabled).toBe(attempt === 2);
		}
		m.send({ type: 'HINT' });
		expect(m.context.hintsUsed).toBe(1);
		expect(m.context.matchedIds).toEqual([]);
		expect(effects).toContainEqual({ type: 'hint', itemId: 'a', targetId: 'x' });
	});
	it.each([{ type: 'DROP', targetId: null }, { type: 'DROP', targetId: 'missing' }, { type: 'DRAG_CANCEL' }] as MatchingEvent[])('cancel/drop outside returns silently ($type)', (event) => {
		const { m, effects } = setup('DRAGGING');
		m.send(event);
		expect(m.state).toBe('RETURNING');
		expect(effects).toEqual([{ type: 'return', itemId: 'a' }]);
		m.send({ type: 'RETURN_DONE' });
		expect(m.context.attempts).toBe(0);
	});
	it.each(Object.keys(paths) as MatchingState[])('both reset paths cancel and clear %s', (state) => {
		for (const method of ['event', 'method']) {
			const { m, effects } = setup(state);
			if (method === 'event') m.send({ type: 'RESET' }); else m.reset();
			expect(m.state).toBe('IDLE');
			expect(m.context.matchedIds).toEqual([]);
			expect(m.context.attempts).toBe(0);
			expect(m.context.selectedId).toBeNull();
			expect(effects).toEqual([{ type: 'cancelAll' }]);
		}
	});
	const listed: Record<MatchingState, string[]> = {
		IDLE: ['TAP_SOURCE', 'DRAG_START', 'HINT'], SOURCE_SELECTED: ['TAP_SOURCE', 'TAP_TARGET', 'TAP_EMPTY'],
		DRAGGING: ['DROP', 'DRAG_CANCEL'], VALIDATING: ['VALIDATE'], SNAPPED: ['SNAP_DONE'], RETURNING: ['RETURN_DONE'], CELEBRATING: ['CELEBRATION_DONE'], COMPLETE: ['NEXT']
	};
	const all: MatchingEvent[] = [{ type: 'TAP_SOURCE', itemId: 'b' }, { type: 'DRAG_START', itemId: 'b' }, { type: 'TAP_TARGET', targetId: 'y' }, { type: 'DROP', targetId: 'y' }, ...(['TAP_EMPTY', 'DRAG_CANCEL', 'VALIDATE', 'SNAP_DONE', 'RETURN_DONE', 'HINT', 'CELEBRATION_DONE', 'NEXT'] as const).map((type) => ({ type }))];
	it.each((Object.keys(paths) as MatchingState[]).flatMap((state) => all.filter((e) => !listed[state].includes(e.type)).map((event) => ({ state, event }))))('$state ignores $event.type (SM-30)', ({ state, event }) => {
		const { m, effects } = setup(state);
		const ctx = m.context;
		expect(m.send(event)).toBe(false);
		expect(m.context).toBe(ctx);
		expect(m.state).toBe(state);
		expect(effects).toEqual([]);
	});
	it('has bilingual placeholder narration for every emitted key', () => {
		const keys = new Set(MATCHING_NARRATION.map((entry) => entry.key));
		expect(keys.size).toBe(MATCHING_NARRATION.length);
		for (const entry of MATCHING_NARRATION) {
			expect(entry.bn).toBeTruthy(); expect(entry.en).toBeTruthy(); expect(entry.status).toBe('placeholder');
		}
		const { m, effects } = setup();
		paths.COMPLETE.forEach((event) => m.send(event));
		for (const effect of effects) if (effect.type === 'narrate') expect(keys.has(effect.key)).toBe(true);
	});
});
