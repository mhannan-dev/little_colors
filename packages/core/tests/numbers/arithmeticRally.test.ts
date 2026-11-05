import {describe,it,expect} from 'vitest';
import {createArithmeticRally,initialArithmeticRally,arithmeticRallyReducer,rallyInstruction,type RallyOperation} from '../../src/numbers/lessons/arithmeticRally.ts';
import {RALLY_NARRATION} from '../../src/numbers/lessons/rallyNarration.ts';
describe('addition and subtraction car adventure',()=>{
	it.each((['5-7','8-10'] as const).flatMap(age=>(['add','subtract'] as RallyOperation[]).map(operation=>({age,operation}))))('$age / $operation: 1,000 seeded trips have valid arithmetic, unique choices and six guarded stops',({age,operation})=>{
		for(let seed=0;seed<1000;seed++){
			const p=createArithmeticRally(age,operation,seed),limit=age==='5-7'?10:20;expect(p).toEqual(createArithmeticRally(age,operation,seed));expect(p.questions).toHaveLength(6);
			expect(new Set(p.questions.map(q=>`${q.left}:${q.right}:${q.blank}`)).size).toBe(6);let s=initialArithmeticRally(p);
			for(const q of p.questions){expect(q.result).toBe(operation==='add'?q.left+q.right:q.left-q.right);for(const n of [q.left,q.right,q.result,...q.options]){expect(n).toBeGreaterThanOrEqual(0);expect(n).toBeLessThanOrEqual(limit);}expect(q.answer).toBe(q[q.blank]);expect(new Set(q.options).size).toBe(q.options.length);expect(q.options.filter(n=>n===q.answer)).toHaveLength(1);expect(arithmeticRallyReducer(p,s,{type:'NEXT'})).toBe(s);
				s=arithmeticRallyReducer(p,s,{type:'ANSWER',value:q.answer});expect(s.phase).toBe('complete');expect(s.completed).toBe(s.index+1);expect(arithmeticRallyReducer(p,s,{type:'ANSWER',value:q.answer})).toBe(s);s=arithmeticRallyReducer(p,s,{type:'NEXT'});
			}expect(s.phase).toBe('finished');expect(s.completed).toBe(6);expect(p.questions.filter(q=>q.blank==='right')).toHaveLength(age==='8-10'?2:0);if(operation==='add')expect(p.questions[5]!.right).toBe(0);else expect(p.questions[5]!.result).toBe(0);
		}
	});
	it('wrong answers do not move the car and unknown answers are ignored',()=>{
		const p=createArithmeticRally('5-7','add',1),initial=initialArithmeticRally(p);const wrong=p.questions[0]!.options.find(n=>n!==p.questions[0]!.answer)!;
		const retry=arithmeticRallyReducer(p,initial,{type:'ANSWER',value:wrong});expect(retry.completed).toBe(0);expect(retry.index).toBe(0);expect(retry.phase).toBe('play');expect(arithmeticRallyReducer(p,retry,{type:'ANSWER',value:999})).toBe(retry);
	});
	it('counting marks can be toggled but cannot solve or reveal a hidden operand',()=>{
		const p=createArithmeticRally('8-10','add',8);let s=initialArithmeticRally(p);s=arithmeticRallyReducer(p,s,{type:'COUNTER',group:'left',index:0});expect(s.markedLeft).toEqual([0]);expect(s.completed).toBe(0);s=arithmeticRallyReducer(p,s,{type:'COUNTER',group:'left',index:0});expect(s.markedLeft).toEqual([]);
		for(const index of [-1,NaN,.5,50])expect(arithmeticRallyReducer(p,s,{type:'COUNTER',group:'left',index})).toBe(s);
		s={...s,index:1};expect(p.questions[1]!.blank).toBe('right');expect(arithmeticRallyReducer(p,s,{type:'COUNTER',group:'right',index:0})).toBe(s);
	});
	it('subtraction crossing, hints and reset preserve earlier completed stops',()=>{
		const p=createArithmeticRally('5-7','subtract',12);let s=initialArithmeticRally(p);s=arithmeticRallyReducer(p,s,{type:'ANSWER',value:p.questions[0]!.answer});s=arithmeticRallyReducer(p,s,{type:'NEXT'});
		expect(arithmeticRallyReducer(p,s,{type:'COUNTER',group:'right',index:0})).toBe(s);if(p.questions[1]!.left>0)s=arithmeticRallyReducer(p,s,{type:'COUNTER',group:'left',index:0});s=arithmeticRallyReducer(p,s,{type:'HINT'});expect(s.hint).toBe(true);expect(s.completed).toBe(1);s=arithmeticRallyReducer(p,s,{type:'RESET'});expect(s.index).toBe(1);expect(s.completed).toBe(1);expect(s.markedLeft).toEqual([]);expect(s.hint).toBe(false);
	});
	it('keeps previous plans/state immutable and emits bilingual catalog keys',()=>{
		const keys=new Set(RALLY_NARRATION.map(e=>e.key));expect(keys.size).toBe(RALLY_NARRATION.length);for(const e of RALLY_NARRATION){expect(e.bn.length).toBeGreaterThan(0);expect(e.en.length).toBeGreaterThan(0);}
		for(const mode of ['add','subtract'] as const){const p=createArithmeticRally('8-10',mode,31),original=JSON.stringify(p),initial=initialArithmeticRally(p);let s=initial;for(const q of p.questions){expect(keys.has(rallyInstruction(p,s.index))).toBe(true);s=arithmeticRallyReducer(p,s,{type:'HINT'});expect(keys.has(s.feedbackKey)).toBe(true);s=arithmeticRallyReducer(p,s,{type:'ANSWER',value:q.answer});expect(keys.has(s.feedbackKey)).toBe(true);s=arithmeticRallyReducer(p,s,{type:'NEXT'});}expect(initial).toEqual(initialArithmeticRally(p));expect(JSON.stringify(p)).toBe(original);}
	});
});
