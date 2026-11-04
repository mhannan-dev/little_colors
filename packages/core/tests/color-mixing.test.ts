import { describe, expect, it } from 'vitest';
import {
	COLORS,
	createMixingMachine,
	mixColors,
	recipeKey,
	type Color,
	type MixingEffect
} from '../src/index.ts';
import { createFakeClock } from './helpers/fakeClock.ts';

describe('mixColors (CM-01..CM-04)', () => {
	it.each([
		['red', 'yellow', 'orange'],
		['yellow', 'blue', 'green'],
		['red', 'blue', 'purple']
	] as [Color, Color, Color][])('%s + %s = %s in both orders', (a, b, r) => {
		expect(mixColors(a, b)).toBe(r);
		expect(mixColors(b, a)).toBe(r);
	});

	it('returns null for unsupported pairs and same color twice', () => {
		for (const a of COLORS) {
			for (const b of COLORS) {
				const supported =
					(a !== b && ['red', 'yellow', 'blue'].includes(a) && ['red', 'yellow', 'blue'].includes(b));
				if (!supported) expect(mixColors(a, b)).toBeNull();
			}
		}
	});
});

function setup(offered: Color[] = ['red', 'yellow'], target: Color | null = null) {
	const clock = createFakeClock();
	const m = createMixingMachine({ offered, target }, clock);
	const effects: MixingEffect[] = [];
	m.onEffect((e) => effects.push(e));
	return { m, effects, clock };
}

function playToComplete(m: ReturnType<typeof createMixingMachine>, a: Color, b: Color, clock: ReturnType<typeof createFakeClock>) {
	m.send({ type: 'SELECT_COLOR', color: a });
	m.send({ type: 'POUR_DONE' });
	m.send({ type: 'SELECT_COLOR', color: b });
	m.send({ type: 'POUR_DONE' });
	m.send({ type: 'MIX_DONE' });
	clock.advanceBy(1500);
	m.send({ type: 'RESULT_SHOWN' });
	m.send({ type: 'CELEBRATION_DONE' });
}

