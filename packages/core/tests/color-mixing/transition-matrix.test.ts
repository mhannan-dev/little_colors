import { describe, expect, it } from 'vitest';
import {
	COLORS,
	createMixingMachine,
	createMixingRound,
	getNarration,
	mixColors,
	RESULT_DISPLAY_MS,
	type Color,
	type Difficulty,
	type MixingEffect,
	type MixingEvent,
	type MixingState
} from '../../src/index.ts';
import { createFakeClock } from '../helpers/fakeClock.ts';

const states: MixingState[] = [
	'READY', 'FIRST_COLOR_SELECTED', 'FIRST_COLOR_APPLIED', 'SECOND_COLOR_SELECTED',
	'MIXING', 'RESULT', 'CELEBRATING', 'COMPLETE'
];

const path: MixingEvent[] = [
	{ type: 'SELECT_COLOR', color: 'red' }, { type: 'POUR_DONE' },
	{ type: 'SELECT_COLOR', color: 'yellow' }, { type: 'POUR_DONE' },
	{ type: 'MIX_DONE' }, { type: 'RESULT_SHOWN' }, { type: 'CELEBRATION_DONE' }
];

function reach(state: MixingState) {
	const clock = createFakeClock(100);
	const machine = createMixingMachine({ offered: ['red', 'yellow'] }, clock);
	for (const event of path.slice(0, states.indexOf(state))) {
		if (event.type === 'RESULT_SHOWN') clock.advanceBy(RESULT_DISPLAY_MS);
		machine.send(event);
	}
	expect(machine.state).toBe(state);
	if (state === 'RESULT') clock.advanceBy(RESULT_DISPLAY_MS);
	const effects: MixingEffect[] = [];
	const notifications: MixingState[] = [];
	machine.onEffect((effect) => effects.push(effect));
	machine.subscribe((next) => notifications.push(next));
	notifications.length = 0;
	return { machine, clock, effects, notifications };
}

const events: { name: string; event: MixingEvent }[] = [
	{ name: 'red', event: { type: 'SELECT_COLOR', color: 'red' } },
	{ name: 'yellow', event: { type: 'SELECT_COLOR', color: 'yellow' } },
	{ name: 'blue (not offered)', event: { type: 'SELECT_COLOR', color: 'blue' } },
	{ name: 'green (not offered)', event: { type: 'SELECT_COLOR', color: 'green' } },
	...(['POUR_DONE', 'MIX_DONE', 'RESULT_SHOWN', 'CELEBRATION_DONE', 'NEXT', 'RESET'] as const)
		.map((type) => ({ name: type, event: { type } }))
];

const destinations: Record<MixingState, Record<string, MixingState>> = {
	READY: { red: 'FIRST_COLOR_SELECTED', yellow: 'FIRST_COLOR_SELECTED' },
	FIRST_COLOR_SELECTED: { POUR_DONE: 'FIRST_COLOR_APPLIED' },
	FIRST_COLOR_APPLIED: { red: 'FIRST_COLOR_APPLIED', yellow: 'SECOND_COLOR_SELECTED' },
	SECOND_COLOR_SELECTED: { POUR_DONE: 'MIXING' },
	MIXING: { MIX_DONE: 'RESULT' },
	RESULT: { RESULT_SHOWN: 'CELEBRATING' },
	CELEBRATING: { CELEBRATION_DONE: 'COMPLETE' },
	COMPLETE: { NEXT: 'READY' }
};

describe('complete state/event matrix (CM-10, CM-11, CM-12, CM-30, CM-36)', () => {
	it.each(states.flatMap((state) => events.map(({ name, event }) => ({ state, name, event }))))(
		'$state / $name',
		({ state, name, event }) => {
			const { machine, effects, notifications } = reach(state);
			const context = machine.context;
			const expected = event.type === 'RESET' ? 'READY' : destinations[state][name];
			expect(machine.send(event)).toBe(expected !== undefined);
			if (expected === undefined) {
				expect(machine.state).toBe(state);
				expect(machine.context).toBe(context);
				expect(effects).toEqual([]);
				expect(notifications).toEqual([]);
			} else {
				expect(machine.state).toBe(expected);
				expect(notifications).toEqual([expected]);
			}
			if (event.type === 'RESET' || (event.type === 'NEXT' && state === 'COMPLETE')) {
				expect(machine.context).toEqual({
					offered: ['red', 'yellow'], target: null, first: null, second: null,
					footballColor: 'white', result: null, resultEnteredAt: null
				});
				expect(effects).toEqual([{ type: event.type === 'RESET' ? 'cancelAll' : 'next' }]);
			}
		}
	);

	it.each(states)('reset() from %s emits cancellation and clears all activity state', (state) => {
		const { machine, effects } = reach(state);
		machine.reset();
		expect(machine.state).toBe('READY');
		expect(machine.context.first).toBeNull();
		expect(machine.context.second).toBeNull();
		expect(machine.context.result).toBeNull();
		expect(machine.context.resultEnteredAt).toBeNull();
		expect(machine.context.footballColor).toBe('white');
		expect(effects).toEqual([{ type: 'cancelAll' }]);
	});

	it('duplicate completion and Next events cannot record progress or advance twice', () => {
		const { machine, effects } = reach('RESULT');
		machine.send({ type: 'RESULT_SHOWN' });
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(false);
		machine.send({ type: 'CELEBRATION_DONE' });
		expect(machine.send({ type: 'CELEBRATION_DONE' })).toBe(false);
		machine.send({ type: 'NEXT' });
		expect(machine.send({ type: 'NEXT' })).toBe(false);
		expect(effects.filter((effect) => effect.type === 'celebrate')).toHaveLength(1);
		expect(effects.filter((effect) => effect.type === 'complete')).toHaveLength(1);
		expect(effects.filter((effect) => effect.type === 'next')).toHaveLength(1);
	});
});

