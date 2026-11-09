import type { NarrationEntry } from '../audio/voiceManifest.ts';
import { createRng, shuffle } from '../learning/rng.ts';
import type { Difficulty } from '../types/colors.ts';

/**
 * Rumi's Kitchen: animal friends come one at a time and ask for food in pictures and numbers.
 * The child makes it and serves it. Nobody ever leaves, nothing burns, there is no clock and
 * no coins (PR-07); a plate that doesn't match yet is kept so the child can fix it (PR-08).
 */
export type StationId = 'stove' | 'juicer' | 'basket';
export type FoodId = 'egg' | 'roti' | 'rice' | 'orange-juice' | 'mango-juice' | 'milk' | 'apple' | 'banana';
export type FriendId = 'cat' | 'rabbit' | 'elephant' | 'duck' | 'bear' | 'panda';

export interface Food {
	id: FoodId;
	station: StationId;
	/** Gentle "making it" time; fruit from the basket is instant. */
	makeMs: number;
	icon: string;
	bn: string;
	en: string;
	/** Bengali counted forms: একটা ডিম / দুটো ডিম / তিনটে ডিম. */
	enPlural: string;
}

export const FOODS: Record<FoodId, Food> = {
	egg: { id: 'egg', station: 'stove', makeMs: 1600, icon: '🍳', bn: 'ডিম ভাজি', en: 'fried egg', enPlural: 'fried eggs' },
	roti: { id: 'roti', station: 'stove', makeMs: 1600, icon: '🫓', bn: 'রুটি', en: 'roti', enPlural: 'rotis' },
	rice: { id: 'rice', station: 'stove', makeMs: 1600, icon: '🍚', bn: 'ভাত', en: 'bowl of rice', enPlural: 'bowls of rice' },
	'orange-juice': { id: 'orange-juice', station: 'juicer', makeMs: 1200, icon: '🍊', bn: 'কমলার জুস', en: 'orange juice', enPlural: 'orange juices' },
	'mango-juice': { id: 'mango-juice', station: 'juicer', makeMs: 1200, icon: '🥭', bn: 'আমের জুস', en: 'mango juice', enPlural: 'mango juices' },
	milk: { id: 'milk', station: 'juicer', makeMs: 1200, icon: '🥛', bn: 'দুধ', en: 'glass of milk', enPlural: 'glasses of milk' },
	apple: { id: 'apple', station: 'basket', makeMs: 0, icon: '🍎', bn: 'আপেল', en: 'apple', enPlural: 'apples' },
	banana: { id: 'banana', station: 'basket', makeMs: 0, icon: '🍌', bn: 'কলা', en: 'banana', enPlural: 'bananas' }
};

export const STATIONS: { id: StationId; foods: FoodId[]; bn: string; en: string }[] = [
	{ id: 'stove', foods: ['egg', 'roti', 'rice'], bn: 'চুলা', en: 'Stove' },
	{ id: 'juicer', foods: ['orange-juice', 'mango-juice', 'milk'], bn: 'জুস মেশিন', en: 'Juice machine' },
	{ id: 'basket', foods: ['apple', 'banana'], bn: 'ফলের ঝুড়ি', en: 'Fruit basket' }
];

export const FRIENDS: Record<FriendId, { icon: string; bn: string; en: string }> = {
	cat: { icon: '🐱', bn: 'বিড়াল', en: 'Cat' },
	rabbit: { icon: '🐰', bn: 'খরগোশ', en: 'Rabbit' },
	elephant: { icon: '🐘', bn: 'হাতি', en: 'Elephant' },
	duck: { icon: '🦆', bn: 'হাঁস', en: 'Duck' },
	bear: { icon: '🐻', bn: 'ভালুক', en: 'Bear' },
	panda: { icon: '🐼', bn: 'পান্ডা', en: 'Panda' }
};

export interface OrderLine {
	food: FoodId;
	count: 1 | 2 | 3;
}
export interface Order {
	id: string;
	friend: FriendId;
	lines: OrderLine[];
}
export interface KitchenRound {
	difficulty: Difficulty;
	seed: number;
	orders: Order[];
}

export const KITCHEN_ROUND_LENGTH = 5;
const ALL_FOODS = Object.keys(FOODS) as FoodId[];
const EASY_FOODS: FoodId[] = ['apple', 'banana', 'egg', 'roti', 'milk'];

/**
 * Beginner: one food, 1–2 of it. Explorer: one food up to 3, or two foods one each.
 * Advanced: two foods, up to 3 each. Five different friends per round.
 */
