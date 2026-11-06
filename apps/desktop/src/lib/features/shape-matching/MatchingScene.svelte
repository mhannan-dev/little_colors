<script lang="ts">
	/**
	 * Spec 06 — Shape Matching screen. Rules, validation, and state come from Codex's
	 * core `matchingMachine` (X-01); this component renders state and runs effects.
	 * Input: drag & drop (SM-20, SM-23), tap source → tap target (SM-21), keyboard (SM-22).
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		COLOR_NAMES,
		SHAPES,
		createMatchingMachine,
		createMatchingRound,
		type MatchItem,
		type MatchingActivity,
		type MatchingContext,
		type MatchingEffect,
		type MatchingMachine,
		type MatchingState
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import Shape from '#lib/components/shapes/Shape.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, replayInstruction, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	const SNAP_MS = 450;
	const RETURN_MS = 400;
	const DRAG_THRESHOLD = 8;
	const DROP_TOLERANCE = 24; // SM-23

	const d = durations();
	const scheduler = createScheduler();

	let round = $state(createMatchingRound($settings.difficulty, Date.now() >>> 0));
	let index = $state(0);
	let roundDone = $state(false);

	let machine: MatchingMachine | null = null;
	let unsubscribers: (() => void)[] = [];
	let mState = $state<MatchingState>('IDLE');
	let ctx = $state<MatchingContext | null>(null);

	let mascot = $state<MascotAnimation>('idle');
	let hintTarget = $state<string | null>(null);
	let hintItem = $state<string | null>(null);
	let returning = $state<string | null>(null);

	// Drag state
	let dragId = $state<string | null>(null);
	let dragDX = $state(0);
	let dragDY = $state(0);
	let pointer: { id: number; itemId: string; x0: number; y0: number; moved: boolean } | null = null;
	let suppressClick = false;

	const activity = $derived<MatchingActivity | undefined>(round.activities[index]);
	const lang = $derived($settings.language);

	const shapeName = (s: string) => SHAPES.find((x) => x.key === s);
	function itemName(item: MatchItem) {
		const shape = shapeName(item.shape);
		const color = COLOR_NAMES[item.color];
		return lang === 'bn-BD' ? `${color.bn} ${shape?.bn ?? ''}` : `${color.en} ${shape?.en ?? ''}`;
	}

	/** Source matched into a given target, if any. */
	function matchedInto(targetId: string): MatchItem | undefined {
		if (!ctx || !activity) return undefined;
		const target = activity.targets.find((x) => x.id === targetId)!;
		return activity.sources.find(
			(s) => ctx!.matchedIds.includes(s.id) && s.shape === target.shape && s.color === target.color
		);
	}

	function clearVisuals() {
		mascot = 'idle';
		hintTarget = null;
		hintItem = null;
		returning = null;
		dragId = null;
		dragDX = 0;
		dragDY = 0;
		pointer = null;
	}

	function runEffect(effect: MatchingEffect) {
		const m = machine;
		if (!m) return;
		switch (effect.type) {
			case 'validate':
				queueMicrotask(() => m.send({ type: 'VALIDATE' }));
				break;
			case 'snap':
				dragId = null;
				dragDX = dragDY = 0;
				hintTarget = hintItem = null;
				mascot = 'celebrate';
				scheduler.after(SNAP_MS, () => m.send({ type: 'SNAP_DONE' }));
				scheduler.after(SNAP_MS + 900, () => {
					if (m.state !== 'CELEBRATING' && m.state !== 'COMPLETE') mascot = 'idle';
				});
				break;
			case 'return':
				returning = effect.itemId;
				dragDX = dragDY = 0;
				scheduler.after(RETURN_MS, () => {
					dragId = null;
					returning = null;
					m.send({ type: 'RETURN_DONE' });
				});
				break;
			case 'hint':
				hintTarget = effect.targetId;
				hintItem = effect.itemId;
				showHand([`[data-item-id="${effect.itemId}"]`, `[data-target-id="${effect.targetId}"]`], { drag: true });
				scheduler.after(2400, () => {
					hintTarget = hintItem = null;
				});
				break;
			case 'narrate':
				say(effect.key);
				break;
			case 'celebrate':
				mascot = 'celebrate';
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'complete':
				break;
			case 'cancelAll':
				scheduler.cancelAll();
				stopNarration();
				clearVisuals();
				break;
			case 'highlight':
			case 'followPointer':
			case 'next':
				break;
		}
	}

	function load(a: MatchingActivity) {
		teardown();
		clearVisuals();
		const m = createMatchingMachine(a);
		machine = m;
		let prev: MatchingState | null = null;
		unsubscribers = [
			m.subscribe((s, c) => {
				mState = s;
				ctx = c;
				if (s === 'COMPLETE' && prev !== 'COMPLETE') setIdlePrompt('ui.tap-next');
				if (s === 'DRAGGING' || s === 'SOURCE_SELECTED') hideHand();
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		instruct(a.instructionKey);
		// First visit: the ghost hand drags the item to its place once (PR-25).
		if (firstTime('matching')) scheduler.after(1400, () => demoMatch(a));
	}

	function demoMatch(a: MatchingActivity) {
		const src = a.sources.find((s) => !ctx?.matchedIds.includes(s.id));
		const target = src && a.targets.find((t) => t.shape === src.shape && t.color === src.color);
		if (src && target) showHand([`[data-item-id="${src.id}"]`, `[data-target-id="${target.id}"]`], { drag: true });
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	// ── Input ────────────────────────────────────────────────
	function onSourcePointerDown(e: PointerEvent, item: MatchItem) {
		if (pointer || !ctx || ctx.matchedIds.includes(item.id)) return; // SM-32, SM-41
		// A fresh press is a new gesture: never let a previous drag swallow this tap
		// (after a drop the dragged button may be gone, and touch drags emit no click).
		suppressClick = false;
		pointer = { id: e.pointerId, itemId: item.id, x0: e.clientX, y0: e.clientY, moved: false };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onSourcePointerMove(e: PointerEvent) {
		if (!pointer || e.pointerId !== pointer.id || !machine) return;
		const dx = e.clientX - pointer.x0;
		const dy = e.clientY - pointer.y0;
		if (!pointer.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
			if (machine.state === 'SOURCE_SELECTED') machine.send({ type: 'TAP_EMPTY' });
			if (!machine.send({ type: 'DRAG_START', itemId: pointer.itemId })) {
				pointer = null;
				return;
			}
			pointer.moved = true;
			dragId = pointer.itemId;
		}
		if (pointer.moved) {
			const zoom = Number(getComputedStyle(document.querySelector('main')!).zoom) || 1;
			dragDX = dx / zoom;
			dragDY = dy / zoom;
		}
	}

	/**
	 * Target under the drop point (SM-23). A drop inside a target always wins; otherwise the
	 * nearest target within the tolerance. Neighbours' tolerance zones overlap across the gap,
	 * so taking the first match in DOM order would send edge drops to the wrong target.
	 */
	function targetAt(x: number, y: number): string | null {
		const zoom = Number(getComputedStyle(document.querySelector('main')!).zoom) || 1;
		const tolerance = DROP_TOLERANCE * zoom; // rects are in screen px
		let best: { id: string; dist: number } | null = null;
		for (const el of document.querySelectorAll<HTMLElement>('[data-target-id]')) {
			const r = el.getBoundingClientRect();
			const dx = Math.max(r.left - x, 0, x - r.right);
			const dy = Math.max(r.top - y, 0, y - r.bottom);
			const dist = Math.hypot(dx, dy); // 0 when inside
			if (dist <= tolerance && (!best || dist < best.dist)) best = { id: el.dataset.targetId!, dist };
		}
		return best?.id ?? null;
	}

	function onSourcePointerUp(e: PointerEvent) {
		if (!pointer || e.pointerId !== pointer.id) return;
		const wasDrag = pointer.moved;
		pointer = null;
		if (wasDrag) {
			suppressClick = true;
			machine?.send({ type: 'DROP', targetId: targetAt(e.clientX, e.clientY) });
		}
	}

	function onSourcePointerCancel(e: PointerEvent) {
		if (!pointer || e.pointerId !== pointer.id) return;
		const wasDrag = pointer.moved;
		pointer = null;
		if (wasDrag) machine?.send({ type: 'DRAG_CANCEL' }); // SM-40
	}

	function onSourceClick(item: MatchItem) {
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		machine?.send({ type: 'TAP_SOURCE', itemId: item.id });
	}

	function onTargetClick(id: string) {
		machine?.send({ type: 'TAP_TARGET', targetId: id });
	}

	function onFieldClick(e: MouseEvent) {
		if (e.target === e.currentTarget) machine?.send({ type: 'TAP_EMPTY' });
	}

	// SM-42: a resize/orientation change mid-drag cancels the drag.
	function onResize() {
		if (pointer?.moved) {
			pointer = null;
			machine?.send({ type: 'DRAG_CANCEL' });
		}
	}

	// ── Round flow ───────────────────────────────────────────
	function next() {
		if (index + 1 >= round.activities.length) {
			roundDone = true;
			setIdlePrompt(null);
			mascot = 'celebrate';
			say('feedback.completed', { interrupt: true });
			return;
		}
		index += 1;
		load(round.activities[index]!);
	}

	function replayRound() {
		round = createMatchingRound($settings.difficulty, (Date.now() + 1) >>> 0);
		index = 0;
		roundDone = false;
		load(round.activities[0]!);
	}

	onMount(() => {
		if (activity) load(activity);
		window.addEventListener('resize', onResize);
	});

	const offPause = paused.subscribe((p) => {
		if (p) {
			scheduler.pause();
			stopNarration();
			if (pointer?.moved) {
				pointer = null;
				machine?.send({ type: 'DRAG_CANCEL' });
			}
		} else {
			scheduler.resume();
		}
	});

	onDestroy(() => {
		offPause();
		teardown();
		hideHand();
		leaveScreen();
		if (typeof window !== 'undefined') window.removeEventListener('resize', onResize);
	});
</script>

<TopBar onreplay={replayInstruction} />

<section class="scene" class:paused={$paused}>
	{#if roundDone}
		<div class="done">
			<Mascot state="celebrate" size={240} />
			<div class="actions">
				<GameButton action="replay" onclick={replayRound} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else if activity && ctx}
		<div class="progress" aria-hidden="true">
			{#each round.activities as a, i (a.id)}
				<span class="dot" class:filled={i < index || (i === index && mState === 'COMPLETE')}></span>
			{/each}
		</div>

		<!-- Picture of WHAT to match, so a non-reader knows color vs shape (PR-25). -->
		<div class="mode-badge" data-testid="match-mode-badge" data-mode={activity.matchMode} aria-hidden="true">
			{#if activity.matchMode !== 'shape'}
				<svg viewBox="0 0 72 32" width="90" height="40">
					<circle cx="14" cy="16" r="11" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="2.5" />
					<circle cx="36" cy="16" r="11" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="2.5" />
					<circle cx="58" cy="16" r="11" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="2.5" />
				</svg>
			{/if}
			{#if activity.matchMode === 'both'}<span class="plus">+</span>{/if}
			{#if activity.matchMode !== 'color'}
				<svg viewBox="0 0 72 32" width="90" height="40">
					<circle cx="13" cy="16" r="10" fill="none" stroke="var(--text-primary)" stroke-width="3" />
					<rect x="27" y="6" width="19" height="20" rx="3" fill="none" stroke="var(--text-primary)" stroke-width="3" />
					<polygon points="60,5 70,27 50,27" fill="none" stroke="var(--text-primary)" stroke-width="3" stroke-linejoin="round" />
				</svg>
			{/if}
		</div>

		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="field" onclick={onFieldClick}>
			<div class="mascot"><Mascot state={mascot} size={170} /></div>

			<div class="sources" onclick={onFieldClick}>
				{#each activity.sources as item (item.id)}
					{#if !ctx.matchedIds.includes(item.id)}
						<button
							class="source"
							data-item-id={item.id}
							class:selected={ctx.selectedId === item.id && mState === 'SOURCE_SELECTED'}
							class:dragging={dragId === item.id}
							class:returning={returning === item.id}
							class:hinted={hintItem === item.id}
							style:transform="translate({dragId === item.id ? dragDX : 0}px, {dragId === item.id ? dragDY : 0}px)"
							aria-label={itemName(item)}
							aria-pressed={ctx.selectedId === item.id}
							onpointerdown={(e) => onSourcePointerDown(e, item)}
							onpointermove={onSourcePointerMove}
							onpointerup={onSourcePointerUp}
							onpointercancel={onSourcePointerCancel}
							onlostpointercapture={onSourcePointerCancel}
							onclick={() => onSourceClick(item)}
						>
							<Shape shape={item.shape} color={item.color} size={104} />
						</button>
					{/if}
				{/each}
			</div>

			<div class="targets">
				{#each activity.targets as target (target.id)}
					{@const filled = matchedInto(target.id)}
					<button
						class="target"
						class:hinted={hintTarget === target.id}
						class:filled={!!filled}
						data-target-id={target.id}
						aria-label="{t('place', lang)}: {itemName(target)}"
						onclick={() => onTargetClick(target.id)}
					>
						<Shape shape={target.shape} color={target.color} variant="outline" size={112} />
						{#if filled}
							<span class="snapped"><Shape shape={filled.shape} color={filled.color} size={104} /></span>
						{/if}
					</button>
				{/each}
			</div>
		</div>

		<div class="bottom">
			{#if mState === 'COMPLETE'}
				<GameButton action="next" onclick={next} />
			{:else if ctx.hintEnabled && mState === 'IDLE'}
				<GameButton action="hint" size="small" onclick={() => machine?.send({ type: 'HINT' })} />
			{/if}
		</div>
	{/if}
</section>

<style>
	.scene {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		padding: 0 24px 24px;
		min-height: 0;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.mode-badge {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 16px;
		margin-top: 8px;
		border-radius: var(--radius-lg);
		background: var(--surface);
		border: 3px solid var(--border-soft);
	}
	.mode-badge .plus {
		font-size: 28px;
		font-weight: 700;
	}
	.progress {
		display: flex;
		gap: 12px;
	}
	.dot {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
	}
	.dot.filled {
		background: var(--text-secondary);
	}
	.field {
		flex: 1;
		width: min(1100px, 100%);
		display: grid;
		grid-template-columns: auto 1fr 1.4fr;
		align-items: center;
		gap: 24px;
	}
	.mascot {
		align-self: end;
	}
	.sources,
	.targets {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 24px;
		min-height: 180px;
	}
	.targets {
		padding: 20px;
		border-radius: var(--radius-xl);
		background: var(--bg-secondary);
	}
	.source,
	.target {
		position: relative;
		display: grid;
		place-items: center;
		padding: 14px;
		border-radius: var(--radius-xl);
		cursor: pointer;
		touch-action: none;
	}
	.source {
		border: 4px solid transparent;
		background: var(--surface);
		box-shadow: 0 6px 0 var(--border-soft);
		transition: transform 300ms ease, border-color 200ms ease;
	}
	.source.dragging {
		transition: none;
		z-index: 10;
		cursor: grabbing;
		box-shadow: 0 14px 24px rgba(0, 0, 0, 0.15);
	}
	.source.returning {
		transition: transform 400ms cubic-bezier(0.3, 0.7, 0.3, 1);
	}
	.source.selected {
		border-color: var(--text-primary);
		transform: translateY(-6px);
	}
	.target {
		border: 4px solid transparent;
		background: var(--surface);
		transition: border-color 300ms ease, transform 300ms ease;
	}
	.target.filled {
		border-color: var(--text-primary);
		transform: scale(1.04);
	}
	.snapped {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		animation: pop 450ms ease-out;
	}
	.hinted {
		animation: glow 1.2s ease-in-out 2;
	}
	@keyframes pop {
		0% { transform: scale(0.6); opacity: 0; }
		70% { transform: scale(1.08); opacity: 1; }
		100% { transform: scale(1); }
	}
	@keyframes glow {
		0%, 100% { box-shadow: 0 0 0 0 transparent; }
		50% { box-shadow: 0 0 0 10px var(--border-soft); }
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
		.field {
			grid-template-columns: 1fr 1.4fr;
		}
		.mascot {
			display: none;
		}
	}
</style>
