import { describe, expect, it } from 'vitest';
import {
	BIKE_LANES,
	BIKE_MAX_SPEED,
	createHighwayRng,
	friendToRingFor,
	getNarration,
	lightAt,
	NARRATION_CATALOG,
	pedalSpeed,
	reachedBike,
	safeBikeSpeed,
	spawnThing,
	STOP_BEFORE_LINE,
	type PathThing
} from '../../src/index.ts';

/** Ride for `seconds` holding the pedal, moving the things relative to the bike. */
function ride(things: PathThing[], lane: number, seconds: number, light: () => 'red' | 'green' | null) {
	let speed = BIKE_MAX_SPEED;
	let closest = Infinity;
	for (let i = 0; i < seconds * 20; i++) {
		const dt = 0.05;
		speed = safeBikeSpeed(pedalSpeed(speed, { pedal: true, brake: false }, dt), lane, things, light());
		for (const t of things) t.z += ((t.speed - speed) / 3.6) * dt;
		for (const t of things) if (t.lane === lane || t.kind === 'crossing') closest = Math.min(closest, t.z);
	}
	return { speed, closest };
}

describe("Rumi's Bicycle", () => {
	it('pedalling speeds up to the max, letting go coasts down, the brake stops', () => {
		let s = 0;
		for (let i = 0; i < 400; i++) s = pedalSpeed(s, { pedal: true, brake: false }, 0.05);
		expect(s).toBe(BIKE_MAX_SPEED);
		const coasting = pedalSpeed(s, { pedal: false, brake: false }, 1);
		expect(coasting).toBeLessThan(s);
		expect(coasting).toBeGreaterThan(s - 5);
		for (let i = 0; i < 100; i++) s = pedalSpeed(s, { pedal: false, brake: true }, 0.05);
		expect(s).toBe(0);
	});

	it('never rides into a friend on the path, even pedalling hard', () => {
		const things: PathThing[] = [{ id: 1, kind: 'friend', friend: 'goat', lane: 1, z: 40, speed: 3 }];
		const { closest } = ride(things, 1, 60, () => null);
		expect(closest).toBeGreaterThan(0.5);
	});

	it('stops before a red light line and goes on green', () => {
		const things: PathThing[] = [{ id: 1, kind: 'crossing', lane: 1, z: 30, speed: 0 }];
		const { closest, speed } = ride(things, 1, 40, () => 'red');
		expect(closest).toBeGreaterThan(STOP_BEFORE_LINE - 1.5);
		expect(speed).toBeLessThan(1);
		expect(lightAt(0)).toBe('red');
		expect(lightAt(5)).toBe('green');
		const after = ride(things, 1, 10, () => 'green');
		expect(after.closest).toBeLessThan(0); // rode through on green
	});

	it('a friend that heard the bell is no longer in the way', () => {
		const things: PathThing[] = [{ id: 1, kind: 'friend', friend: 'duck', lane: 0, z: 12, speed: 2 }];
		expect(friendToRingFor(things, 0)?.id).toBe(1);
		things[0]!.leaving = true;
		expect(friendToRingFor(things, 0)).toBeNull();
		expect(safeBikeSpeed(20, 0, things, null)).toBe(20);
	});

	it('spawning never blocks every lane with friends and keeps crossings clear', () => {
		for (let seed = 0; seed < 300; seed++) {
			const rng = createHighwayRng(seed);
			const things: PathThing[] = [];
			for (let i = 0; i < 60; i++) {
				const t = spawnThing(rng, things, i);
				if (t) things.push(t);
				const near = things.filter((x) => Math.abs(x.z - 120) < 18 && x.kind === 'friend');
				expect(new Set(near.map((x) => x.lane)).size).toBeLessThan(BIKE_LANES);
				for (const x of things) x.z -= 6;
			}
		}
		expect(reachedBike(1, 0.2)).toBe(true);
		expect(reachedBike(0.4, -1)).toBe(false);
	});

	it('all bike lines are in the catalog; keys are unique', () => {
		for (const k of ['mode.bike', 'bike.start', 'bike.red', 'bike.green', 'bike.ring.duck', 'bike.fruit.mango', 'bike.stop.grandma']) expect(getNarration(k), k).toBeDefined();
		const keys = NARRATION_CATALOG.map((e) => e.key);
		expect(keys.length).toBe(new Set(keys).size);
	});
});
