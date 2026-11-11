<script lang="ts">
	import { onMount } from 'svelte';
	import { settings } from '#lib/stores/settings.ts';
	import RouteMap from './RouteMap.svelte';
	import type { CameraMode } from './cityScene';
	import type { LevelConfig, VehicleState } from '../stores/gameStore';

	let { level, state: snapshot, mode }: { level: LevelConfig; state: VehicleState | null; mode: CameraMode } = $props();
	let canvas: HTMLCanvasElement;
	let fallback = $state(false);

	onMount(() => {
		let closed = false;
		let frame = 0;
		let dispose: (() => void) | undefined;
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
		function useMap() {
			if (closed) return;
			fallback = true;
			cancelAnimationFrame(frame);
		}
		canvas.addEventListener('webglcontextlost', useMap);
		// The renderer only consumes Rust snapshots. Physics never runs inside the animation loop.
		void import('./cityScene').then(({ createCityScene }) => {
			if (closed) return;
			const city = createCityScene(canvas, level);
			dispose = city.dispose;
			let last = performance.now();
			function draw(now: number) {
				const delta = Math.min((now - last) / 1000, .05);
				last = now;
				city.draw(snapshot, mode, delta, $settings.reducedMotion || reduce.matches);
				frame = requestAnimationFrame(draw);
			}
			if (!fallback) frame = requestAnimationFrame(draw);
		}).catch(useMap);

		return () => {
			closed = true;
			cancelAnimationFrame(frame);
			canvas.removeEventListener('webglcontextlost', useMap);
			dispose?.();
		};
	});
</script>

<div class="scene">
	<canvas bind:this={canvas} class:hidden={fallback} aria-label="3D view of the city bus route"></canvas>
	{#if fallback}
		<div class="fallback"><RouteMap {level} state={snapshot} /></div>
		<span class="label">Map view</span>
	{:else if mode === 'cockpit'}
		<div class="dashboard" aria-hidden="true"><i></i><i></i><i></i></div>
	{/if}
</div>

<style>
	.scene { position: relative; width: 100%; height: 100%; min-height: 295px; background: #233c45; }
	canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
	.hidden { visibility: hidden; }
	.fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 6px; }
	.label { position: absolute; bottom: 10px; left: 10px; padding: 4px 10px; border-radius: 8px; background: #172d35; color: white; }
	.dashboard { position: absolute; pointer-events: none; bottom: 0; width: 100%; height: 14%; display: flex; justify-content: center; align-items: center; gap: 12px; border-radius: 40% 40% 0 0; background: #172b33; border-top: 5px solid #4c6268; }
	.dashboard i { width: 14px; height: 14px; border: 2px solid #84d1c6; border-radius: 50%; }
</style>
