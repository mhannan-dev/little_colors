import { describe, expect, it } from 'vitest';
import { columnTop, inside, isLockedColumn, key, PALETTE, readBuild, template } from './blocks.ts';
import { pick } from './render.ts';

describe('saved block designs',()=>{
	it('rejects corrupt data and filters invalid, duplicate, and out-of-bounds blocks',()=>{
		const valid={x:1,y:0,z:2,color:PALETTE[0].hex};
		expect(readBuild('{broken')).toEqual([]);
		expect(readBuild('{"blocks":[]}')).toEqual([]);
		expect(readBuild(JSON.stringify([valid,valid,null,{...valid,x:-1},{...valid,y:10},{...valid,x:8},{...valid,z:0.5},{...valid,color:'url(unsafe)'}]))).toEqual([valid]);
	});
	it('keeps the next block above a column, including a column with a gap',()=>{
		expect(columnTop([],3,3)).toBe(0);
		expect(columnTop([{x:3,y:4,z:3,color:PALETTE[0].hex}],3,3)).toBe(5);
	});
});

for (const kind of ['house','tower','rainbow','kaaba'] as const) {
	it(`${kind} is an editable, valid design that survives saving`,()=>{
		const blocks=template(kind);
		expect(blocks.length).toBeGreaterThan(20);
		expect(blocks.every(inside)).toBe(true);
		expect(new Set(blocks.map(key)).size).toBe(blocks.length);
		expect(readBuild(JSON.stringify(blocks))).toEqual(blocks);
	});
}

it('picks the foreground block instead of the floor behind it',()=>{
	const floor={cell:{x:2,y:-1,z:2},normal:{x:0,y:1,z:0},floor:true};
	const block={cell:{x:2,y:0,z:2},normal:{x:1,y:0,z:0},floor:false};
	const points: [number,number][]=[[0,0],[100,0],[100,100],[0,100]];
	expect(pick([{points,hit:floor},{points,hit:block}],50,50)).toEqual(block);
	expect(pick([{points,hit:floor}],150,50)).toBeUndefined();
});

it('the Kaaba is a locked black cube with a gold band and door, on a free white courtyard (PR-13)',()=>{
	const blocks=template('kaaba');
	const kaaba=blocks.filter(b=>b.locked);
	expect(kaaba.length).toBe(16*7);
	expect(kaaba.every(b=>b.x>=2 && b.x<=5 && b.z>=2 && b.z<=5)).toBe(true);
	expect(kaaba.some(b=>b.color==='#c9a227' && b.y===5)).toBe(true);
	expect(kaaba.filter(b=>b.color==='#c9a227' && b.y<5)).toHaveLength(2);
	expect(blocks.filter(b=>!b.locked).every(b=>b.y===0 && b.color==='#ffffff')).toBe(true);
	expect(isLockedColumn(blocks,3,3)).toBe(true);
	expect(isLockedColumn(blocks,0,0)).toBe(false);
	// The lock survives saving and reopening.
	expect(readBuild(JSON.stringify(blocks)).filter(b=>b.locked)).toHaveLength(kaaba.length);
});
