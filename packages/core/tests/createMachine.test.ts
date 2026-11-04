import { describe, expect, it, vi } from 'vitest';
import { createMachine } from '../src/fsm/createMachine.ts';

type State = 'idle' | 'selected' | 'complete';
type Event = { type: 'SELECT'; value: number } | { type: 'FINISH' } | { type: 'UNKNOWN' };
interface Context { values: number[] }

function makeMachine() {
	return createMachine<State, Event, Context>({
		initialState: 'idle',
		initialContext: () => ({ values: [] }),
		transitions: {
			idle: {
				SELECT: {
					target: 'selected',
					guard: (_, event) => event.value > 0,
					reduce: (context, event) => ({ values: [...context.values, event.value] })
				}
			},
			selected: { FINISH: { target: 'complete' } }
		}
	});
}

describe('createMachine (AR-06, architecture acceptance)', () => {
	it('starts in the configured state and publishes an immediate subscription snapshot', () => {
		const machine = makeMachine();
		const listener = vi.fn();
		machine.subscribe(listener);
		expect(machine.state).toBe('idle');
		expect(machine.context).toEqual({ values: [] });
		expect(listener).toHaveBeenCalledExactlyOnceWith('idle', { values: [] });
	});

	it('applies a typed event reducer before notifying, then preserves context without a reducer', () => {
		const machine = makeMachine();
		const listener = vi.fn();
		machine.subscribe(listener);
		machine.send({ type: 'SELECT', value: 3 });
		expect(machine.state).toBe('selected');
		expect(listener).toHaveBeenLastCalledWith('selected', { values: [3] });
		const context = machine.context;
		machine.send({ type: 'FINISH' });
		expect(machine.state).toBe('complete');
		expect(machine.context).toBe(context);
	});

	it('ignores unlisted events, including events valid only in another state', () => {
		const machine = makeMachine();
		const listener = vi.fn();
		machine.subscribe(listener);
		const context = machine.context;
		machine.send({ type: 'FINISH' });
		machine.send({ type: 'UNKNOWN' });
		expect(machine.state).toBe('idle');
		expect(machine.context).toBe(context);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('leaves state, context, and subscriptions untouched when a guard rejects input', () => {
		const machine = makeMachine();
		const listener = vi.fn();
		machine.subscribe(listener);
		machine.send({ type: 'SELECT', value: 0 });
		expect(machine.state).toBe('idle');
		expect(machine.context.values).toEqual([]);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('resets with a fresh context and notifies existing subscribers', () => {
		const machine = makeMachine();
		const initial = machine.context;
		const listener = vi.fn();
		machine.subscribe(listener);
		machine.send({ type: 'SELECT', value: 2 });
		machine.reset();
		expect(machine.state).toBe('idle');
		expect(machine.context).toEqual({ values: [] });
		expect(machine.context).not.toBe(initial);
		expect(listener).toHaveBeenLastCalledWith('idle', { values: [] });
	});

	it('unsubscribes idempotently and keeps other subscriptions active', () => {
		const machine = makeMachine();
		const stopped = vi.fn();
		const active = vi.fn();
		const unsubscribe = machine.subscribe(stopped);
		machine.subscribe(active);
		unsubscribe();
		unsubscribe();
		machine.send({ type: 'SELECT', value: 1 });
		machine.reset();
		expect(stopped).toHaveBeenCalledTimes(1);
		expect(active).toHaveBeenCalledTimes(3);
	});

	it('treats two subscriptions with the same callback independently', () => {
		const machine = makeMachine();
		const listener = vi.fn();
		const unsubscribe = machine.subscribe(listener);
		machine.subscribe(listener);
		unsubscribe();
		machine.send({ type: 'SELECT', value: 1 });
		expect(listener).toHaveBeenCalledTimes(3);
	});

	it('keeps state and mutable context isolated across instances', () => {
		const first = makeMachine();
		const second = makeMachine();
		first.send({ type: 'SELECT', value: 5 });
		expect(second.state).toBe('idle');
		expect(second.context.values).toEqual([]);
		expect(first.context).not.toBe(second.context);
	});

	it('supports same-state transitions that update context', () => {
		const machine = createMachine<'idle', { type: 'ADD' }, number>({
			initialState: 'idle', initialContext: () => 0,
			transitions: { idle: { ADD: { target: 'idle', reduce: (count) => count + 1 } } }
		});
		machine.send({ type: 'ADD' });
		expect(machine.state).toBe('idle');
		expect(machine.context).toBe(1);
	});

	it('does not partially transition if a reducer throws', () => {
		const machine = createMachine<'idle' | 'done', { type: 'FAIL' }, number>({
			initialState: 'idle', initialContext: () => 0,
			transitions: { idle: { FAIL: { target: 'done', reduce: () => { throw new Error('failed'); } } } }
		});
		expect(() => machine.send({ type: 'FAIL' })).toThrow('failed');
		expect(machine.state).toBe('idle');
		expect(machine.context).toBe(0);
	});
});
