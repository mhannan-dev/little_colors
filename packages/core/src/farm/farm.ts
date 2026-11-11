import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng } from '../learning/rng.ts';
import type { Difficulty } from '../types/colors.ts';

/**
 * Rumi's Farm (রুমির খামার): a 3D farmyard for ages 2–5. Tap any animal to hear its name and
 * sound. Four little jobs: feed the cow, collect the eggs, take the ducks to the pond and pick
 * the mangoes, counting as you go. Jobs can be done in any order; Rumi just suggests one.
 * Nothing to fail, no clock, no score (PR-07). When every job is done the animals have a party.
 */
export type FarmAnimal = 'cow' | 'hen' | 'duck' | 'goat';
export type FarmJob = 'cow' | 'eggs' | 'ducks' | 'mangoes';

export const FARM_ANIMALS: Record<FarmAnimal, { bn: string; en: string; sound: [string, string] }> = {
	cow: { bn: 'গরু', en: 'cow', sound: ['হাম্বা!', 'Moo!'] },
	hen: { bn: 'মুরগি', en: 'hen', sound: ['কক কক!', 'Cluck cluck!'] },
	duck: { bn: 'হাঁস', en: 'duck', sound: ['প্যাঁক প্যাঁক!', 'Quack quack!'] },
	goat: { bn: 'ছাগল', en: 'goat', sound: ['ম্যা ম্যা!', 'Baa baa!'] }
};
/** Rumi suggests jobs in this order, but any order counts. */
export const FARM_JOBS: FarmJob[] = ['cow', 'eggs', 'ducks', 'mangoes'];

export interface FarmDay {
	eggs: number;
	ducks: number;
	mangoes: number;
}

const RANGE: Record<Difficulty, [number, number]> = { beginner: [2, 3], explorer: [2, 4], advanced: [3, 5] };

/** How many eggs, ducks and mangoes today (small numbers to count). */
export function createFarmDay(difficulty: Difficulty, seed: number): FarmDay {
	const rng = createRng(seed);
	const [lo, hi] = RANGE[difficulty];
	const pick = () => lo + Math.floor(rng() * (hi - lo + 1));
	return { eggs: pick(), ducks: pick(), mangoes: pick() };
}

/** How many taps a job needs (the cow just needs one bale of hay). */
export const jobSize = (day: FarmDay, job: FarmJob) => (job === 'cow' ? 1 : day[job]);
export type FarmProgress = Record<FarmJob, number>;
export const freshProgress = (): FarmProgress => ({ cow: 0, eggs: 0, ducks: 0, mangoes: 0 });
export const jobDone = (day: FarmDay, p: FarmProgress, job: FarmJob) => p[job] >= jobSize(day, job);
export const allJobsDone = (day: FarmDay, p: FarmProgress) => FARM_JOBS.every((j) => jobDone(day, p, j));
/** The job Rumi suggests next: the first one (in order) not done yet. */
export const suggestedJob = (day: FarmDay, p: FarmProgress): FarmJob | null => FARM_JOBS.find((j) => !jobDone(day, p, j)) ?? null;

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

export const FARM_NARRATION: NarrationEntry[] = [
	line('mode.farm', 'রুমির খামার', "Rumi's Farm"),
	line('farm.hello', 'রুমির খামারে স্বাগতম! যেকোনো পশুতে ট্যাপ করো।', "Welcome to Rumi's farm! Tap any animal."),
	line('farm.job.cow', 'গরুর খিদে পেয়েছে! খড়ের গাদায় ট্যাপ করো।', 'The cow is hungry! Tap the hay.'),
	line('farm.job.eggs', 'মুরগি ডিম পেড়েছে! ডিমগুলো ঝুড়িতে তুলি, গুনি।', "The hen laid eggs! Let's put them in the basket and count."),
	line('farm.job.ducks', 'হাঁসগুলো পুকুরে যেতে চায়! প্রত্যেকটায় ট্যাপ করো।', 'The ducks want to go to the pond! Tap each one.'),
	line('farm.job.mangoes', 'গাছে পাকা আম! আমে ট্যাপ করে পাড়ি।', "Ripe mangoes on the tree! Tap them to pick."),
	line('farm.cow-ate', 'গরু খুশি! হাম্বা!', 'The cow is happy! Moo!'),
	line('farm.eggs-done', 'সব ডিম ঝুড়িতে!', 'All the eggs are in the basket!'),
	line('farm.ducks-done', 'সব হাঁস পুকুরে সাঁতার কাটছে!', 'All the ducks are swimming in the pond!'),
	line('farm.mangoes-done', 'অনেক আম পাড়লাম!', 'We picked lots of mangoes!'),
	line('farm.party', 'সব কাজ শেষ! খামারে আনন্দ!', 'All the jobs are done! A farm party!'),
	line('farm.hay', 'খড়', 'Hay'),
	line('farm.egg', 'ডিম', 'Egg'),
	line('farm.mango', 'আম', 'Mango'),
	...(Object.keys(FARM_ANIMALS) as FarmAnimal[]).flatMap((a) => [
		line(`farm.animal.${a}`, FARM_ANIMALS[a].bn, FARM_ANIMALS[a].en),
		line(`farm.sound.${a}`, `${FARM_ANIMALS[a].bn} বলে ${FARM_ANIMALS[a].sound[0]}`, `The ${FARM_ANIMALS[a].en} says ${FARM_ANIMALS[a].sound[1]}`)
	])
];
