<script lang="ts">
	/**
	 * Shape Sorter (আকৃতি মেলাও): a 3D wooden shape-sorter box. Tap a shape (or drag it) and then
	 * a hole. The matching hole: the shape turns, drops in with a "plop" and Rumi names it. Another
	 * hole: it wobbles, gently bounces back and Rumi says its name (PR-08); after two tries the
	 * right hole glows and the hand points (PR-22). No clock, no score (PR-07). A full box pops its
	 * lid and every shape jumps out. three.js loads only on this screen; without WebGL the same
	 * game runs as big flat buttons.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { createSorterRound, fits, HINT_AFTER, narrationText, SORT_COLORS, SORT_SHAPES, type SortShape, type SorterRound } from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { chime } from '#lib/game/chime.ts';
	import { boing, plop } from '#lib/game/toySounds.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import type * as Kit from '#lib/three3d/toyKit.ts';

	const d = durations();
	const scheduler = createScheduler();
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const HOLE_GAP = 1.75;
	const BOX_Z = -1.3;
	const LID_Y = 1.4;

	// svelte-ignore state_referenced_locally
	let round = $state<SorterRound>(createSorterRound($settings.difficulty, Date.now() >>> 0));
	let inBox = $state<string[]>([]);
	let lifted = $state<string | null>(null);
	let busy = $state(false);
	let done = $state(false);
	let misses = $state<Record<string, number>>({});
	let hintHole = $state<number | null>(null);
	let glowHole = $state<number | null>(null);
	let mascot = $state<MascotAnimation>('wave');
	let tries = $state(0);
	const left = $derived(round.pieces.length - inBox.length);

	// ── 3D ──────────────────────────────────────────────────────────────────
	let canvas = $state<HTMLCanvasElement | null>(null);
	let kit: typeof Kit | null = null;
	let stage: Kit.Stage | null = null;
	let ready = $state(false);
	let failed = $state(false);
	let destroyed = false;
	let confetti: Kit.Confetti | null = null;

	type Tween = { from: Kit.THREE.Vector3; to: Kit.THREE.Vector3; t: number; dur: number; arc: number; spin: number; then?: () => void };
	interface Piece3D {
		id: string;
		shape: SortShape;
		mesh: Kit.THREE.Mesh;
		home: Kit.THREE.Vector3;
		tween: Tween | null;
		wobble: number;
		bob: number;
	}
	let pieces3d: Piece3D[] = [];
	let box: Kit.THREE.Group | null = null;
	let lid: Kit.THREE.Group | null = null;
	let lidOpen = 0;
	let lidTarget = 0;
	let holeGlows: Kit.THREE.Mesh[] = [];
	let holePos: Kit.THREE.Vector3[] = [];
	let spots = $state<Record<string, { x: number; y: number }>>({});
	let drag: { id: string; x0: number; y0: number; moved: boolean; pointer: number } | null = null;
	let frameCount = 0;

	function outline(THREE: typeof Kit.THREE, kind: SortShape, r: number): Kit.THREE.Shape {
		const s = new THREE.Shape();
		const poly = (pts: [number, number][]) => {
			s.moveTo(pts[0]![0], pts[0]![1]);
			for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
			s.closePath();
		};
		if (kind === 'circle') s.absarc(0, 0, r, 0, Math.PI * 2, false);
		else if (kind === 'square') poly([[-r * 0.85, -r * 0.85], [r * 0.85, -r * 0.85], [r * 0.85, r * 0.85], [-r * 0.85, r * 0.85]]);
		else if (kind === 'triangle') poly([0, 1, 2].map((i) => [Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / 3) * r * 1.15, Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / 3) * r * 1.15 - r * 0.1]));
		else if (kind === 'star') poly(Array.from({ length: 10 }, (_, i) => {
			const a = Math.PI / 2 + (i * Math.PI) / 5;
			const rr = i % 2 ? r * 0.5 : r * 1.12;
			return [Math.cos(a) * rr, Math.sin(a) * rr];
		}));
		else {
			s.moveTo(0, -r * 0.95);
			s.bezierCurveTo(r * 0.25, -r * 0.62, r * 1.05, -r * 0.2, r * 1.0, r * 0.32);
			s.bezierCurveTo(r * 0.95, r * 0.9, r * 0.22, r * 1.0, 0, r * 0.5);
			s.bezierCurveTo(-r * 0.22, r * 1.0, -r * 0.95, r * 0.9, -r * 1.0, r * 0.32);
			s.bezierCurveTo(-r * 1.05, -r * 0.2, -r * 0.25, -r * 0.62, 0, -r * 0.95);
		}
		return s;
	}

	async function startStage() {
		try {
			kit = await import('#lib/three3d/toyKit.ts');
		} catch {
			failed = true;
			return;
		}
		if (!canvas || destroyed) return;
		const { THREE } = kit;
		try {
			stage = kit.createStage(canvas, { fov: 40, background: '#FFF1DE', skyTop: '#FFE2C2' });
		} catch {
			failed = true;
			return;
		}
		stage.camera.position.set(0, 8.4, 8.8);
		stage.camera.lookAt(0, 0.5, 0.1);

		// A wooden table in a warm playroom.
		const wood = stage.surface('wood');
		const table = new THREE.Mesh(
			new THREE.BoxGeometry(30, 0.4, 16),
			new THREE.MeshStandardMaterial({ color: '#E2B98A', roughness: 0.7, normalMap: wood.normalMap, roughnessMap: wood.roughnessMap })
		);
		table.position.y = -0.2;
		table.receiveShadow = true;
		stage.scene.add(table);
		const rug = new THREE.Mesh(new THREE.CircleGeometry(4.4, 48), new THREE.MeshStandardMaterial({ color: '#F7D6E4', roughness: 1 }));
		rug.rotation.x = -Math.PI / 2;
		rug.position.set(0, 0.005, 2);
		rug.receiveShadow = true;
		stage.scene.add(rug);

		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused);
		buildRound();
		ready = true;
	}

	function disposeObj(o: Kit.THREE.Object3D) {
		stage?.scene.remove(o);
		o.traverse((c) => {
			const m = c as Kit.THREE.Mesh;
			if (!m.isMesh) return;
			m.geometry.dispose();
			for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
		});
	}

	function buildRound() {
		if (!stage || !kit) return;
		const { THREE } = kit;
		for (const p of pieces3d) disposeObj(p.mesh);
		if (box) disposeObj(box);
		pieces3d = [];
		holeGlows = [];
		const n = round.holes.length;
		const width = n * HOLE_GAP + 0.9;
		const depth = 2.5;
		holePos = round.holes.map((_, i) => new THREE.Vector3((i - (n - 1) / 2) * HOLE_GAP, LID_Y, BOX_Z));

		box = new THREE.Group();
		const plastic = stage.surface('plastic');
		const bodyMat = new THREE.MeshStandardMaterial({ color: '#5EB5E8', roughness: 0.45, normalMap: plastic.normalMap });
		// Hollow body (four walls + floor) so the holes look into a dark inside.
		const wall = (w: number, h: number, dd: number, x: number, y: number, z: number) => {
			const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), bodyMat);
			m.position.set(x, y, z);
			m.castShadow = true;
			m.receiveShadow = true;
			box!.add(m);
		};
		const H = LID_Y - 0.25;
		wall(width, H, 0.18, 0, H / 2, BOX_Z + depth / 2 - 0.09);
		wall(width, H, 0.18, 0, H / 2, BOX_Z - depth / 2 + 0.09);
		wall(0.18, H, depth, -width / 2 + 0.09, H / 2, BOX_Z);
		wall(0.18, H, depth, width / 2 - 0.09, H / 2, BOX_Z);
		const inside = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.3, depth - 0.3), new THREE.MeshStandardMaterial({ color: '#21364A', roughness: 1 }));
		inside.rotation.x = -Math.PI / 2;
		// Just under the lid, so every hole looks into a dark box.
		inside.position.set(0, H - 0.04, BOX_Z);
		box.add(inside);
		// Colour stripes on the front, like a real toy.
		round.holes.forEach((_, i) => {
			const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20), new THREE.MeshStandardMaterial({ color: Object.values(SORT_COLORS)[i % 6], roughness: 0.4 }));
			dot.rotation.x = Math.PI / 2;
			dot.position.set(holePos[i]!.x, H * 0.45, BOX_Z + depth / 2 + 0.01);
			box!.add(dot);
		});

		// The lid: a thick slab with real shape-cut holes (extruded), hinged at the back.
		const slab = new THREE.Shape();
		const hw = width / 2, hd = depth / 2;
		slab.moveTo(-hw, -hd);
		slab.lineTo(hw, -hd);
		slab.lineTo(hw, hd);
		slab.lineTo(-hw, hd);
		slab.closePath();
		round.holes.forEach((shape, i) => {
			const path = new THREE.Path(outline(THREE, shape, 0.6).getPoints(28).map((p) => p.add(new THREE.Vector2(holePos[i]!.x, 0))));
			slab.holes.push(path);
		});
		const lidGeo = new THREE.ExtrudeGeometry(slab, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 20 });
		lidGeo.rotateX(-Math.PI / 2);
		// Hinge at the back edge: shift so the pivot sits on the back.
		lidGeo.translate(0, 0, hd);
		const lidMesh = new THREE.Mesh(lidGeo, new THREE.MeshStandardMaterial({ color: '#FFD45C', roughness: 0.4, normalMap: plastic.normalMap }));
		lidMesh.castShadow = true;
		lidMesh.receiveShadow = true;
		lid = new THREE.Group();
		lid.position.set(0, H, BOX_Z - hd);
		lid.add(lidMesh);
		box.add(lid);
		// Soft glow outlines for hints (hidden until needed).
		round.holes.forEach((shape, i) => {
			const glow = new THREE.Mesh(new THREE.ShapeGeometry(outline(THREE, shape, 0.75), 20), new THREE.MeshBasicMaterial({ color: '#FFF59A', transparent: true, opacity: 0, depthWrite: false }));
			glow.rotation.x = -Math.PI / 2;
			glow.position.set(holePos[i]!.x, 0.3, hd);
			lid!.add(glow);
			holeGlows.push(glow);
		});
		lidOpen = lidTarget = 0;
		lid.rotation.x = 0;
		stage.scene.add(box);

		// The pieces wait on the rug in one or two rows.
		const perRow = round.pieces.length > 5 ? Math.ceil(round.pieces.length / 2) : round.pieces.length;
		pieces3d = round.pieces.map((p, i) => {
			const geo = new THREE.ExtrudeGeometry(outline(THREE, p.shape, 0.5), { depth: 0.34, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 3, curveSegments: 20 });
			geo.rotateX(-Math.PI / 2);
			geo.translate(0, 0.07, 0);
			const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: SORT_COLORS[p.color], roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3 }));
			mesh.castShadow = true;
			const row = Math.floor(i / perRow);
			const inRow = row === 0 ? Math.min(perRow, round.pieces.length) : round.pieces.length - perRow;
			const col = i % perRow;
			const home = new THREE.Vector3((col - (inRow - 1) / 2) * 1.85, 0.02, 1.5 + row * 1.6);
			mesh.position.copy(home);
			mesh.rotation.y = (i % 3 - 1) * 0.35;
			stage!.scene.add(mesh);
			return { id: p.id, shape: p.shape, mesh, home, tween: null, wobble: 0, bob: i * 0.7 };
		});
		updateSpots();
	}

	const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

	function frame(dt: number, t: number) {
		for (const p of pieces3d) {
			if (p.tween) {
				const tw = p.tween;
				tw.t = Math.min(1, tw.t + dt / tw.dur);
				const k = ease(tw.t);
				p.mesh.position.lerpVectors(tw.from, tw.to, k);
				p.mesh.position.y += Math.sin(k * Math.PI) * tw.arc;
				p.mesh.rotation.y += tw.spin * dt;
				if (tw.t >= 1) {
					p.tween = null;
					tw.then?.();
				}
			} else if (lifted === p.id && drag?.id !== p.id) {
				p.mesh.position.y = 1.1 + Math.sin(t * 3 + p.bob) * 0.08;
			}
			if (p.wobble > 0) {
				p.wobble = Math.max(0, p.wobble - dt);
				p.mesh.rotation.z = Math.sin(p.wobble * 28) * 0.28 * p.wobble;
			} else p.mesh.rotation.z = 0;
		}
		// Lid hinge.
		lidOpen += (lidTarget - lidOpen) * Math.min(1, dt * 6);
		if (lid) lid.rotation.x = -lidOpen;
		holeGlows.forEach((g, i) => {
			const on = hintHole === i || glowHole === i;
			const m = g.material as Kit.THREE.MeshBasicMaterial;
			m.opacity = on ? 0.45 + Math.sin(t * 6) * 0.25 : Math.max(0, m.opacity - dt * 2);
		});
		confetti?.update(dt);
		if (++frameCount % 3 === 0) updateSpots();
	}

	function updateSpots() {
		if (!stage) return;
		const next: Record<string, { x: number; y: number }> = {};
		for (const p of pieces3d) if (p.mesh.visible) next[p.id] = stage.toScreen(p.mesh.position.clone().setY(p.mesh.position.y + 0.2));
		holePos.forEach((h, i) => (next[`hole-${i}`] = stage!.toScreen(h)));
		spots = next;
	}

	// ── play ────────────────────────────────────────────────────────────────
	const piece3d = (id: string) => pieces3d.find((p) => p.id === id);
	const pieceData = (id: string) => round.pieces.find((p) => p.id === id)!;

	function tween(p: Piece3D, to: Kit.THREE.Vector3, dur: number, arc: number, then?: () => void, spin = 0) {
		p.tween = { from: p.mesh.position.clone(), to, t: 0, dur: d.reduced ? Math.min(dur, 0.15) : dur, arc: d.reduced ? 0 : arc, spin, then };
	}

	function pick(id: string) {
		if (busy || done || inBox.includes(id)) return;
		hideHand();
		if (lifted && lifted !== id) {
			const prev = piece3d(lifted);
			if (prev) tween(prev, prev.home.clone(), 0.35, 0.3);
		}
		lifted = id;
		const p = piece3d(id);
		if (p) tween(p, p.home.clone().setY(1.1), 0.3, 0);
		speakLabel(`sorter.shape.${pieceData(id).shape}`);
		setIdlePrompt('sorter.pick');
	}

	function tapHole(i: number) {
		if (busy || done) return;
		if (!lifted) {
			glowHole = i;
			scheduler.after(1200, () => glowHole === i && (glowHole = null));
			say(`sorter.hole.${round.holes[i]}`, { interrupt: true });
			return;
		}
		drop(lifted, i);
	}

	function drop(id: string, i: number) {
		const piece = pieceData(id);
		const hole = round.holes[i]!;
		const p = piece3d(id);
		busy = true;
		hideHand();
		tries += 1;
		const above = holePos[i] ? holePos[i]!.clone().setY(LID_Y + 1.1) : null;
		const finish = (ok: boolean) => {
			if (ok) {
				lifted = null;
				inBox = [...inBox, id];
				hintHole = null;
				plop();
				chime();
				mascot = 'celebrate';
				say(`sorter.shape.${piece.shape}`, { interrupt: true });
				say('sorter.plop');
				if (holePos[i]) confetti?.burst(holePos[i]!.clone().setY(LID_Y + 0.4), 12, undefined, { speed: 0.4, up: 0.6, size: 0.7 });
				stage?.feedback(!d.reduced);
				scheduler.after(900, () => (mascot = 'idle'));
				busy = false;
				if (inBox.length === round.pieces.length) boxFull();
				else setIdlePrompt('sorter.start');
			} else {
				boing();
				mascot = 'encourage';
				misses = { ...misses, [id]: (misses[id] ?? 0) + 1 };
				say(`sorter.is.${piece.shape}`, { interrupt: true });
				const back = () => {
					busy = false;
					lifted = id;
					mascot = 'idle';
					if ((misses[id] ?? 0) >= HINT_AFTER) {
						hintHole = round.holes.indexOf(piece.shape);
						scheduler.after(400, () => showHand([`[data-hole="${hintHole}"]`]));
					}
				};
				if (p) {
					p.wobble = 0.7;
					scheduler.after(d.reduced ? 100 : 450, () => tween(p, p.home.clone().setY(1.1), 0.5, 0.6, back));
				} else back();
			}
		};
		if (!p || !above) return finish(fits(piece.shape, hole));
		tween(p, above, 0.5, 0.7, () => {
			if (!fits(piece.shape, hole)) return finish(false);
			// Turn to line up with the hole, then drop through.
			p.mesh.rotation.y = 0;
			tween(p, holePos[i]!.clone().setY(0.3), 0.35, 0, () => {
				p.mesh.visible = false;
				finish(true);
			});
		});
	}

	function boxFull() {
		setIdlePrompt(null);
		say('sorter.full');
		scheduler.after(d.reduced ? 300 : 1400, () => {
			lidTarget = 1.9;
			chime('big');
			confetti?.burst(new kit!.THREE.Vector3(0, LID_Y + 0.5, BOX_Z), 60);
			// Every shape jumps out and lands back on the rug.
			pieces3d.forEach((p, k) => {
				scheduler.after(d.reduced ? 0 : 250 + k * 140, () => {
					p.mesh.position.set(holePos[k % holePos.length]?.x ?? 0, 0.8, BOX_Z);
					p.mesh.visible = true;
					tween(p, p.home.clone(), 0.9, 3, undefined, 6);
				});
			});
			scheduler.after(d.reduced ? 500 : 2600, () => {
				done = true;
				mascot = 'celebrate';
			});
		});
		if (failed) done = true;
	}

	function newRound() {
		scheduler.cancelAll();
		hideHand();
		round = createSorterRound($settings.difficulty, (Date.now() + 7) >>> 0);
		inBox = [];
		lifted = null;
		busy = false;
		done = false;
		misses = {};
		hintHole = null;
		tries = 0;
		mascot = 'wave';
		buildRound();
		instruct('sorter.start');
		setIdlePrompt('sorter.start');
	}

	// Drag a shape straight to a hole (tap-tap also works; keyboard uses Enter).
	function onPieceDown(e: PointerEvent, id: string) {
		if (busy || done) return;
		e.preventDefault();
		pick(id);
		drag = { id, x0: e.clientX, y0: e.clientY, moved: false, pointer: e.pointerId };
		window.addEventListener('pointermove', onDragMove);
		window.addEventListener('pointerup', onDragUp, { once: true });
	}
	function onDragMove(e: PointerEvent) {
		if (!drag || !stage || !kit || !canvas) return;
		if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 12) drag.moved = true;
		if (!drag.moved) return;
		const p = piece3d(drag.id);
		if (!p) return;
		p.tween = null;
		const r = canvas.getBoundingClientRect();
		const ndc = new kit.THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
		const ray = new kit.THREE.Raycaster();
		ray.setFromCamera(ndc, stage.camera);
		const hit = new kit.THREE.Vector3();
		if (ray.ray.intersectPlane(new kit.THREE.Plane(new kit.THREE.Vector3(0, 1, 0), -1.6), hit)) p.mesh.position.set(hit.x, 1.6, hit.z);
	}
	function onDragUp() {
		window.removeEventListener('pointermove', onDragMove);
		const g = drag;
		drag = null;
		if (!g || !g.moved) return;
		const p = piece3d(g.id);
		if (!p) return;
		let best = -1;
		let bestD = 1.1;
		holePos.forEach((h, i) => {
			const dd = Math.hypot(h.x - p.mesh.position.x, h.z - p.mesh.position.z);
			if (dd < bestD) {
				bestD = dd;
				best = i;
			}
		});
		if (best >= 0) drop(g.id, best);
		else tween(p, p.home.clone().setY(1.1), 0.4, 0.3);
	}

	onMount(() => {
		void startStage();
		instruct('sorter.start');
		setIdlePrompt('sorter.start');
		if (firstTime('sorter')) {
			scheduler.after(d.reduced ? 1500 : 4200, () => {
				const p = round.pieces[0]!;
				if (!lifted && inBox.length === 0) showHand([`[data-piece="${p.id}"]`, `[data-hole="${round.holes.indexOf(p.shape)}"]`]);
			});
		}
	});

	const offPause = paused.subscribe((p) => {
		stage?.setPaused(p);
		if (p) {
			scheduler.pause();
			stopNarration();
		} else scheduler.resume();
	});

	onDestroy(() => {
		destroyed = true;
		offPause();
		scheduler.cancelAll();
		window.removeEventListener('pointermove', onDragMove);
		hideHand();
		leaveScreen();
		confetti?.dispose();
		stage?.dispose();
		stage = null;
	});

	const SVG: Record<SortShape, string> = {
		circle: 'M50 10a40 40 0 1 1 0 80a40 40 0 1 1 0-80Z',
		square: 'M15 15h70v70H15Z',
		triangle: 'M50 10 92 86H8Z',
		star: 'M50 6l12 30 32 2-25 20 9 32-28-18-28 18 9-32L6 38l32-2Z',
		heart: 'M50 88C20 66 8 50 8 33 8 20 18 11 30 11c9 0 16 5 20 12 4-7 11-12 20-12 12 0 22 9 22 22 0 17-12 33-42 55Z'
	};
</script>

<TopBar onreplay={() => say(lifted ? 'sorter.pick' : 'sorter.start', { interrupt: true })} />

<section class="sorter" class:paused={$paused} data-ready={ready || failed} data-left={left} data-lifted={lifted ?? ''} data-done={done} data-tries={tries} data-busy={busy} data-hint={hintHole ?? ''}>
	<div class="view game-viewport">
		<canvas bind:this={canvas} aria-hidden="true"></canvas>
		{#if failed}
			<div class="flat">
				<div class="flat-holes">
					{#each round.holes as h, i (h)}
						<button class="flat-hole" class:hint={hintHole === i} data-hole={i} data-hole-shape={h} aria-label={label(`sorter.hole.${h}`)} onclick={() => tapHole(i)}>
							<svg viewBox="0 0 100 100" aria-hidden="true"><path d={SVG[h]} fill="#21364A" /></svg>
						</button>
					{/each}
				</div>
				<div class="flat-pieces">
					{#each round.pieces as p (p.id)}
						{#if !inBox.includes(p.id)}
							<button class="flat-piece" class:lifted={lifted === p.id} data-piece={p.id} data-shape={p.shape} aria-label={label(`sorter.shape.${p.shape}`)} onclick={() => pick(p.id)}>
								<svg viewBox="0 0 100 100" aria-hidden="true"><path d={SVG[p.shape]} fill={SORT_COLORS[p.color]} stroke="#263238" stroke-width="4" /></svg>
							</button>
						{/if}
					{/each}
				</div>
			</div>
		{:else if ready}
			{#each round.holes as h, i (h)}
				{@const s = spots[`hole-${i}`]}
				{#if s}
					<button
						class="tap hole"
						data-hole={i}
						data-hole-shape={h}
						aria-label={label(`sorter.hole.${h}`)}
						style:left="{s.x}px"
						style:top="{s.y}px"
						onclick={() => tapHole(i)}
					></button>
				{/if}
			{/each}
			{#each round.pieces as p (p.id)}
				{@const s = spots[p.id]}
				{#if s && !inBox.includes(p.id)}
					<button
						class="tap piece"
						class:lifted={lifted === p.id}
						data-piece={p.id}
						data-shape={p.shape}
						aria-label={label(`sorter.shape.${p.shape}`)}
						style:left="{s.x}px"
						style:top="{s.y}px"
						onpointerdown={(e) => onPieceDown(e, p.id)}
						onclick={(e) => e.detail === 0 && pick(p.id)}
					></button>
				{/if}
			{/each}
		{/if}
		<div class="rumi"><Mascot state={mascot} size={120} /></div>
		{#if done}
			<div class="done">
				<GameButton action="replay" onclick={newRound} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		{/if}
	</div>
</section>

<style>
	.sorter {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 0 24px 16px;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.view {
		position: relative;
		flex: 1;
		min-height: 320px;
		border-radius: var(--radius-xl);
		overflow: hidden;
		touch-action: none;
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
		width: 104px;
		height: 96px;
		transform: translate(-50%, -50%);
		border: 0;
		border-radius: 24px;
		background: transparent;
		cursor: pointer;
	}
	.tap.hole {
		width: 110px;
		height: 84px;
	}
	.tap.piece {
		cursor: grab;
	}
	.tap:focus-visible {
		outline: 5px solid var(--text-primary);
		outline-offset: 2px;
	}
	.rumi {
		position: absolute;
		left: 12px;
		bottom: 8px;
		pointer-events: none;
	}
	.done {
		position: absolute;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		display: flex;
		gap: 22px;
		padding: 14px 20px;
		border-radius: var(--radius-xl);
		background: rgba(255, 255, 255, 0.85);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
	}
	/* WebGL unavailable: the same game as big flat buttons. */
	.flat {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 40px;
		background: #fff1de;
	}
	.flat-holes {
		display: flex;
		gap: 18px;
		padding: 18px 26px;
		border-radius: 26px;
		background: #ffd45c;
	}
	.flat-pieces {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 18px;
	}
	.flat-hole,
	.flat-piece {
		width: 110px;
		height: 110px;
		padding: 10px;
		border: 4px solid transparent;
		border-radius: 24px;
		background: rgba(255, 255, 255, 0.5);
		cursor: pointer;
	}
	.flat-piece.lifted {
		border-color: var(--text-primary);
		transform: translateY(-10px);
	}
	.flat-hole.hint {
		border-color: #fff59a;
		box-shadow: 0 0 20px #fff59a;
	}
</style>
