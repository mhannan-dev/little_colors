import { describe, expect, it, vi } from 'vitest';
import { createSessionTimer } from '../../src/session/sessionTimer.ts';
import { createFakeClock } from '../helpers/fakeClock.ts';
import type { Clock } from '../../src/session/Clock.ts';

describe('session timer (SR-01 to SR-07)', () => {
	it('counts active time only, preserves it across pause/resume, and start is idempotent', () => {
		const clock = createFakeClock(); const timer = createSessionTimer(clock);
		clock.advanceBy(1000); expect(timer.activeMs).toBe(0);
		timer.start(); timer.start(); clock.advanceBy(500); expect(timer.activeMs).toBe(500);
		timer.pause(); timer.pause(); clock.advanceBy(10_000); expect(timer.activeMs).toBe(500);
		timer.resume(); clock.advanceBy(300); expect(timer.activeMs).toBe(800);
	});
	it('fires once at the exact threshold and never loops on resume or settings changes', () => {
		const clock = createFakeClock(); const timer = createSessionTimer(clock, 10); const listener = vi.fn(); timer.onThreshold(listener);
		timer.start(); clock.advanceBy(599_999); expect(listener).not.toHaveBeenCalled();
		clock.advanceBy(1); expect(listener).toHaveBeenCalledTimes(1);
		clock.advanceBy(600_000); timer.pause(); timer.resume(); timer.setThresholdMinutes(15); clock.advanceBy(600_000);
		expect(listener).toHaveBeenCalledTimes(1);
	});
	it('reset clears accumulated time and stops; a new game session can fire again', () => {
		const clock = createFakeClock(); const timer = createSessionTimer(clock, 10); const listener = vi.fn(); timer.onThreshold(listener);
		timer.start(); clock.advanceBy(600_000); timer.reset(); expect(timer.activeMs).toBe(0);
		clock.advanceBy(600_000); expect(timer.activeMs).toBe(0); expect(listener).toHaveBeenCalledTimes(1);
		timer.start(); clock.advanceBy(600_000); expect(listener).toHaveBeenCalledTimes(2);
	});
	it('off disables callbacks while active time still accumulates; enabling uses elapsed active time', () => {
		const clock = createFakeClock(); const timer = createSessionTimer(clock, 0); const listener = vi.fn(); timer.onThreshold(listener);
		timer.start(); clock.advanceBy(3_600_000); expect(listener).not.toHaveBeenCalled();
		timer.setThresholdMinutes(20); clock.advanceBy(0); expect(listener).toHaveBeenCalledTimes(1);
	});
	it('changing the threshold reschedules the remaining time and off cancels it', () => {
		const clock = createFakeClock(); const timer = createSessionTimer(clock, 20); const listener = vi.fn(); timer.onThreshold(listener);
		timer.start(); clock.advanceBy(300_000); timer.setThresholdMinutes(10); clock.advanceBy(299_999); expect(listener).not.toHaveBeenCalled();
		timer.setThresholdMinutes(0); clock.advanceBy(1_000_000); expect(listener).not.toHaveBeenCalled();
	});
	it('never keeps more than one scheduled callback and disposal cancels it', () => {
		const base = createFakeClock(); let pending = 0, peak = 0;
		const clock: Clock = { now: base.now, setTimeout(fn, delay) {
			pending++; peak = Math.max(peak, pending); let live = true;
			const off = base.setTimeout(() => { if (live) { live = false; pending--; } fn(); }, delay);
			return () => { if (live) { live = false; pending--; } off(); };
		} };
		const timer = createSessionTimer(clock); timer.start(); timer.start(); timer.resume(); timer.setThresholdMinutes(15); timer.pause(); timer.resume();
		expect(peak).toBe(1); expect(pending).toBe(1); timer.dispose(); expect(pending).toBe(0);
	});
	it('ignores a stale callback after cancellation even if the platform delivers it', () => {
		const base = createFakeClock(); const callbacks: (() => void)[] = [];
		const clock: Clock = { now: base.now, setTimeout(fn) { callbacks.push(fn); return () => {}; } };
		const timer = createSessionTimer(clock, 10); const listener = vi.fn(); timer.onThreshold(listener);
		timer.start(); base.advanceBy(600_000); timer.pause(); callbacks[0]!(); expect(listener).not.toHaveBeenCalled();
		timer.resume(); callbacks[1]!(); expect(listener).toHaveBeenCalledTimes(1);
	});
	it('supports independent subscriptions and idempotent cleanup', () => {
		const clock = createFakeClock(); const timer = createSessionTimer(clock, 10); const listener = vi.fn();
		const off = timer.onThreshold(listener); timer.onThreshold(listener); off(); off();
		timer.start(); clock.advanceBy(600_000); expect(listener).toHaveBeenCalledTimes(1);
	});
	it.each([-1, 1, 12, 65, NaN, Infinity])('rejects invalid threshold %s', (value) => {
		const clock = createFakeClock(); expect(() => createSessionTimer(clock, value)).toThrow(RangeError);
		expect(() => createSessionTimer(clock).setThresholdMinutes(value)).toThrow(RangeError);
	});
});
