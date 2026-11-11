<script lang="ts">
	import { onMount } from 'svelte';
	import { isTauri } from '@tauri-apps/api/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { paused as windowPaused } from '#lib/stores/pause.ts';
	import { createBusGame, LEVEL_COUNT } from '../stores/gameStore';
	import RouteMap from './RouteMap.svelte';
	import Viewport from './Viewport.svelte';

	const game = createBusGame();
	const { level, vehicle, progress, speed, countdown, target, metrics, busy, error, saved } = game;
	const levels = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);
	let selection = $state(1);
	let desktop = $state(false);
	let submittedRun: number | undefined;
	const running = $derived($vehicle?.phase === 'driving' || $vehicle?.phase === 'paused');
	const distance = $derived($target && $vehicle
		? Math.hypot($target.position.x - $vehicle.bus.position.x, $target.position.z - $vehicle.bus.position.z) : 0);
	const bearing = $derived($target && $vehicle
		? Math.atan2($target.position.x - $vehicle.bus.position.x, $vehicle.bus.position.z - $target.position.z) - $vehicle.bus.heading : 0);

	onMount(() => {
		desktop = isTauri();
		if (desktop) void game.loadProgress();
		return () => game.leave();
	});

	$effect(() => {
		if ($windowPaused && $vehicle?.phase === 'driving' && !$busy && !$error) void game.pause(true);
	});

	$effect(() => {
		if ($vehicle?.phase === 'completed' && !$busy && submittedRun !== $vehicle.runId) {
			submittedRun = $vehicle.runId;
			void game.saveScore();
		}
	});

	function keyboard(event: KeyboardEvent) {
		if (event.key !== 'Escape' || !running || event.repeat) return;
		event.preventDefault();
		void game.pause($vehicle?.phase === 'driving');
	}
</script>

<svelte:window onkeydown={keyboard} />
<TopBar />

