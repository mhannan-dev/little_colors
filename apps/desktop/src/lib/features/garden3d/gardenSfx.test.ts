import { describe, expect, it } from 'vitest';
import { playFlowerPickupChime, playGardenCelebrationChime } from './gardenSfx.ts';

describe('3D Flower Garden audio chimes', () => {
	it('handles flower pickup and celebration chime calls without crashing in non-browser environments', () => {
		expect(() => playFlowerPickupChime(0, 1)).not.toThrow();
		expect(() => playFlowerPickupChime(4, 0.5)).not.toThrow();
		expect(() => playGardenCelebrationChime(1)).not.toThrow();
	});
});

