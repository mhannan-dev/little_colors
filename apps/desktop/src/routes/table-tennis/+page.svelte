<script lang="ts">
	import { onMount } from 'svelte';
	import { narrationText } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { createTableTennisGame, serve, stepTableTennis } from '#lib/features/table-tennis/game.ts';
	import type { createTableTennisScene } from '#lib/features/table-tennis/scene.ts';

	let canvas: HTMLCanvasElement;
	let view = $state<ReturnType<typeof createTableTennisScene>>();
	const game = createTableTennisGame();
	let target = $state(0);
	let direction = 0;
	let ready = $state(false);
	let failed = $state(false);
	let localPause = $state(false);
	let phase = $state(game.phase);
	let message = $state(game.message);
	let paddleX = $state(0);
	const bn = $derived($settings.language === 'bn-BD');
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	function start() {
		if (!ready || localPause || $paused) return;
		serve(game);
		phase = game.phase;
		message = game.message;
		canvas.focus();
	}
	function move(event: PointerEvent) {
		if (!ready || localPause || $paused) return;
		if (event.pointerType === 'touch' && !event.buttons) return;
		const rect = canvas.getBoundingClientRect();
		target = Math.max(-1.75, Math.min(1.75, ((event.clientX - rect.left) / rect.width - 0.5) * 5.4));
	}
	function keydown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') direction = -1;
		else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') direction = 1;
		else if (event.code === 'Space') start();
		else return;
		event.preventDefault();
	}
	function reset() {
		Object.assign(game, createTableTennisGame());
		target = 0;
		direction = 0;
		phase = game.phase;
		message = game.message;
		localPause = false;
	}
	$effect(() => {
		view?.stage.setPaused($paused || localPause);
		if ($paused || localPause) direction = 0;
	});
	onMount(() => {
		let disposed = false;
		instruct('table-tennis.intro');
		void import('#lib/features/table-tennis/scene.ts').then(({ createTableTennisScene }) => {
			if (disposed) return;
			const scene = createTableTennisScene(canvas);
			view = scene;
			scene.update(game);
			scene.stage.onFrame(dt => {
				if (direction) target = Math.max(-1.75, Math.min(1.75, target + direction * dt * 3.5));
				stepTableTennis(game, dt, target);
				scene.update(game);
				paddleX = game.playerX;
				phase = game.phase;
				if (message !== game.message) {
					message = game.message;
					if (message === 'return') say('table-tennis.return', { interrupt: true });
				}
			});
			ready = true;
		}).catch(() => { if (!disposed) failed = true; });
		return () => {
			disposed = true;
			view?.stage.dispose();
			leaveScreen();
		};
	});
</script>

<svelte:head><title>3D Table Tennis · Rumi Learning Adventures</title></svelte:head>
<TopBar onreplay={() => instruct('table-tennis.intro')} />
<main>
	<div class="heading"><h1>{text('mode.table-tennis')}</h1><span>{bn ? 'কম্পিউটারের সঙ্গে অনুশীলন' : 'Practice with a computer friend'}</span></div>
	<p>{text('table-tennis.intro')}</p>
	<div class="arena" data-ready={ready} data-phase={phase} data-paddle-x={paddleX.toFixed(2)}>
		<canvas bind:this={canvas} aria-label={bn ? 'থ্রিডি টেবিল টেনিস' : '3D table tennis court'} tabindex="0"
			onpointermove={move} onpointerdown={event => { canvas.setPointerCapture(event.pointerId); move(event); canvas.focus(); }}
			onkeydown={keydown} onkeyup={() => direction = 0} onblur={() => direction = 0}></canvas>
		{#if failed}<div class="overlay" role="alert">{bn ? 'থ্রিডি চালু করা যায়নি। WebGL চালু করে আবার খোলো।' : '3D could not start. Enable WebGL and reopen the game.'}</div>
		{:else if !ready}<div class="overlay" role="status">{bn ? 'টেবিল তৈরি হচ্ছে…' : 'Setting up the table…'}</div>
		{:else if localPause || $paused}<div class="overlay">{bn ? 'বিরতি' : 'Paused'}</div>{/if}
	</div>
	<p class="message" role="status">{text('table-tennis.' + message)}</p>
	<div class="controls">
		<button class="primary" onclick={start} disabled={!ready || phase === 'playing' || localPause || $paused}>{bn ? '🏓 বল ছাড়ো' : '🏓 Serve'}</button>
		<button onclick={() => localPause = !localPause} disabled={!ready}>{localPause ? (bn ? '▶ খেলি' : '▶ Resume') : (bn ? 'Ⅱ বিরতি' : 'Ⅱ Pause')}</button>
		<button onclick={reset}>{bn ? '↻ আবার শুরু' : '↻ Start over'}</button>
		<label>{bn ? 'প্যাডল সরাও' : 'Move paddle'}
			<input type="range" min="-1.75" max="1.75" step="0.05" value={target} disabled={!ready || localPause || $paused}
				oninput={event => target = Number(event.currentTarget.value)} />
		</label>
	</div>
	<p class="help">{bn ? 'মাউস বা আঙুল দিয়ে সরাও • কিবোর্ডে ← → বা A / D • Space দিয়ে বল ছাড়ো' : 'Move your mouse or drag a finger • ← → or A / D to move • Space to serve'}</p>
</main>

<style>
	main { width: min(1100px, 100%); margin: 0 auto; padding: 0 20px 18px; overflow-y: auto; }
	.heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
	h1 { margin: 0; font-size: clamp(26px, 3vw, 38px); }
	p { margin: 10px 0; }
	.arena { position: relative; height: clamp(280px, 49vh, 540px); border: 3px solid var(--border-soft); border-radius: 24px; overflow: hidden; background: #e7f2f0; }
	canvas { display: block; width: 100%; height: 100%; touch-action: none; }
	.overlay { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 30px; background: #fff9e8dd; font-size: 26px; pointer-events: none; }
	.controls { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px; }
	button { min-height: 52px; border: 2px solid var(--border-soft); border-radius: 16px; padding: 10px 18px; font: inherit; background: var(--surface); color: var(--text-primary); cursor: pointer; }
	button:disabled { opacity: .55; cursor: default; }
	.primary { border-color: var(--learn-blue); font-weight: 700; }
	.message { text-align: center; font-weight: 700; min-height: 30px; }
	label { display: flex; align-items: center; gap: 10px; }
	input { min-height: 48px; width: 170px; }
	.help { text-align: center; font-size: 16px; }
	:focus-visible { outline: 4px solid var(--learn-blue); outline-offset: -4px; }
</style>