describe('mixing machine transition table', () => {
	it('READY → FIRST_COLOR_SELECTED on an offered color, with pour effect', () => {
		const { m, effects } = setup();
		expect(m.send({ type: 'SELECT_COLOR', color: 'red' })).toBe(true);
		expect(m.state).toBe('FIRST_COLOR_SELECTED');
		expect(m.context.first).toBe('red');
		expect(effects).toEqual([{ type: 'pour', color: 'red' }]);
	});

	it('ignores colors that are not offered', () => {
		const { m } = setup();
		expect(m.send({ type: 'SELECT_COLOR', color: 'blue' })).toBe(false);
		expect(m.state).toBe('READY');
	});

	it('POUR_DONE applies the first color and narrates it', () => {
		const { m, effects } = setup();
		m.send({ type: 'SELECT_COLOR', color: 'red' });
		m.send({ type: 'POUR_DONE' });
		expect(m.state).toBe('FIRST_COLOR_APPLIED');
		expect(m.context.footballColor).toBe('red');
		expect(effects.at(-1)).toEqual({ type: 'narrate', key: 'color.red' });
	});

	it('ignores repeated taps while pouring (CM-12)', () => {
		const { m } = setup();
		m.send({ type: 'SELECT_COLOR', color: 'red' });
		expect(m.send({ type: 'SELECT_COLOR', color: 'yellow' })).toBe(false);
		expect(m.send({ type: 'SELECT_COLOR', color: 'red' })).toBe(false);
		expect(m.state).toBe('FIRST_COLOR_SELECTED');
	});

	it('same color again stays in FIRST_COLOR_APPLIED and wiggles the other container', () => {
		const { m, effects } = setup();
		m.send({ type: 'SELECT_COLOR', color: 'red' });
		m.send({ type: 'POUR_DONE' });
		m.send({ type: 'SELECT_COLOR', color: 'red' });
		expect(m.state).toBe('FIRST_COLOR_APPLIED');
		expect(m.context.second).toBeNull();
		expect(effects.at(-1)).toEqual({ type: 'wiggle', color: 'yellow' });
	});

	it('runs the full happy path to COMPLETE with the right effects', () => {
		const { m, effects, clock } = setup();
		playToComplete(m, 'red', 'yellow', clock);
		expect(m.state).toBe('COMPLETE');
		expect(m.context.footballColor).toBe('orange');
		expect(effects.map((e) => e.type)).toEqual([
			'pour',
			'narrate',
			'pour',
			'mix',
			'narrate',
			'celebrate',
			'complete'
		]);
		expect(effects).toContainEqual({ type: 'narrate', key: 'mix.result.red-yellow' });
		expect(effects.at(-1)).toEqual({ type: 'complete', result: 'orange' });
	});

	it('is order independent (CM-02)', () => {
		const { m, clock } = setup();
		playToComplete(m, 'yellow', 'red', clock);
		expect(m.context.footballColor).toBe('orange');
	});

	it('NEXT from COMPLETE returns to a fresh READY', () => {
		const { m, effects, clock } = setup();
		playToComplete(m, 'red', 'yellow', clock);
		m.send({ type: 'NEXT' });
		expect(m.state).toBe('READY');
		expect(m.context.footballColor).toBe('white');
		expect(m.context.first).toBeNull();
		expect(effects.at(-1)).toEqual({ type: 'next' });
	});

	it('ignores events not listed for the current state (CM-10)', () => {
		const { m } = setup();
		for (const type of ['POUR_DONE', 'MIX_DONE', 'RESULT_SHOWN', 'CELEBRATION_DONE', 'NEXT'] as const) {
			expect(m.send({ type })).toBe(false);
		}
		expect(m.state).toBe('READY');
	});

	it('RESET from every state returns to READY with a white football (CM-36)', () => {
		const steps = [
			(m: ReturnType<typeof createMixingMachine>) => m.send({ type: 'SELECT_COLOR', color: 'red' }),
			(m: ReturnType<typeof createMixingMachine>) => m.send({ type: 'POUR_DONE' }),
			(m: ReturnType<typeof createMixingMachine>) => m.send({ type: 'SELECT_COLOR', color: 'yellow' }),
			(m: ReturnType<typeof createMixingMachine>) => m.send({ type: 'POUR_DONE' }),
			(m: ReturnType<typeof createMixingMachine>) => m.send({ type: 'MIX_DONE' }),
			(m: ReturnType<typeof createMixingMachine>, clock: ReturnType<typeof createFakeClock>) => {
				clock.advanceBy(1500);
				return m.send({ type: 'RESULT_SHOWN' });
			},
			(m: ReturnType<typeof createMixingMachine>) => m.send({ type: 'CELEBRATION_DONE' })
		];
		for (let n = 0; n <= steps.length; n++) {
			const { m, effects, clock } = setup();
			steps.slice(0, n).forEach((s) => s(m, clock));
			m.send({ type: 'RESET' });
			expect(m.state).toBe('READY');
			expect(m.context.footballColor).toBe('white');
			expect(m.context.first).toBeNull();
			expect(m.context.offered).toEqual(['red', 'yellow']);
			expect(effects.at(-1)).toEqual({ type: 'cancelAll' });
		}
	});

	it('unsupported mix returns to READY with a retry narration (CM-32)', () => {
		const { m, effects } = setup(['red', 'green']);
		m.send({ type: 'SELECT_COLOR', color: 'red' });
		m.send({ type: 'POUR_DONE' });
		m.send({ type: 'SELECT_COLOR', color: 'green' });
		m.send({ type: 'POUR_DONE' });
		expect(m.state).toBe('MIXING');
		m.send({ type: 'MIX_DONE' });
		expect(m.state).toBe('READY');
		expect(m.context.footballColor).toBe('white');
		expect(effects.at(-1)).toEqual({ type: 'narrate', key: 'mix.retry' });
	});
});

describe('advanced target mode', () => {
	it('correct pair reaches RESULT', () => {
		const { m } = setup(['red', 'yellow', 'blue'], 'green');
		m.send({ type: 'SELECT_COLOR', color: 'blue' });
		m.send({ type: 'POUR_DONE' });
		m.send({ type: 'SELECT_COLOR', color: 'yellow' });
		m.send({ type: 'POUR_DONE' });
		m.send({ type: 'MIX_DONE' });
		expect(m.state).toBe('RESULT');
		expect(m.context.footballColor).toBe('green');
	});

	it('wrong pair shows its real result, then invites another try', () => {
		const { m, effects } = setup(['red', 'yellow', 'blue'], 'green');
		m.send({ type: 'SELECT_COLOR', color: 'red' });
		m.send({ type: 'POUR_DONE' });
		m.send({ type: 'SELECT_COLOR', color: 'blue' });
		m.send({ type: 'POUR_DONE' });
		m.send({ type: 'MIX_DONE' });
		expect(m.state).toBe('READY');
		expect(m.context.target).toBe('green');
		expect(effects.slice(-3)).toEqual([
			{ type: 'showWrongResult', color: 'purple' },
			{ type: 'narrate', key: 'mix.result.blue-red' },
			{ type: 'narrate', key: 'mix.target.green' }
		]);
	});
});

describe('recipeKey', () => {
	it('is sorted and order independent', () => {
		expect(recipeKey('yellow', 'red')).toBe('red-yellow');
		expect(recipeKey('red', 'blue')).toBe('blue-red');
	});
});
