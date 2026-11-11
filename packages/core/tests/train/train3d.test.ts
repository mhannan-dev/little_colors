import { describe, expect, it } from 'vitest';
import {
	allJobsDone,
	arriveSpeed,
	createFarmDay,
	createSorterRound,
	createTrainTrip,
	fits,
	freshProgress,
	getNarration,
	jobDone,
	MAX_RIDERS,
	NARRATION_CATALOG,
	seatFor,
	suggestedJob,
	wagonsFor,
	type FarmJob
} from '../../src/index.ts';

describe("Rumi's Train", () => {
	it('three stations, each its own colour and number, with a few friends of one kind', () => {
		for (let seed = 1; seed < 30; seed++) {
			for (const level of ['beginner', 'explorer', 'advanced'] as const) {
				const trip = createTrainTrip(level, seed);
				expect(trip).toHaveLength(3);
				expect(new Set(trip.map((s) => s.color)).size).toBe(3);
				expect(new Set(trip.map((s) => s.number)).size).toBe(3);
				for (const s of trip) {
					expect(s.riders.length).toBeGreaterThanOrEqual(1);
					expect(s.riders.length).toBeLessThanOrEqual(MAX_RIDERS[level]);
					expect(new Set(s.riders).size).toBe(1);
					expect(getNarration(`rail.color.${s.color}`)).toBeDefined();
					expect(getNarration(`rail.rider.${s.riders[0]}`)).toBeDefined();
				}
				// There is always a seat for everyone.
				const total = trip.reduce((n, s) => n + s.riders.length, 0);
				expect(wagonsFor(trip) * 3).toBeGreaterThanOrEqual(total);
			}
		}
		expect(seatFor(4)).toEqual({ wagon: 1, seat: 1 });
	});

	it('arrives gently: slows down to stop right at the platform', () => {
		expect(arriveSpeed(100, 6)).toBe(6);
		expect(arriveSpeed(1, 6)).toBeLessThan(3);
		expect(arriveSpeed(0, 6)).toBe(0);
		expect(arriveSpeed(-2, 6)).toBe(0);
	});
});

describe("Rumi's Farm", () => {
	it('jobs can be done in any order; Rumi suggests the first one not done', () => {
		const day = createFarmDay('explorer', 7);
		for (const n of [day.eggs, day.ducks, day.mangoes]) {
			expect(n).toBeGreaterThanOrEqual(2);
			expect(n).toBeLessThanOrEqual(4);
		}
		const p = freshProgress();
		expect(suggestedJob(day, p)).toBe('cow');
		p.mangoes = day.mangoes;
		expect(jobDone(day, p, 'mangoes')).toBe(true);
		expect(suggestedJob(day, p)).toBe('cow');
		p.cow = 1;
		expect(suggestedJob(day, p)).toBe('eggs');
		for (const j of ['eggs', 'ducks'] as FarmJob[]) p[j] = day[j as 'eggs' | 'ducks'];
		expect(allJobsDone(day, p)).toBe(true);
		expect(suggestedJob(day, p)).toBeNull();
	});
});

describe('Shape Sorter', () => {
	it('every hole has a piece, only matching shapes fit', () => {
		for (let seed = 1; seed < 30; seed++) {
			for (const [level, h, n] of [['beginner', 3, 4], ['explorer', 4, 6], ['advanced', 5, 8]] as const) {
				const r = createSorterRound(level, seed);
				expect(r.holes).toHaveLength(h);
				expect(r.pieces).toHaveLength(n);
				for (const hole of r.holes) expect(r.pieces.some((p) => p.shape === hole)).toBe(true);
				for (const p of r.pieces) expect(r.holes).toContain(p.shape);
			}
		}
		expect(createSorterRound('beginner', 3).holes.sort()).toEqual(['circle', 'square', 'triangle']);
		expect(fits('star', 'star')).toBe(true);
		expect(fits('star', 'heart')).toBe(false);
	});

	it('all lines are in the catalog with unique keys', () => {
		for (const k of ['mode.rail', 'mode.farm', 'mode.sorter', 'farm.sound.cow', 'sorter.is.heart', 'sorter.hole.star', 'rail.scene.bridge']) expect(getNarration(k), k).toBeDefined();
		const keys = NARRATION_CATALOG.map((e) => e.key);
		expect(keys.length).toBe(new Set(keys).size);
	});
});
