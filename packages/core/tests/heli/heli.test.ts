import { describe, expect, it } from 'vitest';
import {
	clearance,
	createHeliDay,
	floorAt,
	freshHeli,
	getNarration,
	HELI,
	HELI_OBSTACLES,
	HELI_PADS,
	NARRATION_CATALOG,
	nearPad,
	stepHeli,
	type HeliInput,
	type HeliState
} from '../../src/index.ts';

const fly = (s: HeliState, input: HeliInput, seconds: number) => {
	let minClear = Infinity;
	let minY = Infinity;
	for (let t = 0; t < seconds; t += 1 / 60) {
		s = stepHeli(s, input, 1 / 60);
		minClear = Math.min(minClear, clearance(s));
		minY = Math.min(minY, s.y);
	}
	return { s, minClear, minY };
};

describe("Rumi's Helicopter", () => {
	it('hold up to rise, let go to float down softly onto the ground', () => {
		let { s } = fly(freshHeli(), { up: true, x: 0 }, 3);
		expect(s.y).toBeGreaterThan(6);
		({ s } = fly(s, { up: false, x: 0 }, 12));
		expect(s.y).toBeCloseTo(HELI.ground, 1);
		expect(s.vy).toBe(0);
		({ s } = fly(s, { up: true, x: 0 }, 20));
		expect(s.y).toBeLessThanOrEqual(HELI.maxY);
	});

	it('can never crash: flying low across the whole world lifts over every tree and hill', () => {
		for (const dir of [1, -1] as const) {
			const start = dir > 0 ? freshHeli(HELI.minX) : freshHeli(HELI.maxX);
			const { s, minClear, minY } = fly(start, { up: false, x: dir }, 40);
			expect(minClear).toBeGreaterThan(0);
			expect(minY).toBeGreaterThanOrEqual(HELI.ground);
			expect(s.x).toBe(dir > 0 ? HELI.maxX : HELI.minX);
		}
		for (const o of HELI_OBSTACLES) expect(floorAt(o.x)).toBeGreaterThan(o.top);
	});

	it('lands by itself near a pad when low, not when high above it', () => {
		expect(nearPad({ ...freshHeli(HELI_PADS[0]), y: 2 }, HELI_PADS[0])).toBe(true);
		expect(nearPad({ ...freshHeli(HELI_PADS[0] + 2), y: 3 }, HELI_PADS[0])).toBe(true);
		expect(nearPad({ ...freshHeli(HELI_PADS[0]), y: 12 }, HELI_PADS[0])).toBe(false);
		expect(nearPad({ ...freshHeli(HELI_PADS[0] + 8), y: 2 }, HELI_PADS[0])).toBe(false);
	});

	it('a day of jobs: unique pad colours and numbers, never the same pad twice in a row', () => {
		for (let seed = 1; seed < 40; seed++) {
			for (const level of ['beginner', 'explorer', 'advanced'] as const) {
				const { pads, jobs } = createHeliDay(level, seed);
				expect(new Set(pads.map((p) => p.color)).size).toBe(4);
				expect(new Set(pads.map((p) => p.number)).size).toBe(4);
				expect(jobs).toHaveLength(level === 'beginner' ? 3 : 4);
				jobs.forEach((j, i) => {
					if (i > 0) expect(j.pad).not.toBe(jobs[i - 1]!.pad);
					if (j.cargo === 'friend') expect(j.pad).toBe(2);
					expect(j.color).toBe(pads[j.pad]!.color);
					expect(getNarration(`heli.cargo.${j.cargo}`)).toBeDefined();
					expect(getNarration(`heli.color.${j.color}`)).toBeDefined();
				});
			}
		}
	});

	it('lines are in the catalog with unique keys', () => {
		expect(getNarration('mode.heli')).toBeDefined();
		const keys = NARRATION_CATALOG.map((e) => e.key);
		expect(keys.length).toBe(new Set(keys).size);
	});
});
