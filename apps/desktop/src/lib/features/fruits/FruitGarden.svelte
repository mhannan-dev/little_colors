<script lang="ts">
	import {onDestroy,onMount,tick,untrack} from 'svelte';
	import {LEARNING_FRUITS,learningFruit,createFruitGame,initialFruitGame,fruitGameReducer,fruitQuestionKey,narrationText,formatNumeral,type LearningFruitId,type FruitGameAction,type FruitPool,type ThinkingAgeBand} from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import FruitPicture from './FruitPicture.svelte';
	import {settings} from '#lib/stores/settings.ts';
	import {paused} from '#lib/stores/pause.ts';
	import {caption,say,stopNarration} from '#lib/audio/narrator.ts';
	let mode=$state<'learn'|'play'>('learn');
	let pool=$state<FruitPool>('all');
	let ageBand=$state<ThinkingAgeBand>('5-7');
	let selected=$state<LearningFruitId>('mango');
	let plan=$state(untrack(()=>createFruitGame(ageBand,pool,Date.now()>>>0)));
	let progress=$state(initialFruitGame());
	let joke=$state(false);
	let scroller=$state<HTMLDivElement>();
	const fruits=$derived(LEARNING_FRUITS.filter(fruit=>pool==='all'||fruit.familiar));
	const question=$derived(plan.questions[progress.index]!);
	const text=(key:string)=>narrationText(key,$settings.language,$settings.islamicExpressionsEnabled);
	const name=(id:LearningFruitId)=>$settings.language==='bn-BD'?learningFruit(id).bn:learningFruit(id).en;
	const n=(value:number)=>formatNumeral(value,$settings.numeralStyle);
	function focusHeading(){void tick().then(()=>{scroller?.scrollTo(0,0);scroller?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});});}
	function learn(){if($paused)return;stopNarration();mode='learn';say('fruit.explore',{interrupt:true});focusHeading();}
	function start(){if($paused)return;stopNarration();plan=createFruitGame(ageBand,pool,(plan.seed+1)>>>0);progress=initialFruitGame();mode='play';joke=false;say(progress.feedbackKey,{interrupt:true});focusHeading();}
	function select(id:LearningFruitId){if($paused)return;selected=id;say(`fruit.name.${id}`,{interrupt:true});}
	function choosePool(value:FruitPool){if($paused)return;pool=value;if(value==='familiar'&&!learningFruit(selected).familiar)select('mango');}
	function dispatch(action:FruitGameAction){if($paused)return;const next=fruitGameReducer(plan,progress,action);if(next===progress)return;const phase=progress.phase;progress=next;if(action.type!=='MARK')say(next.feedbackKey,{interrupt:true});if(action.type==='NEXT'||phase!==next.phase)focusHeading();}
	$effect(()=>caption.set(text(mode==='learn'?'fruit.explore':progress.feedbackKey)));
	const offPause=paused.subscribe(value=>{if(value)stopNarration();});
	onMount(()=>{say('fruit.explore',{interrupt:true});focusHeading();});
	onDestroy(()=>{offPause();stopNarration();caption.set('');});
</script>

