<script lang="ts">
	import { goto } from '$app/navigation';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { formatNumeral } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, stopNarration } from '#lib/audio/narrator.ts';
	import { t } from '#lib/i18n.ts';
	import { FLAG_COUNTRIES, FLAG_REGIONS, createFlagQuiz, flagChoices, flagCountry, flagQuizReducer, searchFlags, type FlagQuizAction, type FlagCountry } from './flagGame.ts';
	import { flagUrl } from './flagAssets.ts';
	import flagLicense from './licenses/flag-icons-LICENSE.txt?raw';
	import cldrLicense from './licenses/CLDR-LICENSE.txt?raw';
	let quiz = $state(untrack(() => createFlagQuiz(Date.now() >>> 0)));
	let mode = $state<'quiz' | 'learn'>('quiz');
	let region = $state('all');
	let query = $state('');
	let previewId = $state('bd');
	let scroller = $state<HTMLDivElement>();
	const current = $derived(flagCountry(quiz.deck[quiz.index]!));
	const options = $derived(flagChoices(quiz));
	const gallery = $derived(searchFlags(query, region));
	const preview = $derived(flagCountry(previewId));
	const ui = (bn: string, en: string) => $settings.language === 'bn-BD' ? bn : en;
	const label = (country: FlagCountry) => $settings.language === 'bn-BD' ? country.label.bn : country.label.en;
	const n = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const regionName = (value: string) => ui(({ Africa:'আফ্রিকা', Antarctica:'অ্যান্টার্কটিকা', Asia:'এশিয়া', Europe:'ইউরোপ', 'North America':'উত্তর আমেরিকা', 'South America':'দক্ষিণ আমেরিকা', Oceania:'ওশেনিয়া' } as Record<string,string>)[value] ?? value, value);
	const status = $derived(mode === 'learn' ? `${label(preview)} · ${preview.label.en}` : quiz.phase === 'finished'
		? ui('এই তালিকার শেষ পর্যন্ত এসেছ! চাইলে আবার খেলতে বা সব পতাকা দেখতে পারো।', 'You reached the end of this list! Play again or explore the flags.')
		: quiz.phase === 'correct' ? ui(`মিলেছে! এটি ${label(current)}-এর পতাকা।`, `It matches! This is the flag of ${label(current)}.`)
		: quiz.hint ? ui('পতাকার ছোট ছবি, তীর আর দাগ দেওয়া উত্তরটি মিলিয়ে দেখো।', 'Look for the small matching flag, arrow and outlined answer.')
		: quiz.attempts ? ui('আবার দেখে চেষ্টা করি। চাইলে সাহায্য নিতে পারো।', 'Let’s look again. You can ask for a hint.') : ui('কোন দেশ বা অঞ্চলের পতাকা?', 'Which country or territory has this flag?'));
	function focusTop() { void tick().then(() => { scroller?.scrollTo(0,0); scroller?.querySelector<HTMLElement>('h2')?.focus({preventScroll:true}); }); }
	function dispatch(action: FlagQuizAction) { if ($paused) return; const next = flagQuizReducer(quiz,action); if(next===quiz)return;quiz=next;if(action.type==='NEXT'||action.type==='SKIP')focusTop(); }
	function changeRegion(value: string) { if($paused)return;region=value;query='';quiz=createFlagQuiz((quiz.seed+1)>>>0,value,undefined,quiz.recognized);const first=searchFlags('',value)[0];if(first)previewId=first.id;focusTop(); }
	function practice(id: string) { if($paused)return;quiz=createFlagQuiz((quiz.seed+1)>>>0,region,id,quiz.recognized);mode='quiz';focusTop(); }
	function switchMode(value:'quiz'|'learn') { if($paused)return;mode=value;focusTop(); }
	$effect(() => caption.set(status));
	onMount(() => stopNarration());
	onDestroy(() => { stopNarration(); caption.set(''); });
</script>

