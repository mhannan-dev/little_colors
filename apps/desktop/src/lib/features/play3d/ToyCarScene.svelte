<script lang="ts">
	/**
	 * "Rumi's toy car": a calm 3D drive. Three signs (letters or numbers) roll up and wait on the
	 * road; the child steers into the lane with the sign Rumi names (◀ ▶, arrow keys, or just tap
	 * the sign) and presses Go. No clock, no rivals, no score (PR-07): the signs always wait.
	 * A wrong sign wobbles and the car gently backs up (PR-08). three.js loads only on this screen.
	 */
	import { onDestroy, onMount } from 'svelte';
	import {
		createChoiceMachine,
		createPlay3DRound,
		formatNumeral,
		narrationText,
		symbolDef,
		type ChoiceActivity,
		type ChoiceContext,
		type ChoiceEffect,
		type ChoiceMachine,
		type ChoiceState,
		type Play3DData,
		type SymbolSet
	} from '@little-colors/core';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, replayInstruction, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import SetPicker from './SetPicker.svelte';
	import type * as Kit from '#lib/three3d/toyKit.ts';

	const LANES = [-2.6, 0, 2.6];
	/** Where the signs stop and wait for the child. */
	const STOP_Z = -7.5;
	/** Where the car is when it reaches the signs (car's nose under the arch). */
	const ARRIVE_Z = -1.6;
	const START_Z = -46;
	const APPROACH_SPEED = 9;
	const ANIM_MS = 1000;
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
	let hintId = $state<string | null>(null);

	let lane = $state(1);
	/** 'approach': signs rolling in · 'wait': signs waiting · 'drive' / 'back': car moving. */
	let phase = $state<'approach' | 'wait' | 'drive' | 'back' | 'arrived'>('approach');
	let pendingGo = false;

	let canvas = $state<HTMLCanvasElement | null>(null);
	let kit: typeof Kit | null = null;
	let stage: Kit.Stage | null = null;
	let ready = $state(false);
	let failed = $state(false);

	let car: Kit.THREE.Group | null = null;
	let carX = LANES[1]!;
	/** Seconds into the happy hop; -1 when not hopping. */
	let carHop = -1;
	let confetti: Kit.Confetti | null = null;
	/** Distance travelled; scenery scrolls with it. */
	let offset = 0;
	let gateZ = START_Z;
	/** Movement tween for drive/back. */
	let tween: { from: number; to: number; t: number; dur: number } | null = null;
	interface Sign {
		id: string;
		group: Kit.THREE.Group;
		board: Kit.THREE.Mesh;
		mode: '' | 'win' | 'wobble' | 'glow';
		t: number;
	}
	let signs: Sign[] = [];
	/** Signs from the previous activity roll away behind the car. */
	let leaving: { group: Kit.THREE.Group; z: number }[] = [];
	let scenery: { obj: Kit.THREE.Object3D; base: number; span: number }[] = [];
	let spots = $state<Record<string, { x: number; y: number; w: number; h: number }>>({});

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
			stage = kit.createStage(canvas, { fov: 50, background: '#DDF0FB', skyTop: '#8CC8F0' });
		} catch {
			failed = true;
			return;
		}
		stage.scene.fog = new THREE.Fog('#DDF0FB', 30, 60);

		const grass = new THREE.Mesh(new THREE.PlaneGeometry(80, 140), new THREE.MeshStandardMaterial({ color: '#BFE3A5', roughness: 1 }));
		grass.rotation.x = -Math.PI / 2;
		grass.position.set(0, -0.01, -40);
		grass.receiveShadow = true;
		const road = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 140), new THREE.MeshStandardMaterial({ color: '#C9CED6', roughness: 0.95 }));
		road.rotation.x = -Math.PI / 2;
		road.position.set(0, 0, -40);
		road.receiveShadow = true;
		stage.scene.add(grass, road);

		// Lane dashes and trees scroll with `offset`, wrapping around.
		const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
		const dashGeo = new THREE.BoxGeometry(0.18, 0.02, 1.4);
		for (const x of [-1.3, 1.3]) {
			for (let k = 0; k < 18; k++) {
				const dash = new THREE.Mesh(dashGeo, dashMat);
				dash.position.set(x, 0.01, 0);
				stage.scene.add(dash);
				scenery.push({ obj: dash, base: -k * 4, span: 72 });
			}
		}
		for (const side of [-1, 1]) {
			for (let k = 0; k < 8; k++) {
				const tree = kit.toyTree();
				tree.position.x = side * (6 + (k % 3) * 1.4);
				tree.scale.setScalar(1 + (k % 2) * 0.3);
				stage.scene.add(tree);
				scenery.push({ obj: tree, base: -k * 9 - (side > 0 ? 4.5 : 0), span: 72 });
			}
		}

		car = kit.toyCar('#E5484D');
		stage.scene.add(car);

		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused);
		ready = true;
		if (a) buildSigns(a);
	}

	function wrapZ(v: number, span: number) {
		const w = (((12 - v) % span) + span) % span;
		return 12 - w;
	}

	function disposeGroup(g: Kit.THREE.Group) {
		stage?.scene.remove(g);
		g.traverse((o) => {
			const m = o as Kit.THREE.Mesh;
			if (!m.isMesh) return;
			m.geometry.dispose();
			for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
				(mat as Kit.THREE.MeshStandardMaterial).map?.dispose();
				mat.dispose();
			}
		});
	}

	function buildSigns(activity: ChoiceActivity) {
		if (!stage || !kit) return;
		const { THREE } = kit;
		for (const s of signs) {
			if (d.reduced) disposeGroup(s.group);
			else leaving.push({ group: s.group, z: s.group.position.z });
		}
		signs = [];
		const set = (activity.data as Play3DData).set;
		signs = activity.options.map((o, i) => {
			const color = kit!.TOY_COLORS[[0, 2, 4][i % 3]!]!;
			const group = new THREE.Group();
			const post = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.6 });
			for (const x of [-1.05, 1.05]) {
				const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 10), post);
				p.position.set(x, 1.6, 0);
				p.castShadow = true;
				group.add(p);
			}
			const side = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
			const face = new THREE.MeshStandardMaterial({ map: kit!.glyphTexture(glyphFor(set, o.symbol!), color), roughness: 0.5 });
			const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 0.22), [side, side, side, side, face, side]);
			board.position.set(0, 3.4, 0);
			board.castShadow = true;
			group.add(board);
			group.position.x = LANES[i]!;
			stage!.scene.add(group);
			return { id: o.id, group, board, mode: '', t: 0 } satisfies Sign;
		});
		gateZ = d.reduced ? STOP_Z : START_Z;
		phase = d.reduced ? 'wait' : 'approach';
		placeButtons();
	}

	function frame(dt: number, time: number) {
		if (!car) return;
		let speed = 0;
		if (phase === 'approach') {
			const step = Math.min(APPROACH_SPEED * dt, STOP_Z - gateZ);
			gateZ += step;
			speed = step / Math.max(dt, 1e-6);
			if (gateZ >= STOP_Z - 1e-3) {
				gateZ = STOP_Z;
				phase = 'wait';
				if (pendingGo) {
					pendingGo = false;
					go();
				}
			}
		} else if (tween) {
			tween.t = Math.min(tween.dur, tween.t + dt);
			const k = tween.t / tween.dur;
			const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
			const z = tween.from + (tween.to - tween.from) * e;
			speed = Math.abs(z - gateZ) / Math.max(dt, 1e-6);
			gateZ = z;
			if (k >= 1) tween = null;
		}
		const moved = speed * dt * Math.sign(phase === 'back' ? -1 : 1);
		offset += moved;
		for (const s of signs) s.group.position.z = gateZ;
		for (const l of leaving) {
			l.z += Math.abs(moved);
			l.group.position.z = l.z;
		}
		for (const l of leaving.filter((x) => x.z > 16)) disposeGroup(l.group);
		leaving = leaving.filter((x) => x.z <= 16);
		for (const s of scenery) s.obj.position.z = wrapZ(s.base + offset, s.span);

		// Car: ease into the chosen lane, lean a little, rumble gently while moving.
		const target = LANES[lane]!;
		carX += (target - carX) * Math.min(1, dt * (d.reduced ? 20 : 6));
		car.position.x = carX;
		car.rotation.y = (carX - target) * 0.18;
		car.position.y = d.reduced ? 0 : (speed > 0.5 ? Math.abs(Math.sin(time * 14)) * 0.05 : 0);
		car.scale.setScalar(1);
		if (carHop >= 0) {
			// Squash & stretch hop (the car's origin is at its wheels, so it squashes onto the road).
			carHop += dt;
			const h = kit!.squashHop(carHop, 0.9);
			car.position.y += h.y;
			car.scale.set(h.sxz, h.sy, h.sxz);
			if (h.done) carHop = -1;
		}

		for (const s of signs) {
			const mat = (s.board.material as Kit.THREE.MeshStandardMaterial[])[4]!;
			mat.emissive.setRGB(0, 0, 0);
			s.board.position.y = 3.4;
			s.board.rotation.set(0, 0, 0);
			s.board.scale.setScalar(1);
			if (!s.mode) continue;
			s.t += dt;
			if (s.mode === 'win') {
				const k = Math.min(1, s.t / 1.2);
				s.board.position.y = 3.4 + (d.reduced ? 0 : Math.sin(k * Math.PI) * 1.2);
				s.board.rotation.y = d.reduced ? 0 : k * Math.PI * 2;
				s.board.scale.setScalar(1 + 0.2 * Math.sin(k * Math.PI));
				if (k >= 1) s.mode = '';
			} else if (s.mode === 'wobble') {
				const k = Math.min(1, s.t / 0.8);
				s.board.rotation.z = Math.sin(k * Math.PI * 4) * 0.12 * (1 - k);
				if (k >= 1) s.mode = '';
			} else if (s.mode === 'glow') {
				const g = (Math.sin(s.t * 5) + 1) * 0.2;
				mat.emissive.setRGB(g, g * 0.9, g * 0.4);
				s.board.scale.setScalar(1 + g * 0.2);
				if (s.t > 2.4) s.mode = '';
			}
		}

		confetti?.update(dt);

		// Camera follows the car from behind, softly.
		const cam = stage!.camera;
		cam.position.x += (carX * 0.45 - cam.position.x) * Math.min(1, dt * 4);
		cam.position.y = 4.4;
		cam.position.z = 8.2;
		cam.lookAt(carX * 0.3, 1.6, -9);
		if ((frameNo = (frameNo + 1) % 3) === 0) placeButtons();
	}

	let frameNo = 0;
	function placeButtons() {
		if (!stage || !kit || !canvas) return;
		const next: typeof spots = {};
		for (const s of signs) {
			const c = new kit.THREE.Vector3();
			s.board.getWorldPosition(c);
			const p = stage.toScreen(c);
			const tl = stage.toScreen(c.clone().add(new kit.THREE.Vector3(-1.1, 0.95, 0)));
			const br = stage.toScreen(c.clone().add(new kit.THREE.Vector3(1.1, -0.95, 0)));
			next[s.id] = {
				x: Math.round(p.x),
				y: Math.round(p.y),
				w: Math.round(Math.max(56, br.x - tl.x)),
				h: Math.round(Math.max(56, br.y - tl.y))
			};
		}
		const same =
			Object.keys(spots).length === signs.length &&
			signs.every((s) => {
				const o = spots[s.id];
				const n = next[s.id]!;
				return o && Math.abs(o.x - n.x) < 2 && Math.abs(o.y - n.y) < 2 && Math.abs(o.w - n.w) < 2;
			});
		if (!same) spots = next;
	}

	const signFor = (id: string) => signs.find((s) => s.id === id);
	/** Confetti pops out of the sign the child drove to. */
	function popConfetti(id: string) {
		const s = signFor(id);
		if (!s || !kit) return;
		const at = new kit.THREE.Vector3();
		s.board.getWorldPosition(at);
		at.y += 1.3; // from the top edge, so the number stays readable
		confetti?.burst(at, 50, kit.TOY_COLORS, { up: 0.9, speed: 1.3, size: 1.8 });
	}
	function animateSign(id: string, mode: Sign['mode']) {
		const s = signFor(id);
		if (s) {
			s.mode = mode;
			s.t = 0;
		}
	}
	function moveTo(z: number, ms: number) {
		tween = { from: gateZ, to: z, t: 0, dur: Math.max(0.05, ms / 1000) };
	}

	// ── Controls ────────────────────────────────────────────────────────────
	const canSteer = $derived(mState === 'READY' && (phase === 'approach' || phase === 'wait'));

	function steer(to: number) {
		if (!canSteer) return;
		lane = Math.max(0, Math.min(LANES.length - 1, to));
	}

	/** Drive forward into the sign in the current lane. */
	function go() {
		if (!machine || mState !== 'READY' || !a) return;
		if (failed) {
			// No 3D: choose straight away.
			const option = a.options[lane];
			if (option) machine.send({ type: 'CHOOSE', optionId: option.id });
			return;
		}
		if (phase === 'approach') {
			pendingGo = true;
			return;
		}
		if (phase !== 'wait') return;
		const option = a.options[lane];
		if (option) machine.send({ type: 'CHOOSE', optionId: option.id });
	}

	function tapSign(id: string) {
		if (!a || (!canSteer && !failed)) return;
		const i = a.options.findIndex((o) => o.id === id);
		if (i < 0) return;
		lane = i;
		go();
	}

	function onkeydown(e: KeyboardEvent) {
		if (!set || roundDone || $paused) return;
		// Arrow keys belong to text fields, menus and dialogs when they have focus.
		if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [role=radiogroup], [role=dialog]')) return;
		if (e.key === 'ArrowLeft') steer(lane - 1);
		else if (e.key === 'ArrowRight') steer(lane + 1);
		else if (e.key === 'ArrowUp') go();
		else return;
		e.preventDefault();
	}

	// ── Game flow ───────────────────────────────────────────────────────────
	function runEffect(effect: ChoiceEffect) {
		const m = machine;
		if (!m) return;
		switch (effect.type) {
			case 'animate':
				hintId = null;
				phase = 'drive';
				moveTo(ARRIVE_Z, d.reduced ? 300 : ANIM_MS);
				scheduler.after(d.reduced ? 320 : ANIM_MS + 20, () => {
					phase = 'arrived';
					animateSign(effect.optionId, effect.correct ? 'win' : 'wobble');
					if (effect.correct) popConfetti(effect.optionId);
					m.send({ type: 'ANIM_DONE' });
				});
				break;
			case 'narrate':
				say(effect.key);
				if (m.state === 'TRY_AGAIN') {
					scheduler.after(FEEDBACK_MS * 0.6, () => {
						phase = 'back';
						moveTo(STOP_Z, d.reduced ? 200 : FEEDBACK_MS);
						scheduler.after(d.reduced ? 220 : FEEDBACK_MS + 20, () => {
							phase = 'wait';
							m.send({ type: 'FEEDBACK_DONE' });
						});
					});
				}
				break;
			case 'hint':
				hintId = effect.optionId;
				animateSign(effect.optionId, 'glow');
				showHand([`[data-option-id="${effect.optionId}"]`]);
				scheduler.after(2400, () => (hintId = null));
				break;
			case 'celebrate':
				carHop = d.reduced ? -1 : 0;
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'cancelAll':
				scheduler.cancelAll();
				stopNarration();
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
		hintId = null;
		pendingGo = false;
		tween = null;
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
		buildSigns(activity);
		instruct(activity.instructionKey);
		// First visit: the ghost hand taps the right sign once to show how to play (PR-25).
		if (firstTime('toy-car')) scheduler.after(d.reduced ? 1200 : 5000, () => machine?.state === 'READY' && showHand([`[data-option-id="${activity.answerId}"]`]));
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	function clearSigns() {
		for (const s of signs) disposeGroup(s.group);
		for (const l of leaving) disposeGroup(l.group);
		signs = [];
		leaving = [];
		spots = {};
	}

	function start(s: SymbolSet) {
		clearSigns();
		set = s;
		lane = 1;
		round = createPlay3DRound('car3d', s, $settings.difficulty, Date.now() >>> 0);
		index = 0;
		roundDone = false;
		load(round.activities[0]!);
	}

	function next() {
		if (!round) return;
		if (index + 1 >= round.activities.length) {
			roundDone = true;
			clearSigns();
			setIdlePrompt(null);
			say('feedback.completed', { interrupt: true });
			return;
		}
		index += 1;
		load(round.activities[index]!);
	}

	function backToPicker() {
		teardown();
		clearSigns();
		leaveScreen();
		set = null;
		round = null;
		roundDone = false;
		instruct('mode.car3d');
	}

	onMount(() => {
		void startStage();
		instruct('mode.car3d');
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
		confetti?.dispose();
		confetti = null;
		stage?.dispose();
		stage = null;
	});

	const won = (id: string) =>
		ctx?.chosenId === id && (mState === 'CORRECT' || mState === 'CELEBRATING' || mState === 'COMPLETE');
	const sideLabel = (key: 'drive.left' | 'drive.right') => narrationText(key, lang, true);
</script>

<svelte:window {onkeydown} />

<TopBar onreplay={replayInstruction} />

<section class="scene" class:paused={$paused} data-set={set ?? undefined} data-ready={ready} data-lane={lane} data-phase={phase}>
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
						<button class="flat" data-option-id={o.id} data-symbol={o.symbol} data-lane-index={i} aria-label={nameFor(set, o.symbol!)} onclick={() => tapSign(o.id)}>{glyphFor(set, o.symbol!)}</button>
					{/each}
				</div>
			{/if}
			{#if !failed && set && a && !roundDone}
				{#each a.options as o, i (o.id)}
					{@const p = spots[o.id]}
					<button
						class="tap"
						class:hinted={hintId === o.id}
						class:won={won(o.id)}
						data-option-id={o.id}
						data-symbol={o.symbol}
						data-lane-index={i}
						aria-label={nameFor(set, o.symbol!)}
						aria-disabled={!canSteer}
						style:left="{p?.x ?? 0}px"
						style:top="{p?.y ?? 0}px"
						style:width="{p?.w ?? 80}px"
						style:height="{p?.h ?? 70}px"
						style:visibility={p ? 'visible' : 'hidden'}
						onclick={() => tapSign(o.id)}
					></button>
				{/each}
			{/if}
		</div>
		<div class="bottom">
			{#if set && ctx && !roundDone}
				{#if mState === 'COMPLETE'}
					<GameButton action="next" onclick={next} />
				{:else}
					<div class="controls">
						<button
							class="steer"
							data-steer="left"
							aria-label={sideLabel('drive.left')}
							aria-disabled={!canSteer || lane === 0}
							onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel('drive.left')}
							onclick={() => steer(lane - 1)}
						>
							<svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><path d="M30 10 L14 24 L30 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
						</button>
						<GameButton action="play" onclick={go} />
						<button
							class="steer"
							data-steer="right"
							aria-label={sideLabel('drive.right')}
							aria-disabled={!canSteer || lane === LANES.length - 1}
							onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel('drive.right')}
							onclick={() => steer(lane + 1)}
						>
							<svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><path d="M18 10 L34 24 L18 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
						</button>
						{#if ctx.hintEnabled && mState === 'READY'}
							<GameButton action="hint" size="small" onclick={() => machine?.send({ type: 'HINT' })} />
						{/if}
					</div>
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
		padding: 0 24px 16px;
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
		border-radius: 14px;
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
	.bottom {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 110px;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 28px;
	}
	.steer {
		display: grid;
		place-items: center;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 4px solid var(--border-soft);
		background: var(--surface);
		color: var(--text-primary);
		cursor: pointer;
		transition: transform 150ms ease;
	}
	.steer:active:not([aria-disabled='true']) {
		transform: scale(0.94);
	}
	.steer[aria-disabled='true'] {
		opacity: 0.45;
		cursor: default;
	}
	.steer:focus-visible {
		outline: 5px solid var(--text-primary);
		outline-offset: 4px;
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

	/* WebGL unavailable: the same choices as plain big buttons, so the game still works. */
	.flat-options { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 28px; flex-wrap: wrap; }
	.flat { min-width: 120px; min-height: 120px; font-size: 64px; font-weight: 700; border: 4px solid var(--border-soft); border-radius: var(--radius-xl); background: var(--surface); color: var(--text-primary); cursor: pointer; }
</style>
