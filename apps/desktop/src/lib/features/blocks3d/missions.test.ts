import { describe, expect, it } from 'vitest';
import { MISSIONS, type Mission } from './missions.ts';
import type { Block } from './blocks.ts';

describe('3D Block Building learning missions', () => {
	it('defines 4 kid-friendly educational missions with valid badges and descriptions', () => {
		expect(MISSIONS.length).toBe(4);
		for (const m of MISSIONS) {
			expect(m.id).toBeTruthy();
			expect(m.titleBn).toBeTruthy();
			expect(m.titleEn).toBeTruthy();
			expect(m.badge).toBeTruthy();
		}
	});

	it('evaluates Colors & Counting mission correctly', () => {
		const mission = MISSIONS.find((m) => m.id === 'colors-count')!;
		expect(mission.check([]).done).toBe(false);

		const blocks: Block[] = [
			{ x: 0, y: 0, z: 0, color: '#e58c81' }, // Red 1
			{ x: 1, y: 0, z: 0, color: '#e58c81' }, // Red 2
			{ x: 2, y: 0, z: 0, color: '#80b9ce' }  // Blue 1
		];
		let res = mission.check(blocks);
		expect(res.done).toBe(false);
		expect(res.current).toBe(3);

		// Add 1 red and 1 blue to fulfill 3 red + 2 blue
		blocks.push({ x: 3, y: 0, z: 0, color: '#e58c81' }); // Red 3
		blocks.push({ x: 4, y: 0, z: 0, color: '#80b9ce' }); // Blue 2
		res = mission.check(blocks);
		expect(res.done).toBe(true);
		expect(res.current).toBe(5);
	});

	it('evaluates Tall Tower mission correctly', () => {
		const mission = MISSIONS.find((m) => m.id === 'tall-tower')!;
		const tower: Block[] = [
			{ x: 2, y: 0, z: 2, color: '#f2d877' },
			{ x: 2, y: 1, z: 2, color: '#8dbb8d' },
			{ x: 2, y: 2, z: 2, color: '#80b9ce' }
		];
		expect(mission.check(tower).done).toBe(false);
		expect(mission.check(tower).current).toBe(3);

		// 4th level
		tower.push({ x: 2, y: 3, z: 2, color: '#e58c81' });
		expect(mission.check(tower).done).toBe(true);
		expect(mission.check(tower).current).toBe(4);
	});

	it('ignores locked Kaaba blocks from counting towards missions', () => {
		const mission = MISSIONS.find((m) => m.id === 'creative-builder')!;
		const lockedBlocks: Block[] = [
			{ x: 0, y: 0, z: 0, color: '#2f3437', locked: true },
			{ x: 0, y: 1, z: 0, color: '#2f3437', locked: true }
		];
		expect(mission.check(lockedBlocks).current).toBe(0);
	});
});

