import { describe, expect, it } from 'vitest';
import { createTreasureAdventure, initialTreasureProgress, treasureReducer, treasureTarget, TREASURE_STAGES, type TreasurePlan, type TreasureProgress } from '../../src/numbers/lessons/treasureAdventure.ts';
import { TREASURE_NARRATION } from '../../src/numbers/lessons/treasureNarration.ts';

function solve(plan: TreasurePlan, state: TreasureProgress) {
	if (state.stage === 0) for (const token of plan.clues) state = treasureReducer(plan, state, { type:'PICK', id:token.id });
	if (state.stage === 1) { state = treasureReducer(plan, state, { type:'HIDE' }); for (const token of plan.remembered) state = treasureReducer(plan,state,{ type:'SPOT', cell:plan.spots.findIndex((t) => t?.id === token.id) }); }
	if (state.stage === 2) for (const token of plan.sorting.filter((t) => t.shape === plan.sortShape)) state = treasureReducer(plan,state,{ type:'PICK',id:token.id });
	if (state.stage === 3) state = treasureReducer(plan,state,{ type:'PICK',id:plan.answer.id });
	return state;
}
describe('Treasure Hunt Adventure', () => {
	it.each(['5-7','8-10'] as const)('%s: seeded plans have unique solvable clues, spots, sorting and patterns', (age) => {
		for(let seed=0;seed<1000;seed++) {
			const p=createTreasureAdventure(age,seed); expect(p).toEqual(createTreasureAdventure(age,seed));
			expect(new Set(p.objects.map((t)=>t.id)).size).toBe(p.objects.length);
			expect(p.clues).toHaveLength(age==='5-7'?2:3); expect(p.remembered).toHaveLength(age==='5-7'?2:3);
			for(const t of p.clues) expect(p.objects).toContainEqual(t);
			for(const t of p.remembered) expect(p.spots.filter((s)=>s?.id===t.id)).toHaveLength(1);
			expect(p.sorting.filter((t)=>t.shape===p.sortShape)).toHaveLength(3);
			const unit=p.sequence.slice(0,age==='5-7'?2:3);
			for(let i=0;i<p.sequence.length;i++) expect(p.sequence[i]).toEqual(unit[i%unit.length]);
			expect(p.answer).toEqual(unit[p.sequence.length%unit.length]); expect(p.options.filter(t=>t.id===p.answer.id)).toHaveLength(1);
		}
	});
	it.each(['5-7','8-10'] as const)('%s: all four keys require solved puzzles and explicit next/open', (age) => {
		const p=createTreasureAdventure(age,42); let s=initialTreasureProgress();
		expect(treasureReducer(p,s,{type:'OPEN'})).toBe(s); expect(treasureReducer(p,s,{type:'NEXT'})).toBe(s);
		for(let stage=0;stage<4;stage++) {
			expect(s.stage).toBe(stage); expect(s.phase).toBe('intro');
			s=treasureReducer(p,s,{type:'BEGIN'}); s=solve(p,s); expect(s.phase).toBe('complete'); expect(s.keys).toBe(stage+1);
			expect(treasureReducer(p,s,{type:'PICK',id:p.answer.id})).toBe(s);
			s=treasureReducer(p,s,{type:'NEXT'});
		}
		expect(s.phase).toBe('chest'); s=treasureReducer(p,s,{type:'OPEN'}); expect(s.phase).toBe('finished');
		expect(treasureReducer(p,s,{type:'OPEN'})).toBe(s);
	});
	it('wrong clues, invalid cells and duplicate sorting never earn keys or erase finds', () => {
		const p=createTreasureAdventure('8-10',19); let s=treasureReducer(p,initialTreasureProgress(),{type:'BEGIN'});
		s=treasureReducer(p,s,{type:'PICK',id:p.clues[0]!.id}); const before=JSON.parse(JSON.stringify(s)) as TreasureProgress;
		s=treasureReducer(p,s,{type:'PICK',id:'unknown'}); expect(s.found).toBe(1); expect(s.keys).toBe(0); expect(s.selected).toEqual(before.selected);
		s={...s,stage:1,found:0}; for(const cell of [-1,6,1.2,NaN]) expect(treasureReducer(p,s,{type:'SPOT',cell}).found).toBe(0);
		s={...s,stage:2,found:0,selected:[]}; const t=p.sorting.find(t=>t.shape===p.sortShape)!;
		s=treasureReducer(p,s,{type:'PICK',id:t.id}); expect(treasureReducer(p,s,{type:'PICK',id:t.id})).toBe(s);
	});
	it('peek and reset keep earlier keys, and hints do not solve a puzzle', () => {
		const p=createTreasureAdventure('5-7',2); let s=solve(p,treasureReducer(p,initialTreasureProgress(),{type:'BEGIN'}));
		s=treasureReducer(p,treasureReducer(p,s,{type:'NEXT'}),{type:'BEGIN'}); expect(s.phase).toBe('observe');
		s=treasureReducer(p,s,{type:'HIDE'}); const target=treasureTarget(p,s)!;
		s=treasureReducer(p,s,{type:'SPOT',cell:p.spots.findIndex(t=>t?.id===target.id)});
		s=treasureReducer(p,s,{type:'PEEK'}); expect(s.phase).toBe('observe'); expect(s.found).toBe(1); expect(s.keys).toBe(1);
		s=treasureReducer(p,s,{type:'RESET'}); expect(s.found).toBe(0); expect(s.keys).toBe(1);
		s=treasureReducer(p,s,{type:'HIDE'}); s=treasureReducer(p,s,{type:'HINT'}); expect(s.hint).toBe(true); expect(s.keys).toBe(1);
	});
	it('does not mutate earlier state or plans, and every emitted narration has bilingual text', () => {
		const p=createTreasureAdventure('8-10',14), original=JSON.stringify(p), initial=initialTreasureProgress(); let s=initial;
		const keys=new Set(TREASURE_NARRATION.map(e=>e.key));
		for(const stage of TREASURE_STAGES) for(const prefix of ['story','instruction','hint']) expect(keys.has(`treasure.${prefix}.${stage}`)).toBe(true);
		for(const e of TREASURE_NARRATION) { expect(e.bn.length).toBeGreaterThan(0); expect(e.en.length).toBeGreaterThan(0); }
		for(let i=0;i<4;i++) { s=solve(p,treasureReducer(p,s,{type:'BEGIN'})); expect(keys.has(s.feedbackKey)).toBe(true); s=treasureReducer(p,s,{type:'NEXT'}); }
		expect(initial).toEqual(initialTreasureProgress()); expect(JSON.stringify(p)).toBe(original);
	});
});
