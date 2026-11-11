import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { assistSpeed } from '../highway/highway.ts';
import type { Rng } from '../learning/rng.ts';

/**
 * Rumi's Bicycle: a gentle bike ride for ages 3–6. Pedal to move, brake, change lanes, ring the
 * bell. Fruit along the path drops into the basket; friends walking on the path step aside when
 * the bell rings; traffic lights teach "red: stop, green: go". A bump makes a little hop.
 * Nothing can be hit: the bike stops by itself behind a friend or at a red light. No score,
 * no counter on screen, no game over (PR-07). The basket's fruit goes to Grandma's house.
 */
export type BikePlace = 'park' | 'village' | 'river';
export type PathFriend = 'duck' | 'cat' | 'dog' | 'goat';
export type BikeFruit = 'mango' | 'banana' | 'apple' | 'guava';
export type PathThingKind = 'fruit' | 'friend' | 'ramp' | 'crossing';

export const BIKE_LANES = 3;
export const BIKE_MAX_SPEED = 22; // km/h
/** The bike stops this far before a red light's line. */
export const STOP_BEFORE_LINE = 3; // metres
export const BASKET_SIZE = 6;
export const CROSSING_EVERY = 380; // metres
export const LIGHT_RED_S = 4;
export const LIGHT_GREEN_S = 7;

export const BIKE_PLACES: { id: BikePlace; icon: string; bn: string; en: string }[] = [
	{ id: 'park', icon: '🌳', bn: 'পার্কে ঘুরি', en: 'Park ride' },
	{ id: 'village', icon: '🌾', bn: 'গ্রামের পথ', en: 'Village path' },
	{ id: 'river', icon: '🏞️', bn: 'নদীর ধার', en: 'Riverside' }
];
export const PATH_FRIENDS: Record<PathFriend, { icon: string; bn: string; en: string }> = {
	duck: { icon: '🦆', bn: 'হাঁস', en: 'duck' },
	cat: { icon: '🐱', bn: 'বিড়াল', en: 'cat' },
	dog: { icon: '🐶', bn: 'কুকুর', en: 'dog' },
	goat: { icon: '🐐', bn: 'ছাগল', en: 'goat' }
};
export const BIKE_FRUITS: Record<BikeFruit, { color: string; bn: string; en: string }> = {
	mango: { color: '#F2B233', bn: 'আম', en: 'mango' },
	banana: { color: '#F2D74C', bn: 'কলা', en: 'banana' },
	apple: { color: '#E5484D', bn: 'আপেল', en: 'apple' },
	guava: { color: '#8BC34A', bn: 'পেয়ারা', en: 'guava' }
};
/** Places on the way to Grandma's house; then the ride starts again (endless). */
export const BIKE_STOPS: { id: string; icon: string; bn: string; en: string }[] = [
	{ id: 'pond', icon: '🦆', bn: 'পুকুর', en: 'pond' },
	{ id: 'school', icon: '🏫', bn: 'স্কুল', en: 'school' },
	{ id: 'market', icon: '🛒', bn: 'বাজার', en: 'market' },
	{ id: 'grandma', icon: '👵', bn: 'নানুর বাড়ি', en: "Grandma's house" }
];
export const BIKE_STOP_EVERY = 520; // metres

export interface BikePedals {
	pedal: boolean;
	brake: boolean;
}

/** Like a real bicycle: pedalling speeds up, letting go coasts slowly down, braking stops quickly. */
export function pedalSpeed(speed: number, p: BikePedals, dt: number, max = BIKE_MAX_SPEED): number {
	let s = speed;
	if (p.brake) s -= 18 * dt;
	else if (p.pedal) s += (s < 10 ? 7 : 4) * dt;
	else s -= 2.5 * dt;
	return Math.max(0, Math.min(max, s));
}

export interface PathThing {
	id: number;
	kind: PathThingKind;
	lane: number;
	/** Metres ahead of the bike. */
	z: number;
	fruit?: BikeFruit;
	friend?: PathFriend;
	/** Friend walking speed (km/h); 0 for everything else. */
	speed: number;
	/** A friend that heard the bell is stepping aside (no longer in the way). */
	leaving?: boolean;
}

export type LightColor = 'red' | 'green';
/** Traffic light colour at time `t` seconds since the crossing appeared (starts red, then cycles). */
export function lightAt(t: number): LightColor {
	const cycle = LIGHT_RED_S + LIGHT_GREEN_S;
	return t % cycle < LIGHT_RED_S ? 'red' : 'green';
}

/**
 * The bike's safe speed: never into a friend in its lane, and stopped before a red light's line.
 * Uses the same proven assist as Rumi's Highway (gap → match speed → stop).
 */