<section class="depot" aria-labelledby="city-bus-title">
	<header class="headline">
		<div>
			<p class="eyebrow">Rumi Transit</p>
			<h1 id="city-bus-title">City Bus Driver</h1>
		</div>
		{#if running}
			<button class="primary" disabled={$busy} onclick={() => game.pause($vehicle?.phase === 'driving')}>
				{$vehicle?.phase === 'paused' ? 'Resume' : 'Pause'} · Esc
			</button>
		{/if}
	</header>

	{#if $error}<p class="error" role="alert">{$error}</p>{/if}

	{#if !$vehicle}
		<div class="dispatch">
			<div class="briefing">
				<span aria-hidden="true" class="hero">🚌</span>
				<h2>Route {selection}</h2>
				<p>Follow the blue route. Slow down at junctions and stop inside the highlighted bus stop. Open the doors, wait for passengers, and close them before driving away.</p>
				<p class="subtle">WASD or arrow keys to drive · E doors · Q/R indicators · C camera</p>
				<button class="primary" disabled={!desktop || $busy} onclick={() => game.start(selection)}>Start route</button>
				{#if !desktop}<p class="subtle">Open the Rumi desktop app to drive and save progress.</p>{/if}
			</div>
			<div class="routes">
				<h2>Choose a route</h2>
				<p class="subtle">Complete a route to unlock the next one.</p>
				<div class="matrix" role="group" aria-label="60 routes">
					{#each levels as id (id)}
						{@const best = $progress.bestScores[id - 1]}
						<button aria-label={`Route ${id}${id > $progress.unlockedLevel ? ' (locked)' : ''}`}
							aria-pressed={selection === id} disabled={$busy || id > $progress.unlockedLevel}
							onclick={() => { selection = id; }}>
							<span>{id}</span>
							{#if best != null}<small>{best}</small>{:else if id > $progress.unlockedLevel}<small aria-hidden="true">🔒</small>{/if}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{:else if running && $level}
		<div class="sim">
			<div class="screen">
				{#key $vehicle.runId}
					<Viewport level={$level} state={$vehicle} ontick={game.tick} />
				{/key}
				{#if $vehicle.phase === 'paused'}
					<div class="shade">
						<div class="pause-card">
							<h2>Route paused</h2>
							<p>Your timetable will resume when you continue.</p>
							<button class="primary" disabled={$busy} onclick={() => game.pause(false)}>Continue route</button>
							<button disabled={$busy} onclick={game.leave}>Back to routes</button>
						</div>
					</div>
				{/if}
			</div>
			<aside class="hud" aria-label="Bus dashboard">
				<div class="readouts">
					<p><span>Speed</span><strong>{$speed} <small>km/h</small></strong></p>
					<p><span>Time left</span><strong>{$countdown}</strong></p>
					<p><span>On board</span><strong>{$metrics.onboard}</strong></p>
					<p><span>Dropped off</span><strong>{$metrics.delivered}</strong></p>
				</div>
				{#if $target}
					<div class="next-stop">
						<span class="bearing" style:transform={`rotate(${bearing}rad)`} aria-hidden="true">↑</span>
						<div><span>Next target · {Math.round(distance)} m</span><strong>{$target.name}</strong></div>
					</div>
					{#if $target.kind !== 'waypoint'}
						<p class="stop-help">
							{#if $vehicle.stopServiced}Close the doors to continue.
							{:else if $vehicle.bus.doorsOpen}{$target.kind === 'terminal' ? 'Passengers are getting off.' : 'Passengers are boarding.'}
							{:else if distance <= 5.5}Come to a stop, then open the doors.
							{:else}{$target.kind === 'terminal' ? 'Drop off passengers at the terminal.' : `${$target.waiting} passengers are waiting.`}{/if}
						</p>
						{#if $vehicle.bus.doorsOpen}<progress max="1" value={$vehicle.doorProgress} aria-label="Door service progress"></progress>{/if}
					{/if}
				{/if}
				<div class="map"><RouteMap level={$level} state={$vehicle} /></div>
				<p class="subtle">Bumps {$metrics.collisions} · Harsh brakes {$metrics.harshBrakes}</p>
			</aside>
		</div>
	{:else}
		<div class="result">
			<span class="hero" aria-hidden="true">{$vehicle.phase === 'completed' ? '🏅' : '🚌'}</span>
			<h2>{$vehicle.phase === 'completed' ? 'Route complete' : 'Time is up'}</h2>
			{#if $vehicle.score}
				<p>{$metrics.delivered} passengers reached the terminal.</p>
				<dl>
					<div><dt>Punctuality</dt><dd>{$vehicle.score.punctuality} / 350</dd></div>
					<div><dt>Safety</dt><dd>{$vehicle.score.safety} / 350</dd></div>
					<div><dt>Comfort</dt><dd>{$vehicle.score.comfort} / 300</dd></div>
					<div><dt>Total</dt><dd>{$vehicle.score.total} / 1000</dd></div>
				</dl>
				{#if $saved}<p class="subtle">Progress saved on this device.</p>
				{:else}<button disabled={$busy} onclick={game.saveScore}>{$busy ? 'Saving…' : 'Retry save'}</button>{/if}
			{:else}
				<p>Try the route again and follow each highlighted target.</p>
			{/if}
			<div class="result-actions">
				<button class="primary" disabled={$busy} onclick={game.leave}>Choose a route</button>
				<button disabled={$busy} onclick={() => game.start(selection)}>Drive again</button>
			</div>
		</div>
	{/if}
</section>

<style>
	.depot { flex: 1; overflow: auto; padding: 8px 24px 20px; background: #e8f2f0; }
	.headline { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin: 0 auto 12px; max-width: 1230px; }
	.eyebrow { margin: 0; color: #24645f; font-size: 16px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
	h1 { margin: 0; color: #183943; font-size: clamp(34px, 5vw, 50px); line-height: 1.05; }
	h2 { margin: 0 0 6px; color: #183943; }
	p { margin: 6px 0; }
	.dispatch, .sim { display: grid; gap: 16px; margin: auto; max-width: 1230px; }
	.dispatch { grid-template-columns: minmax(230px, .8fr) minmax(360px, 1.25fr); align-items: start; }
	.sim { grid-template-columns: minmax(0, 1fr) minmax(195px, 236px); }
	.briefing, .routes, .hud, .result, .pause-card { padding: 16px; border: 2px solid #c0d4d0; border-radius: 16px; background: #fffdf5; }
	.hero { display: block; font-size: 46px; }
	.subtle { color: #42606a; font-size: 17px; }
	.matrix { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 5px; margin-top: 10px; }
	button { min-height: 42px; padding: 6px 11px; border: 2px solid #b0c5c6; border-radius: 9px; background: #fff; font-weight: 700; cursor: pointer; }
	.primary { background: #175a53; color: white; border-color: #175a53; }
	button:disabled { opacity: .55; cursor: default; }
	.matrix button { display: grid; place-items: center; padding: 2px; line-height: 1.05; }
	.matrix button[aria-pressed="true"] { background: #ffdf8d; border-color: #885725; }
	.matrix small { font-size: 12px; }
	.screen { position: relative; min-width: 0; }
	.shade { position: absolute; inset: 0; display: grid; place-items: center; padding: 12px; background: #102e3b9c; border-radius: 16px; }
	.pause-card { text-align: center; }
	.hud { padding: 10px; }
	.readouts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px; }
	.readouts p { margin: 0; padding: 4px 7px; background: #edf4ef; border-radius: 7px; }
	.readouts span, .next-stop span { display: block; font-size: 15px; }
	.readouts strong { font-size: 23px; }
	.readouts small { font-size: 13px; }
	.next-stop { display: flex; gap: 8px; align-items: center; margin: 9px 0; }
	.next-stop .bearing { width: 34px; height: 34px; text-align: center; line-height: 34px; border-radius: 50%; background: #ffe49f; font-size: 22px; }
	.stop-help { font-size: 17px; }
	.map { margin: 7px auto; max-width: 162px; aspect-ratio: 1; border-radius: 8px; overflow: hidden; }
	progress { width: 100%; accent-color: #18796f; }
	.result { max-width: 620px; margin: 18px auto; text-align: center; }
	.result dl { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
	.result dl div { padding: 8px; background: #ecf4ef; border-radius: 8px; }
	.result dd { margin: 0; font-weight: 700; }
	.result-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
	.error { margin: 0 auto 10px; max-width: 1230px; background: #ffe7d8; color: #6a2819; padding: 8px 12px; border-radius: 8px; }
	@media (max-width: 790px) { .dispatch, .sim { grid-template-columns: 1fr; } .matrix { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
</style>
