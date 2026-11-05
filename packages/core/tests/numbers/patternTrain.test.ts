import { describe, expect, it } from 'vitest';
import { createPatternTrain, initialPatternTrain, patternTrainReducer, TRAIN_STAGES, type PatternTrainPlan, type PatternTrainProgress } from '../../src/numbers/lessons/patternTrain.ts';
import { findGridPath, sameCell, type GridDirection } from '../../src/numbers/lessons/thinkingLessons.ts';
import { TRAIN_NARRATION } from '../../src/numbers/lessons/trainNarration.ts';
function solve(p:PatternTrainPlan,state:PatternTrainProgress) {
	let s=state;
	if(s.stage===0) for(const gap of p.gaps) s=patternTrainReducer(p,s,{type:'CARRIAGE',id:p.carriages[gap]!.id});
	else if(s.stage===1) {s=patternTrainReducer(p,s,{type:'HIDE'});for(const t of p.passengers)s=patternTrainReducer(p,s,{type:'SEAT',index:p.seats.findIndex(item=>item?.id===t.id)});}
	else for(const cell of findGridPath(p.route,s.position)!){const direction:GridDirection=cell.row<s.position.row?'up':cell.row>s.position.row?'down':cell.column<s.position.column?'left':'right';s=patternTrainReducer(p,s,{type:'MOVE',direction});}
	return s;
}
describe('Rumi’s Pattern Train',()=>{
	it.each(['5-7','8-10'] as const)('%s: 1,000 seeded trains have inferable patterns, unique seats and reachable stations',(age)=>{
		for(let seed=0;seed<1000;seed++){
			const p=createPatternTrain(age,seed);expect(p).toEqual(createPatternTrain(age,seed));const period=age==='5-7'?2:3;
			for(let i=0;i<p.carriages.length;i++)expect(p.carriages[i]).toEqual(p.carriages[i%period]);
			expect(p.gaps).toHaveLength(2);expect(p.gaps.every(i=>i>=period)).toBe(true);
			expect(p.passengers).toHaveLength(age==='5-7'?3:4);for(const t of p.passengers)expect(p.seats.filter(item=>item?.id===t.id)).toHaveLength(1);
			expect(findGridPath(p.route)).not.toBeNull();let s=initialPatternTrain(p);
			for(let stage=0;stage<3;stage++){s=solve(p,patternTrainReducer(p,s,{type:'BEGIN'}));expect(s.phase).toBe('complete');expect(s.completed).toBe(stage+1);s=patternTrainReducer(p,s,{type:'NEXT'});}expect(s.phase).toBe('finished');
		}
	});
	it('guards progression and keeps the first correct carriage after a wrong choice',()=>{
		const p=createPatternTrain('8-10',13);let s=initialPatternTrain(p);expect(patternTrainReducer(p,s,{type:'NEXT'})).toBe(s);
		s=patternTrainReducer(p,s,{type:'BEGIN'});s=patternTrainReducer(p,s,{type:'CARRIAGE',id:p.carriages[p.gaps[0]!]!.id});
		s=patternTrainReducer(p,s,{type:'CARRIAGE',id:'invalid'});expect(s.filled).toBe(1);expect(s.completed).toBe(0);
		s=patternTrainReducer(p,s,{type:'CARRIAGE',id:p.carriages[p.gaps[1]!]!.id});expect(s.phase).toBe('complete');expect(patternTrainReducer(p,s,{type:'RESET'})).toBe(s);
	});
	it('memory peek keeps recovered passengers; invalid seats do not advance; reset retains completed jobs',()=>{
		const p=createPatternTrain('5-7',25);let s=patternTrainReducer(p,solve(p,patternTrainReducer(p,initialPatternTrain(p),{type:'BEGIN'})),{type:'NEXT'});
		s=patternTrainReducer(p,s,{type:'BEGIN'});expect(patternTrainReducer(p,s,{type:'SEAT',index:0})).toBe(s);s=patternTrainReducer(p,s,{type:'HIDE'});
		for(const index of [-1,6,NaN,1.2])expect(patternTrainReducer(p,s,{type:'SEAT',index}).seated).toBe(0);
		s=patternTrainReducer(p,s,{type:'SEAT',index:p.seats.findIndex(t=>t?.id===p.passengers[0]!.id)});
		s=patternTrainReducer(p,s,{type:'PEEK'});expect(s.seated).toBe(1);s=patternTrainReducer(p,s,{type:'RESET'});expect(s.seated).toBe(0);expect(s.completed).toBe(1);expect(s.filled).toBe(2);
	});
	it('route boundaries and rocks preserve position and hints do not move the train',()=>{
		const p=createPatternTrain('8-10',4);let s=initialPatternTrain(p);s={...s,stage:2,phase:'play',completed:2};
		const blocked=patternTrainReducer(p,s,{type:'MOVE',direction:'left'});expect(blocked.position).toEqual(s.position);expect(blocked.completed).toBe(2);
		const hinted=patternTrainReducer(p,blocked,{type:'HINT'});expect(hinted.hint).toBe(true);expect(hinted.position).toEqual(s.position);
		const next=findGridPath(p.route)![0]!;const moved=patternTrainReducer(p,hinted,{type:'MOVE',direction:next.row<s.position.row?'up':'right'});expect(moved.hint).toBe(false);
		const reset=patternTrainReducer(p,moved,{type:'RESET'});expect(reset.position).toEqual(p.route.start);expect(reset.completed).toBe(2);
		const done=solve(p,reset);expect(sameCell(done.position,p.route.goal)).toBe(true);expect(done.phase).toBe('complete');expect(patternTrainReducer(p,done,{type:'MOVE',direction:'left'})).toBe(done);
	});
	it('preserves prior inputs and emits valid bilingual narration keys',()=>{
		const p=createPatternTrain('8-10',5),original=JSON.stringify(p),initial=initialPatternTrain(p);let s=initial;const keys=new Set(TRAIN_NARRATION.map(e=>e.key));expect(keys.size).toBe(TRAIN_NARRATION.length);
		for(const kind of TRAIN_STAGES)for(const prefix of ['story','instruction','hint'])expect(keys.has(`train.${prefix}.${kind}`)).toBe(true);
		for(const e of TRAIN_NARRATION){expect(e.bn.length).toBeGreaterThan(0);expect(e.en.length).toBeGreaterThan(0);}
		for(let i=0;i<3;i++){s=solve(p,patternTrainReducer(p,s,{type:'BEGIN'}));expect(keys.has(s.feedbackKey)).toBe(true);s=patternTrainReducer(p,s,{type:'NEXT'});}
		expect(initial).toEqual(initialPatternTrain(p));expect(JSON.stringify(p)).toBe(original);
	});
});
