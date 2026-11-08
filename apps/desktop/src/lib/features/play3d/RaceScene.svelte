<script lang="ts">
	/**
	 * "Race with friends": Rumi races on a sunny road with two friends. Boost pads with letters or
	 * numbers roll up; driving over the one Rumi names gives a happy VROOM boost.
	 * Nobody ever loses: there is no clock, no position, no score (PR-07). Friends always stay
	 * close and everyone crosses the finish line together. Missing a pad costs nothing: the same
	 * pads simply come again, and after a miss they wait for the child (PR-08, PR-22).
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
	const FRIEND_X = [-5.6, 5.6];
	const START_Z = -44;
	/** Pads slow down from here so there is time to steer. */
	const SLOW_Z = -14;
	/** After a miss, pads stop here and wait for the child. */
	const WAIT_Z = -9;
	/** Pads meet the car's nose here. */
	const MEET_Z = -1.2;
	const BASE_SPEED = 10;
	const SLOW_SPEED = 4;
	const BOOST_SPEED = 22;
	const FEEDBACK_MS = 900;
	const d = durations();
	const scheduler = createScheduler();

	let set = $state<SymbolSet | null>(null);
	let round = $state<ReturnType<typeof createPlay3DRound> | null>(null);
	let index = $state(0);
	let done = $state(0);
	let roundDone = $state(false);

	let machine: ChoiceMachine | null = null;
	let unsubscribers: (() => void)[] = [];
	let mState = $state<ChoiceState>('READY');
	let ctx = $state<ChoiceContext | null>(null);
	let hintId = $state<string | null>(null);

	let lane = $state(1);
	let phase = $state<'idle' | 'drive' | 'wait' | 'boost' | 'finish'>('idle');

	let canvas = $state<HTMLCanvasElement | null>(null);
	let kit: typeof Kit | null = null;
	let stage: Kit.Stage | null = null;
	let ready = $state(false);
	let failed = $state(false);

	let car: Kit.THREE.Group | null = null;
	let friends: { car: Kit.THREE.Group; phase: number }[] = [];
	let carX = LANES[1]!;
	let offset = 0;
	let boostT = 0;
	/** How far the friends have dropped back during a boost; they always catch up. */
	let lag = 0;
	let driving = false;

	interface Pad {
		id: string;
		group: Kit.THREE.Group;
		block: Kit.THREE.Mesh;
		mode: '' | 'burst' | 'bump' | 'glow';
		t: number;
	}
	/** The row of pads for the current question. */
	let row: { z: number; pads: Pad[]; decided: boolean; acted: boolean } | null = null;
	/** Rows already driven over, rolling away behind the car. */
	let leaving: { group: Kit.THREE.Group; z: number }[] = [];
	let finishLine: { group: Kit.THREE.Group; z: number; crossed: boolean } | null = null;
	let scenery: { obj: Kit.THREE.Object3D; base: number; span: number }[] = [];
	let sparkles: { mesh: Kit.THREE.Mesh; life: number; vx: number; vy: number; vz: number }[] = [];
	let spots = $state<Record<string, { x: number; y: number; size: number }>>({});
	let showPads = $state(false);

	const a = $derived<ChoiceActivity | undefined>(round?.activities[index]);
	const lang = $derived($settings.language);
	/** After a miss (or with reduced motion) the pads wait for the child. */
	const assist = () => d.reduced || (ctx?.attempts ?? 0) >= 1;

	function glyphFor(s: SymbolSet, symbol: string): string {
		return s === '123' ? formatNumeral(Number(symbol), $settings.numeralStyle) : symbolDef(s, symbol).glyph;
	}
	function nameFor(s: SymbolSet, symbol: string): string {
		const def = symbolDef(s, symbol);
		if (s === '123') return lang === 'bn-BD' ? def.bn : def.en;
		return lang === 'bn-BD' ? def.bn : s === 'abc' ? def.en : def.glyph;
	}

	// ── 3D ──────────────────────────────────────────────────────────────────
	async function startStage() {
		try {
			kit = await import('#lib/three3d/toyKit.ts');
			await kit.fontsReady();
		} catch {
			failed = true;
			return;
		}
		if (!canvas) return;
		const { THREE } = kit;
		stage = kit.createStage(canvas, { fov: 55, background: '#DDF0FB' });
		stage.scene.fog = new THREE.Fog('#DDF0FB', 32, 62);

		const grass = new THREE.Mesh(new THREE.PlaneGeometry(90, 140), new THREE.MeshStandardMaterial({ color: '#BFE3A5', roughness: 1 }));
		grass.rotation.x = -Math.PI / 2;
		grass.position.set(0, -0.01, -40);
		grass.receiveShadow = true;
		const road = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 140), new THREE.MeshStandardMaterial({ color: '#C9CED6', roughness: 0.95 }));
		road.rotation.x = -Math.PI / 2;
		road.position.set(0, 0, -40);
		road.receiveShadow = true;
		stage.scene.add(grass, road);

		// Red-white kerbs, lane dashes, trees and flags scroll with `offset`.
		const dashMat = new THREE.MeshStandardMaterial({ color: '#ffffff' });
		const dashGeo = new THREE.BoxGeometry(0.18, 0.02, 1.4);
		const kerbGeo = new THREE.BoxGeometry(0.5, 0.12, 2);
		const kerbRed = new THREE.MeshStandardMaterial({ color: '#E5484D' });
		const kerbWhite = new THREE.MeshStandardMaterial({ color: '#ffffff' });
		for (let k = 0; k < 18; k++) {
			for (const x of [-1.3, 1.3, -4.1, 4.1]) {
				const dash = new THREE.Mesh(dashGeo, dashMat);
				dash.position.set(x, 0.01, 0);
				stage.scene.add(dash);
				scenery.push({ obj: dash, base: -k * 4, span: 72 });
			}
		}
		for (let k = 0; k < 36; k++) {
			for (const x of [-7.3, 7.3]) {
				const kerb = new THREE.Mesh(kerbGeo, k % 2 ? kerbRed : kerbWhite);
				kerb.position.set(x, 0.06, 0);
				stage.scene.add(kerb);
				scenery.push({ obj: kerb, base: -k * 2, span: 72 });
			}
		}
		for (const side of [-1, 1]) {
			for (let k = 0; k < 8; k++) {
				const tree = kit.toyTree();
				tree.position.x = side * (10 + (k % 3) * 1.6);
				tree.scale.setScalar(1 + (k % 2) * 0.3);
				stage.scene.add(tree);
				scenery.push({ obj: tree, base: -k * 9 - (side > 0 ? 4.5 : 0), span: 72 });
			}
			for (let k = 0; k < 4; k++) {
				const flag = bunting(kit.TOY_COLORS[(k * 2 + (side > 0 ? 1 : 0)) % 6]!);
				flag.position.x = side * 8.4;
				stage.scene.add(flag);
				scenery.push({ obj: flag, base: -k * 18 - 9, span: 72 });
			}
		}

		car = kit.toyCar('#E5484D');
		stage.scene.add(car);
		// Friends: a blue car with a bear, a yellow car with a bunny-white friend.
		for (const [i, [color, fur]] of ([['#3478D4', '#9B7653'], ['#F2C94C', '#F5EFE6']] as const).entries()) {
			const f = kit.toyCar(color, fur);
			f.position.x = FRIEND_X[i]!;
			stage.scene.add(f);
			friends.push({ car: f, phase: i * 2.1 });
		}

		stage.onFrame(frame);
		stage.setPaused($paused);
		ready = true;
	}

	/** A pole with a little triangle flag for the roadside. */
	function bunting(color: string): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
		pole.position.y = 1.2;
		const shape = new THREE.Shape();
		shape.moveTo(0, 0);
		shape.lineTo(0.9, -0.3);
		shape.lineTo(0, -0.6);
		const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide }));
		flag.position.set(0, 2.35, 0);
		flag.rotation.y = Math.PI / 2;
		g.add(pole, flag);
		return g;
	}

	function checkerTexture(): Kit.THREE.CanvasTexture {
		const { THREE } = kit!;
		const c = document.createElement('canvas');
		c.width = 512;
		c.height = 64;
		const g = c.getContext('2d')!;
		for (let x = 0; x < 16; x++) {
			for (let y = 0; y < 2; y++) {
				g.fillStyle = (x + y) % 2 ? '#263238' : '#ffffff';
				g.fillRect(x * 32, y * 32, 32, 32);
			}
		}
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		return tex;
	}

	function wrapZ(v: number, span: number) {
		const w = (((12 - v) % span) + span) % span;
		return 12 - w;
	}

	function disposeGroup(g: Kit.THREE.Object3D) {
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

	function spawnRow(activity: ChoiceActivity, startZ: number) {
		if (!stage || !kit) return;
		const { THREE } = kit;
		if (row) for (const p of row.pads) leaving.push({ group: p.group, z: p.group.position.z });
		const s = (activity.data as Play3DData).set;
		const pads = activity.options.map((o, i): Pad => {
			const color = kit!.TOY_COLORS[(i * 2 + index) % kit!.TOY_COLORS.length]!;
			const group = new THREE.Group();
			const pad = new THREE.Mesh(
				new THREE.BoxGeometry(2.1, 0.06, 2.6),
				new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.6 })
			);
			pad.position.y = 0.04;
			pad.receiveShadow = true;
			// Chevrons on the pad say "go fast here".
			for (const z of [-0.5, 0.4]) {
				const chev = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.6, 3), new THREE.MeshStandardMaterial({ color: '#ffffff' }));
				chev.rotation.set(-Math.PI / 2, 0, 0);
				chev.scale.set(1, 1, 0.12);
				chev.position.set(0, 0.09, z);
				group.add(chev);
			}
			const block = kit!.toyBlock(glyphFor(s, o.symbol!), color, 1.3);
			block.position.y = 1.6;
			group.add(pad, block);
			group.position.set(LANES[i]!, 0, startZ);
			stage!.scene.add(group);
			return { id: o.id, group, block, mode: '', t: 0 };
		});
		row = { z: startZ, pads, decided: false, acted: false };
		showPads = true;
		placeButtons();
	}

	function spawnFinish() {
		if (!stage || !kit) return;
		const { THREE } = kit;
		const group = new THREE.Group();
		const white = new THREE.MeshStandardMaterial({ color: '#ffffff' });
		for (const x of [-7.4, 7.4]) {
			const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5, 12), white);
			post.position.set(x, 2.5, 0);
			post.castShadow = true;
			group.add(post);
		}
		const banner = new THREE.Mesh(new THREE.BoxGeometry(15, 1.1, 0.2), new THREE.MeshStandardMaterial({ map: checkerTexture() }));
		banner.position.y = 4.6;
		const line = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 1), new THREE.MeshStandardMaterial({ map: checkerTexture() }));
		line.rotation.x = -Math.PI / 2;
		line.position.y = 0.02;
		group.add(banner, line);
		group.position.z = START_Z;
		stage.scene.add(group);
		finishLine = { group, z: START_Z, crossed: false };
	}

	function burst(at: Kit.THREE.Vector3, count: number, colors: readonly string[]) {
		if (!stage || !kit || d.reduced) return;
		const { THREE } = kit;
		for (let i = 0; i < count; i++) {
			const mesh = new THREE.Mesh(
				i % 2 ? new THREE.BoxGeometry(0.22, 0.22, 0.05) : new THREE.OctahedronGeometry(0.16),
				new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: 0.3 })
			);
			mesh.position.copy(at);
			stage.scene.add(mesh);
			const ang = Math.random() * Math.PI * 2;
			const sp = 2 + Math.random() * 4;
			sparkles.push({ mesh, life: 1.4 + Math.random() * 0.8, vx: Math.cos(ang) * sp, vy: 3 + Math.random() * 4, vz: Math.sin(ang) * sp });
		}
	}

	function frame(dt: number, time: number) {
		if (!car) return;
		let speed = driving ? BASE_SPEED : 0;
		if (boostT > 0) {
			boostT = Math.max(0, boostT - dt);
			speed = BOOST_SPEED;
		}
		if (row && !row.decided) {
			if (row.z > SLOW_Z) speed = Math.min(speed, SLOW_SPEED);
			if (!row.acted && assist() && row.z >= WAIT_Z) {
				row.z = WAIT_Z;
				speed = 0;
				if (phase !== 'wait') phase = 'wait';
			} else if (phase === 'wait') {
				phase = 'drive';
			}
		}
		const moved = speed * dt;
		offset += moved;

		if (row) {
			row.z += moved;
			for (const p of row.pads) p.group.position.z = row.z;
			if (!row.decided && row.z >= MEET_Z) {
				row.decided = true;
				showPads = false;
				hideHand();
				const option = a?.options[lane];
				if (option) machine?.send({ type: 'CHOOSE', optionId: option.id });
			}
		}
		for (const l of leaving) {
			l.z += moved;
			l.group.position.z = l.z;
		}
		for (const l of leaving.filter((x) => x.z > 16)) disposeGroup(l.group);
		leaving = leaving.filter((x) => x.z <= 16);
		if (row && row.decided && row.z > 16) {
			for (const p of row.pads) disposeGroup(p.group);
			row = null;
		}
		for (const s of scenery) s.obj.position.z = wrapZ(s.base + offset, s.span);

		// Finish line: everyone crosses together.
		if (finishLine) {
			finishLine.z += moved;
			finishLine.group.position.z = finishLine.z;
			if (!finishLine.crossed && finishLine.z >= -0.5) {
				finishLine.crossed = true;
				crossFinish();
			}
		}

		// Rumi's car.
		const target = LANES[lane]!;
		carX += (target - carX) * Math.min(1, dt * (d.reduced ? 20 : 6));
		car.position.x = carX;
		car.rotation.y = (carX - target) * 0.18;
		car.position.y = d.reduced || speed < 0.5 ? 0 : Math.abs(Math.sin(time * 16)) * 0.05;

		// Friends drift back a little during a boost and always catch up; never far ahead.
		const lagTarget = boostT > 0 ? 3.2 : 0;
		lag += (lagTarget - lag) * Math.min(1, dt * (boostT > 0 ? 1.6 : 0.9));
		const together = phase === 'finish';
		for (const f of friends) {
			const wobble = d.reduced || together ? 0 : Math.sin(time * 0.7 + f.phase) * 1.1;
			f.car.position.z = lag + wobble;
			f.car.position.y = d.reduced || speed < 0.5 ? 0 : Math.abs(Math.sin(time * 16 + f.phase)) * 0.05;
		}

		// Pads: blocks sway gently so the letter keeps facing the child.
		if (row) {
			for (const p of row.pads) {
				const mat = p.block.material as Kit.THREE.MeshStandardMaterial;
				mat.emissive.setRGB(0, 0, 0);
				p.block.position.set(0, 1.6 + (d.reduced ? 0 : Math.sin(time * 2 + p.group.position.x) * 0.12), 0);
				p.block.rotation.set(0, d.reduced ? 0 : Math.sin(time * 1.2 + p.group.position.x) * 0.35, 0);
				p.block.scale.setScalar(1);
				p.block.visible = true;
				if (!p.mode) continue;
				p.t += dt;
				if (p.mode === 'burst') {
					const k = Math.min(1, p.t / 0.35);
					p.block.scale.setScalar(1 + k * 0.6);
					p.block.position.y = 1.6 + k * 1.2;
					if (k >= 1) p.block.visible = false;
				} else if (p.mode === 'bump') {
					const k = Math.min(1, p.t / 0.8);
					const side = p.group.position.x <= 0 ? -1 : 1;
					p.block.position.x = side * Math.sin(k * Math.PI) * 1.4;
					p.block.position.y = 1.6 + Math.sin(k * Math.PI) * 1.2;
					p.block.rotation.z = -side * k * Math.PI * 2;
					if (k >= 1) p.mode = '';
				} else if (p.mode === 'glow') {
					const g = (Math.sin(p.t * 5) + 1) * 0.2;
					mat.emissive.setRGB(g, g * 0.9, g * 0.4);
					p.block.scale.setScalar(1 + g * 0.3);
					if (p.t > 2.4) p.mode = '';
				}
			}
		}

		// Boost sparkles trail behind the car; confetti falls.
		if (boostT > 0 && !d.reduced && Math.random() < 0.6) {
			burst(new kit!.THREE.Vector3(carX + (Math.random() - 0.5), 0.6, 1.5), 1, ['#F2C94C', '#ffffff', '#F28C28']);
		}
		for (const s of sparkles) {
			s.life -= dt;
			s.vy -= 9 * dt;
			s.mesh.position.x += s.vx * dt;
			s.mesh.position.y = Math.max(0.05, s.mesh.position.y + s.vy * dt);
			s.mesh.position.z += s.vz * dt + moved * 0.5;
			s.mesh.rotation.x += dt * 6;
			s.mesh.rotation.y += dt * 4;
		}
		for (const s of sparkles.filter((x) => x.life <= 0)) disposeGroup(s.mesh);
		sparkles = sparkles.filter((x) => x.life > 0);

		// Camera: behind the car; widens a touch during a boost.
		const cam = stage!.camera;
		cam.position.x += (carX * 0.4 - cam.position.x) * Math.min(1, dt * 4);
		cam.position.y = 4.6;
		cam.position.z = 8.8;
		const fov = d.reduced ? 55 : boostT > 0 ? 63 : 55;
		if (Math.abs(cam.fov - fov) > 0.05) {
			cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
			cam.updateProjectionMatrix();
		}
		cam.lookAt(carX * 0.3, 1.4, -10);
		placeButtons();
	}

	function placeButtons() {
		if (!stage || !kit || !canvas || !row) return;
		const next: typeof spots = {};
		for (const p of row.pads) {
			const c = new kit.THREE.Vector3();
			p.block.getWorldPosition(c);
			const s = stage.toScreen(c);
			const top = stage.toScreen(c.clone().add(new kit.THREE.Vector3(0, 0.65, 0)));
			next[p.id] = { x: Math.round(s.x), y: Math.round(s.y), size: Math.round(Math.max(60, Math.abs(s.y - top.y) * 2.4)) };
		}
		const same =
			Object.keys(spots).length === row.pads.length &&
			row.pads.every((p) => {
				const o = spots[p.id];
				const n = next[p.id];
				return o && n && Math.abs(o.x - n.x) < 2 && Math.abs(o.y - n.y) < 2 && Math.abs(o.size - n.size) < 2;
			});
		if (!same) spots = next;
	}

	const padFor = (id: string) => row?.pads.find((p) => p.id === id);
	function animatePad(id: string, mode: Pad['mode']) {
		const p = padFor(id);
		if (p) {
			p.mode = mode;
			p.t = 0;
		}
	}

	// ── Controls ────────────────────────────────────────────────────────────
	const canSteer = $derived(!!set && !roundDone && phase !== 'finish' && phase !== 'idle');

	function steer(to: number) {
		if (!canSteer) return;
		lane = Math.max(0, Math.min(LANES.length - 1, to));
		if (row && !row.decided) row.acted = true;
	}

	function tapPad(id: string) {
		if (!a || !canSteer || !row || row.decided) return;
		const i = a.options.findIndex((o) => o.id === id);
		if (i < 0) return;
		lane = i;
		row.acted = true;
	}

	function onkeydown(e: KeyboardEvent) {
		if (!set || roundDone || $paused) return;
		if (e.key === 'ArrowLeft') steer(lane - 1);
		else if (e.key === 'ArrowRight') steer(lane + 1);
		else if (e.key === 'ArrowUp') steer(lane);
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
				if (effect.correct) {
					animatePad(effect.optionId, 'burst');
					const p = padFor(effect.optionId);
					if (p) burst(new kit!.THREE.Vector3(p.group.position.x, 1.8, p.group.position.z), 26, kit!.TOY_COLORS);
					boostT = d.reduced ? 0 : 2.2;
					phase = 'boost';
				} else {
					animatePad(effect.optionId, 'bump');
				}
				scheduler.after(300, () => m.send({ type: 'ANIM_DONE' }));
				break;
			case 'narrate':
				say(effect.key);
				if (m.state === 'TRY_AGAIN') {
					scheduler.after(FEEDBACK_MS, () => {
						m.send({ type: 'FEEDBACK_DONE' });
						// The same pads come again; after a miss they wait for the child.
						if (a) {
							spawnRow(a, START_Z * 0.7);
							phase = 'drive';
							instruct(a.instructionKey);
						}
					});
				}
				break;
			case 'hint':
				hintId = effect.optionId;
				animatePad(effect.optionId, 'glow');
				showHand([`[data-option-id="${effect.optionId}"]`]);
				scheduler.after(2400, () => (hintId = null));
				break;
			case 'celebrate':
				scheduler.after(d.celebrate, () => m.send({ type: 'CELEBRATION_DONE' }));
				break;
			case 'complete':
				done += 1;
				// Keep racing: the next pads come on their own (no "next" button mid-race).
				scheduler.after(200, next);
				break;
			case 'cancelAll':
				scheduler.cancelAll();
				stopNarration();
				hintId = null;
				break;
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
		const m = createChoiceMachine(activity);
		machine = m;
		let prev: ChoiceState | null = null;
		unsubscribers = [
			m.subscribe((s, c) => {
				mState = s;
				ctx = c;
				if (s === 'CORRECT' && prev !== 'CORRECT') scheduler.after(d.resultMin, () => tryResultShown(m));
				if (s !== 'READY') hideHand();
				prev = s;
			}),
			m.onEffect(runEffect)
		];
		spawnRow(activity, START_Z);
		phase = 'drive';
		instruct(activity.instructionKey);
		if (firstTime('race3d')) scheduler.after(d.reduced ? 1200 : 3200, () => row && !row.decided && showHand([`[data-option-id="${activity.answerId}"]`]));
	}

	function teardown() {
		scheduler.cancelAll();
		for (const u of unsubscribers) u();
		unsubscribers = [];
		machine = null;
	}

	function clearWorld() {
		if (row) for (const p of row.pads) disposeGroup(p.group);
		for (const l of leaving) disposeGroup(l.group);
		for (const s of sparkles) disposeGroup(s.mesh);
		if (finishLine) disposeGroup(finishLine.group);
		row = null;
		leaving = [];
		sparkles = [];
		finishLine = null;
		spots = {};
		showPads = false;
		boostT = 0;
		lag = 0;
	}

	function start(s: SymbolSet) {
		teardown();
		clearWorld();
		set = s;
		lane = 1;
		done = 0;
		round = createPlay3DRound('race3d', s, $settings.difficulty, Date.now() >>> 0);
		index = 0;
		roundDone = false;
		ctx = null;
		phase = 'idle';
		say('race.start', { interrupt: true });
		// "Ready, steady, go!" then everyone starts driving.
		scheduler.after(d.reduced ? 600 : 2600, () => {
			driving = true;
			if (round) load(round.activities[0]!);
		});
	}

	function next() {
		if (!round) return;
		if (index + 1 >= round.activities.length) {
			teardown();
			phase = 'finish';
			setIdlePrompt(null);
			spawnFinish();
			return;
		}
		index += 1;
		load(round.activities[index]!);
	}

	function crossFinish() {
		if (kit && car) {
			burst(new kit.THREE.Vector3(0, 3.5, -1), 70, kit.TOY_COLORS);
			burst(new kit.THREE.Vector3(-5, 3.5, -1), 30, kit.TOY_COLORS);
			burst(new kit.THREE.Vector3(5, 3.5, -1), 30, kit.TOY_COLORS);
		}
		say('race.finish', { interrupt: true });
		scheduler.after(d.reduced ? 1500 : 3200, () => {
			roundDone = true;
			driving = false;
			clearWorld();
		});
	}

	function backToPicker() {
		teardown();
		clearWorld();
		leaveScreen();
		driving = false;
		set = null;
		round = null;
		roundDone = false;
		phase = 'idle';
		instruct('mode.race3d');
	}

	onMount(() => {
		void startStage();
		instruct('mode.race3d');
	});

	const offPause = paused.subscribe((p) => {
		stage?.setPaused(p);
		if (p) {
			scheduler.pause();
			stopNarration();
		} else {
			scheduler.resume();
		}
	});

	onDestroy(() => {
		offPause();
		teardown();
		hideHand();
		leaveScreen();
		stage?.dispose();
		stage = null;
	});

	const sideLabel = (key: 'drive.left' | 'drive.right') => narrationText(key, lang, true);
	const total = $derived(round?.activities.length ?? 5);
