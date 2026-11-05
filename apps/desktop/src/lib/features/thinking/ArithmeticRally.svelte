<script lang="ts">
	import {onDestroy,onMount,tick,untrack} from 'svelte';
	import {createArithmeticRally,initialArithmeticRally,arithmeticRallyReducer,rallyInstruction,narrationText,formatNumeral,type ThinkingAgeBand,type RallyOperation,type ArithmeticRallyAction} from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import RallyCar from './RallyCar.svelte';
	import {settings} from '#lib/stores/settings.ts';
	import {paused} from '#lib/stores/pause.ts';
	import {caption,say,stopNarration} from '#lib/audio/narrator.ts';
	let {ageBand,operation,onexit}:{ageBand:ThinkingAgeBand;operation:RallyOperation;onexit:()=>void}=$props();
	let plan=$state(untrack(()=>createArithmeticRally(ageBand,operation,Date.now()>>>0)));
	let progress=$state(untrack(()=>initialArithmeticRally(plan)));
	let scroller=$state<HTMLDivElement>();
	const question=$derived(plan.questions[progress.index]!);
	const text=(key:string)=>narrationText(key,$settings.language,$settings.islamicExpressionsEnabled);
	const n=(value:number)=>formatNumeral(value,$settings.numeralStyle);
	const value=(key:'left'|'right'|'result')=>question.blank===key&&progress.phase==='play'?'?':n(question[key]);
	const equationLabel=$derived(`${n(question.left)} ${text(plan.operation==='add'?'rally.plus':'rally.minus')} ${question.blank==='right'&&progress.phase==='play'?text('rally.missing'):n(question.right)} ${text('rally.equals')} ${question.blank==='result'&&progress.phase==='play'?text('rally.missing'):n(question.result)}`);
	function focusHeading(){void tick().then(()=>{scroller?.scrollTo(0,0);scroller?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});});}
	function restart(mode:RallyOperation=plan.operation){if($paused)return;stopNarration();plan=createArithmeticRally(ageBand,mode,(plan.seed+1)>>>0);progress=initialArithmeticRally(plan);say(progress.feedbackKey,{interrupt:true});focusHeading();}
	function dispatch(action:ArithmeticRallyAction){if($paused)return;const next=arithmeticRallyReducer(plan,progress,action);if(next===progress)return;const phase=progress.phase;progress=next;if(action.type!=='COUNTER')say(next.feedbackKey,{interrupt:true});if(action.type==='NEXT'||next.phase!==phase)focusHeading();}
	function horn(){if(!$paused)say('rally.hornLine',{interrupt:true});}
	$effect(()=>caption.set(text(progress.feedbackKey)));
	const offPause=paused.subscribe(value=>{if(value)stopNarration();});
	onMount(()=>{say(progress.feedbackKey,{interrupt:true});focusHeading();});
	onDestroy(()=>{offPause();stopNarration();});
</script>

