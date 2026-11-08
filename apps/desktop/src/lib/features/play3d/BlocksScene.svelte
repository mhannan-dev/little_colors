<script lang="ts">
	/**
	 * "ABC & ১২৩ blocks": soft 3D toy blocks float on a mat; the child taps the one Rumi names.
	 * Rules come from core (createPlay3DRound + choiceMachine). three.js is loaded only on this
	 * screen. Every block also has a real button over it (keyboard, screen reader, tests).
	 * No score, no timer (PR-07); a wrong tap just wobbles the block (PR-08).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		createChoiceMachine,
		createPlay3DRound,
		formatNumeral,
		symbolDef,
		type ChoiceActivity,
		type ChoiceContext,
		type ChoiceEffect,
		type ChoiceMachine,
		type ChoiceState,
		type Play3DData,
		type SymbolSet
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, replayInstruction, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import SetPicker from './SetPicker.svelte';
	import type * as Kit from '#lib/three3d/toyKit.ts';

	const ANIM_MS = 900;
	const FEEDBACK_MS = 1000;
	const d = durations();
	const scheduler = createScheduler();

	let set = $state<SymbolSet | null>(null);
	let round = $state<ReturnType<typeof createPlay3DRound> | null>(null);
	let index = $state(0);
	let roundDone = $state(false);

	let machine: ChoiceMachine | null = null;
	let unsubscribers: (() => void)[] = [];
	let mState = $state<ChoiceState>('READY');
	let ctx = $state<ChoiceContext | null>(null);
	let mascot = $state<MascotAnimation>('idle');
	let hintId = $state<string | null>(null);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let kit: typeof Kit | null = null;
	let stage: Kit.Stage | null = null;
	let ready = $state(false);
	let failed = $state(false);

	/** One 3D block per option, plus its animation state. */
	interface Block {
		id: string;
		mesh: Kit.THREE.Mesh;
		baseX: number;
		phase: number;
		mode: '' | 'jump' | 'wobble' | 'glow' | 'hop';
		t: number;
	}
	let blocks: Block[] = [];
	let spots = $state<Record<string, { x: number; y: number; size: number }>>({});

	const a = $derived<ChoiceActivity | undefined>(round?.activities[index]);
	const lang = $derived($settings.language);

	function glyphFor(s: SymbolSet, symbol: string): string {
		return s === '123' ? formatNumeral(Number(symbol), $settings.numeralStyle) : symbolDef(s, symbol).glyph;
	}
	function nameFor(s: SymbolSet, symbol: string): string {
		const def = symbolDef(s, symbol);
		if (s === '123') return lang === 'bn-BD' ? def.bn : def.en;
		return lang === 'bn-BD' ? def.bn : def.en;
	}

	// ── 3D ──────────────────────────────────────────────────────────────────
	let destroyed = false;
	async function startStage() {
		try {
			kit = await import('#lib/three3d/toyKit.ts');
			await kit.fontsReady();
		} catch {
			failed = true;
			return;
		}
		if (!canvas || destroyed) return;
		const { THREE } = kit;
		try {
			stage = kit.createStage(canvas, { fov: 40 });
		} catch {
			failed = true;
			return;
		}
		stage.camera.position.set(0, 3.8, 8.6);
		stage.camera.lookAt(0, 1.4, 0);

		const mat = new THREE.Mesh(
			new THREE.CylinderGeometry(7.5, 7.5, 0.3, 48),
			new THREE.MeshStandardMaterial({ color: '#F6E7CF', roughness: 0.9 })
		);
		mat.position.y = -0.15;
		mat.receiveShadow = true;
		stage.scene.add(mat);

		stage.onFrame(frame);
		stage.setPaused($paused);
		ready = true;
		if (a) buildBlocks(a);
	}

	function clearBlocks() {
		if (!stage) return;
		for (const b of blocks) {
			stage.scene.remove(b.mesh);
			b.mesh.geometry.dispose();
			const m = b.mesh.material as Kit.THREE.MeshStandardMaterial;
			m.map?.dispose();
			m.dispose();
		}
		blocks = [];
	}

	function buildBlocks(activity: ChoiceActivity) {
		if (!stage || !kit) return;
		clearBlocks();
		const s = (activity.data as Play3DData).set;
		const n = activity.options.length;
		const gap = n >= 5 ? 2.3 : n === 4 ? 2.6 : 2.9;
		const size = n >= 5 ? 1.65 : n === 4 ? 1.85 : 2.05;
		blocks = activity.options.map((o, i) => {
			const mesh = kit!.toyBlock(glyphFor(s, o.symbol!), kit!.TOY_COLORS[i % kit!.TOY_COLORS.length], size);
			const baseX = (i - (n - 1) / 2) * gap;
			mesh.position.set(baseX, size / 2 + 0.4, 0);
			mesh.rotation.y = (i - (n - 1) / 2) * -0.12;
			stage!.scene.add(mesh);
			return { id: o.id, mesh, baseX, phase: i * 1.3, mode: d.reduced ? '' : 'hop', t: -i * 0.08 } satisfies Block;
		});
		placeButtons();
	}

	function frame(dt: number, time: number) {
		for (const b of blocks) {
			const m = b.mesh;
			const size = (m.geometry as Kit.THREE.BufferGeometry & { parameters?: { width: number } }).parameters?.width ?? 1.6;
			const rest = size / 2 + 0.4;
			const bob = d.reduced ? 0 : Math.sin(time * 1.6 + b.phase) * 0.08;
			m.position.x = b.baseX;
			m.position.y = rest + bob;
			m.scale.setScalar(1);
			const mat = m.material as Kit.THREE.MeshStandardMaterial;
			mat.emissive.setRGB(0, 0, 0);
			if (b.mode) {
				b.t += dt;
				const p = Math.max(0, b.t);
				if (b.mode === 'jump') {
					const k = Math.min(1, p / 0.9);
					m.position.y = rest + Math.sin(k * Math.PI) * 1.6;
					m.rotation.y += dt * 7 * (1 - k);
					m.scale.setScalar(1 + 0.15 * kit!.easeOutBack(k) * (1 - k));
					if (k >= 1) b.mode = '';
				} else if (b.mode === 'wobble') {
					const k = Math.min(1, p / 0.7);
					m.position.x = b.baseX + Math.sin(k * Math.PI * 4) * 0.18 * (1 - k);
					if (k >= 1) b.mode = '';
				} else if (b.mode === 'glow') {
					const g = (Math.sin(p * 5) + 1) * 0.18;
					mat.emissive.setRGB(g, g * 0.9, g * 0.4);
					if (!d.reduced) m.scale.setScalar(1 + g * 0.25);
					if (p > 2.4) b.mode = '';
				} else if (b.mode === 'hop') {
					const k = Math.min(1, p / 0.5);
					m.position.y = rest + Math.sin(k * Math.PI) * 0.6;
					if (k >= 1) b.mode = '';
				}
			}
		}
		// Keep the tap targets over the blocks (cheap: a handful of projections).
		if ((frameNo = (frameNo + 1) % 3) === 0) placeButtons();
	}

	let frameNo = 0;
	function placeButtons() {
		if (!stage || !kit || !canvas) return;
		const next: typeof spots = {};
		const h = canvas.clientHeight || 1;
		for (const b of blocks) {
			const c = stage.toScreen(b.mesh.position);
			const top = stage.toScreen(b.mesh.position.clone().add(new kit.THREE.Vector3(0, 1, 0)));
			const size = Math.max(70, Math.min(h * 0.5, Math.abs(c.y - top.y) * 1.9));
			next[b.id] = { x: Math.round(c.x), y: Math.round(c.y), size: Math.round(size) };
		}
		const same = blocks.every((b) => {
			const o = spots[b.id];
			const n = next[b.id]!;
			return o && Math.abs(o.x - n.x) < 2 && Math.abs(o.y - n.y) < 2 && o.size === n.size;
		});
		if (!same || Object.keys(spots).length !== blocks.length) spots = next;
	}

	const blockFor = (id: string) => blocks.find((b) => b.id === id);
	function animateBlock(id: string, mode: Block['mode']) {
		const b = blockFor(id);
		if (b) {
			b.mode = d.reduced && mode !== 'glow' ? '' : mode;
			b.t = 0;
		}
	}

	// ── Game flow ───────────────────────────────────────────────────────────
	function runEffect(effect: ChoiceEffect) {
		const m = machine;
		if (!m) return;
		switch (effect.type) {
			case 'animate':
				hintId = null;
				animateBlock(effect.optionId, effect.correct ? 'jump' : 'wobble');
				mascot = 'thinking';
				scheduler.after(d.reduced ? 300 : ANIM_MS, () => m.send({ type: 'ANIM_DONE' }));
				break;
			case 'narrate':
				say(effect.key);
				if (m.state === 'TRY_AGAIN') {
					mascot = 'encourage';
					scheduler.after(FEEDBACK_MS, () => {
						mascot = 'idle';
						m.send({ type: 'FEEDBACK_DONE' });
					});
				} else if (m.state === 'CORRECT') {
					mascot = 'celebrate';
				}
				break;
			case 'hint':
				hintId = effect.optionId;
				animateBlock(effect.optionId, 'glow');
				showHand([`[data-option-id="${effect.optionId}"]`]);
				scheduler.after(2400, () => (hintId = null));
				break;
			case 'celebrate':
				mascot = 'celebrate';
				for (const b of blocks) if (b.id === ctx?.activity.answerId) animateBlock(b.id, 'jump');
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'cancelAll':
				scheduler.cancelAll();
				stopNarration();
				mascot = 'idle';
				hintId = null;
				break;
			case 'complete':
			case 'next':
				break;
		}
	}

	function tryResultShown(m: ChoiceMachine) {
		if (m.state === 'CORRECT' && !m.send({ type: 'RESULT_SHOWN' })) scheduler.after(100, () => tryResultShown(m));
	}

	function load(activity: ChoiceActivity) {
		teardown();
		mascot = 'idle';
		hintId = null;
		const m = createChoiceMachine(activity);
		machine = m;
		let prev: ChoiceState | null = null;
		unsubscribers = [
			m.subscribe((s, c) => {
				mState = s;
				ctx = c;
				if (s === 'CORRECT' && prev !== 'CORRECT') scheduler.after(d.resultMin, () => tryResultShown(m));
				if (s === 'COMPLETE' && prev !== 'COMPLETE') setIdlePrompt('ui.tap-next');
				if (s !== 'READY') hideHand();
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		buildBlocks(activity);
		instruct(activity.instructionKey);
		if (firstTime('abc-blocks')) scheduler.after(1600, () => machine?.state === 'READY' && showHand([`[data-option-id="${activity.answerId}"]`]));
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	function start(s: SymbolSet) {
		set = s;
		round = createPlay3DRound('abc3d', s, $settings.difficulty, Date.now() >>> 0);
		index = 0;
		roundDone = false;
		load(round.activities[0]!);
	}

	function next() {
		if (!round) return;
		if (index + 1 >= round.activities.length) {
			roundDone = true;
			clearBlocks();
			setIdlePrompt(null);
			mascot = 'celebrate';
			say('feedback.completed', { interrupt: true });
			return;
		}
		index += 1;
		load(round.activities[index]!);
	}

	function backToPicker() {
		teardown();
		clearBlocks();
		leaveScreen();
		set = null;
		round = null;
		roundDone = false;
		instruct('mode.abc3d');
	}

	const choose = (id: string) => machine?.send({ type: 'CHOOSE', optionId: id });

	onMount(() => {
		void startStage();
		instruct('mode.abc3d');
	});

	$effect(() => {
		void ready;
		stage?.setPaused($paused || !set || roundDone);
	});

	const offPause = paused.subscribe((p) => {
		stage?.setPaused(p || !set || roundDone);
		if (p) {
			scheduler.pause();
			stopNarration();
		} else {
			scheduler.resume();
		}
	});

	onDestroy(() => {
		destroyed = true;
		offPause();
		teardown();
		hideHand();
		leaveScreen();
		stage?.dispose();
		stage = null;
	});

	const locked = $derived(mState !== 'READY');
	const won = (id: string) =>
		ctx?.chosenId === id && (mState === 'CORRECT' || mState === 'CELEBRATING' || mState === 'COMPLETE');
</script>

<TopBar onreplay={replayInstruction} />

<section class="scene" class:paused={$paused} data-set={set ?? undefined} data-ready={ready}>
	{#if !set}
		<SetPicker onpick={start} />
	{:else if roundDone}
		<div class="done">
			<Mascot state="celebrate" size={240} />
			<div class="actions">
				<GameButton action="replay" onclick={() => start(set!)} />
				<GameButton action="choose-game" onclick={backToPicker} />
			</div>
		</div>
	{/if}

	<div class="stage" class:hidden={!set || roundDone}>
		{#if set && round && !roundDone}
			<div class="progress" aria-hidden="true">
				{#each round.activities as x, i (x.id)}
					<span class="pdot" class:filled={i < index || (i === index && mState === 'COMPLETE')}></span>
				{/each}
			</div>
		{/if}
		<div class="view" data-answer={a?.answerId}>
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
			{#if failed && set && a && !roundDone}
				<div class="flat-options">
					{#each a.options as o, i (o.id)}
						<button class="flat" data-option-id={o.id} data-symbol={o.symbol} data-lane-index={i} aria-label={nameFor(set, o.symbol!)} onclick={() => choose(o.id)}>{glyphFor(set, o.symbol!)}</button>
					{/each}
				</div>
			{/if}
			{#if !failed && set && a && !roundDone}
				{#each a.options as o (o.id)}
					{@const p = spots[o.id]}
					<button
						class="tap"
						class:hinted={hintId === o.id}
						class:won={won(o.id)}
						data-option-id={o.id}
						data-symbol={o.symbol}
						aria-label={nameFor(set, o.symbol!)}
						aria-disabled={locked}
						style:left="{p?.x ?? 0}px"
						style:top="{p?.y ?? 0}px"
						style:width="{p?.size ?? 90}px"
						style:height="{p?.size ?? 90}px"
						style:visibility={p ? 'visible' : 'hidden'}
						onclick={() => choose(o.id)}
					></button>
				{/each}
			{/if}
			<div class="mascot"><Mascot state={mascot} size={150} /></div>
		</div>
		<div class="bottom">
			{#if set && ctx && !roundDone}
				{#if mState === 'COMPLETE'}
					<GameButton action="next" onclick={next} />
				{:else if ctx.hintEnabled && mState === 'READY'}
					<GameButton action="hint" size="small" onclick={() => machine?.send({ type: 'HINT' })} />
				{/if}
			{/if}
		</div>
	</div>
</section>

<style>
	.scene {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 0 24px 20px;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		min-height: 0;
		gap: 8px;
	}
	.stage.hidden {
		/* keep the WebGL canvas alive between rounds; just hide it */
		position: absolute;
		visibility: hidden;
		pointer-events: none;
		inset: 0;
	}
	.progress {
		display: flex;
		gap: 12px;
	}
	.pdot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
	}
	.pdot.filled {
		background: var(--text-secondary);
	}
	.view {
		position: relative;
		flex: 1;
		width: min(1200px, 100%);
		min-height: 300px;
		border-radius: var(--radius-xl);
		overflow: hidden;
	}
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}
	.tap {
		position: absolute;
		transform: translate(-50%, -50%);
		border: 0;
		border-radius: 22%;
		background: transparent;
		cursor: pointer;
	}
	.tap[aria-disabled='true'] {
		cursor: default;
	}
	.tap:focus-visible {
		outline: 5px solid var(--text-primary);
		outline-offset: 4px;
	}
	.mascot {
		position: absolute;
		left: 8px;
		bottom: 0;
		pointer-events: none;
	}
	.bottom {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 110px;
	}
	.done {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32px;
	}
	.actions {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
		justify-content: center;
	}
	@media (max-width: 900px) {
		.mascot {
			display: none;
		}
	}

	/* WebGL unavailable: the same choices as plain big buttons, so the game still works. */
	.flat-options { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 28px; flex-wrap: wrap; }
	.flat { min-width: 120px; min-height: 120px; font-size: 64px; font-weight: 700; border: 4px solid var(--border-soft); border-radius: var(--radius-xl); background: var(--surface); color: var(--text-primary); cursor: pointer; }
</style>
