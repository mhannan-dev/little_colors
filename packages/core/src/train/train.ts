import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import type { Difficulty } from '../types/colors.ts';

/**
 * Rumi's Train (রুমির রেলগাড়ি): a calm 3D train ride for ages 3–6. The train chugs past paddy
 * fields, over a river bridge and through a village. Each station has a colour and a big number;
 * animal friends wait on the platform and the child taps each one to climb aboard while Rumi
 * counts. Toot the whistle, ride on. Nothing can go wrong: no clock, no score, every friend
 * always gets on (PR-07). The last stop is home, where everyone hops off and waves.
 */
export type StationColor = 'red' | 'yellow' | 'blue' | 'green' | 'orange' | 'purple';
export type Rider = 'cat' | 'dog' | 'duck' | 'goat' | 'rabbit' | 'cow' | 'hen' | 'sheep';
export type TrainScenery = 'field' | 'bridge' | 'village' | 'tea';

export const STATION_COLORS: Record<StationColor, { bn: string; en: string; hex: string }> = {
	red: { bn: 'লাল', en: 'red', hex: '#E5484D' },
	yellow: { bn: 'হলুদ', en: 'yellow', hex: '#F2C94C' },
	blue: { bn: 'নীল', en: 'blue', hex: '#3478D4' },
	green: { bn: 'সবুজ', en: 'green', hex: '#35A66A' },
	orange: { bn: 'কমলা', en: 'orange', hex: '#F28C28' },
	purple: { bn: 'বেগুনি', en: 'purple', hex: '#8A5AC2' }
};

export const RIDERS: Record<Rider, { bn: string; en: string }> = {
	cat: { bn: 'বিড়াল', en: 'cat' },
	dog: { bn: 'কুকুর', en: 'dog' },
	duck: { bn: 'হাঁস', en: 'duck' },
	goat: { bn: 'ছাগল', en: 'goat' },
	rabbit: { bn: 'খরগোশ', en: 'rabbit' },
	cow: { bn: 'গরু', en: 'cow' },
	hen: { bn: 'মুরগি', en: 'hen' },
	sheep: { bn: 'ভেড়া', en: 'sheep' }
};

/** What the train passes on the way to each stop, in order. */
export const TRAIN_SCENERY: TrainScenery[] = ['field', 'bridge', 'village', 'tea'];

export interface TrainStop {
	id: string;
	color: StationColor;
	/** The big number on the station sign (1–9). */
	number: number;
	riders: Rider[];
	scenery: TrainScenery;
}

/** Most friends one station can have, so the counting stays small. */
export const MAX_RIDERS: Record<Difficulty, number> = { beginner: 2, explorer: 3, advanced: 4 };

/**
 * A trip: three stations with friends to pick up (each a different colour, number and animals),
 * then home. Wagons hold everyone, so nobody is ever left behind.
 */
export function createTrainTrip(difficulty: Difficulty, seed: number): TrainStop[] {
	const rng = createRng(seed);
	const colors = shuffle(Object.keys(STATION_COLORS) as StationColor[], rng);
	const numbers = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
	const riders = shuffle(Object.keys(RIDERS) as Rider[], rng);
	const max = MAX_RIDERS[difficulty];
	let r = 0;
	return [0, 1, 2].map((i) => {
		const count = 1 + Math.floor(rng() * max);
		const kind = riders[r++ % riders.length]!;
		// One kind of animal per station ("three ducks!"), easy to count and to name.
		return { id: `stop-${i}`, color: colors[i]!, number: numbers[i]!, riders: Array.from({ length: count }, () => kind), scenery: TRAIN_SCENERY[i]! };
	});
}

/** Seats: three per wagon, filled in order. */
export const SEATS_PER_WAGON = 3;
export const seatFor = (k: number) => ({ wagon: Math.floor(k / SEATS_PER_WAGON), seat: k % SEATS_PER_WAGON });
export const wagonsFor = (trip: TrainStop[]) => Math.max(2, Math.ceil(trip.reduce((n, s) => n + s.riders.length, 0) / SEATS_PER_WAGON));

/**
 * Gentle arrival: the speed that stops the train exactly at the platform (v² = 2·a·d), never
 * faster than `max`. Pure so it can be tested.
 */
export function arriveSpeed(remaining: number, max: number, brake = 3.2): number {
	if (remaining <= 0) return 0;
	return Math.min(max, Math.sqrt(2 * brake * remaining));
}

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const RAIL_NARRATION: NarrationEntry[] = [
	line('mode.rail', 'রুমির রেলগাড়ি', "Rumi's Train"),
	line('rail.start', 'সবুজ বোতাম চাপো, রেলগাড়ি চলবে!', 'Press the green button and the train will go!'),
	line('rail.whistle', 'কু ঝিক ঝিক!', 'Choo choo!'),
	line('rail.station', 'স্টেশনে এলাম!', "We're at the station!"),
	line('rail.number', 'নম্বর স্টেশন', 'is the station number'),
	line('rail.board', 'বন্ধুদের ট্যাপ করো, ট্রেনে উঠুক! চলো গুনি।', "Tap our friends to climb aboard! Let's count."),
	line('rail.all-aboard', 'সবাই উঠেছে! হুইসেল বাজিয়ে চলো যাই!', 'Everyone is on! Toot the whistle and off we go!'),
	line('rail.go', 'চলো যাই!', "Let's go!"),
	line('rail.home', 'বাড়ির স্টেশনে এসে গেছি! সবাই নামো, হাত নাড়ো!', "We're home! Everyone hop off and wave!"),
	line('rail.done', 'কী সুন্দর ভ্রমণ হলো!', 'What a lovely trip!'),
	line('rail.whistle-button', 'হুইসেল', 'Whistle'),
	line('rail.scene.field', 'দেখো, সবুজ ধানক্ষেত!', 'Look, green rice fields!'),
	line('rail.scene.bridge', 'নদীর উপর দিয়ে সেতু পার হচ্ছি!', "We're crossing the bridge over the river!"),
	line('rail.scene.village', 'আমাদের সুন্দর গ্রাম!', 'Our pretty village!'),
	line('rail.scene.tea', 'চা বাগানের পাহাড়!', 'The hills of the tea garden!'),
	...(Object.keys(STATION_COLORS) as StationColor[]).map((c) => line(`rail.color.${c}`, `${STATION_COLORS[c].bn} স্টেশন!`, `The ${STATION_COLORS[c].en} station!`)),
	...(Object.keys(RIDERS) as Rider[]).map((r) => line(`rail.rider.${r}`, RIDERS[r].bn, RIDERS[r].en))
];
