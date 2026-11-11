import { describe, expect, it } from 'vitest';
import {
	breakfast,
	freshDirt,
	getNarration,
	isClean,
	MOUTH_ZONES,
	NARRATION_CATALOG,
	nextDirtyZone,
	scrub,
	TEETH_FOODS,
	zoneAt
} from '../../src/index.ts';

describe("Toothie's Morning Adventure", () => {
	it('any scrubbing cleans a zone in a few strokes; direction never matters', () => {
		let d = 1;
		let strokes = 0;
		let cleaned = false;
		while (!cleaned && strokes < 20) {
			const r = scrub(d, 1);
			d = r.dirt;
			cleaned = r.justCleaned;
			strokes++;
		}
		expect(cleaned).toBe(true);
		expect(d).toBe(0);
		expect(strokes).toBeGreaterThanOrEqual(3);
		expect(strokes).toBeLessThanOrEqual(4);
		// Negative (backwards) strokes are treated as no movement, never as "wrong".
		expect(scrub(0.5, -1).dirt).toBe(0.5);
		expect(scrub(0, 1)).toEqual({ dirt: 0, justCleaned: false });
	});

	it('the mouth splits into four parts and the guide follows the brushing order', () => {
		expect(zoneAt(0.1, 0.1)).toBe('top-left');
		expect(zoneAt(0.9, 0.2)).toBe('top-right');
		expect(zoneAt(0.2, 0.8)).toBe('bottom-left');
		expect(zoneAt(0.7, 0.9)).toBe('bottom-right');
		expect(zoneAt(1.2, 0.5)).toBeNull();
		const dirt = freshDirt();
		expect(nextDirtyZone(dirt)).toBe('top-left');
		dirt['top-left'] = 0;
		dirt['bottom-left'] = 0;
		expect(nextDirtyZone(dirt)).toBe('top-right');
		for (const z of MOUTH_ZONES) dirt[z] = 0;
		expect(isClean(dirt)).toBe(true);
		expect(nextDirtyZone(dirt)).toBeNull();
	});

	it('breakfast is two sweets and one healthy food, varied by morning', () => {
		for (let s = 0; s < 12; s++) {
			const b = breakfast(s);
			expect(b).toHaveLength(3);
			expect(new Set(b).size).toBe(3);
			expect(b.filter((f) => TEETH_FOODS[f].sweet)).toHaveLength(2);
		}
		expect(breakfast(0)).not.toEqual(breakfast(1));
	});

	it('every line is in the catalog; keys are unique', () => {
		for (const k of ['mode.teeth', 'teeth.brush', 'teeth.rinse', 'teeth.sticker', 'teeth.zone.top-left', 'teeth.song.bottom-right', 'teeth.friend.dino', 'teeth.food.laddu']) expect(getNarration(k), k).toBeDefined();
		const keys = NARRATION_CATALOG.map((e) => e.key);
		expect(keys.length).toBe(new Set(keys).size);
	});
});
