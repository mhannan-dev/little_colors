import type { Block } from './blocks.ts';

export interface MissionProgress {
	current: number;
	target: number;
	done: boolean;
	summaryBn: string;
	summaryEn: string;
}

export interface Mission {
	id: string;
	titleBn: string;
	titleEn: string;
	goalBn: string;
	goalEn: string;
	hintBn: string;
	hintEn: string;
	badge: string;
	badgeNameBn: string;
	badgeNameEn: string;
	check: (blocks: Block[]) => MissionProgress;
}

// Color hex codes from PALETTE
const CORAL = '#e58c81';
const BLUE = '#80b9ce';

export const MISSIONS: Mission[] = [
	{
		id: 'colors-count',
		titleBn: 'রং ও গণনার খেলা',
		titleEn: 'Colors & Counting',
		goalBn: '৩টি লাল ও ২টি নীল ব্লক বসাই',
		goalEn: 'Add 3 red and 2 blue blocks',
		hintBn: 'প্যালেট থেকে লাল আর নীল রং বেছে বোর্ডে ট্যাপ করো।',
		hintEn: 'Pick red and blue from the palette and tap on the board.',
		badge: '⭐',
		badgeNameBn: 'কালার স্টার',
		badgeNameEn: 'Color Star',
		check: (blocks: Block[]) => {
			const coralCount = blocks.filter((b) => !b.locked && b.color === CORAL).length;
			const blueCount = blocks.filter((b) => !b.locked && b.color === BLUE).length;
			const validCoral = Math.min(3, coralCount);
			const validBlue = Math.min(2, blueCount);
			const current = validCoral + validBlue;
			const target = 5;
			const done = validCoral >= 3 && validBlue >= 2;
			return {
				current,
				target,
				done,
				summaryBn: `লাল: ${validCoral}/৩ • নীল: ${validBlue}/২`,
				summaryEn: `Red: ${validCoral}/3 · Blue: ${validBlue}/2`
			};
		}
	},
	{
		id: 'tall-tower',
		titleBn: 'উঁচু টাওয়ার বানাই',
		titleEn: 'Build a Tall Tower',
		goalBn: 'একটি জায়গায় ৪ তলা উঁচু টাওয়ার বানাই',
		goalEn: 'Stack blocks 4 levels high',
		hintBn: 'একই ব্লকের ওপর একের পর এক ব্লক বসাতে থাকো।',
		hintEn: 'Keep placing blocks on top of each other in the same spot.',
		badge: '🏰',
		badgeNameBn: 'টাওয়ার মাস্টার',
		badgeNameEn: 'Tower Master',
		check: (blocks: Block[]) => {
			// Find max column height of non-locked blocks
			let maxHeight = 0;
			const colHeights = new Map<string, number>();
			for (const b of blocks) {
				if (b.locked) continue;
				const colKey = `${b.x},${b.z}`;
				const next = (colHeights.get(colKey) ?? 0) + 1;
				colHeights.set(colKey, next);
				if (next > maxHeight) maxHeight = next;
			}
			const target = 4;
			const current = Math.min(target, maxHeight);
			const done = maxHeight >= target;
			return {
				current,
				target,
				done,
				summaryBn: `উচ্চতা: ${current}/${target} তলা`,
				summaryEn: `Height: ${current}/${target} levels`
			};
		}
	},
	{
		id: 'colorful-yard',
		titleBn: 'রঙিন উঠোন সাজাই',
		titleEn: 'Colorful Garden Floor',
		goalBn: 'মেঝেতে অন্তত ৪টি ভিন্ন রঙের ব্লক বসাই',
		goalEn: 'Place 4 different colors on the ground',
		hintBn: 'আলাদা আলাদা রং বেছে মাটির আলাদা ঘরে ব্লক বসাও।',
		hintEn: 'Pick different colors and place them on the ground.',
		badge: '🌺',
		badgeNameBn: 'ফুলবাগান ট্রফি',
		badgeNameEn: 'Flower Garden Trophy',
		check: (blocks: Block[]) => {
			const groundBlocks = blocks.filter((b) => !b.locked && b.y === 0);
			const uniqueColors = new Set(groundBlocks.map((b) => b.color));
			const target = 4;
			const current = Math.min(target, uniqueColors.size);
			const done = uniqueColors.size >= target;
			return {
				current,
				target,
				done,
				summaryBn: `ভিন্ন রং: ${current}/${target}টি`,
				summaryEn: `Unique colors: ${current}/${target}`
			};
		}
	},
	{
		id: 'creative-builder',
		titleBn: 'ছোট্ট কারিগর',
		titleEn: 'Creative Builder',
		goalBn: 'অন্তত ৮টি ব্লক দিয়ে তোমার পছন্দের কিছু বানাই',
		goalEn: 'Use at least 8 blocks to build anything you like',
		hintBn: 'যা খুশি বানাও! ৮টি ব্লক হলেই মিশন শেষ হবে।',
		hintEn: 'Build anything! Place at least 8 blocks to complete.',
		badge: '🏆',
		badgeNameBn: 'সুপার বিল্ডার',
		badgeNameEn: 'Super Builder',
		check: (blocks: Block[]) => {
			const nonLockedCount = blocks.filter((b) => !b.locked).length;
			const target = 8;
			const current = Math.min(target, nonLockedCount);
			const done = nonLockedCount >= target;
			return {
				current,
				target,
				done,
				summaryBn: `ব্লক: ${current}/${target}টি`,
				summaryEn: `Blocks: ${current}/${target}`
			};
		}
	}
];

export const MISSIONS_KEY = 'lc.blocks3d.missions.v1';

export function readUnlockedBadges(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(MISSIONS_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

export function saveUnlockedBadge(id: string): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const existing = readUnlockedBadges();
		if (!existing.includes(id)) {
			const next = [...existing, id];
			localStorage.setItem(MISSIONS_KEY, JSON.stringify(next));
			return next;
		}
		return existing;
	} catch {
		return [...new Set([...readUnlockedBadges(), id])];
	}
}

