import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng, type Rng } from '../learning/rng.ts';

/**
 * Rumi's Highway: a calm highway drive for ages 3–6. Gas and brake pedals, lane changes, a horn,
 * a speedometer and gears, traffic to pass, places along the way. A crash is impossible: the
 * car slows behind traffic by itself (assistSpeed) and there is always a free lane. No score,
 * no pass counter, no game over (PR-07). Occasional colour prompts ("pass the blue truck") are
 * optional and never fail.
 */
export type HighwayLocation = 'green' | 'city' | 'sunset';
export type VehicleKind = 'car' | 'truck' | 'bus';
export type VehicleColor = 'red' | 'blue' | 'yellow' | 'green' | 'white' | 'orange';

export const HIGHWAY_LANES = 3;
export const MAX_SPEED = 90; // km/h
export const MAX_SPEED_REDUCED = 60;
export const CRUISE_SPEED = 35;
/** Closer than this behind a vehicle in the same lane, the car matches its speed. */
export const SAFE_GAP = 22; // metres
/** The car never gets closer than this (bumper to bumper). */
export const MIN_GAP = 7;

export const LOCATIONS: { id: HighwayLocation; icon: string; bn: string; en: string }[] = [
	{ id: 'green', icon: '🌳', bn: 'সবুজ হাইওয়ে', en: 'Green highway' },
	{ id: 'city', icon: '🏙️', bn: 'শহরের রাস্তা', en: 'City road' },
	{ id: 'sunset', icon: '🌅', bn: 'সন্ধ্যার মরুভূমি', en: 'Sunset desert' }
];

export const VEHICLE_COLORS: Record<VehicleColor, { hex: string; bn: string; en: string }> = {
	red: { hex: '#E5484D', bn: 'লাল', en: 'red' },
	blue: { hex: '#3478D4', bn: 'নীল', en: 'blue' },
	yellow: { hex: '#F2C94C', bn: 'হলুদ', en: 'yellow' },
	green: { hex: '#35A66A', bn: 'সবুজ', en: 'green' },
	white: { hex: '#F4F4F0', bn: 'সাদা', en: 'white' },
	orange: { hex: '#F28C28', bn: 'কমলা', en: 'orange' }
};
export const VEHICLE_KINDS: Record<VehicleKind, { bn: string; en: string; length: number }> = {
	car: { bn: 'গাড়ি', en: 'car', length: 4.5 },
	truck: { bn: 'ট্রাক', en: 'truck', length: 9 },
	bus: { bn: 'বাস', en: 'bus', length: 11 }
};

/** Places passed on the way home; then the journey starts again (endless, no counter). */
export const LANDMARKS: { id: string; icon: string; bn: string; en: string }[] = [
	{ id: 'village', icon: '🏡', bn: 'গ্রাম', en: 'village' },
	{ id: 'bridge', icon: '🌉', bn: 'নদীর ব্রিজ', en: 'river bridge' },
	{ id: 'market', icon: '🛒', bn: 'বাজার', en: 'market' },
	{ id: 'school', icon: '🏫', bn: 'স্কুল', en: 'school' },
	{ id: 'home', icon: '🏠', bn: 'বাড়ি', en: 'home' }
];
/** Metres between landmarks: about a minute of happy driving at cruising speed. */
export const LANDMARK_EVERY = 700;

export interface Pedals {
	gas: boolean;
	brake: boolean;
}

/**
 * Speed (km/h) after `dt` seconds. Gas speeds up to the max, brake slows down (to a stop),
 * neither drifts gently back to cruising speed — the car always keeps rolling unless braked.
 */
export function nextSpeed(speed: number, pedals: Pedals, dt: number, max = MAX_SPEED): number {
	let s = speed;
	if (pedals.brake) s -= 40 * dt;
	else if (pedals.gas) s += (s < 40 ? 16 : 10) * dt;
	else if (s > CRUISE_SPEED) s -= 6 * dt;
	else if (s < CRUISE_SPEED) s += 8 * dt;
	return Math.max(0, Math.min(max, s));
}

/** Automatic gearbox, 1–6, for the dashboard. */
export function gearFor(speed: number): number {
	const stops = [0, 14, 28, 42, 58, 74];
	let g = 1;
	for (let i = 0; i < stops.length; i++) if (speed >= stops[i]!) g = i + 1;
	return speed < 1 ? 1 : g;
}

/**
 * The safety assist: never closer than MIN_GAP, and from SAFE_GAP on, ease down to the lead
 * vehicle's speed. Pure, so the "a crash can't happen" promise is testable.
 */
export function assistSpeed(desired: number, gap: number | null, leadSpeed: number): number {
	if (gap === null || gap >= SAFE_GAP) return desired;
	if (gap <= MIN_GAP) return Math.min(desired, Math.max(0, leadSpeed - 4));
	const k = (gap - MIN_GAP) / (SAFE_GAP - MIN_GAP); // 0 near, 1 far
	const cap = leadSpeed + k * Math.max(0, desired - leadSpeed);
	return Math.min(desired, cap);
}

export interface TrafficVehicle {
	id: number;
	lane: number;
	/** Metres ahead of Rumi's car (negative = behind). */
	z: number;
	speed: number;
	kind: VehicleKind;
	color: VehicleColor;
}

