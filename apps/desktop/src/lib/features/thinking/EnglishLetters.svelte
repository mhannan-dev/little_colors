<script lang="ts">
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { ENGLISH_ALPHABET, createEnglishLetterGame, initialEnglishLetterProgress, englishLetterReducer, letterInstruction, narrationText, formatNumeral, type ThinkingAgeBand, type EnglishLetterAction } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import AlphabetPicture from './AlphabetPicture.svelte';
	import { createSpeechFallback } from '#lib/platform/audio.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';
	let { ageBand, onexit }: { ageBand: ThinkingAgeBand; onexit: () => void } = $props();
	let mode = $state<'learn'|'play'>('learn');
	let selectedIndex = $state(0);
	let plan = $state(untrack(() => createEnglishLetterGame(ageBand, Date.now() >>> 0)));
	let progress = $state(initialEnglishLetterProgress());
	let scroller = $state<HTMLDivElement>();
	let joke = $state(false);
	let voiceUnavailable = $state(false);
	const english = createSpeechFallback();
	let reading = 0;
	const entry = $derived(ENGLISH_ALPHABET[selectedIndex]!);
	const question = $derived(plan.questions[progress.index]!);
	const text = (key:string) => narrationText(key,$settings.language,$settings.islamicExpressionsEnabled);
	const n = (value:number) => formatNumeral(value,$settings.numeralStyle);
	function stopBoth(){ reading++; english.stop(); stopNarration(); }
	async function readEnglish(line:string){
		stopBoth(); caption.set(line);
		if($paused || !$settings.soundEnabled) return;
		const generation=reading;
		try {
			const available=await english.isAvailable('en-US');
			if(generation!==reading || $paused || !$settings.soundEnabled) return;
			voiceUnavailable=!available;
			if(!available) return;
			const result=await english.speak(line,'en-US');
			if(generation===reading && result==='failed') voiceUnavailable=true;
		}catch{if(generation===reading)voiceUnavailable=true;}
	}
	function listen(){if($paused)return;const line=mode==='learn'?`${entry.letter}. ${entry.letter} is for ${entry.word}.`:question.kind==='word'?question.entry.word:question.kind==='match'?question.target.toUpperCase():question.sequence.map((letter,index)=>index===question.gap?'blank':letter).join('. ');void readEnglish(line);}
	function select(index:number){if($paused)return;selectedIndex=index;void readEnglish(`${entry.letter}. ${entry.letter} is for ${entry.word}.`);}
	function focusHeading(){void tick().then(()=>{scroller?.scrollTo(0,0);scroller?.querySelector<HTMLElement>('h1')?.focus({preventScroll:true});});}
	function start(){if($paused)return;stopBoth();plan=createEnglishLetterGame(ageBand,(plan.seed+1)>>>0);progress=initialEnglishLetterProgress();mode='play';joke=false;say(progress.feedbackKey,{interrupt:true});focusHeading();}
	function learn(){if($paused)return;stopBoth();mode='learn';say('letters.explore',{interrupt:true});focusHeading();}
	function dispatch(action:EnglishLetterAction){if($paused)return;const next=englishLetterReducer(plan,progress,action);if(next===progress)return;stopBoth();const phase=progress.phase;progress=next;say(next.feedbackKey,{interrupt:true});if(action.type==='NEXT'||next.phase!==phase)focusHeading();}
	$effect(()=>{caption.set(text(mode==='learn'?'letters.explore':progress.feedbackKey));});
	$effect(()=>{if(!$settings.soundEnabled)stopBoth();});
	const offPause=paused.subscribe(value=>{if(value)stopBoth();});
	onMount(()=>{say('letters.explore',{interrupt:true});focusHeading();});
	onDestroy(()=>{offPause();stopBoth();});
</script>

