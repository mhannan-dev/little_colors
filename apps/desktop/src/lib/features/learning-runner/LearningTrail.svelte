<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { formatNumeral } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createTrail, MODES, type TrailMode, type Token } from './lessons.ts';
	import TrailToken from './TrailToken.svelte';
	import type { TrailFrame, TrailScene } from './trailScene.ts';
	import { RunnerMotion } from './runnerMotion.ts';
	import { DISCOVERY_STOPS, type CourseId } from './reference/course.ts';

	let mode = $state<TrailMode | null>(null);
	let lessons = $state<ReturnType<typeof createTrail>>([]);
	let index = $state(0);
	let phase = $state<'picker' | 'travel' | 'choice' | 'crossing' | 'celebrate' | 'done'>('picker');
	let selected = $state(0);
	let attempts = $state(0);
	let hint = $state(false);
	let retry = $state(false);
	let manualPause = $state(false);
	let failed = $state(false);
	let ready = $state(false);
	let assisted = $state(true);
	let character = $state(0);
	let theme = $state<CourseId>('meadow');
	let obstacle = $state<'jump' | 'slide' | null>(null);
	let pose = $state('idle');
	const motion = new RunnerMotion();
	const characters = [
		{ index: 0, icon: '🧒', en: 'Explorer', bn: 'অভিযাত্রী' },
		{ index: 1, icon: '🦊', en: 'Fox', bn: 'শিয়াল' },
		{ index: 2, icon: '🐰', en: 'Bunny', bn: 'খরগোশ' },
		{ index: 3, icon: '🐼', en: 'Panda', bn: 'পান্ডা' }
	] as const;
	const themes = [
		{ id: 'meadow', icon: '🌼', en: 'Meadow', bn: 'ফুলের মাঠ' },
		{ id: 'night', icon: '🌙', en: 'Moonlight', bn: 'চাঁদের আলো' },
		{ id: 'snow', icon: '❄', en: 'Snow', bn: 'বরফ' },
		{ id: 'beach', icon: '🌴', en: 'Seaside', bn: 'সমুদ্রের ধারে' }
	] as const;
	let canvas: HTMLCanvasElement;
	let view = $state.raw<TrailScene | null>(null);
	let swipe: { id: number; x: number; y: number } | null = null;
	const bn = $derived($settings.language === 'bn-BD');
	const lesson = $derived(lessons[index]);
	const systemMotion = new MediaQuery('(prefers-reduced-motion: reduce)');
	const motionReduced = $derived($settings.reducedMotion || systemMotion.current);
	const stop = $derived(DISCOVERY_STOPS[index] ?? DISCOVERY_STOPS[0]);
	const name = (token: Token) => bn ? token.bn : token.en;
	const numeral = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const voice = () => {
		if (phase === 'choice' && lesson) instruct(lesson.target.voice);
		else if (phase === 'celebrate' || phase === 'done') instruct('feedback.completed');
		else instruct('match.instruction.both');
	};
	function showChoice() {
		phase = 'choice';
		selected = 0;
		instruct(lesson.target.voice);
		if (firstTime('learning-runner')) requestAnimationFrame(() => showHand(['[data-trail-target]', '[data-trail-options]']));
	}
	function start(nextMode: TrailMode) {
		mode = nextMode;
		lessons = createTrail(nextMode, $settings.difficulty === 'beginner');
		index = 0;
		motion.reset();
		obstacle = null;
		retry = hint = manualPause = false;
		attempts = selected = 0;
		phase = 'travel';
		if (failed) showChoice();
		else instruct(MODES.find(item => item.id === nextMode)!.voice);
	}
	function choose(option: number) {
		if ($paused || manualPause || phase !== 'choice' || !lesson.options[option]) return;
		hideHand();
		selected = option;
		if (lesson.options[option].id !== lesson.target.id) {
			attempts++;
			retry = true;
			hint = attempts >= 2;
			say('match.retry', { interrupt: true });
			return;
		}
		retry = false;
		hint = false;
		phase = failed ? 'celebrate' : 'crossing';
		say(lesson.target.voice, { interrupt: true });
	}
	function next() {
		if (phase !== 'celebrate') return;
		if (index + 1 === lessons.length) {
			phase = 'done';
			instruct('feedback.completed');
			return;
		}
		index++;
		attempts = selected = 0;
		retry = hint = false;
		phase = 'travel';
		if (failed) showChoice();
	}
	function jump() {
		if (phase === 'travel' && !manualPause && !$paused && !motionReduced) motion.jump();
	}
	function slide() {
		if (phase === 'travel' && !manualPause && !$paused && !motionReduced) motion.slide();
	}
	function keydown(event: KeyboardEvent) {
		if (!mode || manualPause || $paused || event.altKey || event.ctrlKey || event.metaKey) return;
		if (event.target instanceof HTMLElement && event.target.closest('button, input, select, a')) return;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			if (lesson) selected = Math.max(0, Math.min(lesson.options.length - 1, selected + (event.key === 'ArrowLeft' ? -1 : 1)));
		} else if (event.key === ' ' || event.key === 'ArrowUp') { event.preventDefault(); jump(); }
		else if (event.key === 'ArrowDown') { event.preventDefault(); slide(); }
		else if (event.key === 'Enter') { event.preventDefault(); choose(selected); }
	}
	function update(dt: number): TrailFrame {
		const running = !manualPause && !$paused;
		if (running && (phase === 'travel' || phase === 'crossing')) {
			const destination = phase === 'travel' ? stop - 8 : stop + 5;
			if (motion.step(dt, destination, assisted, motionReduced)) {
				if (phase === 'travel') showChoice();
				else {
					phase = 'celebrate';
					if (!motionReduced) view?.celebrate();
					instruct('feedback.celebrate');
				}
			}
		}
		obstacle = motion.waiting ? motion.waiting.kind === 'branch' ? 'slide' : 'jump' : null;
		pose = motion.flip >= 0 ? 'flip' : motion.airborne ? 'jump' : motion.sliding ? 'slide' : obstacle ? 'wait' : phase === 'travel' ? 'run' : 'idle';
		return { distance: motion.distance, lane: lesson && phase !== 'travel' ? (selected - (lesson.options.length - 1) / 2) * 1.8 : 0,
			moving: running && !motion.waiting && (phase === 'travel' || phase === 'crossing'), jump: motionReduced ? 0 : motion.height,
			sliding: !motionReduced && motion.sliding, flip: motionReduced ? -1 : motion.flip,
			reduced: motionReduced, celebrate: phase === 'celebrate' || phase === 'done', preview: phase === 'picker' };
	}
	$effect(() => { view?.setPaused($paused || manualPause); });
	$effect(() => { view?.character(character); });
	$effect(() => { view?.theme(theme); });
	$effect(() => {
		$settings.numeralStyle;
		if (view) view.lesson(lesson ?? null, stop, numeral);
	});
	onMount(() => {
		let destroyed = false;
		void import('./trailScene.ts').then(async ({ createTrailScene }) => {
			await document.fonts.ready;
			if (destroyed) return;
			view = createTrailScene(canvas, update);
			ready = true;
		}).catch(() => { if (!destroyed) { failed = true; if (mode) showChoice(); } });
		return () => { destroyed = true; view?.dispose(); hideHand(); leaveScreen(); };
	});
