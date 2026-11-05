import {describe,expect,it} from 'vitest';
import {LEARNING_FRUITS,createFruitGame,initialFruitGame,fruitGameReducer,fruitQuestionKey,type FruitPool} from '../../src/numbers/lessons/fruitLearning.ts';
import {FRUIT_NARRATION} from '../../src/numbers/lessons/fruitNarration.ts';
import {getNarration} from '../../src/audio/catalog.ts';
describe('Bangladesh familiar and popular fruit learning',()=>{
	it('includes 12 bilingual fruits and eight familiar Bangladesh examples',()=>{
		expect(LEARNING_FRUITS).toHaveLength(12);expect(new Set(LEARNING_FRUITS.map(f=>f.id)).size).toBe(12);
		expect(LEARNING_FRUITS.filter(f=>f.familiar).map(f=>f.id)).toEqual(['mango','jackfruit','banana','guava','lychee','papaya','pineapple','watermelon']);
		for(const f of LEARNING_FRUITS){expect(f.bn.length).toBeGreaterThan(0);expect(f.en.length).toBeGreaterThan(0);expect(getNarration(`fruit.name.${f.id}`)).toBeDefined();}
	});
	it.each((['5-7','8-10'] as const).flatMap(age=>(['all','familiar'] as FruitPool[]).map(pool=>({age,pool}))))('$age / $pool: 1,000 complete games stay deterministic, uniquely answerable and in range',({age,pool})=>{
		const seen=new Set<string>();for(let seed=0;seed<1000;seed++){
			const plan=createFruitGame(age,pool,seed);expect(plan).toEqual(createFruitGame(age,pool,seed));expect(plan.questions).toHaveLength(6);expect(new Set(plan.questions.map(q=>q.fruit)).size).toBe(6);let state=initialFruitGame();
			for(const q of plan.questions){seen.add(q.fruit);expect(getNarration(fruitQuestionKey(q))).toBeDefined();expect(new Set<string|number>(q.options).size).toBe(q.options.length);if(pool==='familiar'){expect(LEARNING_FRUITS.find(f=>f.id===q.fruit)?.familiar).toBe(true);if(q.kind!=='count')for(const id of q.options)expect(LEARNING_FRUITS.find(f=>f.id===id)?.familiar).toBe(true);}
				if(q.kind==='count'){expect(q.quantity).toBeGreaterThanOrEqual(age==='5-7'?1:3);expect(q.quantity).toBeLessThanOrEqual(age==='5-7'?5:10);expect(q.options.filter(n=>n===q.quantity)).toHaveLength(1);}else expect(q.options.filter(id=>id===q.fruit)).toHaveLength(1);
				expect(state.index).toBe(state.basket.length);expect(fruitGameReducer(plan,state,{type:'NEXT'})).toBe(state);state=fruitGameReducer(plan,state,{type:'ANSWER',value:q.kind==='count'?q.quantity:q.fruit});expect(state.phase).toBe('complete');expect(state.basket).toHaveLength(state.index+1);expect(fruitGameReducer(plan,state,{type:'ANSWER',value:q.fruit})).toBe(state);state=fruitGameReducer(plan,state,{type:'NEXT'});
			}expect(state.phase).toBe('finished');expect(state.basket).toHaveLength(6);
		}expect(seen.size).toBe(pool==='all'?12:8);
	});
	it('wrong and unknown choices keep earlier fruit and cannot skip or double award',()=>{
		const plan=createFruitGame('8-10','all',7);let state=initialFruitGame();state=fruitGameReducer(plan,state,{type:'ANSWER',value:plan.questions[0]!.fruit});state=fruitGameReducer(plan,state,{type:'NEXT'});const q=plan.questions[1]!;if(q.kind==='count')throw Error('Wrong question kind');
		state=fruitGameReducer(plan,state,{type:'ANSWER',value:q.options.find(id=>id!==q.fruit)!});expect(state.basket).toHaveLength(1);expect(state.index).toBe(1);expect(state.phase).toBe('play');expect(fruitGameReducer(plan,state,{type:'ANSWER',value:'invalid'})).toBe(state);expect(fruitGameReducer(plan,state,{type:'NEXT'})).toBe(state);
	});
	it('count marks, hints and reset do not award fruit or erase earlier basket contents',()=>{
		const plan=createFruitGame('5-7','familiar',12);let state={...initialFruitGame(),index:2,basket:[plan.questions[0]!.fruit,plan.questions[1]!.fruit]};state=fruitGameReducer(plan,state,{type:'MARK',index:0});expect(state.marked).toEqual([0]);expect(state.basket).toHaveLength(2);for(const index of [-1,20,.5,NaN])expect(fruitGameReducer(plan,state,{type:'MARK',index})).toBe(state);state=fruitGameReducer(plan,state,{type:'HINT'});expect(state.hint).toBe(true);state=fruitGameReducer(plan,state,{type:'RESET'});expect(state.marked).toEqual([]);expect(state.hint).toBe(false);expect(state.basket).toHaveLength(2);
	});
	it('preserves earlier state/plan and has unique bilingual narration',()=>{
		const plan=createFruitGame('8-10','all',21),original=JSON.stringify(plan),initial=initialFruitGame();let state=initial;const keys=new Set(FRUIT_NARRATION.map(e=>e.key));expect(keys.size).toBe(FRUIT_NARRATION.length);for(const entry of FRUIT_NARRATION){expect(entry.bn.length).toBeGreaterThan(0);expect(entry.en.length).toBeGreaterThan(0);expect(getNarration(entry.key)).toBeDefined();}
		for(const q of plan.questions){state=fruitGameReducer(plan,state,{type:'ANSWER',value:q.kind==='count'?q.quantity:q.fruit});state=fruitGameReducer(plan,state,{type:'NEXT'});}expect(initial).toEqual(initialFruitGame());expect(JSON.stringify(plan)).toBe(original);expect(state.phase).toBe('finished');
	});
});