export function safeBikeSpeed(desired: number, lane: number, things: readonly PathThing[], light: LightColor | null): number {
	let s = desired;
	for (const t of things) {
		if (t.z <= 0) continue;
		if (t.kind === 'friend' && t.lane === lane && !t.leaving) s = Math.min(s, assistSpeed(desired, t.z - 1.6, t.speed));
		if (t.kind === 'crossing' && light === 'red') s = Math.min(s, assistSpeed(desired, t.z - STOP_BEFORE_LINE, 0));
	}
	return s;
}

/**
 * Something new far ahead. Friends never fill every lane in a stretch, fruit and ramps go in
 * free lanes, and a crossing appears every CROSSING_EVERY metres (passed in by the caller).
 */
export function spawnThing(rng: Rng, things: readonly PathThing[], id: number, aheadZ = 120): PathThing | null {
	const near = things.filter((t) => Math.abs(t.z - aheadZ) < 18);
	if (near.some((t) => t.kind === 'crossing')) return null;
	const busy = new Set(near.filter((t) => t.kind === 'friend').map((t) => t.lane));
	const free = Array.from({ length: BIKE_LANES }, (_, i) => i).filter((l) => !near.some((t) => t.lane === l));
	if (free.length === 0) return null;
	const lane = free[Math.floor(rng() * free.length)]!;
	const r = rng();
	if (r < 0.58) {
		const fruits = Object.keys(BIKE_FRUITS) as BikeFruit[];
		return { id, kind: 'fruit', lane, z: aheadZ, fruit: fruits[Math.floor(rng() * fruits.length)], speed: 0 };
	}
	if (r < 0.8 && busy.size < BIKE_LANES - 1) {
		const friends = Object.keys(PATH_FRIENDS) as PathFriend[];
		return { id, kind: 'friend', lane, z: aheadZ, friend: friends[Math.floor(rng() * friends.length)], speed: 3 + rng() * 2 };
	}
	return { id, kind: 'ramp', lane, z: aheadZ, speed: 0 };
}

/** Did something pass the bike's front wheel this frame? (crossed from ahead to behind) */
export const reachedBike = (before: number, after: number) => before > 0.6 && after <= 0.6;

/** The nearest friend ahead in the bike's lane that is close enough to ring the bell for. */
export function friendToRingFor(things: readonly PathThing[], lane: number, within = 26): PathThing | null {
	let best: PathThing | null = null;
	for (const t of things) {
		if (t.kind !== 'friend' || t.leaving || t.lane !== lane || t.z <= 0 || t.z > within) continue;
		if (!best || t.z < best.z) best = t;
	}
	return best;
}

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const BIKE_NARRATION: NarrationEntry[] = [
	line('mode.bike', 'রুমির সাইকেল', "Rumi's Bicycle"),
	line('bike.choose', 'কোথায় সাইকেল চালাবো? একটা ছবি বেছে নাও।', 'Where shall we ride? Pick a picture.'),
	line('bike.start', 'সবুজ প্যাডেল চেপে ধরো, সাইকেল চলবে! ফলগুলো ঝুড়িতে তুলি।', 'Hold the green pedal to ride! Let’s pick up fruit for the basket.'),
	line('bike.bell', 'ঘণ্টা', 'Bell'),
	line('bike.pedal', 'প্যাডেল', 'Pedal'),
	line('bike.brake', 'ব্রেক', 'Brake'),
	line('bike.thanks', 'ধন্যবাদ! পথ ছেড়ে দিলাম।', 'Thank you! Off I go.'),
	line('bike.red', 'লাল বাতি! থামি।', 'Red light! We stop.'),
	line('bike.green', 'সবুজ বাতি! চলো যাই।', "Green light! Let's go."),
	line('bike.jump', 'উফ! কী মজার লাফ!', 'Whee! What a fun bump!'),
	line('bike.basket-full', 'ঝুড়ি ভরে গেছে! নানুর বাড়ি নিয়ে যাই।', "The basket is full! Let's take it to Grandma."),
	line('bike.grandma', 'নানুর বাড়ি পৌঁছে গেলাম! নানু ফলগুলো পেয়ে খুব খুশি!', "We reached Grandma's house! Grandma loves the fruit!"),
	...BIKE_PLACES.map((p) => line(`bike.place.${p.id}`, p.bn, p.en)),
	...(Object.keys(PATH_FRIENDS) as PathFriend[]).map((f) => line(`bike.ring.${f}`, `সামনে ${PATH_FRIENDS[f].bn}! ঘণ্টা বাজাই।`, `A ${PATH_FRIENDS[f].en} ahead! Ring the bell.`)),
	...(Object.keys(BIKE_FRUITS) as BikeFruit[]).map((f) => line(`bike.fruit.${f}`, `${BIKE_FRUITS[f].bn} পেলাম!`, `Got a ${BIKE_FRUITS[f].en}!`)),
	...BIKE_STOPS.map((s) => line(`bike.stop.${s.id}`, s.id === 'grandma' ? 'নানুর বাড়ি দেখা যাচ্ছে!' : `${s.bn} পার হচ্ছি!`, s.id === 'grandma' ? "There is Grandma's house!" : `Passing the ${s.en}!`))
];
