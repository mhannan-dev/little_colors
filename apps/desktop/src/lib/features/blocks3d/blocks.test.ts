import { describe, expect, it } from 'vitest';
import { columnTop, inside, key, PALETTE, readBuild, template } from './blocks.ts';
import { pick } from './render.ts';

describe('saved block designs',()=>{
	it('rejects corrupt data and filters invalid, duplicate, and out-of-bounds blocks',()=>{
		const valid={x:1,y:0,z:2,color:PALETTE[0].hex};
		expect(readBuild('{broken')).toEqual([]);
		expect(readBuild('{"blocks":[]}')).toEqual([]);
		expect(readBuild(JSON.stringify([valid,valid,null,{...valid,x:-1},{...valid,y:8},{...valid,z:0.5},{...valid,color:'url(unsafe)'}]))).toEqual([valid]);
	});
	it('keeps the next block above a column, including a column with a gap',()=>{
		expect(columnTop([],3,3)).toBe(0);
		expect(columnTop([{x:3,y:4,z:3,color:PALETTE[0].hex}],3,3)).toBe(5);
	});
});

for (const kind of ['house','tower','rainbow'] as const) {
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
