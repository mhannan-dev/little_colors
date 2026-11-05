import { describe, expect, it } from 'vitest';
import { createSillyShop, initialSillyShopProgress, sillyShopReducer, shopShelf, SHOP_STAGES, type SillyShopPlan, type SillyShopProgress } from '../../src/numbers/lessons/sillyShop.ts';
import { SHOP_NARRATION } from '../../src/numbers/lessons/shopNarration.ts';

function solve(p: SillyShopPlan, state: SillyShopProgress) {
	let s = state;
	if (s.stage === 0) { s = sillyShopReducer(p,s,{type:'HIDE'}); for(const e of p.order) for(let i=0;i<e.quantity;i++) s=sillyShopReducer(p,s,{type:'ADD',item:e.item}); }
	else if(s.stage===1) for(const item of p.shelves) s=sillyShopReducer(p,s,{type:'SHELVE',shelf:shopShelf(item)});
	else if(s.stage===2) s=sillyShopReducer(p,s,{type:'COUNT',value:p.countGroups.reduce((a,b)=>a+b,0)});
	else if(s.stage===3) s=sillyShopReducer(p,s,{type:'COMPARE',side:p.comparison==='more' ? p.left>p.right?'left':'right' : p.left<p.right?'left':'right'});
	else s=sillyShopReducer(p,s,{type:'FIX',item:'sock'});
	return s;
}
describe('Rumi’s Silly Shop',()=>{
	it.each(['5-7','8-10'] as const)('%s: 1,000 seeded orders and puzzles are reproducible, unique and solvable',(age)=>{
		for(let seed=0;seed<1000;seed++) {
			const p=createSillyShop(age,seed); expect(p).toEqual(createSillyShop(age,seed));
			expect(p.order).toHaveLength(age==='5-7'?2:3); expect(new Set(p.order.map(e=>e.item)).size).toBe(p.order.length);
			for(const e of p.order) expect(e.quantity).toBeGreaterThan(0);
			expect(p.countGroups).toHaveLength(age==='5-7'?1:2); const total=p.countGroups.reduce((a,b)=>a+b,0);
			expect(p.countOptions.filter(n=>n===total)).toHaveLength(1); expect(new Set(p.countOptions).size).toBe(3);
			expect(p.left).not.toBe(p.right); expect(p.lunch.filter(t=>t==='sock')).toHaveLength(1);
			expect(new Set(p.shelves).size).toBe(p.shelves.length);
			let s=initialSillyShopProgress(); for(let stage=0;stage<5;stage++) { s=solve(p,sillyShopReducer(p,s,{type:'BEGIN'})); expect(s.phase).toBe('complete'); expect(s.completed).toBe(stage+1); s=sillyShopReducer(p,s,{type:'NEXT'}); } expect(s.phase).toBe('finished');
		}
	});
	it('cannot skip jobs, order while observing, or repeat a completed job',()=>{
		const p=createSillyShop('5-7',12), s=initialSillyShopProgress();
		expect(sillyShopReducer(p,s,{type:'NEXT'})).toBe(s);
		const observe=sillyShopReducer(p,s,{type:'BEGIN'}); expect(sillyShopReducer(p,observe,{type:'ADD',item:p.order[0]!.item})).toBe(observe);
		const done=solve(p,observe); expect(sillyShopReducer(p,done,{type:'ADD',item:p.order[0]!.item})).toBe(done);
		expect(sillyShopReducer(p,done,{type:'RESET'})).toBe(done);
	});
	it('wrong items and extra quantities preserve accepted basket items',()=>{
		const p=createSillyShop('8-10',1); let s=sillyShopReducer(p,sillyShopReducer(p,initialSillyShopProgress(),{type:'BEGIN'}),{type:'HIDE'});
		const first=p.order[0]!; for(let i=0;i<first.quantity;i++) s=sillyShopReducer(p,s,{type:'ADD',item:first.item});
		const basket=JSON.stringify(s.basket); s=sillyShopReducer(p,s,{type:'ADD',item:first.item}); expect(JSON.stringify(s.basket)).toBe(basket);
		s=sillyShopReducer(p,s,{type:'ADD',item:'sock'}); expect(JSON.stringify(s.basket)).toBe(basket); expect(s.phase).toBe('play');
		s=sillyShopReducer(p,s,{type:'PEEK'}); expect(s.phase).toBe('observe'); expect(JSON.stringify(s.basket)).toBe(basket);
		s=sillyShopReducer(p,s,{type:'RESET'}); expect(s.basket).toEqual({}); expect(s.completed).toBe(0);
	});
	it('wrong shelf, count, comparison and lunch choices do not advance',()=>{
		const p=createSillyShop('8-10',3); let s=initialSillyShopProgress();
		for(let stage=0;stage<5;stage++) {
			s=sillyShopReducer(p,s,{type:'BEGIN'});
			if(stage===1) { const wrong=shopShelf(p.shelves[0]!)==='food'?'supplies':'food'; const r=sillyShopReducer(p,s,{type:'SHELVE',shelf:wrong}); expect(r.sorted).toEqual([]); expect(r.completed).toBe(stage); }
			if(stage===2) expect(sillyShopReducer(p,s,{type:'COUNT',value:-1}).phase).toBe('play');
			if(stage===3) { const correct=p.comparison==='more'?p.left>p.right:p.left<p.right; expect(sillyShopReducer(p,s,{type:'COMPARE',side:correct?'right':'left'}).phase).toBe('play'); }
			if(stage===4) expect(sillyShopReducer(p,s,{type:'FIX',item:'apple'}).phase).toBe('play');
			s=solve(p,s); s=sillyShopReducer(p,s,{type:'NEXT'});
		}
	});
	it('reset and hints retain earlier completed jobs; prior inputs remain immutable',()=>{
		const p=createSillyShop('5-7',22), original=JSON.stringify(p), initial=initialSillyShopProgress();
		let s=sillyShopReducer(p,solve(p,sillyShopReducer(p,initial,{type:'BEGIN'})),{type:'NEXT'});
		s=sillyShopReducer(p,s,{type:'BEGIN'}); s=sillyShopReducer(p,s,{type:'SHELVE',shelf:shopShelf(p.shelves[0]!)});
		s=sillyShopReducer(p,s,{type:'HINT'}); expect(s.completed).toBe(1); expect(s.hint).toBe(true);
		s=sillyShopReducer(p,s,{type:'RESET'}); expect(s.sorted).toEqual([]); expect(s.completed).toBe(1); expect(s.basket).not.toEqual({});
		expect(initial).toEqual(initialSillyShopProgress()); expect(JSON.stringify(p)).toBe(original);
	});
	it('all stage narration is bilingual and emitted keys exist',()=>{
		const keys=new Set(SHOP_NARRATION.map(e=>e.key)); expect(keys.size).toBe(SHOP_NARRATION.length);
		for(const kind of SHOP_STAGES) for(const prefix of ['story','instruction','hint']) expect(keys.has(`shop.${prefix}.${kind}`)).toBe(true);
		for(const entry of SHOP_NARRATION) { expect(entry.bn.length).toBeGreaterThan(0); expect(entry.en.length).toBeGreaterThan(0); }
		const p=createSillyShop('5-7',11); let s=initialSillyShopProgress(); for(let i=0;i<5;i++) { s=solve(p,sillyShopReducer(p,s,{type:'BEGIN'})); expect(keys.has(s.feedbackKey)).toBe(true); s=sillyShopReducer(p,s,{type:'NEXT'}); expect(keys.has(s.feedbackKey)).toBe(true); }
	});
});
