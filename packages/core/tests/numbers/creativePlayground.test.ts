import { describe, expect, it } from 'vitest';
import { initialCreativePlayground, createPlaygroundStamp, creativePlaygroundReducer, playgroundNeighbor, playgroundTokenKey, playgroundPatternLimit, type CreativePlaygroundState, type PlaygroundAction } from '../../src/numbers/lessons/creativePlayground.ts';
import type { ThinkingAgeBand } from '../../src/numbers/lessons/thinkingLessons.ts';
import { PLAYGROUND_NARRATION } from '../../src/numbers/lessons/playgroundNarration.ts';
import { getNarration } from '../../src/audio/catalog.ts';
import { createRng } from '../../src/learning/rng.ts';

const apple = createPlaygroundStamp('apple'), sandwich = createPlaygroundStamp('sandwich');
function apply(state: CreativePlaygroundState, action: PlaygroundAction, age: ThinkingAgeBand = '5-7') { return creativePlaygroundReducer(state, action, age); }
function place(state: CreativePlaygroundState, cell: number, token = apple) { return apply(apply(state, { type: 'CHOOSE', token }), { type: 'PLACE', cell }); }

describe('creative board actions', () => {
	it('requires an explicit selection and valid empty cell, then selects the newly placed object', () => {
		const empty = initialCreativePlayground();
		expect(apply(empty, { type: 'PLACE', cell: 0 })).toBe(empty);
		const chosen = apply(empty, { type: 'CHOOSE', token: apple });
		for (const cell of [-1, 16, NaN, 1.5]) expect(apply(chosen, { type: 'PLACE', cell })).toBe(chosen);
		const state = apply(chosen, { type: 'PLACE', cell: 0 });
		expect(state.items).toEqual([{ id: 'creation-1', token: apple, cell: 0, rotation: 0 }]);
		expect(state.selectedId).toBe('creation-1'); expect(state.stamp).toBeNull(); expect(empty.items).toEqual([]);
	});
	it('never overwrites an occupied spot when adding another item', () => {
		const state = place(initialCreativePlayground(), 0);
		const next = place(state, 0, sandwich);
		expect(next.items).toEqual(state.items); expect(next.history).toEqual(state.history); expect(next.nextId).toBe(state.nextId);
		expect(next.feedbackKey).toBe('playground.occupied');
	});
	it('moves and swaps objects without losing either one, with reversible undo', () => {
		const state = place(place(initialCreativePlayground(), 0), 1, sandwich);
		const moved = apply(state, { type: 'MOVE', id: 'creation-1', cell: 1 });
		expect(moved.items.find((item) => item.id === 'creation-1')?.cell).toBe(1);
		expect(moved.items.find((item) => item.id === 'creation-2')?.cell).toBe(0);
		expect(apply(moved, { type: 'UNDO' }).items).toEqual(state.items);
		expect(apply(state, { type: 'MOVE', id: 'missing', cell: 0 })).toBe(state);
	});
	it('rotates in quarter turns, removes selected objects, and restores them through undo', () => {
		let state = place(initialCreativePlayground(), 5, createPlaygroundStamp('triangle', 'orange'));
		for (const expected of [90, 180, 270, 0]) { state = apply(state, { type: 'ROTATE' }); expect(state.items[0]!.rotation).toBe(expected); }
		const removed = apply(state, { type: 'REMOVE' }); expect(removed.items).toEqual([]); expect(removed.selectedId).toBeNull();
		expect(apply(removed, { type: 'UNDO' }).items).toEqual(state.items);
	});
	it('clear and idea templates are reversible and IDs remain unique after undo', () => {
		const state = place(initialCreativePlayground(), 3);
		const cleared = apply(state, { type: 'CLEAR' }); expect(cleared.items).toEqual([]);
		expect(apply(cleared, { type: 'UNDO' }).items).toEqual(state.items);
		for (const name of ['flower', 'cat'] as const) {
			const idea = apply(state, { type: 'TEMPLATE', name });
			expect(new Set(idea.items.map((item) => item.cell)).size).toBe(idea.items.length);
			expect(apply(idea, { type: 'UNDO' }).items).toEqual(state.items);
		}
		const again = place(apply(state, { type: 'UNDO' }), 1);
		expect(again.items[0]!.id).toBe('creation-2');
	});
	it('nudges within bounds without wrapping across rows or columns', () => {
		expect(playgroundNeighbor(0, 'left')).toBeNull(); expect(playgroundNeighbor(0, 'up')).toBeNull();
		expect(playgroundNeighbor(3, 'right')).toBeNull(); expect(playgroundNeighbor(15, 'down')).toBeNull();
		let state = place(initialCreativePlayground(), 0);
		expect(apply(state, { type: 'NUDGE', direction: 'left' })).toBe(state);
		state = apply(state, { type: 'NUDGE', direction: 'right' }); expect(state.items[0]!.cell).toBe(1);
		state = apply(state, { type: 'NUDGE', direction: 'down' }); expect(state.items[0]!.cell).toBe(5);
	});
	it('keeps edit history bounded and does not mutate earlier items/snapshots', () => {
		let state = place(initialCreativePlayground(), 0); const initial = state, original = JSON.stringify(state);
		for (let index = 0; index < 100; index++) state = apply(state, { type: 'ROTATE' });
		expect(state.history).toHaveLength(50);
		const restored = apply(state, { type: 'UNDO' }); restored.items[0]!.token.color = 'blue';
		expect(state.history[state.history.length - 1]!.items[0]!.token.color).toBe('green');
		expect(JSON.stringify(initial)).toBe(original);
	});
	it('preserves board invariants through 1,000 seeded edit histories', () => {
		for (let seed = 0; seed < 1000; seed++) {
			const rng = createRng(seed); let state = initialCreativePlayground();
			for (let step = 0; step < 20; step++) {
				const cell = Math.floor(rng() * 16), choice = Math.floor(rng() * 6);
				if (choice === 0) state = place(state, cell);
				else if (choice === 1 && state.items[0]) state = apply(state, { type: 'MOVE', id: state.items[0].id, cell });
				else state = apply(state, { type: choice === 2 ? 'UNDO' : choice === 3 ? 'CLEAR' : choice === 4 ? 'ROTATE' : 'REMOVE' });
			}
			expect(new Set(state.items.map((item) => item.id)).size).toBe(state.items.length);
			expect(new Set(state.items.map((item) => item.cell)).size).toBe(state.items.length);
			expect(state.items.every((item) => item.cell >= 0 && item.cell < 16 && item.rotation % 90 === 0)).toBe(true);
			expect(state.items.length).toBeLessThanOrEqual(16); expect(state.history.length).toBeLessThanOrEqual(50);
		}
	}, 60_000);
});

