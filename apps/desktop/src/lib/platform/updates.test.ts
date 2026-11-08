import { describe, expect, it } from 'vitest';
import { CHECK_EVERY_MS, dueForCheck } from './updates.ts';

describe('when to look for an update', () => {
	const now = 1_800_000_000_000;
	it('never without internet', () => {
		expect(dueForCheck(null, now, false)).toBe(false);
		expect(dueForCheck(now - 10 * CHECK_EVERY_MS, now, false)).toBe(false);
	});
	it('first time, or when the last check is old', () => {
		expect(dueForCheck(null, now, true)).toBe(true);
		expect(dueForCheck(now - CHECK_EVERY_MS, now, true)).toBe(true);
	});
	it('not again soon after a check', () => {
		expect(dueForCheck(now - 60_000, now, true)).toBe(false);
	});
	it('a clock that went back or a broken value does not block updates forever', () => {
		expect(dueForCheck(now + 5 * CHECK_EVERY_MS, now, true)).toBe(true);
		expect(dueForCheck(Number.NaN, now, true)).toBe(true);
	});
});
