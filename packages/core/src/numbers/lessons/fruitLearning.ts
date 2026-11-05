import {createRng,shuffle} from '../../learning/rng.ts';
import type {ThinkingAgeBand} from './thinkingLessons.ts';

export const LEARNING_FRUITS = [
	{id:'mango',bn:'আম',en:'Mango',familiar:true}, {id:'jackfruit',bn:'কাঁঠাল',en:'Jackfruit',familiar:true},
	{id:'banana',bn:'কলা',en:'Banana',familiar:true}, {id:'guava',bn:'পেয়ারা',en:'Guava',familiar:true},
	{id:'lychee',bn:'লিচু',en:'Lychee',familiar:true}, {id:'papaya',bn:'পেঁপে',en:'Papaya',familiar:true},
	{id:'pineapple',bn:'আনারস',en:'Pineapple',familiar:true}, {id:'watermelon',bn:'তরমুজ',en:'Watermelon',familiar:true},
	{id:'apple',bn:'আপেল',en:'Apple',familiar:false}, {id:'orange',bn:'কমলা',en:'Orange',familiar:false},
	{id:'grapes',bn:'আঙুর',en:'Grapes',familiar:false}, {id:'strawberry',bn:'স্ট্রবেরি',en:'Strawberry',familiar:false}
] as const;
export type LearningFruitId=(typeof LEARNING_FRUITS)[number]['id'];
export const learningFruit=(id:LearningFruitId)=>LEARNING_FRUITS.find(fruit=>fruit.id===id)!;
export type FruitPool='all'|'familiar';
export type FruitQuestion={kind:'name'|'find';fruit:LearningFruitId;options:LearningFruitId[]}|
	{kind:'count';fruit:LearningFruitId;quantity:number;options:number[]};
export interface FruitGamePlan{ageBand:ThinkingAgeBand;pool:FruitPool;seed:number;questions:FruitQuestion[]}
export interface FruitGameProgress{index:number;phase:'play'|'complete'|'finished';basket:LearningFruitId[];hint:boolean;marked:number[];feedbackKey:string}
export type FruitGameAction={type:'ANSWER';value:string|number}|{type:'NEXT'}|{type:'HINT'}|{type:'RESET'}|{type:'MARK';index:number};
export const fruitQuestionKey=(question:FruitQuestion)=>`fruit.instruction.${question.kind}`;
export const initialFruitGame=():FruitGameProgress=>({index:0,phase:'play',basket:[],hint:false,marked:[],feedbackKey:'fruit.instruction.name'});
export function createFruitGame(ageBand:ThinkingAgeBand,pool:FruitPool,seed:number):FruitGamePlan{
	const rng=createRng(seed),older=ageBand==='8-10';
	const available=LEARNING_FRUITS.filter(fruit=>pool==='all'||fruit.familiar).map(fruit=>fruit.id);
	const targets=shuffle(available,rng).slice(0,6);
	const questions=targets.map((fruit,index):FruitQuestion=>{
		if(index%3===2){const quantity=older?3+Math.floor(rng()*8):1+Math.floor(rng()*5);return {kind:'count',fruit,quantity,options:shuffle([quantity,...shuffle(Array.from({length:older?10:5},(_,n)=>n+1).filter(n=>n!==quantity),rng).slice(0,older?3:2)],rng)};}
		return {kind:index%3===0?'name':'find',fruit,options:shuffle([fruit,...shuffle(available.filter(id=>id!==fruit),rng).slice(0,older?3:2)],rng)};
	});return {ageBand,pool,seed,questions};
}
export function fruitGameReducer(plan:FruitGamePlan,state:FruitGameProgress,action:FruitGameAction):FruitGameProgress{
	if(action.type==='NEXT'){
		if(state.phase!=='complete')return state;
		const index=state.index+1;
		return index===plan.questions.length?{...state,phase:'finished',feedbackKey:'fruit.done'}
			:{...state,index,phase:'play',hint:false,marked:[],feedbackKey:fruitQuestionKey(plan.questions[index]!)};
	}
	if(state.phase!=='play')return state;
	const question=plan.questions[state.index]!;
	if(action.type==='HINT')return {...state,hint:true,feedbackKey:'fruit.hint'};
	if(action.type==='RESET')return {...state,marked:[],hint:false,feedbackKey:fruitQuestionKey(question)};
	if(action.type==='MARK')return question.kind==='count'&&Number.isInteger(action.index)&&action.index>=0&&action.index<question.quantity
		?{...state,marked:state.marked.includes(action.index)?state.marked.filter(index=>index!==action.index):[...state.marked,action.index]}:state;
	const valid=question.kind==='count'?typeof action.value==='number'&&question.options.includes(action.value):typeof action.value==='string'&&question.options.some(id=>id===action.value);
	if(!valid)return state;
	const correct=action.value===(question.kind==='count'?question.quantity:question.fruit);
	return correct?{...state,phase:'complete',basket:[...state.basket,question.fruit],hint:false,feedbackKey:'fruit.correct'}:{...state,feedbackKey:'fruit.retry'};
}
