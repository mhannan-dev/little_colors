import { describe, expect, it } from 'vitest';
import { PALETTE, template } from './blocks.ts';
import { addSaved, MAX_SAVED, readSaved, removeSaved } from './savedBuilds.ts';

const thumb = 'data:image/jpeg;base64,AAAA';
const one = [{ x: 1, y: 0, z: 1, color: PALETTE[0].hex }];

describe('my builds', () => {
	it('saves newest first, keeps one copy of the same build, and refuses an empty mat', () => {
		const a = addSaved([], one, thumb, 1000);
		expect(a.status).toBe('saved');
		const again = addSaved(a.list, [...one], thumb, 2000);
		expect(again.status).toBe('already');
		expect(again.list).toHaveLength(1);
		const b = addSaved(a.list, template('house'), thumb, 3000);
		expect(b.status).toBe('saved');
		expect(b.list.map((s) => s.savedAt)).toEqual([3000, 1000]);
		expect(addSaved(b.list, [], thumb, 4000).status).toBe('empty');
	});

	it(`stops at ${MAX_SAVED} instead of silently deleting an old build`, () => {
		let list = addSaved([], one, thumb, 1).list;
		for (let i = 1; i < MAX_SAVED; i++) list = addSaved(list, [{ x: i % 8, y: 0, z: Math.floor(i / 8), color: PALETTE[1].hex }], thumb, i + 1).list;
		expect(list).toHaveLength(MAX_SAVED);
		const full = addSaved(list, template('tower'), thumb, 99);
		expect(full.status).toBe('full');
		expect(full.list).toBe(list);
		expect(removeSaved(list, list[0]!.id)).toHaveLength(MAX_SAVED - 1);
	});

	it('round-trips through storage, keeps the Kaaba lock, and drops corrupt entries', () => {
		const saved = addSaved([], template('kaaba'), thumb, 5).list;
		const back = readSaved(JSON.stringify(saved));
		expect(back).toEqual(saved);
		expect(back[0]!.blocks.some((b) => b.locked)).toBe(true);
		expect(readSaved('{nope')).toEqual([]);
		expect(readSaved(JSON.stringify([{ id: 'x', savedAt: 1, blocks: one, thumb: 'javascript:alert(1)' }, { id: 'y', savedAt: 1, blocks: [], thumb }, null]))).toEqual([]);
	});
});
