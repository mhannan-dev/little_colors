import { describe, expect, it } from 'vitest';
import { columnTop, HEIGHT, inside, key, PALETTE, SIZE, template, type Block } from './blocks.ts';
import { FREE_IDEAS, freeTile, ideaForMission, nextCell, placeIdea, remaining } from './ideas.ts';
import { MISSIONS } from './missions.ts';

/** Fill the guide the way a child does: tap the column of the shown block. */
function tapNext(blocks: Block[], cell: Block): Block[] {
	return [...blocks, { x: cell.x, y: columnTop(blocks, cell.x, cell.z), z: cell.z, color: cell.color }];
}

describe('give me an idea', () => {
	for (const id of [...FREE_IDEAS, 'count'] as const) {
		it(`${id}: fits on an empty mat and can be filled by tapping the shown column`, () => {
			const guide = placeIdea(id, [])!;
			expect(guide.cells.every(inside)).toBe(true);
			let blocks: Block[] = [];
			for (let i = 0; i < 50 && nextCell(guide, blocks); i++) {
				const cell = nextCell(guide, blocks)!;
				blocks = tapNext(blocks, cell);
				// The tap landed exactly on the shadow block (no overhangs).
				expect(blocks.at(-1)).toEqual(cell);
			}
			expect(remaining(guide, blocks)).toEqual([]);
		});
	}

	it('every mission has a matching idea that completes it', () => {
		for (const m of MISSIONS) {
			const id = ideaForMission(m.id)!;
			expect(id, m.id).toBeTruthy();
			const blocks = placeIdea(id, [])!.cells;
			expect(m.check(blocks).done, m.id).toBe(true);
		}
		expect(ideaForMission(null)).toBeNull();
	});

	it('goes on empty ground only: never on the Kaaba or on other blocks', () => {
		const kaaba = template('kaaba').filter((b) => b.locked);
		const guide = placeIdea('house', kaaba)!;
		const used = new Set(kaaba.map((b) => `${b.x},${b.z}`));
		expect(guide.cells.some((c) => used.has(`${c.x},${c.z}`))).toBe(false);
		const full: Block[] = [];
		for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) full.push({ x, y: 0, z, color: PALETTE[0].hex });
		expect(placeIdea('tower', full)).toBeNull();
		expect(freeTile(full)!.y).toBe(1); // on top of the one layer
	const tall: Block[] = [];
	for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) for (let y = 0; y < HEIGHT; y++) tall.push({ x, y, z, color: PALETTE[0].hex });
	expect(freeTile(tall)).toBeNull();
		expect(freeTile(kaaba)).not.toBeNull();
		expect(used.has(`${freeTile(kaaba)!.x},${freeTile(kaaba)!.z}`)).toBe(false);
	});

	it('a block of any color in the right place counts; removing it brings the shadow back', () => {
		const guide = placeIdea('tower', [])!;
		const first = guide.cells[0]!;
		const blocks = [{ ...first, color: PALETTE[5].hex }];
		expect(remaining(guide, blocks).map(key)).not.toContain(key(first));
		expect(remaining(guide, []).map(key)).toContain(key(first));
	});
});
