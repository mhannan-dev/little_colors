import { describe, expect, it, vi } from 'vitest';
import { createMixingMachine, type MixingEffect, type MixingMachine } from '../../src/index.ts';
import { createFakeClock } from '../helpers/fakeClock.ts';

function makeMachine() {
	const clock = createFakeClock();
	const machine = createMixingMachine({ offered: ['red', 'yellow'] }, clock);
	const effects: MixingEffect[] = [];
	machine.onEffect((effect) => effects.push(effect));
	return { machine, clock, effects };
}

function reachResult(machine: MixingMachine) {
	machine.send({ type: 'SELECT_COLOR', color: 'red' });
	machine.send({ type: 'POUR_DONE' });
	machine.send({ type: 'SELECT_COLOR', color: 'yellow' });
	machine.send({ type: 'POUR_DONE' });
	machine.send({ type: 'MIX_DONE' });
}

describe('mixing lifecycle regressions (CM-10, CM-13, CM-14, CM-32, CM-36)', () => {
	it('preserves the one-argument factory while enforcing the display guard', () => {
		const clock = createFakeClock();
		const now = vi.spyOn(Date, 'now').mockImplementation(clock.now);
		try {
			const machine = createMixingMachine({ offered: ['red', 'yellow'] });
			reachResult(machine);
			expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(false);
			clock.advanceBy(1500);
			expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(true);
		} finally {
			now.mockRestore();
		}
	});

	it('ignores RESULT_SHOWN until exactly 1.5 seconds after entering RESULT', () => {
		const { machine, clock, effects } = makeMachine();
		reachResult(machine);
		const context = machine.context;
		const count = effects.length;
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(false);
		clock.advanceBy(1499);
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(false);
		expect(machine.state).toBe('RESULT');
		expect(machine.context).toBe(context);
		expect(effects).toHaveLength(count);
		clock.advanceBy(1);
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(true);
		expect(machine.state).toBe('CELEBRATING');
	});

	it('measures the result display time from MIX_DONE rather than machine creation', () => {
		const { machine, clock } = makeMachine();
		clock.advanceBy(10_000);
		reachResult(machine);
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(false);
		clock.advanceBy(1500);
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(true);
	});

	it('starts a fresh display interval after RESET and ignores old completion events', () => {
		const { machine, clock } = makeMachine();
		reachResult(machine);
		clock.advanceBy(1500);
		machine.send({ type: 'RESET' });
		for (const type of ['POUR_DONE', 'MIX_DONE', 'RESULT_SHOWN', 'CELEBRATION_DONE'] as const) {
			expect(machine.send({ type })).toBe(false);
		}
		reachResult(machine);
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(false);
		clock.advanceBy(1500);
		expect(machine.send({ type: 'RESULT_SHOWN' })).toBe(true);
	});

	it('reset() cancels effects just like the RESET event', () => {
		const { machine, effects } = makeMachine();
		machine.send({ type: 'SELECT_COLOR', color: 'red' });
		machine.reset();
		expect(machine.state).toBe('READY');
		expect(machine.context.footballColor).toBe('white');
		expect(effects.at(-1)).toEqual({ type: 'cancelAll' });
	});

	it('does not let caller setup mutations change future resets', () => {
		const setup = { offered: ['red', 'yellow'] as ('red' | 'yellow' | 'blue')[], target: null };
		const machine = createMixingMachine(setup, createFakeClock());
		setup.offered.splice(0, 2, 'blue');
		machine.reset();
		expect(machine.context.offered).toEqual(['red', 'yellow']);
		expect(machine.send({ type: 'SELECT_COLOR', color: 'blue' })).toBe(false);
	});

	it('emits a mix effect for unsupported pairs so an effect driver can send MIX_DONE', () => {
		const machine = createMixingMachine({ offered: ['red', 'green'] }, createFakeClock());
		const effects: MixingEffect[] = [];
		machine.onEffect((effect) => effects.push(effect));
		machine.send({ type: 'SELECT_COLOR', color: 'red' });
		machine.send({ type: 'POUR_DONE' });
		machine.send({ type: 'SELECT_COLOR', color: 'green' });
		machine.send({ type: 'POUR_DONE' });
		expect(machine.state).toBe('MIXING');
		expect(effects.at(-1)).toEqual({ type: 'mix', from: 'red', to: 'red' });
		machine.send({ type: 'MIX_DONE' });
		expect(machine.state).toBe('READY');
		expect(machine.context.footballColor).toBe('white');
		expect(effects.at(-1)).toEqual({ type: 'narrate', key: 'mix.retry' });
	});

	it('reaches COMPLETE without waiting for any audio acknowledgement', () => {
		const { machine, clock, effects } = makeMachine();
		reachResult(machine);
		clock.advanceBy(1500);
		machine.send({ type: 'RESULT_SHOWN' });
		expect(effects).toContainEqual({ type: 'celebrate' });
		machine.send({ type: 'CELEBRATION_DONE' });
		expect(machine.state).toBe('COMPLETE');
		expect(effects.at(-1)).toEqual({ type: 'complete', result: 'orange' });
	});
});