<div class="flag-shell" class:reduce-motion={$settings.reducedMotion} class:paused={$paused}>
	<TopBar backTo="/play" />
	<div class="flag-content" bind:this={scroller} data-testid="flag-game">
		<section class="flag-game">
			<div class="header"><h2 tabindex="-1">{ui('দেশের পতাকা চিনো','Guess the country flag')}</h2><p>{ui('দেশ ও অঞ্চল','Countries & territories')}: {n(FLAG_COUNTRIES.length)} · {ui('চেনা পতাকা','Flags recognized')}: <span data-testid="flag-recognized">{n(quiz.recognized.length)}</span></p></div>
			<div class="toolbar"><div class="tabs" role="group" aria-label={ui('পতাকা শেখা ও খেলা','Flag learning and play')}><button data-testid="flag-quiz-tab" aria-pressed={mode==='quiz'} disabled={$paused} onclick={()=>switchMode('quiz')}>{ui('পতাকা খেলা','Play')}</button><button data-testid="flag-learn-tab" aria-pressed={mode==='learn'} disabled={$paused} onclick={()=>switchMode('learn')}>{ui('সব পতাকা দেখি','Explore all flags')}</button></div><label class="region"><span>{ui('মহাদেশ','Continent')}</span><select data-testid="flag-region" disabled={$paused} value={region} onchange={(event)=>changeRegion(event.currentTarget.value)}><option value="all">{ui('সব মহাদেশ','All continents')}</option>{#each FLAG_REGIONS as value}<option {value}>{regionName(value)}</option>{/each}</select></label></div>
			{#if mode==='quiz'}
				{#if quiz.phase==='finished'}<div class="finished" data-testid="flag-finished"><p>{status}</p><button class="primary" disabled={$paused} onclick={()=>practice(quiz.deck[0]!)}>{ui('আবার খেলি','Play again')}</button></div>
				{:else}
					<div class="flag-panel" data-testid="flag-panel" data-country={current.id}><img src={flagUrl(current.id)} alt={quiz.phase==='correct'?label(current):ui('দেশ বা অঞ্চল চিনতে পতাকাটি দেখো','Flag to identify')} draggable="false" /></div>
					<div class="choices">{#each options as option (option.id)}
						{@const hinted = quiz.hint && option.id===current.id}
						<button type="button" class:correct={quiz.phase==='correct'&&option.id===current.id} class:hint-target={hinted} data-flag-option={option.id} aria-describedby={hinted?'flag-hint':undefined} disabled={quiz.phase!=='play'||$paused} onclick={()=>dispatch({type:'ANSWER',id:option.id})}>{#if hinted}<img class="hint-flag" src={flagUrl(option.id)} alt="" aria-hidden="true"/><span class="hint-arrow" aria-hidden="true">➜</span>{/if}<span>{label(option)}</span>{#if quiz.phase==='correct'&&option.id===current.id}<b aria-hidden="true"> ✓</b>{/if}</button>
					{/each}</div>
					<p class="status" class:success={quiz.phase==='correct'} role="status" data-testid="flag-status" id={quiz.hint?'flag-hint':undefined}>{status}</p>
					<div class="actions">{#if quiz.phase==='correct'}<button class="primary" data-testid="flag-next" disabled={$paused} onclick={()=>dispatch({type:'NEXT'})}>{ui('পরের পতাকা','Next flag')} →</button>{:else}<button data-testid="flag-hint" disabled={quiz.hint||$paused} onclick={()=>dispatch({type:'HINT'})}>{ui('একটু সাহায্য','Show a hint')}</button><button data-testid="flag-skip" disabled={$paused} onclick={()=>dispatch({type:'SKIP'})}>{ui('অন্য পতাকা দেখি','Try another flag')}</button>{/if}<button class="other-game" onclick={()=>goto('/play')}>{t('chooseGame',$settings.language)}</button></div>
				{/if}
			{:else}
				<div class="explore" data-testid="flag-explore"><div class="preview"><img data-testid="flag-preview" src={flagUrl(preview.id)} alt={label(preview)}/><div><h3>{label(preview)}</h3><p lang="en">{preview.label.en} · {preview.id.toUpperCase()}</p><button class="primary" data-testid="flag-practice" disabled={$paused} onclick={()=>practice(preview.id)}>{ui('এই পতাকা নিয়ে খেলি','Play with this flag')}</button></div></div>
					<label class="search"><span>{ui('বাংলা, ইংরেজি বা দেশের কোড দিয়ে খুঁজি','Search Bengali, English or country code')}</span><input data-testid="flag-search" type="search" bind:value={query} placeholder={ui('যেমন: বাংলাদেশ, Japan, US','For example: Bangladesh, জাপান, US')}/></label><p class="result-count" role="status">{ui('পাওয়া গেছে','Found')}: <span data-testid="flag-result-count">{n(gallery.length)}</span></p>
					<div class="flag-gallery">{#each gallery as country (country.id)}<button data-gallery-country={country.id} aria-pressed={previewId===country.id} disabled={$paused} onclick={()=>{previewId=country.id;scroller?.scrollTo({top:0,behavior:'instant'});}}><img src={flagUrl(country.id)} alt="" loading="lazy" decoding="async"/><span>{label(country)}</span><small lang="en">{country.label.en}</small></button>{/each}</div>{#if !gallery.length}<p>{ui('এই নামে কিছু পাওয়া যায়নি। অন্য নামে খোঁজো।','No flags found. Try another name.')}</p>{/if}
				</div>
			{/if}
			<details class="credits"><summary>{ui('পতাকা ও নামের তথ্যসূত্র','Flag and name credits')}</summary><p>{ui('দেশ ও অঞ্চলসহ ISO তালিকার ২৪৯টি পতাকা।','249 ISO entries, including countries and territories.')} <a href="https://github.com/lipis/flag-icons" target="_blank" rel="noreferrer">flag-icons 7.6.0</a> · <a href="https://github.com/unicode-org/cldr-json" target="_blank" rel="noreferrer">Unicode CLDR 49.0.0</a></p><details><summary>flag-icons · MIT</summary><pre>{flagLicense}</pre></details><details><summary>Unicode · Unicode-3.0</summary><pre>{cldrLicense}</pre></details></details>
		</section>
	</div>
</div>

<style>
	.flag-shell{display:flex;flex-direction:column;flex:1;min-height:0}.flag-content{flex:1;min-height:0;overflow:auto;padding:4px 16px 16px}.flag-game{display:flex;flex-direction:column;align-items:center;gap:10px;max-width:1100px;margin:auto}.header{text-align:center}.header h2{font-size:34px;line-height:1.2;margin:0}.header p{margin:4px 0 0;font-size:19px}.toolbar,.tabs,.actions{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px}.toolbar{width:100%;gap:20px}.region{display:flex;align-items:center;gap:8px;font-size:18px}button,select,input{border:3px solid var(--border-soft);border-radius:16px;background:var(--surface);color:var(--text-primary);font:inherit}button{min-height:48px;padding:8px 16px;font-size:20px;font-weight:600;cursor:pointer}button:disabled{cursor:default;opacity:.65}button[aria-pressed='true']{border-color:var(--text-primary);background:var(--bg-secondary)}select{padding:8px;font-size:18px;max-width:260px}.flag-panel{width:min(300px,26vh);aspect-ratio:4/3;flex-shrink:0;border:3px solid var(--border-soft);border-radius:16px;padding:8px;background:#f5f5f5;display:grid;place-items:center}.flag-panel img{width:100%;height:100%;object-fit:contain;display:block}.choices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:min(760px,100%)}.choices button{position:relative;min-height:60px;line-height:1.25;padding:10px 54px;overflow-wrap:anywhere}.choices .correct{border-color:var(--learn-green);background:var(--bg-secondary);opacity:1}.choices .hint-target{border:3px dashed var(--text-primary);background:var(--bg-secondary);animation:hint-pulse 1.1s ease-in-out 3}.hint-flag{position:absolute;left:8px;top:50%;transform:translateY(-50%);width:40px;height:30px;object-fit:contain;background:var(--surface)}.hint-arrow{position:absolute;right:12px;top:50%;margin-top:-14px;line-height:28px;font-size:26px;animation:hint-arrow 1.1s ease-in-out 3}.status{font-size:20px;line-height:1.3;min-height:26px;text-align:center;margin:0;max-width:800px}.success{font-weight:700}.primary{background:var(--text-primary);color:var(--bg-primary)}.credits{font-size:15px;max-width:850px;width:100%;text-align:center;margin-top:2px}.credits summary{cursor:pointer;padding:4px}.credits p{margin:8px}.credits pre{white-space:pre-wrap;overflow-wrap:anywhere;text-align:start;font-size:13px}.finished{text-align:center;padding:30px}.explore{width:100%}.preview{display:flex;justify-content:center;align-items:center;gap:24px;border:2px solid var(--border-soft);border-radius:20px;background:var(--surface);padding:16px}.preview>img{width:180px;height:135px;object-fit:contain;background:#f5f5f5}.preview h3{font-size:27px;margin:0}.preview p{font-size:19px;margin:6px 0 12px}.search{display:flex;flex-direction:column;gap:8px;margin:20px auto 0;max-width:650px;font-size:20px}.search input{padding:10px 14px;min-height:54px;font-size:20px;width:100%}.result-count{text-align:center;font-size:20px;margin:12px}.flag-gallery{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:12px 0 24px}.flag-gallery button{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:8px;padding:14px;font-size:20px;min-width:0}.flag-gallery img{width:100px;height:75px;object-fit:contain;background:#f5f5f5}.flag-gallery span,.flag-gallery small{overflow-wrap:anywhere}.flag-gallery small{font-size:15px;font-weight:400}.reduce-motion .hint-target,.reduce-motion .hint-arrow{animation:none!important}.paused .hint-target,.paused .hint-arrow{animation-play-state:paused}
	@keyframes hint-pulse{0%,100%{box-shadow:0 0 0 0 var(--border-soft)}50%{box-shadow:0 0 0 5px var(--learn-green)}}@keyframes hint-arrow{0%,100%{transform:translateX(0)}50%{transform:translateX(-6px)}}
	@media(prefers-reduced-motion:reduce){.choices .hint-target,.hint-arrow{animation:none!important}}
	@media(max-width:600px){.flag-content{padding:6px 12px 18px}.header h2{font-size:28px}.toolbar{gap:10px}.choices{grid-template-columns:1fr}.flag-gallery{grid-template-columns:repeat(2,minmax(0,1fr))}.preview{flex-direction:column;gap:12px;text-align:center}.preview h3{font-size:24px}.region{font-size:17px}.flag-panel{width:min(260px,32vh)}.actions{gap:8px}button{font-size:19px}}
	@media(max-height:700px) and (min-width:601px){.flag-game{gap:8px}.header h2{font-size:30px}.header p{font-size:18px}.flag-panel{width:min(240px,25vh)}.choices button{min-height:54px}button{min-height:44px;font-size:19px;padding:6px 14px}.status{font-size:18px}.credits{font-size:14px}}
</style>