/**
 * A new vehicle far ahead, in a lane that keeps at least one lane free nearby, so the child
 * can always pass. Traffic is slower than the car's top speed so passing is possible.
 */
export function spawnVehicle(rng: Rng, traffic: readonly TrafficVehicle[], id: number, aheadZ = 220): TrafficVehicle | null {
	const near = traffic.filter((v) => Math.abs(v.z - aheadZ) < 45);
	const busy = new Set(near.map((v) => v.lane));
	const free = Array.from({ length: HIGHWAY_LANES }, (_, i) => i).filter((l) => !busy.has(l));
	// Keep a lane open: never fill the last free lane in the same stretch.
	if (free.length <= 1) return null;
	const lane = free[Math.floor(rng() * free.length)]!;
	const r = rng();
	const kind: VehicleKind = r < 0.62 ? 'car' : r < 0.84 ? 'truck' : 'bus';
	const colors = Object.keys(VEHICLE_COLORS) as VehicleColor[];
	const color = colors[Math.floor(rng() * colors.length)]!;
	const speed = kind === 'car' ? 32 + rng() * 22 : 24 + rng() * 14;
	return { id, lane, z: aheadZ, speed, kind, color };
}

/** Nearest vehicle ahead in a lane (or null), measured bumper to bumper. */
export function leadIn(traffic: readonly TrafficVehicle[], lane: number, carLength = 4.5): { gap: number; vehicle: TrafficVehicle } | null {
	let best: { gap: number; vehicle: TrafficVehicle } | null = null;
	for (const v of traffic) {
		if (v.lane !== lane || v.z <= 0) continue;
		const gap = v.z - (carLength + VEHICLE_KINDS[v.kind].length) / 2;
		if (!best || gap < best.gap) best = { gap, vehicle: v };
	}
	return best;
}

/** Can the car move into `lane` right now without touching anything alongside? */
export function laneIsClear(traffic: readonly TrafficVehicle[], lane: number, carLength = 4.5): boolean {
	if (lane < 0 || lane >= HIGHWAY_LANES) return false;
	return traffic.every((v) => v.lane !== lane || Math.abs(v.z) > (carLength + VEHICLE_KINDS[v.kind].length) / 2 + 2);
}

export const createHighwayRng = (seed: number) => createRng(seed);

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });
export const passKey = (color: VehicleColor, kind: VehicleKind) => `highway.pass.${color}.${kind}`;
export const passedKey = (color: VehicleColor, kind: VehicleKind) => `highway.passed.${color}.${kind}`;

export const HIGHWAY_NARRATION: NarrationEntry[] = [
	line('mode.highway', 'রুমির হাইওয়ে', "Rumi's Highway"),
	line('highway.choose', 'কোন রাস্তায় চালাবো? একটা ছবি বেছে নাও।', 'Which road shall we drive? Pick a picture.'),
	line('highway.start', 'চলো গাড়ি চালাই! সবুজ প্যাডেলে চাপ দিলে জোরে চলে।', "Let's drive! Press the green pedal to go faster."),
	line('highway.change-lane', 'সামনে গাড়ি আস্তে চলছে। তীর চেপে পাশের লেনে যাই!', 'The car ahead is slow. Tap an arrow to change lanes!'),
	line('highway.passed', 'দারুণ! পেরিয়ে গেলাম!', 'Great! We passed it!'),
	line('highway.horn', 'পিপ পিপ!', 'Beep beep!'),
	line('highway.home', 'বাড়ি পৌঁছে গেলাম! চলো আবার ঘুরে আসি!', "We're home! Let's go for another drive!"),
	line('highway.paused', 'একটু থামলাম।', "Let's take a little break."),
	line('highway.gas', 'গ্যাস', 'Gas'),
	line('highway.brake', 'ব্রেক', 'Brake'),
	line('highway.menu', 'থামি', 'Pause'),
	line('highway.continue', 'চালিয়ে যাই', 'Keep driving'),
	line('highway.restart', 'আবার শুরু', 'Start again'),
	line('highway.camera', 'ক্যামেরা বদলাই', 'Change camera'),
	line('highway.place', 'জায়গা বদলাই', 'Change place'),
	...LOCATIONS.map((l) => line(`highway.location.${l.id}`, l.bn, l.en)),
	...LANDMARKS.map((l) => line(`highway.landmark.${l.id}`, l.id === 'home' ? 'বাড়ি দেখা যাচ্ছে!' : `${l.bn} পার হচ্ছি!`, l.id === 'home' ? 'There is home!' : `Passing the ${l.en}!`)),
	...(Object.keys(VEHICLE_COLORS) as VehicleColor[]).flatMap((c) =>
		(Object.keys(VEHICLE_KINDS) as VehicleKind[]).flatMap((k) => [
			line(passKey(c, k), `${VEHICLE_COLORS[c].bn} ${VEHICLE_KINDS[k].bn}টার পাশ দিয়ে যাই!`, `Let's pass the ${VEHICLE_COLORS[c].en} ${VEHICLE_KINDS[k].en}!`),
			line(passedKey(c, k), `বাহ! ${VEHICLE_COLORS[c].bn} ${VEHICLE_KINDS[k].bn} পেরিয়ে গেলাম!`, `Wow! We passed the ${VEHICLE_COLORS[c].en} ${VEHICLE_KINDS[k].en}!`)
		])
	)
];
