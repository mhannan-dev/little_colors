<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { formatNumeral } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { leaveScreen } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { chime } from '#lib/game/chime.ts';
	import { showHand, hideHand } from '#lib/game/hand.ts';
	import SafariHelp from './SafariHelp.svelte';
	import { ANIMALS, FOODS, MODES, createSafari, type SafariMode, type FoodId } from './lessons.ts';
	import { createSafariAudio } from './audio.ts';
	import type { AnimalSpot, SafariFrame, SafariScene } from './safariScene.ts';

	let canvas: HTMLCanvasElement;
	let view = $state.raw<SafariScene | null>(null);
	let audio = $state.raw<ReturnType<typeof createSafariAudio> | null>(null);
	let ready = $state(false), fallback = $state(false);
	let mode = $state<SafariMode>('adventure');
	let lessons = $state(createSafari('adventure'));
	let index = $state(0), distance = 24;
	let phase = $state<'picker' | 'travel' | 'choice' | 'celebrate' | 'done'>('picker');
	let counted = $state<number[]>([]), attempts = $state(0), selected = $state(0);
	let hint = $state(false), manualPause = $state(false);
	let helpOpen = $state(false), hintId = $state<number | null>(null);
	let spots = $state<AnimalSpot[]>([]);
	let feedback = $state('');
	const bn = $derived($settings.language === 'bn-BD');
	const reducedSystem = new MediaQuery('(prefers-reduced-motion: reduce)');
	const reduced = $derived($settings.reducedMotion || reducedSystem.current);
	const lesson = $derived(lessons[index]);
	const stop = $derived(24 + index * 34);
	const animal = $derived(ANIMALS[lesson.animal]);
	const n = (value: number) => formatNumeral(value, $settings.numeralStyle);
	const tr = (en: string, bangla: string) => bn ? bangla : en;
	const name = (id: keyof typeof ANIMALS) => bn ? ANIMALS[id].bn : ANIMALS[id].en;
	const rabbitWord = (count: number) => count === 1 ? 'rabbit' : 'rabbits';
	const heading = $derived(lesson.kind === 'count' ? tr(`Let’s count ${n(lesson.count!)} ${rabbitWord(lesson.count!)}`, `${n(lesson.count!)}টি খরগোশ গুনি`)
		: lesson.kind === 'food' ? tr(`${animal.en} would like the ${FOODS[lesson.food!].en.toLowerCase()}`, `${animal.bn} ${FOODS[lesson.food!].bn} চায়`)
		: lesson.kind === 'listen' ? tr('Who is calling?', 'কে ডাকছে?') : tr(`Where is the ${animal.en.toLowerCase()}?`, `${animal.bn} কোথায়?`));
	function prompt() {
		if (phase === 'picker') audio?.speak(tr('Welcome to Rumi’s Animal Safari! Pick an adventure.', 'রুমির প্রাণী সাফারিতে স্বাগতম! একটি অভিযান বেছে নিই।'));
		else if (phase === 'travel') audio?.speak(tr('Let’s ride to meet our animal friends.', 'চলো, জিপে চড়ে প্রাণী বন্ধুদের কাছে যাই।'));
		else if (phase === 'done') audio?.speak(tr('So many new animal friends! Shall we explore again?', 'কত নতুন প্রাণী বন্ধু! আবার ঘুরতে যাবো?'));
		else if (phase === 'celebrate') audio?.speak(lesson.kind === 'count'
			? tr(`We counted ${['', 'one', 'two', 'three', 'four', 'five'][lesson.count!]} ${rabbitWord(lesson.count!)}. Lovely exploring!`, `${['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ'][lesson.count!]}টি খরগোশ গুনেছি। দারুণ শিখেছি!`)
			: lesson.kind === 'food' ? tr(`${animal.en} has the ${FOODS[lesson.food!].en.toLowerCase()}. Thank you!`, `${animal.bn} ${FOODS[lesson.food!].bn} পেয়েছে। ধন্যবাদ!`)
			: tr(`${animal.en}! A lovely discovery.`, `${animal.bn}! দারুণ আবিষ্কার।`));
		else audio?.speak(heading + (/[?।.]$/.test(heading) ? ' ' : tr('. ', '। ')) + (lesson.kind === 'count' ? tr('Tap each rabbit once.', 'প্রতিটি খরগোশে একবার ট্যাপ করি।') : lesson.kind === 'food' ? tr('Find the snack in the picture.', 'ছবির খাবারটি খুঁজে দিই।') : tr('Tap an animal.', 'প্রাণীটিতে ট্যাপ করি।')));
	}
	function arrive() {
		phase = 'choice'; prompt();
		if (lesson.kind === 'listen') audio?.call(lesson.animal);
	}
	function start(nextMode: SafariMode) {
		hideHand(); hintId = null;
		mode = nextMode; lessons = createSafari(mode); index = 0; distance = 0;
		counted = []; attempts = selected = 0; hint = false; manualPause = false; feedback = ''; spots = [];
		phase = 'travel'; prompt();
		if (fallback) { distance = stop; arrive(); }
	}
	function update(dt: number): SafariFrame {
		if (phase === 'travel' && !manualPause && !helpOpen && !$paused) {
			distance = reduced ? stop : Math.min(stop, distance + dt * 10);
			if (distance >= stop) arrive();
		}
		return { distance, reduced, moving: phase === 'travel', counted };
	}
	function success() {
		hideHand(); hintId = null;
		phase = 'celebrate'; hint = false; feedback = ''; view?.celebrate(reduced); chime(); prompt();
	}
	function retry() {
		attempts++;
		feedback = tr('Let’s look again. Match the picture.', 'আবার দেখি। ছবির সঙ্গে মেলাই।');
		if (attempts >= 2) void requestHint(); else audio?.speak(feedback);
	}
	const hintedAnimal = (id: number) => hint && lesson.kind !== 'food' && (lesson.kind === 'count' ? id === hintId : lesson.options[id] === lesson.animal);
	async function requestHint() {
		if (phase !== 'choice' || manualPause || helpOpen || $paused) return;
		hint = true;
		hintId = lesson.kind === 'count' ? lesson.options.findIndex((_, id) => !counted.includes(id)) : lesson.options.indexOf(lesson.animal);
		feedback = lesson.kind === 'food' ? tr(`Tap the ${FOODS[lesson.food!].en.toLowerCase()} shown in the picture.`, `ছবির ${FOODS[lesson.food!].bn} বোতামে ট্যাপ করি।`)
			: lesson.kind === 'count' ? tr('Tap this rabbit next. Checked rabbits are already counted.', 'এবার এই খরগোশে ট্যাপ করি। টিক চিহ্নের খরগোশগুলো গোনা হয়েছে।')
			: tr(`Look for our ${animal.en.toLowerCase()}. Tap the animal with the dotted outline.`, `${animal.bn} খুঁজি। ডোরা দিয়ে ঘেরা প্রাণীটিতে ট্যাপ করি।`);
		audio?.speak(feedback);
		const selector = lesson.kind === 'food' ? `[data-snack="${lesson.food}"]` : `[data-animal-id="${hintId}"]`;
		const currentIndex = index;
		await tick();
		if (index !== currentIndex || phase !== 'choice' || helpOpen || manualPause || $paused) return;
		document.querySelector(selector)?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
		if (!reduced) showHand([selector]);
	}
	function openHelp() { hideHand(); helpOpen = true; audio?.stop(); }
	function closeHelp() { helpOpen = false; if (!manualPause && !$paused) prompt(); }
	function chooseAnimal(id: number) {
		if (phase !== 'choice' || manualPause || helpOpen || $paused || !lesson.options[id]) return;
		hideHand();
		selected = id;
		if (lesson.kind === 'food') { audio?.speak(name(lesson.animal)); return; }
		if (lesson.kind === 'count') {
			if (counted.includes(id)) return;
			counted = [...counted, id];
			if (id === hintId) { hint = false; hintId = null; feedback = ''; }
			if (counted.length === lesson.count) success();
			else audio?.speak(tr(['', 'One', 'Two', 'Three', 'Four', 'Five'][counted.length], ['', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ'][counted.length]));
			return;
		}
		if (lesson.options[id] === lesson.animal) success(); else retry();
	}
	function chooseFood(food: FoodId) {
		if (phase !== 'choice' || manualPause || helpOpen || $paused) return;
		hideHand();
		if (food !== lesson.food) { retry(); return; }
		view?.feed(food); success();
	}
	function next() {
		if (phase !== 'celebrate') return;
		hideHand(); hintId = null;
		if (index === lessons.length - 1) { phase = 'done'; prompt(); return; }
		index++; counted = []; attempts = selected = 0; hint = false; feedback = ''; spots = []; phase = 'travel'; prompt();
		if (fallback) { distance = stop; arrive(); }
	}
	function home() { hideHand(); hintId = null; manualPause = false; phase = 'picker'; index = 0; distance = 24; lessons = createSafari('adventure'); counted = []; spots = []; prompt(); }
	function keydown(event: KeyboardEvent) {
		if (phase !== 'choice' || manualPause || helpOpen || $paused || event.ctrlKey || event.metaKey || event.altKey) return;
		if (event.target instanceof HTMLElement && event.target.closest('button,input,select,a')) return;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selected = (selected + (event.key === 'ArrowRight' ? 1 : -1) + lesson.options.length) % lesson.options.length; }
		else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (lesson.kind !== 'food') chooseAnimal(selected); }
	}
	$effect(() => { if (view) view.lesson(lesson, stop); });
	$effect(() => { if (reduced) hideHand(); });
	$effect(() => { view?.setPaused($paused || manualPause || helpOpen); if ($paused || manualPause || helpOpen) hideHand(); if ($paused || manualPause || !$settings.soundEnabled || $settings.volume <= 0) audio?.stop(); });
	onMount(() => {
		let destroyed = false;
		audio = createSafariAudio(); prompt();
		void import('./safariScene.ts').then(({ createSafariScene }) => {
			if (destroyed) return;
			view = createSafariScene(canvas, update, projected => spots = projected); ready = true;
		}).catch(() => { if (!destroyed) { fallback = true; if (phase === 'travel') arrive(); } });
		return () => { destroyed = true; hideHand(); view?.dispose(); audio?.dispose(); leaveScreen(); };
	});
</script>

<svelte:window onkeydown={keydown} />
<svelte:head><title>Rumi’s Animal Safari 3D · Little Colors</title></svelte:head>
<div class="safari-shell">
	<TopBar onreplay={prompt} />
	<section class:reduced data-testid="animal-safari" data-phase={phase} data-ready={ready} data-fallback={fallback} data-lesson={lesson.kind} data-counted={counted.length}>
		<div class="masthead"><div><p class="eyebrow">{tr('LITTLE EXPLORERS · BIG WONDERS', 'ছোট্ট অভিযাত্রী · কত বিস্ময়')}</p><h1>{tr('Rumi’s Animal Safari 3D', 'রুমির প্রাণী সাফারি থ্রিডি')}</h1></div>
			<div class="masthead-actions"><button class="how-to" onclick={openHelp}>❔ {tr('How to play', 'কীভাবে খেলব')}</button>{#if phase !== 'picker'}<button class="quiet" onclick={home}>☰ {tr('Choose an adventure', 'অভিযান বেছে নিই')}</button>{:else}<span class="nature-badge">🌿 {tr('Learn at your own pace', 'নিজের মতো করে শিখি')}</span>{/if}</div>
		</div>
		{#if phase === 'picker'}
			<div class="welcome"><span aria-hidden="true">🧭</span><div><h2>{tr('An adventure with animal friends', 'প্রাণী বন্ধুদের সঙ্গে অভিযান')}</h2><p>{tr('Hop into our jeep. A little discovery waits at every stop.', 'জিপে উঠে পড়ি। প্রতি জায়গায় নতুন কিছু শিখি।')}</p></div></div>
		{/if}
		<div class="stage game-viewport" class:preview={phase === 'picker'}>
			<canvas bind:this={canvas} tabindex="0" aria-label={tr('3D safari clearing. Arrow keys choose an animal; Enter selects.', 'থ্রিডি সাফারি। তীর দিয়ে প্রাণী বাছি, এন্টার দিয়ে নির্বাচন করি।')}></canvas>
			{#if !ready && !fallback}<div class="loading" role="status">🌿 {tr('Our safari is waking up…', 'সাফারি তৈরি হচ্ছে…')}</div>{/if}
			<div class="location" aria-hidden="true">🌳 {tr('Acacia Grove', 'সবুজ বনের পথ')}</div>
			{#if phase !== 'picker'}<div class="journey" aria-label={tr('Safari discoveries', 'সাফারির আবিষ্কার')}>
				{#each lessons as item, i}<span class:complete={i < index || (i === index && (phase === 'celebrate' || phase === 'done'))} aria-hidden="true">{i < index || (i === index && (phase === 'celebrate' || phase === 'done')) ? '✿' : '○'}</span>{/each}
			</div>{/if}
			{#if phase === 'choice' && !manualPause}
				{#if fallback}<div class="picture-animals">{#each lesson.options as id, i}<button class:hinted={hintedAnimal(i)} disabled={counted.includes(i)} data-animal-id={i} aria-label={lesson.kind === 'count' ? `${name(id)} ${n(i + 1)}` : name(id)} onclick={() => chooseAnimal(i)}><span aria-hidden="true">{ANIMALS[id].icon}</span>{counted.includes(i) ? '✓' : name(id)}</button>{/each}</div>
				{:else}{#each spots as spot (spot.id)}<button class="animal-target" class:counted={counted.includes(spot.id)} class:hinted={hintedAnimal(spot.id)} class:selected={selected === spot.id}
					data-animal-id={spot.id} disabled={counted.includes(spot.id)} aria-label={lesson.kind === 'count' ? `${name(lesson.options[spot.id])} ${n(spot.id + 1)}` : name(lesson.options[spot.id])}
					style:left="{spot.x}px" style:top="{spot.y}px" style:width="{spot.size}px" style:height="{spot.size}px" onclick={() => chooseAnimal(spot.id)}><span>{counted.includes(spot.id) ? '✓' : name(lesson.options[spot.id])}</span></button>{/each}{/if}
			{/if}
			{#if phase === 'travel'}<div class="travel-note" role="status">🚙 {tr('Off to our next discovery…', 'চলো, নতুন কিছু খুঁজি…')}<small>{tr('Our jeep stops for every activity.', 'প্রতি কাজের জায়গায় জিপ থামবে।')}</small></div>{/if}
			{#if phase === 'picker'}<div class="preview-note">🐘 🦁 🦒 🐰<span>{tr('Four friends. So much to discover.', 'চার বন্ধু। কত কিছু শেখার আছে।')}</span></div>{/if}
			{#if manualPause}<div class="overlay"><div class="message"><span class="big-icon" aria-hidden="true">🌴</span><h2>{tr('A little rest', 'একটু বিশ্রাম')}</h2><button class="primary" onclick={() => manualPause = false}>▶ {tr('Continue', 'আবার চলি')}</button></div></div>{/if}
			{#if phase === 'done'}<div class="overlay"><div class="message"><span class="big-icon" aria-hidden="true">🌻</span><h2>{tr('Hello, animal friends!', 'কত প্রাণী বন্ধু হলো!')}</h2><p>{tr('We listened, looked and learned together.', 'একসঙ্গে শুনেছি, দেখেছি আর শিখেছি।')}</p><div class="friends" aria-hidden="true">🐘 🦁 🐰 🦒</div><button class="primary" onclick={() => start(mode)}>↻ {tr('Explore again', 'আবার ঘুরতে যাই')}</button><button class="quiet" onclick={home}>{tr('Choose an adventure', 'অভিযান বেছে নিই')}</button></div></div>{/if}
		</div>
		{#if phase === 'picker'}
			<div class="mode-cards">{#each MODES as item}<button class:featured={item.id === 'adventure'} disabled={!ready && !fallback} onclick={() => start(item.id)}><span class="mode-icon" aria-hidden="true">{item.icon}</span><strong>{bn ? item.bn : item.en}</strong><small>{bn ? item.detailBn : item.detail}</small><span class="arrow" aria-hidden="true">↗</span></button>{/each}</div>
		{:else if phase !== 'done'}
			<div class="activity" inert={manualPause}>
				{#if phase === 'travel'}<div class="prompt"><span class="task-picture" aria-hidden="true">🧭</span><div><p class="eyebrow">{tr('ON OUR WAY', 'চলো, যাই')}</p><h2>{tr('Watch the world go by', 'চারপাশ দেখি')}</h2><p>{tr('We’ll stop to learn together.', 'একসঙ্গে শেখার জন্য থামব।')}</p></div></div>
				{:else if phase === 'celebrate'}<div class="prompt"><span class="task-picture" aria-hidden="true">{lesson.kind === 'food' ? FOODS[lesson.food!].icon : animal.icon}</span><div><p class="eyebrow">{tr('A LITTLE DISCOVERY', 'নতুন কিছু শিখলাম')}</p><h2>{tr('Lovely exploring!', 'দারুণ শিখেছি!')}</h2><p>{lesson.kind === 'count' ? tr(`${n(lesson.count!)} ${rabbitWord(lesson.count!)}, counted together.`, `একসঙ্গে ${n(lesson.count!)}টি খরগোশ গুনেছি।`) : tr(`${animal.en} · ${animal.bn}`, `${animal.bn} · ${animal.en}`)}</p></div></div><button class="primary next" onclick={next}>→ {index === lessons.length - 1 ? tr('Meet our friends', 'বন্ধুদের দেখি') : tr('Next stop', 'পরের জায়গায় যাই')}</button>
				{:else}<div class="prompt"><span class="task-picture" aria-hidden="true">{lesson.kind === 'food' ? FOODS[lesson.food!].icon : lesson.kind === 'listen' && !hint && $settings.soundEnabled ? '🔊' : animal.icon}</span><div><p class="eyebrow">{tr('LOOK · LISTEN · DISCOVER', 'দেখি · শুনি · শিখি')}</p><h2>{heading}</h2><p aria-live="polite">{feedback || (lesson.kind === 'count' ? tr('Tap each rabbit once.', 'প্রতিটি খরগোশে একবার ট্যাপ করি।') : lesson.kind === 'food' ? tr('Match the snack in the picture.', 'ছবির খাবারটি মিলিয়ে দিই।') : tr('Tap an animal in the clearing.', 'মাঠের প্রাণীটিতে ট্যাপ করি।'))}</p></div></div>
					{#if lesson.kind === 'food'}<div class="snacks" role="group" aria-label={tr('Choose a snack', 'খাবার বেছে নিই')}>{#each Object.entries(FOODS) as [id, snack]}<button data-snack={id} class:hinted={hint && id === lesson.food} aria-label={bn ? snack.bn : snack.en} onclick={() => chooseFood(id as FoodId)}><span aria-hidden="true">{snack.icon}</span>{bn ? snack.bn : snack.en}</button>{/each}</div>
					{:else if lesson.kind === 'count'}<div class="count-strip" aria-label={tr(`${n(counted.length)} of ${n(lesson.count!)} ${rabbitWord(lesson.count!)} counted`, `${n(lesson.count!)}টির মধ্যে ${n(counted.length)}টি গুনেছি`)}><strong>{n(counted.length)} / {n(lesson.count!)}</strong><div aria-hidden="true">{#each Array(lesson.count) as _, i}<span class:done={i < counted.length}>🐰</span>{/each}</div></div>
					{:else if lesson.kind === 'listen'}<button class="listen" disabled={!$settings.soundEnabled} onclick={() => audio?.call(lesson.animal)}>🔊 {tr('Hear the toy call', 'প্রাণীর খেলনা ডাক শুনি')}</button>{/if}
					<button class="hint-button" onclick={() => void requestHint()}>💡 {tr('Hint', 'সাহায্য')}</button>
				{/if}
				<button class="quiet pause" aria-label={tr('Pause', 'বিরতি')} onclick={() => manualPause = true}>Ⅱ</button>
			</div>
		{/if}
	</section>
</div>
{#if helpOpen}<SafariHelp {bn} soundEnabled={$settings.soundEnabled && $settings.volume > 0} onclose={closeHelp} onspeak={(text) => audio?.speak(text)} />{/if}

<style>
	.safari-shell { display: flex; flex-direction: column; flex: 1; min-height: 100%; background: radial-gradient(ellipse at 80% 20%, #e8f1dd, transparent 55%), #faf7ed; }
	section { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 0 clamp(12px, 2.5vw, 32px) 24px; }
	.masthead { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
	.masthead-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; } .how-to, .hint-button { background: #fff1cc; border-color: #dfc889; }
	h1 { font-size: clamp(24px, 3vw, 36px); line-height: 1.2; margin: 0; } h2 { font-size: 24px; line-height: 1.3; margin: 0; }
	p { margin: 5px 0 0; color: #586b5b; font-size: 17px; } .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .12em; margin: 0 0 5px; color: #537b60; }
	.nature-badge { padding: 8px 14px; background: #e6efda; border-radius: 999px; font-size: 15px; color: #4b7054; }
	.welcome { display: flex; align-items: center; gap: 14px; } .welcome > span { display: grid; place-items: center; width: 60px; height: 60px; background: #f6e6bd; border-radius: 18px; font-size: 32px; }
	.welcome h2 { font-size: 23px; } .welcome p { font-size: 16px; }
	.stage { position: relative; flex: 1; min-height: 450px; overflow: hidden; border-radius: 28px; background: linear-gradient(#b9e0df, #cee2ad); }
	.stage.preview { min-height: 350px; }
	canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
	.location, .journey { position: absolute; top: 14px; padding: 7px 13px; border-radius: 14px; background: #fffdf0e0; box-shadow: 0 3px 10px #34513310; pointer-events: none; }
	.location { left: 14px; color: #496d54; font-size: 14px; } .journey { right: 14px; display: flex; gap: 10px; font-size: 24px; line-height: 1.3; color: #9baa8a; } .journey .complete { color: #4d8b61; }
	button { min-height: 48px; padding: 9px 16px; border: 2px solid #cfdbcb; border-radius: 16px; background: #fffdf5; color: #29473b; font: inherit; font-weight: 700; font-size: 17px; cursor: pointer; touch-action: manipulation; }
	button:hover:not(:disabled) { border-color: #6c9a77; } button:disabled { cursor: default; opacity: .6; }
	.primary { background: #427859; border-color: #356448; color: white; box-shadow: 0 4px 0 #294d38; }
	.quiet { background: #ffffffb3; } .listen { background: #fff1cc; border-color: #e1c886; }
	.loading, .overlay { position: absolute; inset: 0; display: grid; place-items: center; padding: 20px; } .loading { color: #3b634b; background: #e9efd9; }
	.preview-note, .travel-note { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); width: max-content; max-width: calc(100% - 24px); padding: 10px 18px; border-radius: 18px; background: #fffdf0e8; text-align: center; color: #3e664c; }
	.preview-note { font-size: 26px; letter-spacing: 6px; } .preview-note span, .travel-note small { display: block; font-size: 14px; letter-spacing: 0; }
	.mode-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
	.mode-cards button { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; padding: 16px 20px 26px; background: linear-gradient(145deg, #fffefa, #f0f5e9); box-shadow: var(--panel-shadow); }
	.mode-cards button.featured { background: linear-gradient(145deg, #e3efd7, #f5f7e6); border-color: #a6c593; }
	.mode-icon { font-size: 34px; } .mode-cards strong { font-size: 20px; } .mode-cards small { color: #60735d; font-size: 13px; font-weight: 400; } .arrow { position: absolute; right: 14px; bottom: 10px; }
	.activity { display: flex; align-items: center; flex-wrap: wrap; gap: 16px; min-height: 124px; background: #fffef8; border: 1px solid #d9e1cf; border-radius: 24px; padding: 16px 20px; box-shadow: var(--panel-shadow); }
	.prompt { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 220px; }
	.task-picture { display: grid; place-items: center; width: 76px; height: 76px; flex-shrink: 0; border-radius: 22px; background: #f0f1df; font-size: 43px; }
	.pause { margin-left: auto; min-width: 48px; } .snacks { display: flex; gap: 8px; } .snacks button { display: flex; flex-direction: column; align-items: center; min-width: 82px; font-size: 14px; } .snacks span { font-size: 33px; }
	.count-strip { text-align: center; } .count-strip strong { color: #426e4e; font-size: 27px; font-variant-numeric: tabular-nums; } .count-strip > div { display: flex; gap: 4px; } .count-strip span { opacity: .3; font-size: 23px; } .count-strip span.done { opacity: 1; }
	.animal-target { position: absolute; transform: translate(-50%, -50%); padding: 0; border: 2px solid transparent; background: transparent; border-radius: 40%; }
	.animal-target > span { position: absolute; left: 50%; bottom: -24px; transform: translateX(-50%); white-space: nowrap; padding: 3px 12px; border-radius: 999px; background: #fffdf0eb; font-size: 15px; box-shadow: 0 2px 8px #3b58351a; }
	.animal-target.selected { border-color: #ffffff70; } .animal-target:hover:not(:disabled) { background: #ffffff12; border-color: #ffffffa6; }
	.animal-target.counted { opacity: 1; } .animal-target.counted > span { background: #d8edc8; color: #3b7149; }
	.hinted { outline: 3px dashed #527d44; outline-offset: 4px; }
	.snacks button, .picture-animals button { position: relative; }
	.reduced .hinted::after { content: '☝️'; position: absolute; right: -10px; bottom: 0; font-size: 32px; pointer-events: none; }
	.picture-animals { position: absolute; inset: 60px 12px 20px; display: flex; flex-wrap: wrap; align-content: center; justify-content: center; gap: 14px; }
	.picture-animals button { min-width: 100px; display: flex; flex-direction: column; align-items: center; } .picture-animals button > span { font-size: 58px; }
	.overlay { background: #dce8d199; backdrop-filter: blur(4px); z-index: 3; } .message { width: min(440px, 100%); padding: 26px; border: 2px solid #bdd1a8; border-radius: 28px; background: #fffdf1; text-align: center; box-shadow: var(--panel-shadow); }
	.message button { margin: 14px 4px 0; } .big-icon { display: block; font-size: 54px; margin-bottom: 8px; } .friends { font-size: 39px; margin-top: 12px; }
	@media(max-width:800px) { .nature-badge { display: none; } .mode-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .stage { min-height: 420px; } .stage.preview { min-height: 320px; } .activity { padding: 12px; gap: 12px; } .prompt h2 { font-size: 21px; } .prompt p { font-size: 15px; } .task-picture { width: 60px; height: 60px; font-size: 35px; } }
	@media(max-width:500px) { section { gap: 12px; } .masthead { flex-wrap: wrap; gap: 8px; } .masthead button { font-size: 14px; min-height: 42px; } .welcome > span { display: none; } .welcome h2 { font-size: 21px; } .stage { min-height: 460px; border-radius: 22px; } .stage.preview { min-height: 360px; } .mode-cards { gap: 10px; } .mode-cards button { padding: 12px 12px 26px; } .mode-cards strong { font-size: 17px; } .mode-cards small { font-size: 12px; } .location { font-size: 12px; padding: 6px 9px; top: 10px; left: 10px; } .journey { padding: 6px 9px; gap: 6px; font-size: 19px; right: 10px; top: 10px; } .activity > .prompt { flex-basis: 100%; } .snacks { flex: 1; } .snacks button { flex: 1; min-width: 0; } .count-strip { text-align: left; } .animal-target > span { font-size: 12px; padding-inline: 8px; } .next { width: calc(100% - 64px); font-size: 16px; } }
</style>
