<script lang="ts">
	import { onMount } from 'svelte';
	import Canvas from './Canvas.svelte';
	import type { CameraMode } from './cityScene';
	import type { DriverControls, Indicator, LevelConfig, VehicleState } from '../stores/gameStore';

	let { level, state: snapshot, ontick }: {
		level: LevelConfig;
		state: VehicleState;
		ontick: (readControls: () => DriverControls) => void;
	} = $props();
	let camera = $state<CameraMode>('chase');
	let indicator = $state<Indicator>('off');
	let doorRequest = false;
	const held = new Set<string>();
	const pointerControls = new Map<number, string>();
	const active = $derived(snapshot.phase === 'driving');
	const drivingKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
	const controlButtons = [
		{ code: 'ArrowLeft', glyph: '←', label: 'Steer left' },
		{ code: 'ArrowUp', glyph: '↑', label: 'Accelerate' },
		{ code: 'ArrowDown', glyph: '↓', label: 'Brake or reverse' },
		{ code: 'ArrowRight', glyph: '→', label: 'Steer right' }
	];

	function clearControls() {
		held.clear();
		pointerControls.clear();
		doorRequest = false;
	}

	function readControls(): DriverControls {
		const pressed = (code: string) => held.has(code) || [...pointerControls.values()].includes(code);
		const toggleDoors = doorRequest;
		doorRequest = false;
		return {
			throttle: pressed('KeyW') || pressed('ArrowUp'),
			brake: pressed('KeyS') || pressed('ArrowDown'),
			steering: Number(pressed('KeyD') || pressed('ArrowRight')) - Number(pressed('KeyA') || pressed('ArrowLeft')),
			toggleDoors,
			indicator
		};
	}

	function toggleIndicator(next: Indicator) {
		indicator = indicator === next ? 'off' : next;
	}

	function toggleCamera() {
		camera = camera === 'chase' ? 'cockpit' : 'chase';
	}

	function keydown(event: KeyboardEvent) {
		if (!active || event.altKey || event.ctrlKey || event.metaKey) return;
		if (drivingKeys.has(event.code)) {
			event.preventDefault();
			held.add(event.code);
		}
		if (event.repeat) return;
		if (event.code === 'KeyE') doorRequest = true;
		if (event.code === 'KeyQ') toggleIndicator('left');
		if (event.code === 'KeyR') toggleIndicator('right');
		if (event.code === 'KeyC') toggleCamera();
	}

	function hold(event: PointerEvent, code: string) {
		if (!active || event.button !== 0) return;
		(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		pointerControls.set(event.pointerId, code);
	}

	function release(event: PointerEvent) {
		pointerControls.delete(event.pointerId);
	}

	function holdKey(event: KeyboardEvent, code: string, down: boolean) {
		if (event.key !== ' ' && event.key !== 'Enter') return;
		event.preventDefault();
		if (down && active) held.add(code);
		else held.delete(code);
	}

	$effect(() => { if (!active) clearControls(); });
	onMount(() => {
		const timer = window.setInterval(() => { if (active) ontick(readControls); }, 50);
		return () => { window.clearInterval(timer); clearControls(); };
	});
</script>

<svelte:window onkeydown={keydown} onkeyup={event => held.delete(event.code)} onblur={clearControls} />

<div class="viewport">
	<div class="view"><Canvas {level} state={snapshot} mode={camera} /></div>
	<div class="controls" role="group" aria-label="Bus controls">
		<div class="drive">
			{#each controlButtons as control (control.code)}
				<button class="pedal" aria-label={control.label} title={control.label} disabled={!active}
					onpointerdown={event => hold(event, control.code)} onpointerup={release}
					onpointercancel={release} onlostpointercapture={release}
					onkeydown={event => holdKey(event, control.code, true)} onkeyup={event => holdKey(event, control.code, false)}
					onblur={() => held.delete(control.code)}>{control.glyph}</button>
			{/each}
		</div>
		<div class="extras">
			<button aria-label="Left indicator" aria-pressed={indicator === 'left'} disabled={!active} onclick={() => toggleIndicator('left')}>◀ Q</button>
			<button disabled={!active} onclick={() => { doorRequest = true; }}>{snapshot.bus.doorsOpen ? 'Close doors' : 'Open doors'} · E</button>
			<button aria-label="Right indicator" aria-pressed={indicator === 'right'} disabled={!active} onclick={() => toggleIndicator('right')}>R ▶</button>
			<button aria-pressed={camera === 'cockpit'} onclick={toggleCamera}>{camera === 'chase' ? 'Cockpit' : 'Chase'} · C</button>
		</div>
	</div>
</div>

<style>
	.viewport { min-width: 0; display: grid; grid-template-rows: minmax(300px, 1fr) auto; gap: 8px; }
	.view { overflow: hidden; border-radius: 16px; border: 2px solid #b7cbcc; min-height: 295px; }
	.controls, .drive, .extras { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
	button { min-height: 42px; padding: 4px 12px; border: 2px solid #93b0b5; border-radius: 9px; background: #f4fbfa; cursor: pointer; touch-action: none; }
	button[aria-pressed="true"] { color: #202e35; background: #ffe4a0; border-color: #9b6114; }
	button:disabled { opacity: .55; cursor: default; }
	.pedal { min-width: 43px; font-size: 25px; line-height: 1; }
</style>