<div class="rally-shell">
	<TopBar onreplay={()=>say(progress.phase==='finished'?'rally.done':rallyInstruction(plan,progress.index),{interrupt:true})}/>
	<div class="rally-scroll" bind:this={scroller} data-testid="arithmetic-rally">
		<section>
			<div class="navigation"><button data-testid="rally-back" onclick={onexit}>← {text('rally.patterns')}</button><span>{text('rally.stop')} {n(progress.completed)} / {n(6)}</span></div>
			<h1 tabindex="-1">{text(`rally.${plan.operation}`)}</h1>
			<div class="modes" role="group" aria-label={text('rally.title')}><button data-testid="rally-add" aria-pressed={plan.operation==='add'} disabled={$paused} onclick={()=>{if(plan.operation!=='add')restart('add');}}>+ {text('rally.add')}</button><button data-testid="rally-subtract" aria-pressed={plan.operation==='subtract'} disabled={$paused} onclick={()=>{if(plan.operation!=='subtract')restart('subtract');}}>− {text('rally.subtract')}</button></div>
			<div class="road" data-testid="rally-road" data-completed={progress.completed}><svg viewBox="0 0 740 155" role="img" aria-label={`${text('rally.road')}: ${n(progress.completed)} / ${n(6)}`}><path d="M28 104 H714" stroke="var(--border-soft)" stroke-width="40" stroke-linecap="round"/><path d="M28 104 H714" stroke="var(--text-secondary)" stroke-width="3" stroke-dasharray="14 12"/><path d="M618 64 V25 L660 7 L707 25 V64Z" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4"/><rect x="640" y="32" width="42" height="32" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="3"/>{#each Array(7) as _,index}<circle cx={60+index*100} cy="136" r="14" fill={index<=progress.completed?'var(--learn-green)':'var(--surface)'} stroke="var(--text-primary)" stroke-width="2"/><text x={60+index*100} y="142" text-anchor="middle" font-size="20" fill="var(--text-primary)">{n(index)}</text>{/each}<g transform="translate({20+progress.completed*100} 48)"><RallyCar size={80}/></g></svg></div>
			{#if progress.phase==='finished'}
				<div data-testid="rally-finale"><Mascot state="celebrate" size={140}/><h2>{text('rally.garage')}</h2><p role="status">{text('rally.done')}</p><div class="actions"><button data-testid="rally-horn" disabled={$paused} onclick={horn}>{text('rally.horn')}</button><button class="primary" data-testid="rally-replay" disabled={$paused} onclick={()=>restart()}>{text('rally.replay')}</button></div></div>
			{:else}
				<p>{text(rallyInstruction(plan,progress.index))}</p>
				<div class="equation" role="group" aria-label={equationLabel} data-testid="rally-equation" data-operation={plan.operation} data-blank={question.blank}>
					<strong data-equation-part="left" data-value={question.left}>{value('left')}</strong><b aria-hidden="true">{plan.operation==='add'?'+':'−'}</b><strong class:blank={question.blank==='right'} data-equation-part="right" data-value={question.blank!=='right'||progress.phase==='complete'?question.right:undefined}>{value('right')}</strong><b aria-hidden="true">=</b><strong class:blank={question.blank==='result'} data-equation-part="result" data-value={question.blank!=='result'||progress.phase==='complete'?question.result:undefined}>{value('result')}</strong>
				</div>
				<div class="workbench" aria-label={text('rally.count')}>
					{#each (plan.operation==='add'?['left','right']:['left']) as groupName}{@const group=groupName as 'left'|'right'}{@const marks=group==='left'?progress.markedLeft:progress.markedRight}
						<div class="counter-tray" data-counter-group={group}><strong>{value(group)}</strong>{#if group==='right'&&question.blank==='right'&&progress.phase==='play'}<span>{text('rally.missing')}</span>{:else}<div class="counters">{#each Array(question[group]) as _,index}<button class="counter" class:marked={marks.includes(index)} class:crossed={plan.operation==='subtract'&&marks.includes(index)} data-counter={group} data-counter-index={index} aria-pressed={marks.includes(index)} aria-label={`${text('rally.counter')} ${n(index+1)}`} disabled={progress.phase!=='play'||$paused} onclick={()=>dispatch({type:'COUNTER',group,index})}><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 4 L25 15 L37 16 L28 24 L31 36 L20 30 L9 36 L12 24 L3 16 L15 15Z" fill={group==='left'?'var(--learn-orange)':'var(--learn-blue)'} stroke="var(--text-primary)" stroke-width="2"/></svg>{#if plan.operation!=='subtract'&&marks.includes(index)}<span aria-hidden="true">✓</span>{/if}</button>{/each}{#if question[group]===0}<span class="empty">{text('rally.empty')}</span>{/if}</div><small>{#if plan.operation==='subtract'}{text('rally.removed')}: {n(marks.length)} · {text('rally.remaining')}: {n(question.left-marks.length)}{:else}{text('rally.marked')}: {n(marks.length)}{/if}</small>{/if}</div>
					{/each}
					{#if plan.operation==='subtract'}<div class="take-away"><b aria-hidden="true">−</b><strong>{value('right')}</strong><span>{text('rally.takeAway')}</span></div>{/if}
				</div>
				<div class="answers">{#each question.options as answer}<button data-rally-answer={answer} disabled={progress.phase!=='play'||$paused} onclick={()=>dispatch({type:'ANSWER',value:answer})}>{n(answer)}</button>{/each}</div>
				{#if progress.hint}<p class="hint" role="status" data-testid="rally-hint">{text(question.blank==='right'?'rally.hint.missing':`rally.hint.${plan.operation}`)}</p>{/if}
				<div class="actions">{#if progress.phase==='complete'}<p class="success" role="status" data-testid="rally-correct">✓ {text('rally.correct')}</p><button class="primary" data-testid="rally-next" disabled={$paused} onclick={()=>dispatch({type:'NEXT'})}>{text(progress.index===5?'rally.finish':'rally.next')} →</button>{:else}<button data-testid="rally-reset" disabled={$paused} onclick={()=>dispatch({type:'RESET'})}>{text('rally.reset')}</button><button data-testid="rally-help" disabled={$paused} onclick={()=>dispatch({type:'HINT'})}>{text('rally.help')}</button><button data-testid="rally-horn" disabled={$paused} onclick={horn}>{text('rally.horn')}</button>{/if}</div>
			{/if}
		</section>
	</div>
</div>

<style>
	.rally-shell{display:flex;flex-direction:column;flex:1;min-height:0}.rally-scroll{flex:1;min-height:0;overflow:auto;padding:10px 24px 30px}section{max-width:1000px;margin:auto;text-align:center}.navigation,.actions,.modes{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.navigation{font-size:21px}h1{font-size:clamp(28px,3vw,40px);margin:16px 0}h2{font-size:30px}p{font-size:23px;line-height:1.5;max-width:800px;margin:18px auto}button{cursor:pointer;min-height:60px;padding:10px 20px;font-size:21px;border:3px solid var(--border-soft);border-radius:20px;background:var(--surface)}button:disabled{opacity:.6;cursor:default}button[aria-pressed='true']{border-color:var(--text-primary);background:var(--bg-secondary)}.primary{background:var(--text-primary);color:var(--bg-primary);font-weight:700}.actions,.modes{justify-content:center;margin:20px auto}.road{max-width:740px;margin:10px auto}.road>svg{display:block;width:100%;height:auto}.equation{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:14px;margin:24px auto;font-size:48px}.equation strong{display:grid;place-items:center;min-width:90px;min-height:90px;padding:8px;border:3px solid var(--border-soft);border-radius:20px;background:var(--surface)}.equation .blank{border-style:dashed;border-color:var(--text-primary)}.workbench{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:20px;margin:24px auto}.counter-tray{border:3px solid var(--border-soft);border-radius:20px;padding:12px;max-width:420px;min-width:130px;background:var(--surface);display:flex;flex-direction:column;gap:10px}.counter-tray>strong,.take-away strong{font-size:34px}.counters{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.counter{position:relative;min-width:48px;min-height:48px;width:48px;height:48px;padding:4px;border-width:2px;border-radius:12px}.counter svg{width:36px;height:36px}.counter span{position:absolute;right:0;top:-5px;font-size:20px;font-weight:700}.counter.crossed:after{content:'';position:absolute;left:5px;right:5px;top:21px;border-top:4px solid var(--text-primary);transform:rotate(-45deg)}small{font-size:18px}.take-away{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:21px}.take-away b{font-size:38px}.answers{display:flex;justify-content:center;flex-wrap:wrap;gap:16px;margin:24px auto}.answers button{min-width:100px;min-height:90px;font-size:40px}.success,.hint{padding:12px;border-radius:18px;background:var(--bg-secondary)}.empty{font-size:21px;padding:12px}
	@media(max-width:600px){.rally-scroll{padding:8px 12px 24px}.navigation{justify-content:center}p{font-size:21px}button{font-size:19px;padding:8px 12px}.equation{font-size:34px;gap:8px}.equation strong{min-width:58px;min-height:70px;padding:4px}.workbench{gap:14px}.counter-tray{max-width:100%;min-width:0}.answers{gap:10px}.answers button{min-width:72px;min-height:78px;font-size:34px}}
	@media(max-width:600px){.rally-shell>:global(header){grid-template-columns:auto 1fr;gap:8px;padding:10px 12px}.rally-shell>:global(header .right){grid-column:2;grid-row:1;justify-self:end}.rally-shell>:global(header .caption){grid-column:1 / -1;grid-row:2;font-size:20px;line-height:1.3}.rally-shell>:global(header .icon){width:56px;height:56px}}
</style>