<div class="fruit-shell" class:paused={$paused} class:reduce-motion={$settings.reducedMotion}>
	<TopBar backTo="/play" onreplay={()=>{if(!$paused)say(mode==='learn'?`fruit.name.${selected}`:progress.phase==='finished'?'fruit.done':fruitQuestionKey(question),{interrupt:true});}}/>
	<div class="fruit-scroll" bind:this={scroller} data-testid="fruit-garden">
		<section><h1 tabindex="-1">{text('fruit.title')}</h1><div class="tabs" role="group" aria-label={text('fruit.title')}><button data-testid="fruit-learn" aria-pressed={mode==='learn'} disabled={$paused} onclick={learn}>{text('fruit.learn')}</button><button data-testid="fruit-play" aria-pressed={mode==='play'} disabled={$paused} onclick={()=>{if(mode!=='play')start();}}>{text('fruit.play')}</button></div>
			{#if mode==='learn'}
				<p>{text('fruit.explore')}</p><div class="filters"><div role="group" aria-label={text('fruit.all')}><button data-testid="fruit-all" aria-pressed={pool==='all'} disabled={$paused} onclick={()=>choosePool('all')}>{text('fruit.all')}</button><button data-testid="fruit-familiar" aria-pressed={pool==='familiar'} disabled={$paused} onclick={()=>choosePool('familiar')}>{text('fruit.familiar')}</button></div><div role="group" aria-label={text('thinking.lesson')}>{#each ['5-7','8-10'] as age}<button data-testid="fruit-age-{age}" aria-pressed={ageBand===age} disabled={$paused} onclick={()=>ageBand=age as ThinkingAgeBand}>{text(age==='5-7'?'thinking.age.younger':'thinking.age.older')}</button>{/each}</div></div>
				<div class="preview" data-testid="fruit-preview" data-fruit={selected}><FruitPicture id={selected} size={170}/><div><h2 lang="bn">{learningFruit(selected).bn}</h2><p lang="en">{learningFruit(selected).en}</p><button data-testid="fruit-listen" disabled={$paused||!$settings.soundEnabled} onclick={()=>select(selected)}>♪ {text('fruit.listen')}</button></div></div>
				<div class="fruit-gallery">{#each fruits as fruit}<button data-learning-fruit={fruit.id} aria-pressed={selected===fruit.id} disabled={$paused} onclick={()=>{select(fruit.id);scroller?.scrollTo({top:0,behavior:'instant'});}}><FruitPicture id={fruit.id} size={95} decorative/><strong>{name(fruit.id)}</strong><small lang="en">{fruit.en}</small></button>{/each}</div>
			{:else if progress.phase==='finished'}
				<div data-testid="fruit-finale"><div class="joke"><Mascot state={joke?'wave':'celebrate'} size={170}/><div class="banana-phone" class:tilted={joke} aria-hidden="true"><FruitPicture id="banana" size={85} decorative/></div></div><p role="status">{text(joke?'fruit.joke':'fruit.done')}</p><div class="actions"><button data-testid="fruit-giggle" disabled={$paused} onclick={()=>{joke=!joke;say(joke?'fruit.joke':'fruit.done',{interrupt:true});}}>{text('fruit.giggle')}</button><button class="primary" data-testid="fruit-replay" disabled={$paused} onclick={start}>{text('fruit.replay')}</button></div></div>
			{:else}
				<p class="round">{text('thinking.lesson')} {n(progress.index+1)} / {n(6)}</p><p>{text(fruitQuestionKey(question))}</p>
				{#if question.kind==='name'}<div class="question-picture" data-testid="fruit-question-picture"><FruitPicture id={question.fruit} size={165}/></div>
				{:else if question.kind==='find'}<h2 class="target-name" data-testid="fruit-target-name" data-fruit={question.fruit}>{name(question.fruit)}</h2><button class="listen" disabled={$paused||!$settings.soundEnabled} onclick={()=>{if(!$paused)say(`fruit.name.${question.fruit}`,{interrupt:true});}}>♪ {text('fruit.listen')}</button>
				{:else if question.kind==='count'}<div class="count-fruits" data-testid="fruit-count">{#each Array(question.quantity) as _,index}<button class:marked={progress.marked.includes(index)} aria-pressed={progress.marked.includes(index)} aria-label={`${name(question.fruit)} ${n(index+1)}`} data-count-fruit={index} disabled={progress.phase!=='play'||$paused} onclick={()=>dispatch({type:'MARK',index})}><FruitPicture id={question.fruit} size={65} decorative/>{#if progress.marked.includes(index)}<b aria-hidden="true">✓</b>{/if}</button>{/each}</div><p class="counted">{text('fruit.counted')}: {n(progress.marked.length)}</p>{/if}
				<div class="choices" data-testid="fruit-choices">{#if question.kind==='count'}{#each question.options as value}<button class="number" class:hinted={progress.hint&&value===question.quantity} data-fruit-number={value} disabled={progress.phase!=='play'||$paused} onclick={()=>dispatch({type:'ANSWER',value})}>{n(value)}</button>{/each}{:else}{#each question.options as id}<button data-fruit-answer={id} class:hinted={progress.hint&&id===question.fruit} disabled={progress.phase!=='play'||$paused} aria-label={name(id)} onclick={()=>dispatch({type:'ANSWER',value:id})}>{#if question.kind==='find'}<FruitPicture {id} size={100} decorative/>{:else}<strong>{name(id)}</strong>{/if}</button>{/each}{/if}</div>
				{#if progress.hint}<p class="hint" role="status" data-testid="fruit-hint">{text('fruit.hint')}</p>{/if}
				<div class="actions">{#if progress.phase==='complete'}<p class="success" role="status" data-testid="fruit-correct">✓ {text('fruit.correct')}</p><button class="primary" data-testid="fruit-next" disabled={$paused} onclick={()=>dispatch({type:'NEXT'})}>{text('fruit.next')} →</button>{:else}<button data-testid="fruit-help" disabled={$paused} onclick={()=>dispatch({type:'HINT'})}>{text('fruit.help')}</button>{#if question.kind==='count'}<button data-testid="fruit-reset" disabled={$paused} onclick={()=>dispatch({type:'RESET'})}>{text('fruit.reset')}</button>{/if}{/if}</div>
			{/if}
			{#if mode==='play'}<div class="basket" aria-label={text('fruit.basket')} data-testid="fruit-basket"><strong>{text('fruit.basket')} · {n(progress.basket.length)} / {n(6)}</strong><div>{#each progress.basket as id}<span data-basket-fruit={id}><FruitPicture {id} size={55}/></span>{/each}</div></div>{/if}
		</section>
	</div>
</div>

<style>
	.fruit-shell{display:flex;flex-direction:column;flex:1;min-height:0}.fruit-scroll{flex:1;min-height:0;overflow:auto;padding:10px 24px 30px}section{max-width:1050px;margin:auto;text-align:center}h1{font-size:clamp(28px,3vw,40px);margin:12px 0}h2{font-size:32px;margin:0}p{font-size:23px;line-height:1.4;margin:18px auto;max-width:820px}button{min-height:58px;padding:10px 18px;border:3px solid var(--border-soft);border-radius:20px;background:var(--surface);font-size:21px;cursor:pointer}button:disabled{opacity:.6;cursor:default}button[aria-pressed='true']{border-color:var(--text-primary);background:var(--bg-secondary)}.tabs,.actions,.filters,.filters>div{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:12px}.tabs,.actions{margin:20px auto}.filters{gap:20px}.primary{background:var(--text-primary);color:var(--bg-primary);font-weight:700}.preview{display:flex;align-items:center;justify-content:center;gap:36px;max-width:680px;margin:24px auto;padding:18px;border:3px solid var(--learn-green);border-radius:26px;background:var(--surface)}.preview p{font-family:Arial,sans-serif;margin:8px 0 14px}.fruit-gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:24px auto}.fruit-gallery button{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0}.fruit-gallery small{font:18px Arial,sans-serif}.round,.counted{font-size:19px}.question-picture{margin:14px auto}.target-name{font-size:40px;margin:24px auto}.count-fruits{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;max-width:650px;margin:24px auto}.count-fruits button{padding:5px;position:relative}.count-fruits b{position:absolute;right:3px;top:-7px;font-size:27px}.choices{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin:24px auto}.choices button{min-width:150px;min-height:90px;font-size:28px}.choices .number{font-size:40px;min-width:90px}.hinted{outline:4px dashed var(--text-primary);outline-offset:4px;animation:fruit-hint 1s ease-in-out 3}.success,.hint{padding:12px;border-radius:18px;background:var(--bg-secondary)}.basket{border:3px solid var(--learn-orange);border-radius:24px;padding:12px;margin:24px auto;max-width:680px;background:var(--bg-secondary);font-size:21px}.basket>div{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;min-height:40px}.joke{position:relative;width:200px;margin:24px auto}.banana-phone{position:absolute;top:0;right:-12px;transform:rotate(-25deg)}.banana-phone.tilted{transform:rotate(12deg)}.reduce-motion .hinted{animation:none}.paused .hinted{animation-play-state:paused}@keyframes fruit-hint{50%{box-shadow:0 0 0 6px var(--border-soft)}}@media(prefers-reduced-motion:reduce){.hinted{animation:none}}
	@media(max-width:600px){.fruit-scroll{padding:8px 12px 24px}p{font-size:21px}.fruit-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.preview{gap:16px;flex-wrap:wrap}.filters{gap:12px}.choices{gap:12px}.choices button{min-width:130px;font-size:25px}.choices .number{min-width:74px}button{font-size:19px;padding:8px 12px}}
	@media(max-width:600px){.fruit-shell>:global(header){grid-template-columns:auto 1fr;gap:8px;padding:10px 12px}.fruit-shell>:global(header .right){grid-column:2;grid-row:1;justify-self:end}.fruit-shell>:global(header .caption){grid-column:1 / -1;grid-row:2;font-size:20px;line-height:1.3}.fruit-shell>:global(header .icon){width:56px;height:56px}}
</style>