</script>

<svelte:window {onkeydown} />

<TopBar onreplay={replayInstruction} />

<section
	class="scene"
	class:paused={$paused}
	data-set={set ?? undefined}
	data-ready={ready}
	data-lane={lane}
	data-phase={phase}
	data-progress={done}
>
	{#if !set}
		<SetPicker onpick={start} />
	{:else if roundDone}
		<div class="done">
			<div class="podium" aria-hidden="true">
				<Mascot state="celebrate" size={220} />
			</div>
			<div class="actions">
				<GameButton action="replay" onclick={() => start(set!)} />
				<GameButton action="choose-game" onclick={backToPicker} />
			</div>
		</div>
	{/if}

	<div class="stage" class:hidden={!set || roundDone}>
		{#if set && round && !roundDone}
			<!-- Journey, not a score: all three cars move together toward the flag. -->
			<div class="journey" aria-hidden="true">
				<div class="track">
					{#each Array.from({ length: total }, (_, i) => i) as i (i)}
						<span class="stop" class:passed={i < done} style:left="{((i + 1) / (total + 1)) * 100}%"></span>
					{/each}
					<span class="cars" style:left="{(done / (total + 1)) * 100 + (phase === 'finish' ? 100 / (total + 1) : 0)}%">
						<span class="mini" style:background="#3478D4"></span>
						<span class="mini me" style:background="#E5484D"></span>
						<span class="mini" style:background="#F2C94C"></span>
					</span>
					<span class="flag">🏁</span>
				</div>
			</div>
		{/if}
		<div class="view" data-answer={a?.answerId}>
			<canvas bind:this={canvas} aria-hidden="true"></canvas>
			{#if failed}
				<p class="fallback">🏎️</p>
			{/if}
			{#if set && a && showPads && !roundDone && phase !== 'finish'}
				{#each a.options as o, i (o.id)}
					{@const p = spots[o.id]}
					<button
						class="tap"
						class:hinted={hintId === o.id}
						data-option-id={o.id}
						data-symbol={o.symbol}
						data-lane-index={i}
						aria-label={nameFor(set, o.symbol!)}
						style:left="{p?.x ?? 0}px"
						style:top="{p?.y ?? 0}px"
						style:width="{p?.size ?? 70}px"
						style:height="{p?.size ?? 70}px"
						style:visibility={p ? 'visible' : 'hidden'}
						onclick={() => tapPad(o.id)}
					></button>
				{/each}
			{/if}
		</div>
		<div class="bottom">
			{#if set && !roundDone}
				<div class="controls">
					<button
						class="steer"
						data-steer="left"
						aria-label={sideLabel('drive.left')}
						aria-disabled={!canSteer || lane === 0}
						onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel('drive.left')}
						onclick={() => steer(lane - 1)}
					>
						<svg viewBox="0 0 48 48" width="60" height="60" aria-hidden="true"><path d="M30 10 L14 24 L30 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</button>
					<button
						class="steer"
						data-steer="right"
						aria-label={sideLabel('drive.right')}
						aria-disabled={!canSteer || lane === LANES.length - 1}
						onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel('drive.right')}
						onclick={() => steer(lane + 1)}
					>
						<svg viewBox="0 0 48 48" width="60" height="60" aria-hidden="true"><path d="M18 10 L34 24 L18 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
					</button>
					{#if ctx?.hintEnabled && mState === 'READY' && phase !== 'finish'}
						<GameButton action="hint" size="small" onclick={() => machine?.send({ type: 'HINT' })} />
					{/if}
				</div>
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
	.journey {
		width: min(560px, 90%);
		padding: 6px 0 2px;
	}
	.track {
		position: relative;
		height: 34px;
	}
	.track::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 15px;
		height: 6px;
		border-radius: 3px;
		background: var(--border-soft);
	}
	.stop {
		position: absolute;
		top: 11px;
		width: 14px;
		height: 14px;
		margin-left: -7px;
		border-radius: 50%;
		border: 3px solid var(--text-secondary);
		background: var(--surface);
	}
	.stop.passed {
		background: var(--text-secondary);
	}
	.cars {
		position: absolute;
		top: 2px;
		display: flex;
		gap: 3px;
		transform: translateX(-50%);
		transition: left 1.2s ease-in-out;
	}
	.mini {
		width: 16px;
		height: 30px;
		border-radius: 6px;
		border: 2px solid var(--text-primary);
	}
	.mini.me {
		height: 32px;
	}
	.flag {
		position: absolute;
		right: -10px;
		top: -2px;
		font-size: 28px;
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
	.fallback {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-size: 80px;
		margin: 0;
	}
	.tap {
		position: absolute;
		transform: translate(-50%, -50%);
		border: 0;
		border-radius: 22%;
		background: transparent;
		cursor: pointer;
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
		gap: 120px;
	}
	.steer {
		display: grid;
		place-items: center;
		width: 104px;
		height: 104px;
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
	@media (prefers-reduced-motion: reduce) {
		.cars {
			transition: none;
		}
	}
	@media (max-width: 700px) {
		.controls {
			gap: 40px;
		}
	}
</style>