describe('advanced pairs and narration (CM-01 to CM-04, CM-32)', () => {
	const primaries: Color[] = ['red', 'yellow', 'blue'];
	it.each((['orange', 'green', 'purple'] as const).flatMap((target) =>
		primaries.flatMap((first) => primaries.filter((second) => second !== first)
			.map((second) => ({ target, first, second })))
	))('$first + $second with $target target', ({ target, first, second }) => {
		const machine = createMixingMachine({ offered: [...primaries], target }, createFakeClock());
		const effects: MixingEffect[] = [];
		machine.onEffect((effect) => effects.push(effect));
		machine.send({ type: 'SELECT_COLOR', color: first });
		machine.send({ type: 'POUR_DONE' });
		machine.send({ type: 'SELECT_COLOR', color: second });
		machine.send({ type: 'POUR_DONE' });
		machine.send({ type: 'MIX_DONE' });
		const result = mixColors(first, second)!;
		expect(machine.state).toBe(result === target ? 'RESULT' : 'READY');
		expect(machine.context.footballColor).toBe(result === target ? target : 'white');
		expect(machine.context.target).toBe(target);
		if (result !== target) {
			expect(effects.slice(-3).map((effect) => effect.type)).toEqual(['showWrongResult', 'narrate', 'narrate']);
			expect(effects.at(-3)).toEqual({ type: 'showWrongResult', color: result });
			expect(machine.context.first).toBeNull();
			expect(machine.context.second).toBeNull();
			expect(machine.context.result).toBeNull();
			expect(effects.some((effect) => effect.type === 'complete')).toBe(false);
		}
		for (const effect of effects) {
			if (effect.type === 'narrate') expect(getNarration(effect.key), effect.key).toBeDefined();
		}
	});

	it('keeps a defined football color through unsupported pairs in either order', () => {
		for (const first of COLORS) {
			for (const second of COLORS.filter((color) => color !== first)) {
				if (mixColors(first, second) !== null) continue;
				const machine = createMixingMachine({ offered: [first, second] }, createFakeClock());
				const colors: string[] = [];
				machine.subscribe((_, context) => colors.push(context.footballColor));
				machine.send({ type: 'SELECT_COLOR', color: first });
				machine.send({ type: 'POUR_DONE' });
				machine.send({ type: 'SELECT_COLOR', color: second });
				machine.send({ type: 'POUR_DONE' });
				machine.send({ type: 'MIX_DONE' });
				expect(machine.state).toBe('READY');
				expect(colors.every((color) => color === 'white' || COLORS.includes(color as Color))).toBe(true);
			}
		}
	});
});

describe('seeded round gameplay invariants (CP-01, CP-02, QA-03)', () => {
	it.each(['beginner', 'explorer', 'advanced'] as Difficulty[])(
		'%s activities remain playable and correctly narrated across 1,000 seeds',
		(difficulty) => {
			for (let seed = 0; seed < 1000; seed++) {
				const round = createMixingRound(difficulty, seed);
				for (const activity of round.activities) {
					expect(new Set(activity.offered).size).toBe(activity.offered.length);
					expect(activity.offered).toHaveLength(difficulty === 'advanced' ? 3 : 2);
					const possible = activity.offered.flatMap((first) => activity.offered
						.filter((second) => second !== first).map((second) => mixColors(first, second)));
					expect(possible).toContain(activity.expectedOutcome);
					expect(activity.target).toBe(difficulty === 'advanced' ? activity.expectedOutcome : null);
					expect(getNarration(activity.instructionKey)).toBeDefined();
				}
			}
		}
	);
});
