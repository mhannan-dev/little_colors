import { describe, expect, it } from 'vitest';
import {
	assistSpeed,
	createHighwayRng,
	gearFor,
	getNarration,
	HIGHWAY_LANES,
	laneIsClear,
	leadIn,
	MAX_SPEED,
	MIN_GAP,
	NARRATION_CATALOG,
	nextSpeed,
	passedKey,
	passKey,
	spawnVehicle,
	VEHICLE_KINDS,
	type TrafficVehicle
} from '../../src/index.ts';

describe("Rumi's Highway driving model", () => {
	it('gas speeds up to the max, brake stops, no pedal drifts back to cruising', () => {
		let s = 0;
		for (let i = 0; i < 400; i++) s = nextSpeed(s, { gas: true, brake: false }, 0.05);
		expect(s).toBe(MAX_SPEED);
		for (let i = 0; i < 400; i++) s = nextSpeed(s, { gas: false, brake: true }, 0.05);
		expect(s).toBe(0);
		for (let i = 0; i < 400; i++) s = nextSpeed(s, { gas: false, brake: false }, 0.05);
		expect(s).toBeGreaterThan(30);
		expect(s).toBeLessThan(40);
	});

	it('gears climb with speed, 1 to 6', () => {
		expect(gearFor(0)).toBe(1);
		expect(gearFor(20)).toBe(2);
		expect(gearFor(MAX_SPEED)).toBe(6);
		for (let s = 1; s < MAX_SPEED; s++) expect(gearFor(s + 1)).toBeGreaterThanOrEqual(gearFor(s));
	});

	it('a crash is impossible: driving flat out at a slow truck, the gap never drops below MIN_GAP', () => {
		// Simulate 2 minutes at 20 fps with the gas pedal held into a truck doing 24 km/h.
		const truck: TrafficVehicle = { id: 1, lane: 1, z: 120, speed: 24, kind: 'truck', color: 'blue' };
		let speed = MAX_SPEED;
		let minGap = Infinity;
		for (let i = 0; i < 2400; i++) {
			const dt = 0.05;
			const lead = leadIn([truck], 1)!;
			speed = assistSpeed(nextSpeed(speed, { gas: true, brake: false }, dt), lead.gap, truck.speed);
			truck.z += ((truck.speed - speed) / 3.6) * dt; // relative motion
			minGap = Math.min(minGap, leadIn([truck], 1)!.gap);
		}
		expect(minGap).toBeGreaterThan(MIN_GAP - 1.5);
		expect(minGap).toBeGreaterThan(0);
	});

	it('traffic never blocks every lane in the same stretch (a free lane always exists)', () => {
		for (let seed = 0; seed < 300; seed++) {
			const rng = createHighwayRng(seed);
			const traffic: TrafficVehicle[] = [];
			for (let i = 0; i < 40; i++) {
				const v = spawnVehicle(rng, traffic, i);
				if (v) traffic.push(v);
				const nearSpawn = traffic.filter((t) => Math.abs(t.z - 220) < 45);
				expect(new Set(nearSpawn.map((t) => t.lane)).size).toBeLessThan(HIGHWAY_LANES);
				for (const t of traffic) t.z -= 7; // the stretch moves past
			}
			for (const t of traffic) expect(t.speed).toBeLessThan(MAX_SPEED - 20);
		}
	});

	it('lane changes are refused only when something is right alongside', () => {
		const traffic: TrafficVehicle[] = [{ id: 1, lane: 0, z: 1, speed: 30, kind: 'bus', color: 'red' }];
		expect(laneIsClear(traffic, 0)).toBe(false);
		expect(laneIsClear(traffic, 2)).toBe(true);
		expect(laneIsClear(traffic, -1)).toBe(false);
		traffic[0]!.z = VEHICLE_KINDS.bus.length + 10;
		expect(laneIsClear(traffic, 0)).toBe(true);
	});

	it('every colour prompt and praise is in the catalog; keys are unique', () => {
		for (const c of ['red', 'blue', 'yellow', 'green', 'white', 'orange'] as const) {
			for (const k of ['car', 'truck', 'bus'] as const) {
				expect(getNarration(passKey(c, k))).toBeDefined();
				expect(getNarration(passedKey(c, k))).toBeDefined();
			}
		}
		const keys = NARRATION_CATALOG.map((e) => e.key);
		expect(keys.length).toBe(new Set(keys).size);
		expect(getNarration('mode.highway')).toBeDefined();
	});
});
