import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import { STATION_COLORS, type StationColor } from '../train/train.ts';
import type { Difficulty } from '../types/colors.ts';

/**
 * Rumi's Helicopter (রুমির হেলিকপ্টার): one-thumb flying for ages 3–6 (docs/plans/helicopter-game.md).
 * Hold ⬆ to rise, let go to float gently down, ◀ ▶ to fly sideways; the helicopter levels itself.
 * Nothing can crash (PR-07): the ground is a soft landing and trees and hills lift the helicopter
 * over them before it gets close. Kind jobs: carry mangoes, water a garden, bring a kitten home,
 * fly a friend to the island, landing on coloured, numbered pads. Near a pad it lands by itself.
 * The world is a long strip along x (side view); y is height.
 */
export type HeliCargo = 'mangoes' | 'water' | 'kitten' | 'friend';

export interface HeliState {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Facing: 1 = right, -1 = left. */
	face: 1 | -1;
}
export interface HeliInput {
	up: boolean;
	x: -1 | 0 | 1;
}
export interface HeliObstacle {
	id: string;
	kind: 'tree' | 'hill' | 'palm';
	x: number;
	halfWidth: number;
	top: number;
}

export const HELI = {
	maxVx: 8,
	accel: 7,
	climb: 3.4,
	sink: 1.7,
	maxY: 14,
	/** Height of the skids above the ground when parked. */
	ground: 0.6,
	/** How far above any obstacle the helicopter is kept. */
	margin: 1.2,
	/** Look ahead (seconds of travel) so the helicopter rises before it reaches a tree. */
	lookAhead: 0.7,
	/** World strip. */
	minX: -12,
	maxX: 170
} as const;

/** Home pad at 0, four job pads (the third is on the river island). */
export const HELI_PADS = [34, 70, 108, 146] as const;
export const HOME_PAD = 0;
export const PAD_HEIGHT = 0.5;

/** Trees, palms and hills between the pads (the scene builds exactly these). */
export const HELI_OBSTACLES: HeliObstacle[] = [
	{ id: 'tree-1', kind: 'tree', x: 14, halfWidth: 1.8, top: 5.5 },
	{ id: 'palm-1', kind: 'palm', x: 24, halfWidth: 1.4, top: 6.5 },
	{ id: 'hill-1', kind: 'hill', x: 52, halfWidth: 7, top: 5 },
	{ id: 'tree-2', kind: 'tree', x: 62, halfWidth: 1.8, top: 5.8 },
	{ id: 'palm-2', kind: 'palm', x: 84, halfWidth: 1.4, top: 7 },
	{ id: 'tree-3', kind: 'tree', x: 124, halfWidth: 1.8, top: 6 },
	{ id: 'hill-2', kind: 'hill', x: 134, halfWidth: 6, top: 4.5 },
	{ id: 'palm-3', kind: 'palm', x: 158, halfWidth: 1.4, top: 6.2 }
];

/** The lowest the helicopter may be at x (ground or over an obstacle, with a safe margin). */
export function floorAt(x: number, obstacles: readonly HeliObstacle[] = HELI_OBSTACLES): number {
	let floor: number = HELI.ground;
	for (const o of obstacles) {
		const dx = Math.abs(x - o.x);
		if (dx > o.halfWidth + 1.6) continue;
		// Smooth shoulders: full height over the obstacle, easing off beside it.
		const k = dx <= o.halfWidth ? 1 : 1 - (dx - o.halfWidth) / 1.6;
		floor = Math.max(floor, HELI.ground + (o.top + HELI.margin - HELI.ground) * k);
	}
	return floor;
}

export const freshHeli = (x = HOME_PAD): HeliState => ({ x, y: HELI.ground + PAD_HEIGHT, vx: 0, vy: 0, face: 1 });

const approach = (v: number, target: number, rate: number) => (v < target ? Math.min(target, v + rate) : Math.max(target, v - rate));

/**
 * One step of toy flight. Never below the floor (ground or a tree/hill ahead), never above
 * the sky ceiling, never outside the strip. Pure, so "can't crash" is testable.
 */
export function stepHeli(s: HeliState, input: HeliInput, dt: number, obstacles: readonly HeliObstacle[] = HELI_OBSTACLES): HeliState {
	const vx = approach(s.vx, input.x * HELI.maxVx, HELI.accel * dt);
	const vy = approach(s.vy, input.up ? HELI.climb : -HELI.sink, (input.up ? 6 : 3) * dt);
	let x = Math.min(HELI.maxX, Math.max(HELI.minX, s.x + vx * dt));
	// Look ahead in the flying direction and keep above whatever is coming.
	const floor = Math.max(floorAt(x, obstacles), floorAt(x + vx * HELI.lookAhead, obstacles));
	let y = s.y + vy * dt;
	let nvy = vy;
	if (y < floor) {
		// Rise smoothly (but quickly) to the floor; never inside anything.
		y = Math.max(floorAt(x, obstacles), y + (floor - y) * Math.min(1, dt * 8));
		nvy = Math.max(0, vy);
	}
	if (y > HELI.maxY) {
		y = HELI.maxY;
		nvy = Math.min(0, nvy);
	}
	if (x === HELI.minX || x === HELI.maxX) x = Math.min(HELI.maxX, Math.max(HELI.minX, x));
	const face: 1 | -1 = input.x === 0 ? s.face : input.x;
	return { x, y, vx: x === s.x + vx * dt ? vx : 0, vy: nvy, face };
}

