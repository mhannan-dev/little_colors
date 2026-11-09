import { describe, expect, it } from 'vitest';
import { checkTray, createKitchenRound, FOODS, friendWantsKey, getNarration, itemKey, KITCHEN_ROUND_LENGTH, NARRATION_CATALOG, STATIONS, type Difficulty } from '../../src/index.ts';

describe("Rumi's Kitchen orders (1,000 seeds per level)", () => {
	for (const d of ['beginner', 'explorer', 'advanced'] as Difficulty[]) {
		it(d, () => {
			for (let seed = 0; seed < 1000; seed++) {
				const round = createKitchenRound(d, seed);
				expect(createKitchenRound(d, seed)).toEqual(round);
				expect(round.orders).toHaveLength(KITCHEN_ROUND_LENGTH);
				expect(new Set(round.orders.map((o) => o.friend)).size).toBe(KITCHEN_ROUND_LENGTH);
				for (const o of round.orders) {
					expect(new Set(o.lines.map((l) => l.food)).size).toBe(o.lines.length);
					const total = o.lines.reduce((n, l) => n + l.count, 0);
					if (d === 'beginner') {
						expect(o.lines).toHaveLength(1);
						expect(total).toBeLessThanOrEqual(2);
					}
					expect(total).toBeLessThanOrEqual(5);
					expect(getNarration(friendWantsKey(o.friend))).toBeDefined();
					for (const l of o.lines) expect(getNarration(itemKey(l.food, l.count)), itemKey(l.food, l.count)).toBeDefined();
				}
			}
		});
	}
});

describe('checking the plate', () => {
	const order = { id: 'x', friend: 'cat' as const, lines: [{ food: 'apple' as const, count: 2 as const }, { food: 'milk' as const, count: 1 as const }] };
	it('matches in any order', () => {
		expect(checkTray(order, ['milk', 'apple', 'apple']).match).toBe(true);
	});
	it('tells what is still missing and what is extra', () => {
		expect(checkTray(order, ['apple'])).toEqual({ match: false, missing: [{ food: 'apple', count: 1 }, { food: 'milk', count: 1 }], extra: [] });
		expect(checkTray(order, ['apple', 'apple', 'apple', 'milk', 'egg'])).toEqual({
			match: false,
			missing: [],
			extra: [{ food: 'apple', count: 1 }, { food: 'egg', count: 1 }]
		});
	});
});

it('every food belongs to exactly one station, and all kitchen lines are in the catalog once', () => {
	const placed = STATIONS.flatMap((s) => s.foods);
	expect(placed.sort()).toEqual(Object.keys(FOODS).sort());
	const keys = NARRATION_CATALOG.map((e) => e.key);
	expect(keys.length).toBe(new Set(keys).size);
	expect(getNarration('mode.kitchen')).toBeDefined();
});