function pattern(age: ThinkingAgeBand, who: 'rumi' | 'together') {
	let state = initialCreativePlayground();
	for (const token of [apple, sandwich, apple, sandwich, apple, sandwich].slice(0, playgroundPatternLimit(age))) state = apply(apply(state, { type: 'CHOOSE', token }), { type: 'PATTERN_ADD' }, age);
	return apply(state, { type: 'PATTERN_START', who }, age);
}
describe('child-created patterns', () => {
	it.each(['5-7', '8-10'] as ThinkingAgeBand[])('%s respects source limits and Rumi only copies on explicit button presses', (age) => {
		let state = pattern(age, 'rumi');
		expect(state.pattern.source).toHaveLength(playgroundPatternLimit(age)); expect(state.pattern.copy).toEqual([]);
		const snapshot = JSON.stringify(state.pattern.source);
		expect(apply(state, { type: 'PATTERN_COPY' }, age)).toBe(state);
		for (let index = 0; index < playgroundPatternLimit(age); index++) {
			state = apply(state, { type: 'RUMI_NEXT' }, age); expect(state.pattern.copy).toHaveLength(index + 1);
		}
		expect(state.pattern.phase).toBe('matched'); expect(JSON.stringify(state.pattern.source)).toBe(snapshot);
		expect(apply(state, { type: 'RUMI_NEXT' }, age)).toBe(state);
	});
	it('requires two source items and ignores additions beyond the age-band limit', () => {
		let state = initialCreativePlayground(); expect(apply(state, { type: 'PATTERN_START', who: 'rumi' })).toBe(state);
		state = apply(state, { type: 'CHOOSE', token: apple });
		for (let index = 0; index < 4; index++) state = apply(state, { type: 'PATTERN_ADD' });
		expect(apply(state, { type: 'PATTERN_ADD' })).toBe(state); expect(state.pattern.source).toHaveLength(4);
	});
	it('copying together preserves earlier matches on a wrong choice and never chooses automatically', () => {
		let state = pattern('5-7', 'together');
		state = apply(apply(state, { type: 'CHOOSE', token: apple }), { type: 'PATTERN_COPY' });
		expect(state.pattern.copy).toHaveLength(1);
		state = apply(state, { type: 'PATTERN_COPY' });
		expect(state.pattern.copy).toHaveLength(1); expect(state.feedbackKey).toBe('playground.pattern.retry');
		for (const token of [sandwich, apple, sandwich]) state = apply(apply(state, { type: 'CHOOSE', token }), { type: 'PATTERN_COPY' });
		expect(state.pattern.phase).toBe('matched'); expect(state.pattern.copy.map(playgroundTokenKey)).toEqual(state.pattern.source.map(playgroundTokenKey));
	});
	it('editing, removing and clearing patterns keeps the canvas intact', () => {
		let state = place(pattern('5-7', 'rumi'), 0);
		state = apply(state, { type: 'PATTERN_EDIT' }); state = apply(state, { type: 'PATTERN_REMOVE', index: 1 });
		expect(state.pattern.source).toHaveLength(3); expect(state.pattern.copy).toEqual([]);
		state = apply(state, { type: 'PATTERN_CLEAR' }); expect(state.pattern.source).toEqual([]); expect(state.items).toHaveLength(1);
	});
	it('an older draft remains copyable if the chosen age band changes', () => {
		let state = pattern('8-10', 'rumi');
		for (let index = 0; index < 6; index++) state = apply(state, { type: 'RUMI_NEXT' }, '5-7');
		expect(state.pattern.phase).toBe('matched'); expect(state.pattern.copy).toHaveLength(6);
	});
	it('publishes unique bilingual placeholder instructions through the existing catalog', () => {
		expect(new Set(PLAYGROUND_NARRATION.map((entry) => entry.key)).size).toBe(PLAYGROUND_NARRATION.length);
		for (const entry of PLAYGROUND_NARRATION) { expect(getNarration(entry.key)).toEqual(entry); expect(entry.bn).toBeTruthy(); expect(entry.en).toBeTruthy(); expect(entry.status).toBe('placeholder'); }
	});
});