<div class="letters-shell">
	<TopBar onreplay={()=>{if($paused)return;stopBoth();if(mode==='learn')listen();else say(progress.phase==='finished'?'letters.done':letterInstruction(question),{interrupt:true});}}/>
	<div class="letters-scroll" bind:this={scroller} data-testid="english-letters">
		<section>
			<div class="navigation"><button data-testid="letters-back" onclick={onexit}>← {text('thinking.hub')}</button>{#if mode==='play'}<span>{n(progress.index+1)} / {n(plan.questions.length)}</span>{/if}</div>
			<h1 tabindex="-1">{text('letters.title')}</h1>
			<div class="tabs" role="group" aria-label={text('letters.title')}><button data-testid="letters-learn" aria-pressed={mode==='learn'} disabled={$paused} onclick={learn}>{text('letters.learn')}</button><button data-testid="letters-play" aria-pressed={mode==='play'} disabled={$paused} onclick={()=>{if(mode!=='play')start();}}>{text('letters.play')}</button></div>
			{#if mode==='learn'}
				<p>{text('letters.explore')}</p>
				<div class="learning-card" data-testid="letter-card" data-letter={entry.letter}><strong class="letter-pair" lang="en">{entry.letter} <span>{entry.letter.toLowerCase()}</span></strong><AlphabetPicture {entry}/><strong class="word" lang="en">{entry.word}</strong><button data-testid="letters-listen" disabled={$paused||!$settings.soundEnabled} onclick={listen}>♪ {text('letters.listen')}</button></div>
				<div class="actions"><button data-testid="letter-previous" disabled={selectedIndex===0||$paused} onclick={()=>select(selectedIndex-1)}>← {text('letters.previous')}</button><button data-testid="letter-next" disabled={selectedIndex===25||$paused} onclick={()=>select(selectedIndex+1)}>{text('letters.nextLetter')} →</button></div>
				<div class="alphabet" lang="en" role="group" aria-label="English alphabet A to Z">{#each ENGLISH_ALPHABET as item,index}<button data-letter={item.letter} aria-label={`${item.letter} ${item.letter.toLowerCase()}`} aria-pressed={selectedIndex===index} disabled={$paused} onclick={()=>select(index)}>{item.letter}<small>{item.letter.toLowerCase()}</small></button>{/each}</div>
			{:else if progress.phase==='finished'}
				<div data-testid="letters-finale"><div class="rumi"><Mascot state={joke?'wave':'celebrate'} size={170}/><span class="glasses" class:tilted={joke} aria-hidden="true">B</span></div><p role="status">{text(joke?'letters.joke':'letters.done')}</p><div class="actions"><button data-testid="letters-giggle" disabled={$paused} onclick={()=>{stopBoth();joke=!joke;say(joke?'letters.joke':'letters.done',{interrupt:true});}}>{text('letters.giggle')}</button><button class="primary" data-testid="letters-replay" disabled={$paused} onclick={start}>{text('letters.replay')}</button></div></div>
			{:else}
				<h2>{text(`letters.${question.kind}`)}</h2><p>{text(letterInstruction(question))}</p>
				{#if question.kind==='match'}<div class="match-target" data-testid="letter-target" lang="en">{question.target}</div>
				{:else if question.kind==='sequence'}<div class="sequence" lang="en" data-testid="letter-sequence">{#each question.sequence as letter,index}<div class="letter-slot" class:current={index===question.gap} data-sequence-token={index!==question.gap||progress.phase==='complete'?letter:undefined}>{index!==question.gap||progress.phase==='complete'?letter:'?'}</div>{/each}</div>
				{:else}<div class="picture-word" data-testid="letter-picture-word" data-spelling={question.spelling}><AlphabetPicture entry={question.entry}/><div class="sequence" lang="en">{#if question.spelling}{#each question.answer.split('') as letter,index}<div class="letter-slot" class:current={index===progress.filled} data-spelled-letter={index<progress.filled?letter:undefined}>{index<progress.filled?letter:'?'}</div>{/each}{:else}<strong class="word" data-testid="letter-word-clue">{progress.phase==='complete'?question.entry.word:`?${question.entry.word.slice(1)}`}</strong>{/if}</div></div>{/if}
				<button data-testid="letters-listen" disabled={$paused||!$settings.soundEnabled} onclick={listen}>♪ {text('letters.listen')}</button>
				<div class="choices" lang="en">{#each question.options as letter}<button data-letter-option={letter} class:hinted={progress.hint&&letter===question.answer[progress.filled]} disabled={progress.phase!=='play'||$paused} onclick={()=>dispatch({type:'ANSWER',letter})}>{letter}</button>{/each}</div>
				{#if progress.hint}<p class="hint" role="status" data-testid="letters-hint">{text('letters.hint')}</p>{/if}
				<div class="actions">{#if progress.phase==='complete'}<p class="success" role="status" data-testid="letters-correct">✓ {text('letters.correct')}</p><button class="primary" data-testid="letters-next" disabled={$paused} onclick={()=>dispatch({type:'NEXT'})}>{text('letters.next')} →</button>{:else}<button data-testid="letters-reset" disabled={$paused} onclick={()=>dispatch({type:'RESET'})}>{text('thinking.restart')}</button><button data-testid="letters-help" disabled={$paused} onclick={()=>dispatch({type:'HINT'})}>{text('letters.help')}</button>{/if}</div>
			{/if}
			{#if !$settings.soundEnabled}<p class="sound-note" data-testid="letters-muted">{text('letters.silent')}</p>{:else if voiceUnavailable}<p class="sound-note" role="status" data-testid="letters-voice-note">{text('letters.voiceUnavailable')}</p>{/if}
		</section>
	</div>
</div>

<style>
	.letters-shell{display:flex;flex-direction:column;flex:1;min-height:0}.letters-scroll{flex:1;min-height:0;overflow:auto;padding:10px 24px 30px}section{max-width:1000px;margin:auto;text-align:center}.navigation,.actions,.tabs{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.navigation{font-size:21px}h1{font-size:clamp(28px,3vw,40px);margin:16px 0}h2{font-size:27px}p{font-size:23px;line-height:1.5;max-width:800px;margin:18px auto}button{cursor:pointer;min-height:60px;padding:10px 20px;font-size:21px;border:3px solid var(--border-soft);border-radius:20px;background:var(--surface)}button:disabled{opacity:.6;cursor:default}button[aria-pressed='true']{border-color:var(--text-primary);background:var(--bg-secondary)}.primary{background:var(--text-primary);color:var(--bg-primary);font-weight:700}.tabs,.actions{justify-content:center;margin:22px auto}.learning-card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;border:3px solid var(--learn-blue);border-radius:28px;max-width:480px;margin:20px auto;background:var(--surface)}.letter-pair,.match-target,.letter-slot,.choices button,.alphabet button,.glasses{font-family:Arial,sans-serif}.letter-pair{font-size:96px;line-height:1.1;color:var(--learn-blue)}.letter-pair span{color:var(--text-primary)}.word{font:700 36px Arial,sans-serif}.alphabet{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin:24px auto}.alphabet button{font-size:34px;padding:10px 6px;min-height:76px}.alphabet small{font-size:25px;margin-left:7px}.match-target{font-size:110px;line-height:1.2;border:3px solid var(--learn-blue);border-radius:24px;max-width:240px;margin:24px auto;padding:14px}.sequence{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin:20px auto}.letter-slot{width:78px;min-height:90px;border:3px solid var(--border-soft);border-radius:18px;display:grid;place-items:center;font-size:52px;background:var(--surface)}.current,.hinted{outline:4px dashed var(--text-primary);outline-offset:3px}.picture-word{margin:20px auto}.choices{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;margin:24px auto}.choices button{font-size:52px;min-width:90px;min-height:100px}.success,.hint{padding:12px;border-radius:18px;background:var(--bg-secondary)}.sound-note{font-size:18px;color:var(--text-secondary)}.rumi{position:relative;width:170px;margin:30px auto}.glasses{position:absolute;top:42px;left:48px;font-size:74px;font-weight:900;line-height:1;color:var(--learn-blue);transform:rotate(90deg);text-shadow:2px 0 var(--text-primary)}.glasses.tilted{transform:rotate(70deg)}
	@media(max-width:600px){.letters-scroll{padding:8px 12px 24px}.navigation{justify-content:center}p{font-size:21px}button{padding:8px 12px;font-size:19px}.alphabet{grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.alphabet button{font-size:28px}.alphabet small{font-size:22px;margin-left:4px}.letter-pair{font-size:80px}.letter-slot{width:54px;min-height:72px;font-size:40px}.sequence{gap:8px}.choices button{min-width:76px;min-height:86px;font-size:44px}.word{font-size:30px}}
	@media(max-width:600px){.letters-shell>:global(header){grid-template-columns:auto 1fr;gap:8px;padding:10px 12px}.letters-shell>:global(header .right){grid-column:2;grid-row:1;justify-self:end}.letters-shell>:global(header .caption){grid-column:1 / -1;grid-row:2;font-size:20px;line-height:1.3}.letters-shell>:global(header .icon){width:56px;height:56px}}
</style>