export function createKitchenRound(difficulty: Difficulty, seed: number): KitchenRound {
	const rng = createRng(seed);
	const friends = shuffle(Object.keys(FRIENDS) as FriendId[], rng).slice(0, KITCHEN_ROUND_LENGTH);
	const pick = (n: number) => Math.floor(rng() * n);
	const orders = friends.map((friend, i): Order => {
		const pool = difficulty === 'beginner' ? EASY_FOODS : ALL_FOODS;
		const foods = shuffle(pool, rng);
		let lines: OrderLine[];
		if (difficulty === 'beginner') lines = [{ food: foods[0]!, count: (1 + pick(2)) as 1 | 2 }];
		else if (difficulty === 'explorer') {
			lines = i % 2 === 0 ? [{ food: foods[0]!, count: (1 + pick(3)) as 1 | 2 | 3 }] : [{ food: foods[0]!, count: 1 }, { food: foods[1]!, count: 1 }];
		} else lines = [{ food: foods[0]!, count: (1 + pick(3)) as 1 | 2 | 3 }, { food: foods[1]!, count: (1 + pick(2)) as 1 | 2 }];
		return { id: `kitchen.${difficulty}.${seed}.${i}`, friend, lines };
	});
	return { difficulty, seed, orders };
}

export interface TrayCheck {
	match: boolean;
	/** Still needed, per food. */
	missing: OrderLine[];
	/** More than asked for, per food (count = how many extra). */
	extra: { food: FoodId; count: number }[];
}

/** Order of items on the plate doesn't matter; only what and how many. */
export function checkTray(order: Order, tray: readonly FoodId[]): TrayCheck {
	const have = new Map<FoodId, number>();
	for (const f of tray) have.set(f, (have.get(f) ?? 0) + 1);
	const missing: OrderLine[] = [];
	const extra: { food: FoodId; count: number }[] = [];
	for (const line of order.lines) {
		const got = have.get(line.food) ?? 0;
		if (got < line.count) missing.push({ food: line.food, count: (line.count - got) as 1 | 2 | 3 });
		else if (got > line.count) extra.push({ food: line.food, count: got - line.count });
		have.delete(line.food);
	}
	for (const [food, count] of have) extra.push({ food, count });
	return { match: missing.length === 0 && extra.length === 0, missing, extra };
}

/** At most this many on one plate, so a tap-happy child can't bury the plate. */
export const TRAY_MAX = 6;

const BN_COUNT = ['', 'একটা', 'দুটো', 'তিনটে'] as const;
const EN_COUNT = ['', 'one', 'two', 'three'] as const;
const line = (key: string, bn: string, en: string): NarrationEntry => ({ key, bn, en, islamic: false, status: 'placeholder' });

/** Keys the game speaks: "বিড়াল খেতে চায়…" then "দুটো আপেল", joined with "আর". */
export const friendWantsKey = (f: FriendId) => `kitchen.wants.${f}`;
export const itemKey = (food: FoodId, count: number) => `kitchen.item.${food}.${count}`;

export const KITCHEN_NARRATION: NarrationEntry[] = [
	line('mode.kitchen', 'রুমির রান্নাঘর', "Rumi's Kitchen"),
	line('kitchen.intro', 'বন্ধুরা খেতে এসেছে! ওরা যা চায়, বানিয়ে দিই।', "Friends are hungry! Let's make what they ask for."),
	line('kitchen.and', 'আর', 'and'),
	line('kitchen.serve', 'দিয়ে দিই', 'Serve'),
	line('kitchen.making', 'বানাচ্ছি…', 'Making it…'),
	line('kitchen.thanks', 'ধন্যবাদ! খুব মজার খাবার!', 'Thank you! Yummy!'),
	line('kitchen.not-yet', 'আরেকটু মিলিয়ে দিই। ছবির মতো করে সাজাই।', "Almost! Let's make the plate look like the picture."),
	line('kitchen.too-many', 'একটু বেশি হয়ে গেছে। প্লেটের খাবারে ট্যাপ করলে সরে যায়।', 'A little too much. Tap food on the plate to take it off.'),
	line('kitchen.plate-full', 'প্লেট ভরে গেছে! আগে দিয়ে দিই।', "The plate is full! Let's serve it first."),
	line('kitchen.done', 'সব বন্ধুর খাওয়া হয়ে গেছে! দারুণ রান্না!', 'Everyone has eaten! What a great cook!'),
	...(Object.keys(FRIENDS) as FriendId[]).map((f) => line(friendWantsKey(f), `${FRIENDS[f].bn} খেতে চায়…`, `${FRIENDS[f].en} would like…`)),
	...ALL_FOODS.map((f) => line(`kitchen.food.${f}`, FOODS[f].bn, FOODS[f].en)),
	...STATIONS.map((s) => line(`kitchen.station.${s.id}`, s.bn, s.en)),
	...ALL_FOODS.flatMap((f) => [1, 2, 3].map((n) => line(itemKey(f, n), `${BN_COUNT[n]} ${FOODS[f].bn}`, `${EN_COUNT[n]} ${n === 1 ? FOODS[f].en : FOODS[f].enPlural}`)))
];