/** Height above the top of any tree or hill under the helicopter (Infinity when none; > 0 means not touching). */
export function clearance(s: HeliState, obstacles: readonly HeliObstacle[] = HELI_OBSTACLES): number {
	let c = Infinity;
	for (const o of obstacles) if (Math.abs(s.x - o.x) <= o.halfWidth) c = Math.min(c, s.y - o.top);
	return c;
}

/** Close enough to the pad to land by itself: near it and not high up. */
export const nearPad = (s: HeliState, padX: number) => Math.abs(s.x - padX) < 3.2 && s.y < floorAt(padX) + 4.5;

export interface HeliJob {
	id: string;
	cargo: HeliCargo;
	/** Index into HELI_PADS. */
	pad: number;
	color: StationColor;
	number: number;
	/** How many mangoes (counted aloud); 1 for the other cargo. */
	count: number;
}

const JOB_COUNT: Record<Difficulty, number> = { beginner: 3, explorer: 4, advanced: 4 };

/**
 * A day of jobs. Each pad has its own colour and number; jobs never repeat the pad just landed
 * on; the friend always goes to the island pad (index 2); then home.
 */
export function createHeliDay(difficulty: Difficulty, seed: number): { pads: { color: StationColor; number: number }[]; jobs: HeliJob[] } {
	const rng = createRng(seed);
	const colors = shuffle(Object.keys(STATION_COLORS) as StationColor[], rng).slice(0, 4);
	const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng).slice(0, 4);
	const pads = colors.map((color, i) => ({ color, number: numbers[i]! }));
	const cargoes = shuffle(['mangoes', 'water', 'kitten', 'friend'] as HeliCargo[], rng).slice(0, JOB_COUNT[difficulty]);
	const padFor: Record<HeliCargo, number[]> = { mangoes: [0, 1, 3], water: [1, 3], kitten: [0, 3], friend: [2] };
	let last = -1;
	const jobs = cargoes.map((cargo, i) => {
		const options = padFor[cargo].filter((p) => p !== last);
		const pad = options[Math.floor(rng() * options.length)]!;
		last = pad;
		return { id: `job-${i}`, cargo, pad, color: pads[pad]!.color, number: pads[pad]!.number, count: cargo === 'mangoes' ? 2 + Math.floor(rng() * 2) : 1 };
	});
	return { pads, jobs };
}

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const HELI_NARRATION: NarrationEntry[] = [
	line('mode.heli', 'রুমির হেলিকপ্টার', "Rumi's Helicopter"),
	line('heli.choose', 'কাজে উড়বে, না ইচ্ছেমতো উড়বে?', 'Fly to help, or fly anywhere?'),
	line('heli.jobs', 'কাজে উড়ি', 'Fly to help'),
	line('heli.free', 'ইচ্ছেমতো উড়ি', 'Fly anywhere'),
	line('heli.how', 'উপরের তীর চেপে ধরো, হেলিকপ্টার উড়বে! পাশের তীরে ডানে-বামে যাও।', 'Hold the up arrow to fly! Use the side arrows to go left and right.'),
	line('heli.whirr', 'ঘুর ঘুর ঘুর!', 'Whirr whirr whirr!'),
	line('heli.pad', 'প্যাডে নামি!', "Let's land on the pad!"),
	line('heli.number', 'নম্বর প্যাড', 'is the pad number'),
	line('heli.landing', 'আস্তে আস্তে নামছি…', 'Landing gently…'),
	line('heli.thanks', 'ধন্যবাদ রুমি!', 'Thank you, Rumi!'),
	line('heli.cargo.mangoes', 'গ্রামে আম নিয়ে যাই!', "Let's take mangoes to the village!"),
	line('heli.cargo.water', 'বাগানের ফুলগুলো তৃষ্ণার্ত! পানি নিয়ে যাই।', "The garden flowers are thirsty! Let's bring water."),
	line('heli.cargo.kitten', 'বিড়ালছানাকে তার মায়ের কাছে নিয়ে যাই!', "Let's take the kitten home to its mother!"),
	line('heli.cargo.friend', 'খরগোশ বন্ধু নদীর দ্বীপে যেতে চায়!', 'Our rabbit friend wants to go to the river island!'),
	line('heli.done.mangoes', 'আম পৌঁছে গেছে! সবাই খুশি।', 'The mangoes are here! Everyone is happy.'),
	line('heli.done.water', 'বৃষ্টি বৃষ্টি! ফুলগুলো ফুটে উঠল!', 'Rain, rain! The flowers bloomed!'),
	line('heli.done.kitten', 'মিয়াও! বিড়ালছানা মায়ের কাছে ফিরেছে!', 'Meow! The kitten is back with its mother!'),
	line('heli.done.friend', 'খরগোশ দ্বীপে লাফাচ্ছে!', 'The rabbit is hopping on the island!'),
	line('heli.home', 'সব কাজ শেষ! চলো বাড়ির প্যাডে ফিরি।', "All the jobs are done! Let's fly back to the home pad."),
	line('heli.party', 'কী দারুণ উড়লাম! তুমি সবাইকে সাহায্য করেছ!', 'What a great flight! You helped everyone!'),
	line('heli.up', 'উপরে', 'Up'),
	line('heli.left', 'বামে', 'Left'),
	line('heli.right', 'ডানে', 'Right'),
	...(Object.keys(STATION_COLORS) as StationColor[]).map((c) => line(`heli.color.${c}`, `${STATION_COLORS[c].bn} প্যাড!`, `The ${STATION_COLORS[c].en} pad!`))
];
