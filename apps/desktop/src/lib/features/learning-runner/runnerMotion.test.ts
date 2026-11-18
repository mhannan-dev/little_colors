import { describe, expect, it } from 'vitest';
import { RunnerMotion } from './runnerMotion.ts';
import { DISCOVERY_STOPS } from './reference/course.ts';

describe('child-friendly runner obstacles', () => {
	it('waits safely for a jump and then for a slide without losing progress', () => {
		const runner = new RunnerMotion();
		const advance = (seconds: number) => {
			for (let i = 0; i < seconds * 60; i++) runner.step(1 / 60, 62, false, false);
		};
		advance(4);
		expect(runner.waiting?.kind).toBe('log');
		expect(runner.distance).toBe(19);
		runner.slide();
		advance(1);
		expect(runner.waiting?.kind).toBe('log');
		runner.jump();
		advance(3);
		expect(runner.waiting?.kind).toBe('branch');
		expect(runner.distance).toBe(43);
		runner.slide();
		advance(2);
		expect(runner.distance).toBe(62);
		expect(runner.waiting).toBeNull();
	});

	it('assistance crosses the complete mountain course and resets for replay', () => {
		const runner = new RunnerMotion();
		for (const stop of DISCOVERY_STOPS) {
			let arrived = false;
			for (let i = 0; i < 6000 && !arrived; i++) arrived = runner.step(1 / 60, stop + 5, true, false);
			expect(arrived).toBe(true);
		}
		runner.reset();
		expect(runner.distance).toBe(0);
		expect(runner.height).toBe(0);
		expect(runner.sliding).toBe(false);
		for (let i = 0; i < 200; i++) runner.step(1 / 60, 62, false, false);
		expect(runner.waiting?.kind).toBe('log');
	});

	it('reduced motion goes straight to the learning stop', () => {
		const runner = new RunnerMotion();
		runner.jump();
		expect(runner.step(1 / 60, 62, false, true)).toBe(true);
		expect(runner.distance).toBe(62);
		expect(runner.waiting).toBeNull();
	});
});