</script>

<svelte:window onkeydown={keydown} />
<svelte:head><title>Rumi's Learning Trail · Little Colors</title></svelte:head>
<div class="runner-shell">
	<TopBar onreplay={voice} />
	<section data-testid="learning-runner" data-ready={ready} data-phase={phase} data-obstacle={obstacle} data-motion={pose}>
		<div class="heading"><div><p class="eyebrow">{bn ? 'ছোট ছোট পায়ে শেখার অভিযান' : 'LITTLE STEPS, BIG DISCOVERIES'}</p><h1>{bn ? 'রুমির শেখার পথ' : "Rumi’s Learning Trail"}</h1></div>
			{#if mode}<button class="light" onclick={() => { phase = 'picker'; mode = null; lessons = []; manualPause = false; motion.reset(); obstacle = null; hideHand(); voice(); }}>☰ {bn ? 'অন্য পথ' : 'Choose a trail'}</button>{/if}
		</div>
		<div class="stage" onpointerdown={(e) => { if (e.target === canvas) { swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } }}
			onpointerup={(e) => { if (swipe?.id === e.pointerId) { const dy = e.clientY - swipe.y; if (dy > 35) slide(); else jump(); swipe = null; } }} onpointercancel={() => swipe = null} role="presentation">
			<canvas bind:this={canvas} tabindex="0" aria-label={bn ? 'থ্রিডি পাহাড়ি পথ। স্পেসে লাফ, নিচের তীরে স্লাইড।' : '3D mountain trail. Space to jump, Down to slide.'}></canvas>
			{#if !ready && !failed}<div class="loading" role="status">{bn ? 'পথ তৈরি হচ্ছে…' : 'Growing a little trail…'}</div>{/if}
			{#if failed}<div class="fallback-art" aria-hidden="true">🌳 🐯 🌳</div>{/if}
			{#if mode && phase !== 'picker'}
				<div class="journey" aria-label={bn ? 'শেখার যাত্রা' : 'Learning journey'}>{#each lessons as item, i}<span class:learned={i < index || (i === index && (phase === 'celebrate' || phase === 'done'))} aria-hidden="true">✿</span>{/each}</div>
			{/if}
			{#if phase === 'picker'}
				<div class="picker"><h2>{bn ? 'কোন পথে যাবো?' : 'Where shall we explore?'}</h2><p>{bn ? 'রং চিনে, আকার মিলিয়ে, গুনে গুনে এগিয়ে যাই।' : 'Discover colors, match shapes, and count together.'}</p>
					<div class="mode-cards">{#each MODES as item}<button disabled={!ready && !failed} onclick={() => start(item.id)}><span aria-hidden="true">{item.icon}</span>{bn ? item.bn : item.en}<small aria-hidden="true">→</small></button>{/each}</div>
					<p class="picker-label">{bn ? 'কাকে নিয়ে খেলবে?' : 'CHOOSE YOUR RUNNER'}</p>
					<div class="character-options" role="group" aria-label={bn ? 'চরিত্র' : 'Runner character'}>{#each characters as item}<button aria-pressed={character === item.index} aria-label={bn ? item.bn : item.en} onclick={() => character = item.index}><span aria-hidden="true">{item.icon}</span></button>{/each}</div>
					<p class="picker-label">{bn ? 'কোথায় যাবে?' : 'EXPLORE A WORLD'}</p>
					<div class="theme-options" role="group" aria-label={bn ? 'দৃশ্য' : 'Trail scenery'}>{#each themes as item}<button aria-pressed={theme === item.id} onclick={() => theme = item.id}>{item.icon} {bn ? item.bn : item.en}</button>{/each}</div>
					<label class="assist"><input type="checkbox" bind:checked={assisted} />{bn ? 'লাফ ও স্লাইডে সাহায্য করো' : 'Help me jump and slide'}</label>
				</div>
			{:else if manualPause}
				<div class="overlay"><div class="message"><h2>{bn ? 'একটু বিশ্রাম' : 'A little rest'}</h2><button class="primary" onclick={() => manualPause = false}>▶ {bn ? 'আবার চলি' : 'Continue'}</button></div></div>
			{:else if phase === 'done'}
				<div class="overlay"><div class="message"><div class="flower" aria-hidden="true">✿</div><h2>{bn ? 'কত কিছু শিখলাম!' : 'So many discoveries!'}</h2><p>{bn ? 'রুমির সঙ্গে আবার বেরোবো?' : 'Shall we explore with Rumi again?'}</p>
					<div class="discovered">{#each lessons as item}<div><TrailToken token={item.target} /></div>{/each}</div>
					<button class="primary" onclick={() => start(mode!)}>↻ {bn ? 'আবার খেলি' : 'Play again'}</button></div></div>
			{/if}
		{#if mode && !manualPause && phase !== 'done'}
			<div class="learning-panel">
				{#if phase === 'choice'}
					<div class="prompt"><div class="target-token" data-trail-target><TrailToken token={lesson.target} /></div><div><h2>{bn ? `${name(lesson.target)} কোনটি?` : `Where is ${name(lesson.target)}?`}</h2><p aria-live="polite">{retry ? (bn ? 'আবার দেখি, কোনটি মেলে?' : 'Let’s look again. Which one matches?') : (bn ? 'ছবিটি দেখে মেলাও। সময় নিয়ে বেছে নাও।' : 'Look, match, and choose at your own pace.')}</p></div></div>
					<div class="choices" data-trail-options role="group" aria-label={bn ? 'কোনটি মেলে?' : 'Choose the matching picture'}>
						{#each lesson.options as token, i}<button class:selected={selected === i} class:hinted={hint && token.id === lesson.target.id} data-option-id={token.id} onclick={() => choose(i)} aria-label={name(token)}><TrailToken {token} /><span>{name(token)}</span></button>{/each}
					</div>
					{#if attempts >= 2}<button class="light" onclick={() => { hint = true; instruct(lesson.target.voice); showHand([`[data-option-id="${lesson.target.id}"]`]); }}>☞ {bn ? 'দেখিয়ে দাও' : 'Show me'}</button>{/if}
				{:else if phase === 'celebrate'}
					<div class="prompt"><div class="target-token"><TrailToken token={lesson.target} /></div><div><h2>{bn ? 'দারুণ মিলেছে!' : 'A lovely match!'}</h2><p>{name(lesson.target)}</p></div></div>
					<button class="primary" onclick={next}>→ {index === lessons.length - 1 ? (bn ? 'সব আবিষ্কার দেখি' : 'See our discoveries') : (bn ? 'পরের পথে যাই' : 'Next discovery')}</button>
				{:else}<div class="run-caption"><h2>{phase === 'crossing' ? (bn ? 'মিলটি পেয়ে গেলাম!' : 'We found a match!') : obstacle === 'slide' ? (bn ? 'ডালের নিচ দিয়ে যাই!' : 'Slide under the branch!') : obstacle === 'jump' ? (bn ? 'লাফ দিয়ে পার হই!' : 'Jump across!') : (bn ? 'চলো, পাহাড়ি পথে!' : 'Follow the mountain trail!')}</h2><p>{bn ? 'ট্যাপ / ↑ লাফ • ↓ স্লাইড • দুবার ট্যাপ করলে ডিগবাজি' : 'Tap / ↑ to jump · ↓ to slide · Double tap for a flip'}</p></div>
					<div class="run-controls"><button class="primary" disabled={phase !== 'travel' || motionReduced} onclick={jump}>↟ {bn ? 'লাফাই' : 'Hop'}</button><button class="light" disabled={phase !== 'travel' || motionReduced} onclick={slide}>↧ {bn ? 'স্লাইড' : 'Slide'}</button></div>
				{/if}
				<button class="light pause" aria-label={bn ? 'বিরতি' : 'Pause'} onclick={() => manualPause = true}>Ⅱ</button>
			</div>
		{/if}
		</div>
	</section>
</div>

<style>
	.runner-shell { display: flex; flex-direction: column; flex: 1; min-height: 100%; background: #fbf7ec; }
	section { display: flex; flex: 1; flex-direction: column; gap: 12px; padding: 0 24px 20px; min-height: 0; }
	.heading { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
	h1 { margin: 0; font-size: clamp(25px, 3vw, 37px); line-height: 1.2; } .eyebrow { margin: 0 0 5px; font-size: 12px; letter-spacing: .12em; color: #587465; }
	.stage { flex: 1; min-height: 600px; position: relative; border-radius: 26px; overflow: hidden; background: linear-gradient(#a7d5e4, #e7f1e6); border: 2px solid #b5cbb8; }
	canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: pan-x; }
	button { min-height: 48px; padding: 8px 16px; border: 2px solid #b2c4ad; border-radius: 15px; font-size: 18px; font-weight: 700; background: #fffcf3; cursor: pointer; touch-action: manipulation; }
	button:disabled { opacity: .5; cursor: default; } .light { background: #fffdf5; } .primary { background: #d2e7ba; border-color: #8aa974; }
	button:hover { border-color: #537950; } .loading { position: absolute; inset: 0; display: grid; place-items: center; color: #36534a; } .fallback-art { font-size: 90px; position: absolute; inset: 15% 0; text-align: center; }
	.picker { position: relative; width: min(370px, calc(100% - 32px)); margin: 22px; padding: 20px; border: 2px solid #c5d7bd; border-radius: 23px; background: #fffcf0ed; box-shadow: 0 15px 35px #294f3226; backdrop-filter: blur(10px); }
	.picker-label { font-size: 11px; font-weight: 800; letter-spacing: .09em; margin: 14px 0 7px; }
	.picker > h2 { font-size: 22px; } .picker > p:not(.picker-label) { font-size: 15px; line-height: 1.4; }
	.character-options, .theme-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; }
	.character-options button { font-size: 27px; padding: 4px; }
	.theme-options { grid-template-columns: 1fr 1fr; }
	.theme-options button { font-size: 13px; padding: 5px; min-height: 36px; }
	button[aria-pressed='true'] { border-color: #54865f; background: #dbedcc; box-shadow: 0 0 0 2px #54865f25; }
	.assist { display: flex; align-items: center; gap: 8px; margin-top: 14px; font-size: 14px; color: #36534a; cursor: pointer; }
	.assist input { width: 20px; height: 20px; accent-color: #568360; }
	h2 { font-size: 24px; margin: 0; line-height: 1.25; } p { font-size: 17px; color: #52695b; margin: 6px 0; }
	.mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; } .mode-cards button { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 16px; line-height: 1.15; padding: 8px 6px; } .mode-cards button > span { font-size: 24px; color: #51835d; } small { color: #598151; font-size: 14px; line-height: 1; }
	.learning-panel { position: absolute; bottom: 16px; left: 16px; right: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; padding: 12px 18px; background: #fffdf6ed; backdrop-filter: blur(10px); border: 2px solid #d5dfcc; border-radius: 22px; min-height: 84px; }
	.run-controls { display: flex; gap: 8px; margin-left: auto; } .run-caption h2 { font-size: 22px; } .run-caption p { font-size: 14px; }
	.prompt { display: flex; align-items: center; gap: 13px; } .target-token { width: 76px; height: 76px; flex-shrink: 0; background: #f4f3df; border-radius: 17px; }
	.choices { display: flex; gap: 10px; } .choices button { width: 100px; height: 104px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 5px; font-size: 15px; } .choices button :global(svg) { flex: 1; min-height: 0; } .choices button.selected { border-color: #709561; } .choices button.hinted { outline: 3px dashed #456f46; outline-offset: 4px; background: #e8f0d9; }
	.pause { margin-left: auto; min-width: 48px; } .journey { position: absolute; right: 18px; top: 15px; display: flex; gap: 8px; padding: 5px 12px; border-radius: 14px; background: #fff8e6d9; font-size: 27px; color: #aebba4; } .journey .learned { color: #679968; }
	.overlay { position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; background: #e8f2df9c; } .message { background: #fffdf1; border: 2px solid #c0d2b2; padding: 22px; border-radius: 23px; text-align: center; } .flower { font-size: 47px; color: #779d69; } .discovered { display: flex; justify-content: center; margin: 14px 0; gap: 6px; } .discovered > div { width: 56px; height: 56px; }
	@media(max-width:700px) { section { padding: 0 10px 15px; gap: 8px; } .eyebrow { display: none; } .heading { flex-wrap: wrap; } .heading button { font-size: 15px; min-height: 42px; } .stage { min-height: 810px; } .picker { margin: 230px auto 14px; padding: 16px; } .learning-panel { bottom: 10px; left: 8px; right: 8px; padding: 10px; gap: 10px; } .run-caption { flex-basis: 100%; } .run-controls { margin-left: 0; } .prompt { flex: 1; } .prompt h2 { font-size: 21px; } .prompt p { font-size: 15px; } .choices { justify-content: center; order: 2; flex-basis: 100%; } .runner-shell > :global(header) { grid-template-columns: auto 1fr; padding: 8px 10px; gap: 6px; } .runner-shell > :global(header .right) { grid-column: 2; grid-row: 1; justify-self: end; gap: 4px; } .runner-shell > :global(header .caption) { grid-column: 1 / -1; grid-row: 2; font-size: 18px; } .runner-shell > :global(header .icon) { width: 44px; height: 44px; } }
</style>
