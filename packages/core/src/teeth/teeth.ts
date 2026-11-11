import type { NarrationEntry } from '../audio/voiceManifest.ts';

/**
 * Toothie's Morning Adventure (টুথির সকাল): a tooth-brushing game for ages 2–5.
 * Pick a friend (Dino, Panda, Bunny), eat yummy food, then brush the four parts of the mouth
 * with any swipe. Goofy germs run away, rinse, admire the shiny smile, pop balloons and get a
 * sticker — every time (no rating, no stars, no clock: PR-07). There is no wrong way to brush.
 * "Brush with me" guides real brushing with the song, one part of the mouth per verse.
 */
export type ToothFriend = 'dino' | 'panda' | 'bunny';
export type MouthZone = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type TeethStep = 'pick' | 'eat' | 'paste' | 'brush' | 'rinse' | 'mirror' | 'celebrate';
export type TeethFood = 'cake' | 'chocolate' | 'laddu' | 'apple' | 'carrot';

export const TOOTH_FRIENDS: Record<ToothFriend, { bn: string; en: string; color: string }> = {
	dino: { bn: 'ডিনো', en: 'Dino', color: '#7CD3A8' },
	panda: { bn: 'পান্ডা', en: 'Panda', color: '#F4F4F0' },
	bunny: { bn: 'বানি', en: 'Bunny', color: '#F7B6CF' }
};
/** The order a child is guided through (any order still counts). */
export const MOUTH_ZONES: MouthZone[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
/** Two sweets and one healthy food per morning. */
export const TEETH_FOODS: Record<TeethFood, { bn: string; en: string; sweet: boolean }> = {
	cake: { bn: 'কেক', en: 'cake', sweet: true },
	chocolate: { bn: 'চকলেট', en: 'chocolate', sweet: true },
	laddu: { bn: 'লাড্ডু', en: 'laddu', sweet: true },
	apple: { bn: 'আপেল', en: 'apple', sweet: false },
	carrot: { bn: 'গাজর', en: 'carrot', sweet: false }
};

/** A full zone needs roughly three to four side-to-side scrubs across it. */
export const SCRUB_PER_ZONE = 3.4;
/** Below this the zone counts as sparkling clean (the last flecks vanish by themselves). */
export const CLEAN_AT = 0.08;

export type Dirt = Record<MouthZone, number>;
export const freshDirt = (): Dirt => ({ 'top-left': 1, 'top-right': 1, 'bottom-left': 1, 'bottom-right': 1 });

/**
 * Brushing: `stroke` is how far the brush moved inside the zone, as a fraction of the zone's
 * width. Any direction counts. Returns the new dirt (0 = clean) and whether it just became clean.
 */
export function scrub(dirt: number, stroke: number): { dirt: number; justCleaned: boolean } {
	if (dirt <= 0) return { dirt: 0, justCleaned: false };
	const next = Math.max(0, dirt - Math.max(0, stroke) / SCRUB_PER_ZONE);
	if (next <= CLEAN_AT) return { dirt: 0, justCleaned: true };
	return { dirt: next, justCleaned: false };
}

export const isClean = (dirt: Dirt) => MOUTH_ZONES.every((z) => dirt[z] <= 0);
/** Where the guiding hand points next: the first zone (in the brushing order) still dirty. */
export const nextDirtyZone = (dirt: Dirt): MouthZone | null => MOUTH_ZONES.find((z) => dirt[z] > 0) ?? null;

/** Which zone a point in the mouth box belongs to (x, y in 0..1 across the open mouth). */
export function zoneAt(x: number, y: number): MouthZone | null {
	if (x < 0 || x > 1 || y < 0 || y > 1) return null;
	return `${y < 0.5 ? 'top' : 'bottom'}-${x < 0.5 ? 'left' : 'right'}` as MouthZone;
}

/** Breakfast: two sweets and one healthy food, varied each morning. */
export function breakfast(seed: number): TeethFood[] {
	const sweets: TeethFood[] = ['cake', 'chocolate', 'laddu'];
	const healthy: TeethFood[] = ['apple', 'carrot'];
	const s = Math.abs(Math.floor(seed));
	return [sweets[s % 3]!, sweets[(s + 1) % 3]!, healthy[s % 2]!];
}

const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

const ZONE_TEXT: Record<MouthZone, [string, string]> = {
	'top-left': ['উপরের এই দিকের দাঁত মাজি!', "Let's brush the top teeth on this side!"],
	'top-right': ['এবার উপরের ওই দিক!', 'Now the top teeth on that side!'],
	'bottom-left': ['নিচের দাঁতগুলো মাজি!', "Let's brush the bottom teeth!"],
	'bottom-right': ['নিচের ওই দিকটাও!', 'And the bottom teeth on that side!']
};
/** The brushing song, one verse per part of the mouth (used by "Brush with me"). */
const SONG: Record<MouthZone, [string, string]> = {
	'top-left': ['উপরে মাজি ঘষ ঘষ ঘষ, ঝকঝকে দাঁত হাসি খুশি!', 'Brush the top, scrub scrub scrub, shiny teeth and happy smiles!'],
	'top-right': ['ওই দিকেও ঘষ ঘষ ঘষ, জীবাণু সব পালিয়ে যায়!', 'That side too, scrub scrub scrub, all the germs run far away!'],
	'bottom-left': ['নিচে মাজি ঘষ ঘষ ঘষ, ফেনা ফেনা বুদবুদ!', 'Brush below, scrub scrub scrub, foamy bubbles everywhere!'],
	'bottom-right': ['শেষ দিকটা ঘষ ঘষ ঘষ, এবার কুলি, ঝকঝকে হাসি!', 'The last side, scrub scrub scrub, now rinse — a sparkly smile!']
};

export const TEETH_NARRATION: NarrationEntry[] = [
	line('mode.teeth', 'চলো দাঁত মাজি', "Let's brush teeth"),
	line('teeth.choose', 'কার দাঁত মাজবো? একজন বন্ধু বেছে নাও।', 'Whose teeth shall we brush? Pick a friend.'),
	line('teeth.real', 'আসল ব্রাশ দিয়ে আমার সাথে মাজো', 'Brush with me (real brush)'),
	line('teeth.real-start', 'আসল টুথব্রাশ নাও, আয়নার সামনে চলো! গানের সাথে মাজি।', "Get your real toothbrush and stand by the mirror! Let's brush with the song."),
	line('teeth.eat', 'সকালের নাস্তা! খাবারে ট্যাপ করে খাওয়াই।', 'Breakfast time! Tap the food to eat.'),
	line('teeth.yum', 'ম্মম! কী মজা!', 'Mmm! Yummy!'),
	line('teeth.healthy', 'বাহ! এটা খেলে শরীর ভালো থাকে।', 'Great! This keeps us healthy.'),
	line('teeth.dirty', 'ওহো! দাঁতে খাবার লেগে গেছে, দুষ্টু জীবাণুরাও এসেছে!', 'Oh no! Food on our teeth, and silly germs came too!'),
	line('teeth.paste', 'টুথপেস্টে ট্যাপ করো, ব্রাশে পেস্ট লাগাই।', 'Tap the toothpaste to put some on the brush.'),
	line('teeth.brush', 'আঙুল দিয়ে দাঁতের উপর ঘষো! ঘষ ঘষ ঘষ!', 'Rub over the teeth with your finger! Scrub scrub scrub!'),
	line('teeth.zone-clean', 'ঝকঝকে!', 'Sparkly!'),
	line('teeth.germ-bye', 'উইইই! জীবাণু পালিয়ে গেল!', 'Wheee! The germs ran away!'),
	line('teeth.rinse', 'এবার কুলি করি! কাপে ট্যাপ করো।', "Now let's rinse! Tap the cup."),
	line('teeth.mirror', 'দেখো, কী সুন্দর ঝকঝকে হাসি!', 'Look at that shiny, sparkly smile!'),
	line('teeth.balloons', 'বেলুন ফাটাই! পপ পপ পপ!', "Let's pop the balloons! Pop pop pop!"),
	line('teeth.sticker', 'ঝকঝকে হাসির স্টিকার পেলে!', 'You got a shiny-smile sticker!'),
	line('teeth.toothpaste', 'টুথপেস্ট', 'Toothpaste'),
	line('teeth.cup', 'কুলির কাপ', 'Rinse cup'),
	...(Object.keys(TOOTH_FRIENDS) as ToothFriend[]).map((f) => line(`teeth.friend.${f}`, TOOTH_FRIENDS[f].bn, TOOTH_FRIENDS[f].en)),
	...(Object.keys(TEETH_FOODS) as TeethFood[]).map((f) => line(`teeth.food.${f}`, TEETH_FOODS[f].bn, TEETH_FOODS[f].en)),
	...MOUTH_ZONES.map((z) => line(`teeth.zone.${z}`, ZONE_TEXT[z][0], ZONE_TEXT[z][1])),
	...MOUTH_ZONES.map((z) => line(`teeth.song.${z}`, SONG[z][0], SONG[z][1]))
];
