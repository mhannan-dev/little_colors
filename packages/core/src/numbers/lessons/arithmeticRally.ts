import { createRng, shuffle } from '../../learning/rng.ts';
import type { ThinkingAgeBand } from './thinkingLessons.ts';

export type RallyOperation = 'add' | 'subtract';
export interface RallyQuestion { left: number; right: number; result: number; blank: 'right' | 'result'; answer: number; options: number[] }
export interface ArithmeticRallyPlan { ageBand: ThinkingAgeBand; operation: RallyOperation; seed: number; questions: RallyQuestion[] }
export interface ArithmeticRallyProgress {
	index: number; phase: 'play' | 'complete' | 'finished'; completed: number;
	markedLeft: number[]; markedRight: number[]; hint: boolean; feedbackKey: string;
}
export type ArithmeticRallyAction = { type: 'ANSWER'; value: number } | { type: 'NEXT' } | { type: 'RESET' } | { type: 'HINT' } |
	{ type: 'COUNTER'; group: 'left' | 'right'; index: number };

export function createArithmeticRally(ageBand: ThinkingAgeBand, operation: RallyOperation, seed: number): ArithmeticRallyPlan {
	const rng=createRng(seed), limit=ageBand==='5-7'?10:20;
	const pool: {left:number;right:number;result:number}[]=[];
	for(let left=0;left<=limit;left++)for(let right=0;right<=limit;right++){
		const result=operation==='add'?left+right:left-right;
		if(result>=0&&result<=limit)pool.push({left,right,result});
	}
	const candidates=shuffle(pool,rng), used=new Set<string>();
	const questions=Array.from({length:6},(_,index):RallyQuestion=>{
		const blank=ageBand==='8-10'&&(index===1||index===4)?'right':'result';
		const values=candidates.find(q=>!used.has(`${q.left}:${q.right}:${blank}`)&&
			(index===5 ? operation==='add'?q.right===0&&q.left>0:q.result===0&&q.left>0 : index===0?q.left>0&&q.right>0:true))!;
		used.add(`${values.left}:${values.right}:${blank}`);
		const answer=values[blank];
		const distractors=shuffle(Array.from({length:limit+1},(_,n)=>n).filter(n=>n!==answer),rng).slice(0,ageBand==='5-7'?2:3);
		return {...values,blank,answer,options:shuffle([answer,...distractors],rng)};
	});
	return {ageBand,operation,seed,questions};
}
export const rallyInstruction=(plan:ArithmeticRallyPlan,index:number)=>plan.questions[index]!.blank==='right'?'rally.instruction.missing':`rally.instruction.${plan.operation}`;
export const initialArithmeticRally=(plan:ArithmeticRallyPlan):ArithmeticRallyProgress=>({index:0,phase:'play',completed:0,markedLeft:[],markedRight:[],hint:false,feedbackKey:rallyInstruction(plan,0)});
export function arithmeticRallyReducer(plan:ArithmeticRallyPlan,state:ArithmeticRallyProgress,action:ArithmeticRallyAction):ArithmeticRallyProgress{
	if(action.type==='NEXT'){
		if(state.phase!=='complete')return state;
		const index=state.index+1;
		return index===plan.questions.length?{...state,phase:'finished',feedbackKey:'rally.done'}
			:{...state,index,phase:'play',markedLeft:[],markedRight:[],hint:false,feedbackKey:rallyInstruction(plan,index)};
	}
	if(state.phase!=='play')return state;
	const question=plan.questions[state.index]!;
	if(action.type==='RESET')return {...state,markedLeft:[],markedRight:[],hint:false,feedbackKey:rallyInstruction(plan,state.index)};
	if(action.type==='HINT')return {...state,hint:true,feedbackKey:question.blank==='right'?'rally.hint.missing':`rally.hint.${plan.operation}`};
	if(action.type==='COUNTER'){
		if((action.group==='right'&&(plan.operation==='subtract'||question.blank==='right'))||!Number.isInteger(action.index)||action.index<0||action.index>=question[action.group])return state;
		const key=action.group==='left'?'markedLeft':'markedRight', marks=state[key];
		return {...state,[key]:marks.includes(action.index)?marks.filter(n=>n!==action.index):[...marks,action.index]};
	}
	if(!question.options.includes(action.value))return state;
	return action.value===question.answer?{...state,phase:'complete',completed:state.completed+1,hint:false,feedbackKey:'rally.correct'}
		:{...state,feedbackKey:'rally.retry'};
}
