import { describe, expect, it } from 'vitest';
import { createFakeClock } from './helpers/fakeClock.ts';

describe('fake clock (QA-02, AR-08)', () => {
	it('runs only due callbacks at their deadlines and finishes at the requested time', () => {
		const clock = createFakeClock(100);
		const calls: number[] = [];
		clock.setTimeout(() => calls.push(clock.now()), 20);
		clock.setTimeout(() => calls.push(clock.now()), 10);
		clock.advanceBy(9);
		expect(calls).toEqual([]);
		clock.advanceBy(16);
		expect(calls).toEqual([110, 120]);
		expect(clock.now()).toBe(125);
	});

	it('supports cancellation, including cancellation from another callback', () => {
		const clock = createFakeClock();
		const calls: string[] = [];
		clock.setTimeout(() => cancel(), 5);
		const cancel = clock.setTimeout(() => calls.push('cancelled'), 10);
		clock.advanceBy(20);
		cancel();
		cancel();
		expect(calls).toEqual([]);
	});

	it('runs equal deadlines in insertion order, including newly scheduled zero-delay timers', () => {
		const clock = createFakeClock();
		const calls: number[] = [];
		clock.setTimeout(() => {
			calls.push(1);
			clock.setTimeout(() => calls.push(3), 0);
		}, 0);
		clock.setTimeout(() => calls.push(2), 0);
		clock.advanceBy(0);
		expect(calls).toEqual([1, 2, 3]);
	});

	it('runs nested timers that become due within the same advance exactly once', () => {
		const clock = createFakeClock();
		const calls: number[] = [];
		clock.setTimeout(() => {
			calls.push(clock.now());
			clock.setTimeout(() => calls.push(clock.now()), 5);
		}, 10);
		clock.advanceBy(20);
		clock.advanceBy(20);
		expect(calls).toEqual([10, 15]);
	});

	it('rejects invalid starts, delays, and advances', () => {
		expect(() => createFakeClock(Infinity)).toThrow(RangeError);
		const clock = createFakeClock();
		for (const value of [-1, NaN, Infinity]) {
			expect(() => clock.setTimeout(() => {}, value)).toThrow(RangeError);
			expect(() => clock.advanceBy(value)).toThrow(RangeError);
		}
		expect(clock.now()).toBe(0);
	});
});
