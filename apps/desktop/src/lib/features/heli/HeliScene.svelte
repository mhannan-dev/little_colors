<script lang="ts">
	/**
	 * Rumi's Helicopter (রুমির হেলিকপ্টার) — one-thumb toy flying (docs/plans/helicopter-game.md).
	 * Hold ⬆ to rise, let go to float down, ◀ ▶ to fly sideways. Nothing can crash: the flight rules
	 * in core lift the helicopter over trees and hills and the ground is a soft landing (PR-07).
	 * Jobs: carry mangoes, water the garden, take a kitten home, fly a friend to the island, landing
	 * on coloured, numbered pads; near the pad it lands by itself. Free-fly mode has no jobs.
	 * three.js loads only on this screen; without WebGL the jobs work as big flat buttons.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		clearance,
		createHeliDay,
		floorAt,
		formatNumeral,
		freshHeli,
		HELI,
		HELI_OBSTACLES,
		HELI_PADS,
		HOME_PAD,
		narrationText,
		nearPad,
		STATION_COLORS,
		stepHeli,
		type HeliInput,
		type HeliJob,
		type HeliState
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, instructAll, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { chime } from '#lib/game/chime.ts';
	import { ANIMAL_CALL, whup } from '#lib/game/toySounds.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import type * as Kit from '#lib/three3d/toyKit.ts';
	import type * as Animals from '#lib/three3d/animals.ts';

	const d = durations();
	const scheduler = createScheduler();
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	/** Lifts the model so its skids touch the ground when the rules say "parked". */
	const MODEL_Y = 1.1 - HELI.ground;

	// svelte-ignore state_referenced_locally
	let day = $state(createHeliDay($settings.difficulty, Date.now() >>> 0));
	let mode = $state<'pick' | 'jobs' | 'free'>('pick');
	/** fly · landing (auto) · deliver · party */
	let phase = $state<'fly' | 'landing' | 'deliver' | 'party'>('fly');
	let jobIndex = $state(0);
	let delivered = $state(0);
	let finished = $state(false);
	let mascot = $state<MascotAnimation>('wave');
	let heli: HeliState = freshHeli();
	let hx = $state(0);
	let hy = $state(heli.y);
	let minClear = $state(Infinity);
	const input: HeliInput = { up: false, x: 0 };
	let held = $state({ up: false, left: false, right: false });
	const job = $derived<HeliJob | undefined>(mode === 'jobs' ? day.jobs[jobIndex] : undefined);
	const goingHome = $derived(mode === 'jobs' && jobIndex >= day.jobs.length);
	const targetX = $derived(mode !== 'jobs' ? null : goingHome ? HOME_PAD : HELI_PADS[job!.pad]!);
	const targetColor = $derived(goingHome ? '#FF8FA3' : job ? STATION_COLORS[job.color].hex : '#ffffff');

	// ── 3D ──
	let canvas = $state<HTMLCanvasElement | null>(null);
	let canvasKey = $state(0);
	let kit: typeof Kit | null = null;
	let animals: typeof Animals | null = null;
	let stage: Kit.Stage | null = null;
	let ready = $state(false);
	let failed = $state(false);
	let destroyed = false;
	let confetti: Kit.Confetti | null = null;
	let disposeSky: (() => void) | null = null;
	const disposers: (() => void)[] = [];

	let heliRoot: Kit.THREE.Group | null = null;
	let yaw: Kit.THREE.Group | null = null;
	let tilt: Kit.THREE.Group | null = null;
	let rotor: Kit.THREE.Object3D | null = null;
	let tailRotor: Kit.THREE.Object3D | null = null;
	let cargo: Kit.THREE.Group | null = null;
	let beacon: Kit.THREE.Mesh | null = null;
	let rotorSpin = 0;
	let whupPhase = 0;
	let camX = 0;
	let camY = 4;
	let landing: { fromX: number; fromY: number; toX: number; t: number } | null = null;
	type Hopper = { obj: Kit.THREE.Object3D; from: Kit.THREE.Vector3; to: Kit.THREE.Vector3; t: number; dur: number; arc: number; then?: () => void };
	let hoppers: Hopper[] = [];
	let loopers: { obj: Kit.THREE.Object3D; base: number; phase: number }[] = [];
	let flowers: Kit.THREE.Object3D[] = [];
	let rain: { mesh: Kit.THREE.Mesh; vy: number }[] = [];
	let raining = 0;
	let receivers: Kit.THREE.Object3D[] = [];
	let lastLandedPad = -1;
	let idleFor = 0;
	let hintShown = false;
	let arrow = $state<'left' | 'right' | null>(null);

	async function startStage() {
		try {
			kit = await import('#lib/three3d/toyKit.ts');
			animals = await import('#lib/three3d/animals.ts');
			await kit.fontsReady();
		} catch {
			failed = true;
			return;
		}
		if (!canvas || destroyed) return;
		const { THREE } = kit;
		try {
			stage = kit.createStage(canvas, { fov: 45, background: '#CFE8F7', skyTop: '#7DB8E8' });
		} catch {
			failed = true;
			return;
		}
		stage.scene.fog = new THREE.Fog('#d6e9f2', 45, 110);
		try {
			disposeSky = await kit.useHdriSky(stage, '/hdri/sky_partly_cloudy_2k.hdr', { background: true, intensity: 0.85 });
		} catch {
			/* painted sky stays */
		}
		if (destroyed || !stage) return;
		buildWorld();
		buildHeli();
		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused || mode === 'pick');
		place(true);
		ready = true;
		if (mode === 'jobs') loadCargo();
	}

	const std = (color: string, roughness = 0.8) => new kit!.THREE.MeshStandardMaterial({ color, roughness });
	function add<T extends Kit.THREE.Object3D>(o: T, x: number, y: number, z: number, parent?: Kit.THREE.Object3D): T {
		o.position.set(x, y, z);
		o.traverse((c) => {
			const m = c as Kit.THREE.Mesh;
			if (m.isMesh) {
				m.castShadow = true;
				m.receiveShadow = true;
			}
		});
		(parent ?? stage!.scene).add(o);
		return o;
	}

	function buildWorld() {
		const { THREE } = kit!;
		const s = stage!;
		const grass = kit!.pbrMaterial('/textures/highway/grass', [52, 16], '#c4e5a0');
		disposers.push(grass.dispose);
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 90), grass.material);
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(80, 0, -25);
		ground.receiveShadow = true;
		s.scene.add(ground);
		// River with the island pad in the middle.
		const water = new THREE.Mesh(new THREE.PlaneGeometry(30, 90), new THREE.MeshPhysicalMaterial({ color: '#4FA3D1', roughness: 0.1, clearcoat: 1 }));
		water.rotation.x = -Math.PI / 2;
		water.position.set(HELI_PADS[2], 0.02, -25);
		s.scene.add(water);
		const island = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.6, 0.3, 32), std('#E8D3A2', 1));
		add(island, HELI_PADS[2], 0.1, -0.5);
		const islandGrass = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 0.32, 32), std('#7CC35A', 1));
		add(islandGrass, HELI_PADS[2], 0.12, -0.5);

		// Pads: home (pink heart) and four job pads (colour + number on a sign facing the camera).
		const pad = (x: number, color: string, glyph: string, y = 0) => {
			const g = new THREE.Group();
			const ring = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.8, 0.14, 40), new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.6 }));
			ring.position.y = 0.07;
			const center = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.16, 40), std('#FFFFFF', 0.5));
			center.position.y = 0.08;
			const h = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshStandardMaterial({ map: kit!.glyphTexture(glyph, color), transparent: true }));
			h.rotation.x = -Math.PI / 2;
			h.position.y = 0.17;
			const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.12), new THREE.MeshStandardMaterial({ map: kit!.glyphTexture(glyph, color), roughness: 0.5 }));
			board.position.set(3.4, 2.1, -1.2);
			const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8), std('#F6EEE0'));
			pole.position.set(3.4, 0.7, -1.2);
			g.add(ring, center, h, board, pole);
			add(g, x, y, 0);
		};
		pad(HOME_PAD, '#FF8FA3', '♥');
		HELI_PADS.forEach((x, i) => pad(x, STATION_COLORS[day.pads[i]!.color].hex, num(day.pads[i]!.number), i === 2 ? 0.27 : 0));

		// Trees, palms and hills exactly where the flight rules expect them.
		for (const o of HELI_OBSTACLES) {
			if (o.kind === 'hill') {
				const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std('#6DB35E', 1));
				hill.scale.set(o.halfWidth, o.top, 6);
				add(hill, o.x, 0, -2);
			} else if (o.kind === 'tree') {
				const g = new THREE.Group();
				const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, o.top - 2.2, 10), std('#7A5A44'));
				trunk.position.y = (o.top - 2.2) / 2;
				g.add(trunk);
				for (const [x, y, r] of [[0, o.top - 1.5, 1.6], [-0.9, o.top - 2.2, 1.1], [0.9, o.top - 2.1, 1.2]] as const) {
					const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ color: '#3F8F4E', roughness: 0.9, flatShading: true }));
					leaf.position.set(x, y, 0);
					g.add(leaf);
				}
				add(g, o.x, 0, 0);
			} else {
				const g = new THREE.Group();
				const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, o.top - 0.4, 8), std('#8B6B4E'));
				trunk.position.y = (o.top - 0.4) / 2;
				g.add(trunk);
				for (let k = 0; k < 7; k++) {
					const pivot = new THREE.Group();
					pivot.rotation.y = (k / 7) * Math.PI * 2;
					const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.32, 2.4, 4), std('#3E8E4A'));
					leaf.scale.set(1, 1, 0.25);
					leaf.position.set(1, o.top - 0.6, 0);
					leaf.rotation.z = -1.25;
					pivot.add(leaf);
					g.add(pivot);
				}
				add(g, o.x, 0, 0);
			}
		}
		// Background: village houses, distant hills, puffy clouds.
		const walls = ['#F1D7A8', '#E8C1A0', '#F5E6C8', '#D9E4C3'];
		for (let k = 0; k < 14; k++) {
			const hgrp = new THREE.Group();
			const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.4), std(walls[k % 4]!));
			body.position.y = 1;
			const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.3, 4), new THREE.MeshStandardMaterial({ color: k % 3 ? '#8E9AA6' : '#C8453C', metalness: 0.4, roughness: 0.45 }));
			roof.rotation.y = Math.PI / 4;
			roof.position.y = 2.65;
			hgrp.add(body, roof);
			const x = -10 + k * 13;
			if (Math.abs(x - HELI_PADS[2]) < 16) continue;
			add(hgrp, x, 0, -14 - (k % 3) * 4);
		}
		for (let k = 0; k < 8; k++) {
			const hill = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 12), std('#79B86A', 1));
			hill.scale.set(1.5, 0.45, 1);
			add(hill, -20 + k * 28, 0, -45);
		}
		for (let k = 0; k < 12; k++) {
			const cloud = new THREE.Group();
			for (const [x, y, r] of [[0, 0, 1.4], [1.3, -0.2, 1.1], [-1.3, -0.2, 1], [0.5, 0.6, 1]] as const) {
				const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1 }));
				puff.position.set(x, y, 0);
				cloud.add(puff);
			}
			cloud.traverse((c) => ((c as Kit.THREE.Mesh).castShadow = false));
			stage!.scene.add(cloud);
			cloud.position.set(-10 + k * 15, 11 + (k % 3) * 1.8, -8 - (k % 2) * 6);
			loopers.push({ obj: cloud, base: cloud.position.x, phase: k });
		}
		// Beacon: a soft light column over the pad to fly to.
		beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 22, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#FFF59A', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
		beacon.position.y = 11;
		beacon.visible = false;
		s.scene.add(beacon);
	}

	function buildHeli() {
		const { THREE } = kit!;
		const plastic = stage!.surface('plastic');
		const paint = (c: string) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, normalMap: plastic.normalMap });
		heliRoot = new THREE.Group();
		yaw = new THREE.Group();
		tilt = new THREE.Group();
		heliRoot.add(yaw);
		yaw.add(tilt);
		const body = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), paint('#F2C94C'));
		body.scale.set(1.45, 1, 1);
		const glass = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 18, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: '#BFE7FA', roughness: 0.05, transparent: true, opacity: 0.45, clearcoat: 1 }));
		glass.rotation.y = -Math.PI / 2;
		glass.scale.set(1, 0.95, 1.1);
		glass.position.set(0.72, 0.18, 0);
		const stripe = new THREE.Mesh(new THREE.TorusGeometry(1.01, 0.07, 8, 32), paint('#E5484D'));
		stripe.rotation.y = Math.PI / 2;
		stripe.scale.set(1, 1, 1);
		stripe.position.x = -0.3;
		// Rumi in the cockpit.
		const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), std('#E3B48A', 0.7));
		head.position.set(0.55, 0.22, 0);
		const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), std('#FFF1E0'));
		muzzle.position.set(0.86, 0.14, 0);
		for (const z of [-0.24, 0.24]) {
			const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), std('#E3B48A', 0.7));
			ear.position.set(0.5, 0.52, z);
			const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), std('#1E1E28', 0.3));
			eye.position.set(0.86, 0.3, z * 0.55);
			tilt.add(ear, eye);
		}
		const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, 2.6, 12), paint('#F2C94C'));
		boom.rotation.z = Math.PI / 2;
		boom.position.set(-2.4, 0.15, 0);
		const fin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.08), paint('#E5484D'));
		fin.position.set(-3.6, 0.55, 0);
		fin.rotation.z = -0.25;
		tailRotor = new THREE.Group();
		for (const r of [0, Math.PI / 2]) {
			const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 0.03), std('#2E2E38', 0.4));
			blade.rotation.z = r;
			tailRotor.add(blade);
		}
		tailRotor.position.set(-3.6, 0.55, 0.12);
		const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.45, 10), std('#2E2E38', 0.4));
		mast.position.y = 1.1;
		rotor = new THREE.Group();
		for (const r of [0, Math.PI / 2]) {
			const blade = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.05, 0.28), std('#3A3F47', 0.4));
			blade.rotation.y = r;
			rotor.add(blade);
		}
		const hub = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), paint('#E5484D'));
		rotor.add(hub);
		rotor.position.y = 1.35;
		tilt.add(body, glass, stripe, head, muzzle, boom, fin, tailRotor, mast, rotor);
		for (const z of [-0.62, 0.62]) {
			const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), std('#2E2E38', 0.4));
			skid.rotation.z = Math.PI / 2;
			skid.position.set(0, -1.05, z);
			tilt.add(skid);
			for (const x of [-0.6, 0.6]) {
				const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), std('#2E2E38', 0.4));
				strut.position.set(x, -0.8, z * 0.85);
				tilt.add(strut);
			}
		}
		// Cargo hangs under the helicopter in a basket.
		cargo = new THREE.Group();
		const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), std('#8A6A52'));
		rope.position.y = -1.2;
		cargo.add(rope);
		tilt.add(cargo);
		add(heliRoot, heli.x, heli.y + MODEL_Y, 0);
	}

	/** Fill the hanging basket for the current job (mangoes, a water bucket, a kitten, a rabbit). */
	function loadCargo() {
		if (!cargo || !kit || !animals) return;
		const { THREE } = kit;
		while (cargo.children.length > 1) cargo.remove(cargo.children[1]!);
		const j = job;
		if (!j) return;
		const basket = new THREE.Group();
		basket.name = 'basket';
		const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.45, 16, 1, true), new THREE.MeshStandardMaterial({ color: j.cargo === 'water' ? '#5EB5E8' : '#C79A55', roughness: 0.8, side: THREE.DoubleSide }));
		const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), std('#A97E42'));
		bottom.rotation.x = -Math.PI / 2;
		bottom.position.y = -0.22;
		basket.add(b, bottom);
		if (j.cargo === 'mangoes') {
			for (let i = 0; i < j.count; i++) {
				const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#FFB627', roughness: 0.35, clearcoat: 0.5 }));
				m.scale.set(0.85, 1.1, 0.85);
				m.name = 'mango';
				m.position.set((i - (j.count - 1) / 2) * 0.32, 0.12, 0);
				basket.add(m);
			}
		} else if (j.cargo === 'water') {
			const w = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), new THREE.MeshPhysicalMaterial({ color: '#4FA3D1', roughness: 0.05, clearcoat: 1 }));
			w.rotation.x = -Math.PI / 2;
			w.position.y = 0.15;
			basket.add(w);
		} else {
			const a = animals.toyAnimal(j.cargo === 'kitten' ? 'cat' : 'rabbit');
			a.scale.setScalar(0.65);
			a.position.y = -0.15;
			a.rotation.y = Math.PI / 2;
			a.name = 'passenger';
			basket.add(a);
		}
		basket.position.y = -2.1;
		cargo.add(basket);
		// Someone waits at the pad: villagers, a flower bed, the mother cat, the island rabbits.
		for (const r of receivers) stage?.scene.remove(r);
		receivers = [];
		flowers = [];
		const px = HELI_PADS[j.pad]!;
		const z = -2.6;
		if (j.cargo === 'water') {
			const bed = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 1.6), std('#8A5A3C', 1));
			receivers.push(add(bed, px - 0.5, 0.15, z));
			for (let k = 0; k < 7; k++) {
				const f = new THREE.Group();
				const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6), std('#4E9F68'));
				stem.position.y = 0.4;
				const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), std(['#FF8FA3', '#FFD166', '#C3A6FF', '#FFFFFF'][k % 4]!, 0.6));
				bloom.position.y = 0.85;
				f.add(stem, bloom);
				f.scale.setScalar(0.25);
				receivers.push(add(f, px - 2.6 + k * 0.7, 0.3, z));
				flowers.push(f);
			}
		} else {
			const kinds: Animals.ToyAnimalKind[] = j.cargo === 'kitten' ? ['cat'] : j.cargo === 'friend' ? ['rabbit', 'rabbit'] : ['dog', 'goat'];
			kinds.forEach((k, i) => {
				const a = animals!.toyAnimal(k);
				a.scale.setScalar(k === 'cat' ? 1.5 : 1.3);
				receivers.push(add(a, px - 1.2 + i * 1.6, j.pad === 2 ? 0.28 : 0, z));
			});
		}
	}

	const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

	function place(snap = false) {
		if (!stage || !heliRoot) return;
		heliRoot.position.set(heli.x, heli.y + MODEL_Y, 0);
		const tx = heli.x + heli.face * 3;
		const ty = Math.max(3.5, heli.y * 0.6 + 3);
		camX = snap ? tx : camX + (tx - camX) * 0.05;
		camY = snap ? ty : camY + (ty - camY) * 0.05;
		stage.camera.position.set(camX, camY + 2.6, 16.5);
		stage.camera.lookAt(camX, camY, -1);
	}

	function frame(dt: number, t: number) {
		if (!heliRoot || !yaw || !tilt) return;
		if (phase === 'fly' && mode !== 'pick') {
			heli = stepHeli(heli, input, dt);
			minClear = Math.min(minClear, clearance(heli));
			const moving = input.up || input.x !== 0;
			idleFor = moving ? 0 : idleFor + dt;
			if (idleFor > 8 && !hintShown) {
				hintShown = true;
				showHand(['[data-testid="heli-up"]', targetX !== null && targetX < heli.x ? '[data-testid="heli-left"]' : '[data-testid="heli-right"]']);
			}
			if (moving && hintShown) {
				hintShown = false;
				hideHand();
			}
			if (targetX !== null && nearPad(heli, targetX) && heli.vy <= 0.5) startLanding(targetX);
			if (mode === 'free') freeLandingChat();
		} else if (phase === 'landing' && landing) {
			landing.t = Math.min(1, landing.t + dt / (d.reduced ? 0.3 : 1.6));
			const k = ease(landing.t);
			heli = { ...heli, x: landing.fromX + (landing.toX - landing.fromX) * k, y: landing.fromY + (padY(landing.toX) - landing.fromY) * k, vx: 0, vy: 0 };
			if (landing.t >= 1) {
				landing = null;
				landed();
			}
		}
		// Rotor: spins faster with lift; soft "whup" sounds.
		const lift = phase === 'fly' && input.up ? 1 : phase === 'fly' && heli.y > HELI.ground + 0.2 ? 0.6 : mode === 'pick' ? 0.15 : 0.35;
		rotorSpin += (lift * 26 + 4 - rotorSpin) * Math.min(1, dt * 2);
		if (rotor) rotor.rotation.y += rotorSpin * dt;
		if (tailRotor) tailRotor.rotation.z += rotorSpin * 1.4 * dt;
		whupPhase += dt * (3 + rotorSpin * 0.28);
		if (whupPhase >= 1 && mode !== 'pick') {
			whupPhase = 0;
			whup(lift);
		}
		// Face the way we fly; lean gently forward; a little hover bob.
		const yawTarget = heli.face > 0 ? 0 : Math.PI;
		yaw.rotation.y += (yawTarget - yaw.rotation.y) * Math.min(1, dt * 5);
		const lean = -(Math.abs(heli.vx) / HELI.maxVx) * 0.22;
		tilt.rotation.z += (lean - tilt.rotation.z) * Math.min(1, dt * 4);
		hx = Math.round(heli.x * 10) / 10;
		hy = Math.round(heli.y * 10) / 10;
		place();
		heliRoot.position.y += heli.y > HELI.ground + 0.3 && !d.reduced ? Math.sin(t * 2.4) * 0.06 : 0;
		if (cargo) cargo.rotation.z = Math.sin(t * 1.8) * 0.05 - tilt.rotation.z * 0.6;

		// Beacon over the target pad, and an edge arrow when it's off screen.
		if (beacon) {
			beacon.visible = targetX !== null && phase === 'fly';
			if (targetX !== null) {
				beacon.position.x = targetX;
				(beacon.material as Kit.THREE.MeshBasicMaterial).color.set(targetColor);
				(beacon.material as Kit.THREE.MeshBasicMaterial).opacity = 0.14 + Math.sin(t * 3) * 0.05;
			}
		}
		arrow = targetX === null || phase !== 'fly' || Math.abs(targetX - heli.x) < 14 ? null : targetX < heli.x ? 'left' : 'right';

		for (let i = hoppers.length - 1; i >= 0; i--) {
			const h = hoppers[i]!;
			h.t = Math.min(1, h.t + dt / h.dur);
			const k = ease(h.t);
			h.obj.position.lerpVectors(h.from, h.to, k);
			h.obj.position.y += Math.sin(k * Math.PI) * h.arc;
			if (h.t >= 1) {
				hoppers.splice(i, 1);
				h.then?.();
			}
		}
		for (const l of loopers) l.obj.position.x = l.base + Math.sin(t * 0.05 + l.phase) * 3;
		// Rain for the garden.
		if (raining > 0 && kit && stage) {
			raining -= dt;
			for (let k = 0; k < 3; k++) {
				const drop = new kit.THREE.Mesh(dropGeo ??= new kit.THREE.SphereGeometry(0.06, 6, 4), dropMat ??= new kit.THREE.MeshBasicMaterial({ color: '#7EC8F0' }));
				drop.position.set(heli.x + (Math.random() - 0.5) * 3, heli.y + MODEL_Y - 2.4, -1.5 + (Math.random() - 0.5) * 2);
				stage.scene.add(drop);
				rain.push({ mesh: drop, vy: -6 - Math.random() * 3 });
			}
			for (const f of flowers) f.scale.setScalar(Math.min(1, f.scale.x + dt * 0.45));
		}
		for (let i = rain.length - 1; i >= 0; i--) {
			const r = rain[i]!;
			r.mesh.position.y += r.vy * dt;
			if (r.mesh.position.y < 0.3) {
				stage?.scene.remove(r.mesh);
				rain.splice(i, 1);
			}
		}
		for (const r of receivers) {
			const parts = (r.userData as Animals.ToyAnimal['userData']).parts;
			if (parts?.tail) parts.tail.rotation.z = Math.sin(t * 5) * 0.4;
		}
		confetti?.update(dt);
	}
	let dropGeo: Kit.THREE.SphereGeometry | null = null;
	let dropMat: Kit.THREE.MeshBasicMaterial | null = null;

	const padY = (x: number) => HELI.ground + (x === HELI_PADS[2] ? 0.27 : 0);

	function startLanding(x: number) {
		phase = 'landing';
		hideHand();
		hintShown = false;
		input.up = false;
		input.x = 0;
		held = { up: false, left: false, right: false };
		landing = { fromX: heli.x, fromY: heli.y, toX: x, t: 0 };
		say('heli.landing', { interrupt: true });
		if (!stage) scheduler.after(300, landed);
	}

	function landed() {
		phase = 'deliver';
		heli = { ...heli, y: padY(heli.x), vx: 0, vy: 0 };
		if (goingHome) return party();
		const j = job!;
		const done = () => {
			delivered += 1;
			chime();
			mascot = 'celebrate';
			say(`heli.done.${j.cargo}`, { interrupt: j.cargo !== 'mangoes' });
			say('heli.thanks');
			for (const r of receivers) hopOnce(r);
			stage?.feedback(!d.reduced);
			scheduler.after(d.reduced ? 800 : 3200, nextJob);
		};
		if (!stage || !cargo || !kit) return done();
		const basket = cargo.getObjectByName('basket');
		const px = HELI_PADS[j.pad]!;
		if (j.cargo === 'mangoes' && basket) {
			const mangoes = basket.children.filter((c) => c.name === 'mango');
			mangoes.forEach((m, i) => {
				scheduler.after(i * 700, () => {
					const from = new kit!.THREE.Vector3();
					m.getWorldPosition(from);
					stage!.scene.attach(m);
					hoppers.push({ obj: m, from, to: new kit!.THREE.Vector3(px - 0.4 + i * 0.4, 0.25, -2.0), t: 0, dur: 0.6, arc: 1.5, then: () => say(`number.${i + 1}`, { interrupt: true }) });
				});
			});
			scheduler.after(mangoes.length * 700 + 700, done);
		} else if (j.cargo === 'water') {
			raining = d.reduced ? 0.5 : 2.4;
			scheduler.after(d.reduced ? 600 : 2600, () => {
				for (const f of flowers) f.scale.setScalar(1);
				done();
			});
		} else {
			const p = basket?.getObjectByName('passenger');
			if (p) {
				const from = new kit.THREE.Vector3();
				p.getWorldPosition(from);
				stage.scene.attach(p);
				p.scale.setScalar(j.cargo === 'kitten' ? 0.9 : 1.1);
				p.rotation.set(0, 0, 0);
				hoppers.push({ obj: p, from, to: new kit.THREE.Vector3(px + 1.6, padY(px) - HELI.ground + 0.02, -2.2), t: 0, dur: 0.8, arc: 1.4, then: () => {
					ANIMAL_CALL[j.cargo === 'kitten' ? 'cat' : 'rabbit']?.();
					receivers.push(p);
					done();
				} });
			} else done();
		}
	}

	function hopOnce(o: Kit.THREE.Object3D) {
		if (!kit || d.reduced) return;
		const base = o.position.clone();
		hoppers.push({ obj: o, from: base.clone(), to: base.clone(), t: 0, dur: 0.6, arc: 0.7 });
	}

	function nextJob() {
		mascot = 'idle';
		jobIndex += 1;
		phase = 'fly';
		if (goingHome) {
			if (cargo) while (cargo.children.length > 1) cargo.remove(cargo.children[1]!);
			say('heli.home', { interrupt: true });
			setIdlePrompt('heli.home');
			return;
		}
		loadCargo();
		announceJob();
	}

	function announceJob() {
		const j = job;
		if (!j) return;
		instructAll([`heli.cargo.${j.cargo}`, `heli.color.${j.color}`, `number.${j.number}`, 'heli.number']);
		setIdlePrompt(`heli.cargo.${j.cargo}`);
	}

	function party() {
		phase = 'party';
		chime('big');
		mascot = 'celebrate';
		say('heli.party', { interrupt: true });
		setIdlePrompt(null);
		if (kit) for (const dx of [-5, 0, 5]) confetti?.burst(new kit.THREE.Vector3(HOME_PAD + dx, 4, -1), 26);
		stage?.feedback(!d.reduced);
		scheduler.after(d.reduced ? 600 : 2200, () => (finished = true));
	}

	/** Free flight: landing on any pad says its colour (once per landing). */
	function freeLandingChat() {
		if (heli.y > HELI.ground + 0.4) {
			lastLandedPad = -1;
			return;
		}
		const i = HELI_PADS.findIndex((x) => Math.abs(x - heli.x) < 2.6);
		if (i >= 0 && i !== lastLandedPad) {
			lastLandedPad = i;
			chime();
			instructAll([`heli.color.${day.pads[i]!.color}`, `number.${day.pads[i]!.number}`, 'heli.number']);
		}
	}

	function start(m: 'jobs' | 'free') {
		mode = m;
		phase = 'fly';
		stage?.setPaused($paused);
		speakLabel(`heli.${m}`);
		instruct('heli.how');
		if (m === 'jobs') {
			loadCargo();
			scheduler.after(d.reduced ? 1500 : 4200, announceJob);
		}
		scheduler.after(d.reduced ? 1500 : 5000, () => {
			if (heli.y <= HELI.ground + PAD_EPS && phase === 'fly') showHand(['[data-testid="heli-up"]']);
		});
	}
	const PAD_EPS = 0.7;

	function again() {
		scheduler.cancelAll();
		hideHand();
		day = createHeliDay($settings.difficulty, (Date.now() + 11) >>> 0);
		mode = 'pick';
		phase = 'fly';
		jobIndex = 0;
		delivered = 0;
		finished = false;
		minClear = Infinity;
		heli = freshHeli();
		mascot = 'wave';
		void restartStage();
		instruct('heli.choose');
	}

	async function restartStage() {
		confetti?.dispose();
		confetti = null;
		disposeSky?.();
		disposeSky = null;
		for (const x of disposers.splice(0)) x();
		hoppers = [];
		loopers = [];
		rain = [];
		receivers = [];
		flowers = [];
		dropGeo = null;
		dropMat = null;
		stage?.dispose();
		stage = null;
		ready = false;
		canvasKey += 1;
		await new Promise((r) => requestAnimationFrame(r));
		void startStage();
	}

	// ── controls: hold buttons (pointer) or keys ──
	function setHold(key: 'up' | 'left' | 'right', on: boolean) {
		held = { ...held, [key]: on };
		input.up = held.up;
		input.x = held.left && !held.right ? -1 : held.right && !held.left ? 1 : 0;
	}
	const KEYS: Record<string, 'up' | 'left' | 'right'> = { ArrowUp: 'up', w: 'up', W: 'up', ' ': 'up', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
	function onkeydown(e: KeyboardEvent) {
		const k = KEYS[e.key];
		if (!k || mode === 'pick' || phase !== 'fly') return;
		e.preventDefault();
		if (!held[k]) setHold(k, true);
	}
	function onkeyup(e: KeyboardEvent) {
		const k = KEYS[e.key];
		if (k) setHold(k, false);
	}
	function holdProps(key: 'up' | 'left' | 'right') {
		return {
			onpointerdown: (e: PointerEvent) => {
				if (phase !== 'fly') return;
				(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
				setHold(key, true);
			},
			onpointerup: () => setHold(key, false),
			onpointercancel: () => setHold(key, false),
			onlostpointercapture: () => setHold(key, false)
		};
	}

	onMount(() => {
		void startStage();
		instruct('heli.choose');
		setIdlePrompt('heli.choose');
	});

	const offPause = paused.subscribe((p) => {
		stage?.setPaused(p || mode === 'pick');
		if (p) {
			scheduler.pause();
			stopNarration();
			setHold('up', false);
			setHold('left', false);
			setHold('right', false);
		} else scheduler.resume();
	});

	onDestroy(() => {
		destroyed = true;
		offPause();
		scheduler.cancelAll();
		hideHand();
		leaveScreen();
		confetti?.dispose();
		disposeSky?.();
		for (const x of disposers) x();
		dropGeo?.dispose();
		dropMat?.dispose();
		stage?.dispose();
		stage = null;
	});

	// Flat fallback (no WebGL): tap the pad with the right colour and number.
	function flatPad(i: number) {
		if (phase !== 'fly' || mode !== 'jobs') return;
		if (goingHome ? i === -1 : job && i === job.pad) startLanding(i === -1 ? HOME_PAD : HELI_PADS[i]!);
		else if (i >= 0) instructAll([`heli.color.${day.pads[i]!.color}`, `number.${day.pads[i]!.number}`, 'heli.number']);
	}
	const CARGO_ICON = { mangoes: '🥭', water: '💧', kitten: '🐱', friend: '🐰' } as const;
</script>

<svelte:window {onkeydown} {onkeyup} />

<TopBar onreplay={() => (job ? announceJob() : say(goingHome ? 'heli.home' : 'heli.how', { interrupt: true }))} />

<section
	class="heli"
	class:paused={$paused}
	data-ready={ready || failed}
	data-mode={mode}
	data-phase={phase}
	data-job={jobIndex}
	data-jobs={day.jobs.length}
	data-delivered={delivered}
	data-x={hx}
	data-y={hy}
	data-target-x={targetX ?? ''}
	data-min-clear={Number.isFinite(minClear) ? minClear.toFixed(2) : 'none'}
	data-floor={floorAt(hx).toFixed(2)}
	data-done={finished}
>
	<div class="view">
		{#key canvasKey}<canvas bind:this={canvas} aria-hidden="true"></canvas>{/key}
		{#if mode === 'pick'}
			<div class="picker">
				<button class="mode-btn" data-heli-mode="jobs" onclick={() => start('jobs')} onfocus={() => speakLabel('heli.jobs')}>
					<span class="mode-icon" aria-hidden="true">🚁🥭🐱</span>
					<span>{label('heli.jobs')}</span>
				</button>
				<button class="mode-btn free" data-heli-mode="free" onclick={() => start('free')} onfocus={() => speakLabel('heli.free')}>
					<span class="mode-icon" aria-hidden="true">🚁☁️🌈</span>
					<span>{label('heli.free')}</span>
				</button>
			</div>
		{/if}
		{#if mode === 'jobs' && (job || goingHome) && phase !== 'party'}
			<div class="job-card" style:--c={targetColor} aria-hidden="true">
				<span class="cargo">{goingHome ? '🏠' : CARGO_ICON[job!.cargo]}</span>
				<span class="arrow-to">→</span>
				<span class="pad-chip">{goingHome ? '♥' : num(job!.number)}</span>
			</div>
		{/if}
		{#if arrow}
			<div class="edge {arrow}" style:--c={targetColor} aria-hidden="true">{arrow === 'left' ? '◀' : '▶'}</div>
		{/if}
		{#if failed && mode === 'jobs'}
			<div class="flat">
				<button class="flat-pad" style:--c="#FF8FA3" onclick={() => flatPad(-1)}>♥</button>
				{#each day.pads as p, i (i)}
					<button class="flat-pad" data-pad={i} style:--c={STATION_COLORS[p.color].hex} onclick={() => flatPad(i)}>{num(p.number)}</button>
				{/each}
			</div>
		{/if}
		<div class="rumi"><Mascot state={mascot} size={100} /></div>
		{#if finished}
			<div class="finish">
				<GameButton action="replay" onclick={again} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		{/if}
	</div>
	{#if mode !== 'pick'}
		<div class="controls">
			<button class="ctl" class:on={held.left} data-testid="heli-left" aria-label={label('heli.left')} {...holdProps('left')}>
				<svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true"><path d="M30 10 L14 24 L30 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			<button class="ctl up" class:on={held.up} data-testid="heli-up" aria-label={label('heli.up')} {...holdProps('up')}>
				<svg viewBox="0 0 48 48" width="62" height="62" aria-hidden="true"><path d="M10 30 L24 14 L38 30" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			<button class="ctl" class:on={held.right} data-testid="heli-right" aria-label={label('heli.right')} {...holdProps('right')}>
				<svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true"><path d="M18 10 L34 24 L18 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			{#if mode === 'free'}
				<GameButton action="choose-game" size="small" onclick={() => goto('/play')} />
			{/if}
		</div>
	{/if}
</section>

<style>
	.heli {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 0 24px 12px;
		gap: 10px;
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}
	.view {
		position: relative;
		flex: 1;
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
	.picker {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 30px;
		background: rgba(255, 255, 255, 0.25);
	}
	.mode-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		min-width: 250px;
		padding: 22px 26px;
		border: 5px solid #ffffff;
		border-radius: 32px;
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-primary);
		font-size: 26px;
		font-weight: 800;
		box-shadow: 0 10px 0 rgba(242, 201, 76, 0.5), 0 18px 34px rgba(40, 70, 100, 0.18);
		cursor: pointer;
		transition: transform 160ms ease;
	}
	.mode-btn.free {
		box-shadow: 0 10px 0 rgba(94, 200, 232, 0.5), 0 18px 34px rgba(40, 70, 100, 0.18);
	}
	.mode-btn:hover,
	.mode-btn:focus-visible {
		transform: translateY(-5px) scale(1.03);
	}
	.mode-icon {
		font-size: 54px;
	}
	.job-card {
		position: absolute;
		top: 14px;
		right: 16px;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-radius: 26px;
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
		font-size: 44px;
	}
	.arrow-to {
		font-size: 30px;
		color: var(--text-secondary);
	}
	.pad-chip {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		border: 7px solid var(--c);
		background: #ffffff;
		color: var(--text-primary);
		font-size: 34px;
		font-weight: 800;
	}
	.edge {
		position: absolute;
		top: 50%;
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: var(--c);
		color: #ffffff;
		font-size: 30px;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
		transform: translateY(-50%);
		animation: nudge 1.2s ease-in-out infinite;
	}
	.edge.left {
		left: 14px;
	}
	.edge.right {
		right: 14px;
	}
	.rumi {
		position: absolute;
		left: 12px;
		bottom: 6px;
		pointer-events: none;
	}
	.finish {
		position: absolute;
		left: 50%;
		bottom: 22px;
		transform: translateX(-50%);
		display: flex;
		gap: 22px;
		padding: 14px 20px;
		border-radius: var(--radius-xl);
		background: rgba(255, 255, 255, 0.88);
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
	}
	.controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 26px;
		min-height: 100px;
		touch-action: none;
		user-select: none;
	}
	.ctl {
		display: grid;
		place-items: center;
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 4px solid var(--border-soft);
		background: var(--surface);
		color: var(--text-primary);
		cursor: pointer;
		touch-action: none;
		transition: transform 120ms ease;
	}
	.ctl.up {
		width: 116px;
		height: 116px;
		border-color: #f2c94c;
		background: #fff6d6;
	}
	.ctl.on {
		transform: scale(0.92);
		background: #ffe58a;
	}
	.ctl:focus-visible {
		outline: 5px solid var(--text-primary);
		outline-offset: 4px;
	}
	.flat {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 22px;
		background: #dff0fb;
	}
	.flat-pad {
		width: 120px;
		height: 120px;
		border: 10px solid var(--c);
		border-radius: 50%;
		background: #ffffff;
		font-size: 50px;
		font-weight: 800;
		cursor: pointer;
	}
	@keyframes nudge {
		50% {
			transform: translateY(-50%) scale(1.12);
		}
	}
</style>
