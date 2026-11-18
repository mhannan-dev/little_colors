<script lang="ts">
	/**
	 * Rumi's Highway — a calm, original highway drive for ages 3–6 (genre inspired by traffic
	 * racers, nothing copied). Gas/brake pedals, lane changes, horn, speedometer + gears, a pause
	 * menu, three places, landmarks on the way home. A crash can't happen: the car slows behind
	 * traffic by itself (core assistSpeed) and a lane is always free. No score, no pass counter,
	 * no game over (PR-07). Optional colour prompts ("pass the blue truck") never fail.
	 */
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		assistSpeed,
		createHighwayRng,
		formatNumeral,
		gearFor,
		HIGHWAY_LANES,
		LANDMARK_EVERY,
		LANDMARKS,
		laneIsClear,
		leadIn,
		LOCATIONS,
		MAX_SPEED,
		MAX_SPEED_REDUCED,
		MIN_GAP,
		narrationText,
		nextSpeed,
		passedKey,
		passKey,
		SAFE_GAP,
		spawnVehicle,
		VEHICLE_COLORS,
		VEHICLE_KINDS,
		type HighwayLocation,
		type TrafficVehicle
	} from '@little-colors/core';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import RumiLoading from '#lib/components/ui/RumiLoading.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { hideHand, showHand, firstTime } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import type * as Kit from '#lib/three3d/toyKit.ts';

	const d = durations();
	const scheduler = createScheduler();
	/** Scene units per metre: the toy car (2.6 units) stands for a ~4.5 m car. */
	const U = 1 / 1.7;
	const LANE_W = 3.2;
	const laneX = (l: number) => (l - (HIGHWAY_LANES - 1) / 2) * LANE_W;
	const maxSpeed = d.reduced ? MAX_SPEED_REDUCED : MAX_SPEED;

	let location = $state<HighwayLocation | null>(null);
	let menuOpen = $state(false);
	let camera = $state<'chase' | 'high' | 'bumper'>('chase');
	let lane = $state(1);
	let ready = $state(false);
	let failed = $state(false);
	// Dashboard (updated ~10×/s, not every frame).
	let shownSpeed = $state(0);
	let shownGear = $state(1);
	let journey = $state(0);
	let hintDir = $state<-1 | 0 | 1>(0);
	let refused = $state<-1 | 0 | 1>(0);
	let promptLabel = $state('');
	// Hidden test hooks (never shown: no tallies on screen).
	let passes = $state(0);
	let minGapSeen = $state(999);

	const bn = $derived($settings.language === 'bn-BD');
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let kit: typeof Kit | null = null;
	let roundedBox: typeof import('three/addons/geometries/RoundedBoxGeometry.js') | null = null;
	let stage: Kit.Stage | null = null;
	let confetti: Kit.Confetti | null = null;
	let destroyed = false;
	/** Realistic look (pilot): HDR sky lighting, PBR road/grass, clear-coat cars. */
	let disposeSky: (() => void) | null = null;
	let surfaces: { scroll(v: number): void; dispose(): void; tile: number }[] = [];
	/** A released WebGL context cannot be reused: each new place gets a fresh canvas. */
	let canvasKey = $state(0);
	let canvasUsed = false;

	// World state (plain variables: changed every frame).
	let speed = 0;
	let carX = laneX(1);
	let offset = 0;
	let distance = 0;
	let pedals = { gas: false, brake: false };
	let traffic: (TrafficVehicle & { obj: Kit.THREE.Group; base: number })[] = [];
	let nextId = 1;
	let rng = createHighwayRng(Date.now() >>> 0);
	let spawnT = 0;
	let car: Kit.THREE.Group | null = null;
	let world: Kit.THREE.Group | null = null;
	let scenery: { obj: Kit.THREE.Object3D; base: number; span: number }[] = [];
	let landmarkSign: { obj: Kit.THREE.Group; z: number; index: number; said: boolean } | null = null;
	let landmarkIndex = 0;
	let slowSince = 0;
	let lastLaneHint = -999;
	let lastPrompt = 0;
	let prompt: { id: number; since: number } | null = null;
	let clock = 0;
	let dashT = 0;

	// ── 3D setup ────────────────────────────────────────────────────────────
	const LOOK: Record<HighwayLocation, { sky: string; horizon: string; ground: string; fog: [number, number] }> = {
		green: { sky: '#7FB8EA', horizon: '#DDF0FB', ground: '#9ED17E', fog: [55, 110] },
		city: { sky: '#8FB0D6', horizon: '#E4ECF4', ground: '#B9C0C8', fog: [50, 100] },
		sunset: { sky: '#7A5AA8', horizon: '#F6B26B', ground: '#E8C48A', fog: [45, 95] }
	};

	async function buildWorld(loc: HighwayLocation) {
		if (!kit) {
			try {
				kit = await import('#lib/three3d/toyKit.ts');
				roundedBox = await import('three/addons/geometries/RoundedBoxGeometry.js');
			} catch {
				failed = true;
				return;
			}
		}
		disposeStage();
		if (canvasUsed) {
			canvasKey += 1;
			await tick();
		}
		if (destroyed || !canvas) return;
		canvasUsed = true;
		const { THREE } = kit;
		const look = LOOK[loc];
		try {
			stage = kit.createStage(canvas, { fov: 55, background: look.horizon, skyTop: look.sky });
		} catch {
			failed = true;
			return;
		}
		stage.scene.fog = new THREE.Fog(loc === 'sunset' ? look.horizon : '#dde6ec', look.fog[0] + 20, look.fog[1] + 70);
		if (loc !== 'sunset') {
			try {
				disposeSky = await kit.useHdriSky(stage, '/hdri/sky_partly_cloudy_2k.hdr', { background: true, intensity: 0.9 });
			} catch {
				/* keep the painted sky */
			}
		}
		if (destroyed || !stage) return;
		world = new THREE.Group();
		stage.scene.add(world);

		const tex = '/textures/highway'; // static/, served at the app root (also inside Tauri)
		const groundPbr = loc === 'green' ? kit.pbrMaterial(`${tex}/grass`, [27, 43]) : loc === 'city' ? kit.pbrMaterial(`${tex}/asphalt`, [40, 65], '#d3d7dc') : null;
		const roadPbr = kit.pbrMaterial(`${tex}/asphalt`, [3, 65], '#9aa0a6');
		surfaces = [{ ...roadPbr, tile: 260 / 65 }, ...(groundPbr ? [{ ...groundPbr, tile: 260 / 43 }] : [])];
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 260), groundPbr?.material ?? new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }));
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(0, -0.02, -90);
		ground.receiveShadow = true;
		const roadW = HIGHWAY_LANES * LANE_W + 1.6;
		const road = new THREE.Mesh(new THREE.PlaneGeometry(roadW, 260), roadPbr.material);
		road.rotation.x = -Math.PI / 2;
		road.position.set(0, 0, -90);
		road.receiveShadow = true;
		world.add(ground, road);
		// Distant hills / mesas give the view depth (they sit in the fog, so they never pop).
		const hillColor = loc === 'sunset' ? '#B98557' : loc === 'city' ? '#AEB8C2' : '#7FA77A';
		for (let i = 0; i < 9; i++) {
			const hill = new THREE.Mesh(
				loc === 'city' ? new THREE.BoxGeometry(10 + (i % 3) * 6, 14 + (i % 4) * 9, 10) : new THREE.ConeGeometry(16 + (i % 3) * 8, 10 + (i % 4) * 5, 7),
				new THREE.MeshStandardMaterial({ color: hillColor, roughness: 1 })
			);
			hill.position.set(-80 + i * 20 + (i % 2) * 6, loc === 'city' ? 7 : 4, -150 - (i % 3) * 12);
			world.add(hill);
		}
		const white = new THREE.MeshStandardMaterial({ color: '#F4F4F0' });
		for (const x of [-roadW / 2 + 0.35, roadW / 2 - 0.35]) {
			const edge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 260), white);
			edge.position.set(x, 0.01, -90);
			world.add(edge);
		}
		// Lane dashes and roadside things scroll with `offset`.
		const dashGeo = new THREE.BoxGeometry(0.16, 0.02, 2.4);
		for (let k = 0; k < 24; k++) {
			for (let l = 1; l < HIGHWAY_LANES; l++) {
				const dash = new THREE.Mesh(dashGeo, white);
				dash.position.set(laneX(l) - LANE_W / 2, 0.012, 0);
				world.add(dash);
				scenery.push({ obj: dash, base: -k * 6, span: 144 });
			}
		}
		const railMat = new THREE.MeshStandardMaterial({ color: '#C8CDD2', metalness: 0.3, roughness: 0.5 });
		for (const side of [-1, 1]) {
			for (let k = 0; k < 14; k++) {
				const rail = new THREE.Group();
				const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 10.2), railMat);
				bar.position.y = 0.75;
				const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.8, 0.15), railMat);
				post.position.y = 0.4;
				rail.add(bar, post);
				rail.position.x = side * (roadW / 2 + 0.6);
				world.add(rail);
				scenery.push({ obj: rail, base: -k * 10, span: 140 });
			}
			for (let k = 0; k < 10; k++) {
				const thing = roadside(loc, k, side);
				thing.position.x = side * (roadW / 2 + 5 + (k % 3) * 3.5);
				world.add(thing);
				scenery.push({ obj: thing, base: -k * 14 - (side > 0 ? 7 : 0), span: 140 });
			}
		}

		car = realCar('#E5484D', true);
		car.rotation.y = Math.PI;
		world.add(car);
		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused || menuOpen);
		ready = true;
	}

	/** Trees, buildings or cacti, depending on the place. */
	function roadside(loc: HighwayLocation, k: number, side: number): Kit.THREE.Group {
		const { THREE } = kit!;
		if (loc === 'green') {
			// A fuller tree: a trunk with a few overlapping leafy clumps in varied greens.
			const { THREE } = kit!;
			const t = new THREE.Group();
			const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.2, 8), new THREE.MeshStandardMaterial({ color: '#6f5440', roughness: 1 }));
			trunk.position.y = 1.1;
			t.add(trunk);
			const greens = ['#4f8f4a', '#5c9e52', '#477f43', '#66a85b'];
			const clumps: [number, number, number, number][] = [[0, 2.7, 0, 1.25], [0.75, 2.3, 0.2, 0.9], [-0.7, 2.4, -0.15, 0.95], [0.1, 3.4, -0.1, 0.85]];
			clumps.forEach(([x, y, z, r], i) => {
				const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ color: greens[(i + k) % greens.length], roughness: 0.9, flatShading: true }));
				leaf.position.set(x, y, z);
				leaf.rotation.set(k * 0.7, i, 0);
				t.add(leaf);
			});
			t.scale.setScalar(1 + (k % 3) * 0.25);
			t.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
			return t;
		}
		const g = new THREE.Group();
		if (loc === 'city') {
			const colors = ['#E8D8C3', '#C9DCEB', '#F2D6B3', '#D9E6CF', '#E6C9D6'];
			const h = 4 + ((k * 7 + (side > 0 ? 3 : 0)) % 5) * 1.8;
			const b = new THREE.Mesh(new THREE.BoxGeometry(4, h, 4), new THREE.MeshStandardMaterial({ color: colors[k % colors.length], roughness: 0.8 }));
			b.position.y = h / 2;
			b.castShadow = true;
			const win = new THREE.MeshStandardMaterial({ color: '#7DA7C9', emissive: '#2a4a66', emissiveIntensity: 0.25 });
			for (let y = 1.4; y < h - 0.6; y += 1.6) {
				const w = new THREE.Mesh(new THREE.BoxGeometry(4.02, 0.6, 3.2), win);
				w.position.y = y;
				g.add(w);
			}
			g.add(b);
			return g;
		}
		const cactus = new THREE.MeshStandardMaterial({ color: '#4E9F68', roughness: 0.9 });
		const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 2.6, 10), cactus);
		trunk.position.y = 1.3;
		const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 8), cactus);
		arm.position.set(0.55, 1.6, 0);
		g.add(trunk, arm);
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	/** A real-looking car (metres, then scaled): clear-coat paint, tinted glass, rims, lights. */
	function realCar(hex: string, rumi = false): Kit.THREE.Group {
		const { THREE } = kit!;
		const { RoundedBoxGeometry } = roundedBox!;
		const g = new THREE.Group();
		const paint = kit!.carPaint(hex);
		const glass = new THREE.MeshPhysicalMaterial({ color: '#1d2a33', metalness: 0.6, roughness: 0.06, clearcoat: 1 });
		const rubber = new THREE.MeshStandardMaterial({ color: '#1b1f22', roughness: 0.9 });
		const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde1', metalness: 1, roughness: 0.18 });
		const trim = new THREE.MeshStandardMaterial({ color: '#2b3136', roughness: 0.6 });
		const body = new THREE.Mesh(new RoundedBoxGeometry(1.84, 0.72, 4.4, 5, 0.26), paint);
		body.position.y = 0.66;
		const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.66, 2.3, 5, 0.3), glass);
		cabin.position.set(0, 1.25, 0.25);
		const roof = new THREE.Mesh(new RoundedBoxGeometry(1.56, 0.1, 1.9, 4, 0.05), paint);
		roof.position.set(0, 1.6, 0.3);
		const bumperF = new THREE.Mesh(new RoundedBoxGeometry(1.86, 0.26, 0.24, 3, 0.1), trim);
		bumperF.position.set(0, 0.42, -2.2);
		const bumperB = bumperF.clone();
		bumperB.position.z = 2.2;
		g.add(body, cabin, roof, bumperF, bumperB);
		for (const x of [-0.62, 0.62]) {
			const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.06), new THREE.MeshStandardMaterial({ color: '#fffbe8', emissive: '#fff3c4', emissiveIntensity: location === 'sunset' ? 1.4 : 0.4 }));
			head.position.set(x, 0.78, -2.21);
			const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.06), new THREE.MeshStandardMaterial({ color: '#7a1010', emissive: '#E5484D', emissiveIntensity: location === 'sunset' ? 1.6 : 0.6 }));
			tail.position.set(x, 0.8, 2.21);
			g.add(head, tail);
		}
		const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24);
		const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.27, 16);
		for (const z of [-1.4, 1.35]) {
			for (const x of [-0.84, 0.84]) {
				const tyre = new THREE.Mesh(tyreGeo, rubber);
				tyre.rotation.z = Math.PI / 2;
				tyre.position.set(x, 0.36, z);
				const rim = new THREE.Mesh(rimGeo, chrome);
				rim.rotation.z = Math.PI / 2;
				rim.position.set(x * 1.01, 0.36, z);
				g.add(tyre, rim);
			}
		}
		if (rumi) {
			// Rumi pops out of the sunroof, so the child always knows which car is theirs.
			const fur = new THREE.MeshStandardMaterial({ color: '#E3B48A', roughness: 0.8 });
			const headR = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), fur);
			headR.position.set(0, 2.0, 0.45);
			const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 20), new THREE.MeshStandardMaterial({ color: '#5E8C6A' }));
			scarf.rotation.x = Math.PI / 2;
			scarf.position.set(0, 1.7, 0.45);
			g.add(headR, scarf);
			for (const x of [-0.24, 0.24]) {
				const ear = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), fur);
				ear.position.set(x, 2.3, 0.45);
				g.add(ear);
			}
		}
		g.scale.setScalar(U);
		g.traverse((o) => {
			const m = o as Kit.THREE.Mesh;
			if (m.isMesh) m.castShadow = true;
		});
		return g;
	}

	/** Trucks and buses in the same real style. */
	function vehicleModel(v: TrafficVehicle): Kit.THREE.Group {
		const { THREE } = kit!;
		const hex = VEHICLE_COLORS[v.color].hex;
		if (v.kind === 'car') return realCar(hex);
		const { RoundedBoxGeometry } = roundedBox!;
		const g = new THREE.Group();
		const paint = kit!.carPaint(hex);
		const white = new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.55 });
		const glass = new THREE.MeshPhysicalMaterial({ color: '#1d2a33', metalness: 0.6, roughness: 0.06, clearcoat: 1 });
		const rubber = new THREE.MeshStandardMaterial({ color: '#1b1f22', roughness: 0.9 });
		const chrome = new THREE.MeshStandardMaterial({ color: '#d9dde1', metalness: 1, roughness: 0.2 });
		const len = VEHICLE_KINDS[v.kind].length;
		let axles: number[];
		if (v.kind === 'truck') {
			const cab = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.5, 2.2, 4, 0.22), paint);
			cab.position.set(0, 1.55, -len / 2 + 1.1);
			const wind = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.9, 0.1, 3, 0.04), glass);
			wind.position.set(0, 2.15, -len / 2 - 0.01);
			const cargo = new THREE.Mesh(new RoundedBoxGeometry(2.5, 2.9, len - 2.6, 3, 0.1), white);
			cargo.position.set(0, 1.95, 1.2);
			const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.45, len - 2.7), paint);
			stripe.position.set(0, 1.4, 1.2);
			g.add(cab, wind, cargo, stripe);
			axles = [-len / 2 + 1.2, len / 2 - 2.6, len / 2 - 1.2];
		} else {
			const body = new THREE.Mesh(new RoundedBoxGeometry(2.5, 2.9, len, 4, 0.3), paint);
			body.position.y = 1.85;
			const band = new THREE.Mesh(new RoundedBoxGeometry(2.54, 0.9, len - 1.4, 3, 0.1), glass);
			band.position.set(0, 2.35, 0.2);
			const wind = new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.2, 0.1, 3, 0.04), glass);
			wind.position.set(0, 2.2, -len / 2 - 0.01);
			const skirt = new THREE.Mesh(new THREE.BoxGeometry(2.52, 0.5, len - 0.6), white);
			skirt.position.y = 0.85;
			g.add(body, band, wind, skirt);
			axles = [-len / 2 + 2.2, len / 2 - 2.4];
		}
		const tyreGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 24);
		const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.35, 16);
		for (const z of axles) {
			for (const x of [-1.15, 1.15]) {
				const tyre = new THREE.Mesh(tyreGeo, rubber);
				tyre.rotation.z = Math.PI / 2;
				tyre.position.set(x, 0.52, z);
				const rim = new THREE.Mesh(rimGeo, chrome);
				rim.rotation.z = Math.PI / 2;
				rim.position.set(x * 1.01, 0.52, z);
				g.add(tyre, rim);
			}
		}
		g.scale.setScalar(U);
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	function landmarkModel(index: number): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const lm = LANDMARKS[index]!;
		const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 8), new THREE.MeshStandardMaterial({ color: '#F4F4F0' }));
		post.position.y = 1.8;
		const board = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.6, 0.15), [
			new THREE.MeshStandardMaterial({ color: '#35A66A' }),
			new THREE.MeshStandardMaterial({ color: '#35A66A' }),
			new THREE.MeshStandardMaterial({ color: '#35A66A' }),
			new THREE.MeshStandardMaterial({ color: '#35A66A' }),
			new THREE.MeshStandardMaterial({ map: kit!.glyphTexture(lm.icon, '#35A66A') }),
			new THREE.MeshStandardMaterial({ color: '#35A66A' })
		]);
		board.position.y = 4.4;
		g.add(post, board);
		g.position.x = (HIGHWAY_LANES * LANE_W) / 2 + 2.6;
		return g;
	}

	function wrapZ(v: number, span: number) {
		const w = (((14 - v) % span) + span) % span;
		return 14 - w;
	}

	function disposeObj(o: Kit.THREE.Object3D) {
		o.parent?.remove(o);
		o.traverse((x) => {
			const m = x as Kit.THREE.Mesh;
			if (!m.isMesh) return;
			m.geometry.dispose();
			for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
				(mat as Kit.THREE.MeshStandardMaterial).map?.dispose();
				mat.dispose();
			}
		});
	}

	function disposeStage() {
		disposeSky?.();
		disposeSky = null;
		for (const sf of surfaces) sf.dispose();
		surfaces = [];
		confetti?.dispose();
		confetti = null;
		stage?.dispose();
		stage = null;
		world = null;
		car = null;
		traffic = [];
		scenery = [];
		landmarkSign = null;
		ready = false;
	}

	// ── Driving ─────────────────────────────────────────────────────────────
	function frame(dt: number) {
		if (!car || !world || !kit) return;
		clock += dt;
		const desired = nextSpeed(speed, pedals, dt, maxSpeed);
		const lead = leadIn(traffic, lane);
		speed = assistSpeed(desired, lead?.gap ?? null, lead?.vehicle.speed ?? 0);
		if (lead) minGapSeen = Math.min(minGapSeen, Math.round(lead.gap));

		// Held back by slow traffic for a while: suggest a free lane (at most every 10 s).
		if (lead && lead.gap < SAFE_GAP && desired - speed > 8) {
			slowSince += dt;
			if (slowSince > 1.5 && clock - lastLaneHint > 10) {
				lastLaneHint = clock;
				const dir = laneIsClear(traffic, lane - 1) ? -1 : laneIsClear(traffic, lane + 1) ? 1 : 0;
				if (dir) {
					hintDir = dir;
					say('highway.change-lane', { interrupt: true });
					scheduler.after(3000, () => (hintDir = 0));
				}
			}
		} else slowSince = 0;

		const mps = speed / 3.6;
		const moved = mps * dt * U;
		offset += moved;
		distance += mps * dt;

		// Traffic: each vehicle keeps its own pace but never runs into the one ahead in its lane.
		for (const v of traffic) {
			const ahead = leadIn(
				traffic.filter((o) => o !== v).map((o) => ({ ...o, z: o.z - v.z })),
				v.lane,
				VEHICLE_KINDS[v.kind].length
			);
			const pace = assistSpeed(v.base, ahead?.gap ?? null, ahead?.vehicle.speed ?? v.base);
			v.speed = pace;
			const before = v.z;
			v.z += ((v.speed - speed) / 3.6) * dt;
			if (before > 0 && v.z <= 0 && v.lane !== lane) passed(v);
			v.obj.position.set(laneX(v.lane), 0, -v.z * U);
		}
		for (const v of traffic.filter((t) => t.z < -60 || t.z > 320)) disposeObj(v.obj);
		traffic = traffic.filter((t) => t.z >= -60 && t.z <= 320);
		spawnT -= dt * (0.6 + speed / 60);
		if (spawnT <= 0 && traffic.length < 9) {
			spawnT = 2.2 + rng() * 1.6;
			const v = spawnVehicle(rng, traffic, nextId++, 200);
			if (v) {
				const obj = vehicleModel(v);
				world.add(obj);
				traffic.push({ ...v, base: v.speed, obj });
			}
		}

		// Landmarks: a sign comes up, then Rumi names the place.
		const nextAt = (landmarkIndex + 1) * LANDMARK_EVERY;
		if (!landmarkSign && nextAt - distance < 180) {
			const idx = landmarkIndex % LANDMARKS.length;
			const obj = landmarkModel(idx);
			world.add(obj);
			landmarkSign = { obj, z: nextAt - distance, index: idx, said: false };
		}
		if (landmarkSign) {
			landmarkSign.z = nextAt - distance;
			landmarkSign.obj.position.z = -landmarkSign.z * U;
			if (!landmarkSign.said && landmarkSign.z < 25) {
				landmarkSign.said = true;
				const lm = LANDMARKS[landmarkSign.index]!;
				say(`highway.landmark.${lm.id}`, { interrupt: true });
				if (lm.id === 'home') {
					confetti?.burst(new kit.THREE.Vector3(carX, 3, -8), 70, kit.TOY_COLORS);
					scheduler.after(1800, () => say('highway.home'));
				}
			}
			if (landmarkSign.z < -40) {
				disposeObj(landmarkSign.obj);
				landmarkSign = null;
				landmarkIndex += 1;
			}
		}

		// Colour prompt every ~25 s, about a vehicle the child can see. Optional; it just fades.
		if (!prompt && clock - lastPrompt > 25) {
			const target = traffic.find((v) => v.z > 50 && v.z < 150);
			if (target) {
				prompt = { id: target.id, since: clock };
				lastPrompt = clock;
				promptLabel = `${VEHICLE_COLORS[target.color].hex}|${target.kind}`;
				say(passKey(target.color, target.kind), { interrupt: true });
			}
		}
		if (prompt) {
			const t = traffic.find((v) => v.id === prompt!.id);
			if (!t || clock - prompt.since > 35) {
				prompt = null;
				promptLabel = '';
			}
		}

		for (const s of scenery) s.obj.position.z = wrapZ(s.base + offset, s.span);
		for (const sf of surfaces) sf.scroll(offset / sf.tile);

		// Rumi's car: glide between lanes, gentle bounce when moving.
		const tx = laneX(lane);
		carX += (tx - carX) * Math.min(1, dt * (d.reduced ? 20 : 6));
		car.position.x = carX;
		car.rotation.y = Math.PI + (carX - tx) * 0.15;
		car.position.y = d.reduced || speed < 3 ? 0 : Math.abs(Math.sin(clock * 15)) * 0.04;
		confetti?.update(dt, moved * 0.5);

		const cam = stage!.camera;
		const pose = camera === 'high' ? [carX * 0.5, 13, 13, -10] : camera === 'bumper' ? [carX, 1.6, 2.6, -20] : [carX * 0.6, 2.9, 7.2, -14];
		cam.position.x += (pose[0]! - cam.position.x) * Math.min(1, dt * 5);
		cam.position.y += (pose[1]! - cam.position.y) * Math.min(1, dt * 5);
		cam.position.z += (pose[2]! - cam.position.z) * Math.min(1, dt * 5);
		cam.lookAt(carX * 0.4, 1.2, pose[3]!);

		dashT += dt;
		if (dashT > 0.1) {
			dashT = 0;
			shownSpeed = Math.round(speed);
			shownGear = gearFor(speed);
			journey = (distance % (LANDMARK_EVERY * LANDMARKS.length)) / (LANDMARK_EVERY * LANDMARKS.length);
		}
	}

	function passed(v: TrafficVehicle & { obj: Kit.THREE.Group }) {
		passes += 1;
		if (kit && !d.reduced) confetti?.burst(new kit.THREE.Vector3(laneX(v.lane), 2, 2), 14, [VEHICLE_COLORS[v.color].hex, '#F2C94C', '#ffffff'], { speed: 0.5, up: 0.6 });
		chime();
		if (prompt && prompt.id === v.id) {
			say(passedKey(v.color, v.kind), { interrupt: true });
			prompt = null;
			promptLabel = '';
		} else if (passes % 5 === 1) say('highway.passed');
	}

	// ── Controls ────────────────────────────────────────────────────────────
	const driving = $derived(!!location && ready && !menuOpen && !$paused);

	function steer(dir: -1 | 1) {
		if (!driving) return;
		const to = lane + dir;
		if (to < 0 || to >= HIGHWAY_LANES) return;
		if (!laneIsClear(traffic, to)) {
			// Something alongside: a gentle "not now" wiggle, never a crash.
			refused = dir;
			scheduler.after(450, () => (refused = 0));
			return;
		}
		lane = to;
		hintDir = 0;
		hideHand();
	}
	function setPedal(which: 'gas' | 'brake', down: boolean) {
		pedals = { ...pedals, [which]: down && driving };
		if (down) hideHand();
	}

	let audio: AudioContext | null = null;
	function tone(freqs: number[], dur: number, vol: number) {
		const v = $settings.soundEnabled ? $settings.volume : 0;
		if (!(v > 0)) return;
		try {
			audio ??= new AudioContext();
			void audio.resume();
			const t0 = audio.currentTime;
			for (const [i, f] of freqs.entries()) {
				const o = audio.createOscillator();
				const g = audio.createGain();
				o.type = 'triangle';
				o.frequency.value = f;
				g.gain.setValueAtTime(0, t0 + i * dur);
				g.gain.linearRampToValueAtTime(vol * v, t0 + i * dur + 0.02);
				g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * dur);
				o.connect(g).connect(audio.destination);
				o.start(t0 + i * dur);
				o.stop(t0 + (i + 1) * dur + 0.02);
			}
		} catch {
			/* no audio: fine */
		}
	}
	const horn = () => driving && tone([392, 330], 0.18, 0.25);
	const chime = () => tone([784, 1046], 0.09, 0.12);

	function onkeydown(e: KeyboardEvent) {
		if (!location) return;
		if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
		if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
			menuOpen ? closeMenu() : openMenu();
			e.preventDefault();
			return;
		}
		if (menuOpen) return;
		if (e.key === 'ArrowLeft') steer(-1);
		else if (e.key === 'ArrowRight') steer(1);
		else if (e.key === 'ArrowUp') setPedal('gas', true);
		else if (e.key === 'ArrowDown') setPedal('brake', true);
		else if (e.key === 'h' || e.key === 'H' || e.key === ' ') horn();
		else return;
		e.preventDefault();
	}
	function onkeyup(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') setPedal('gas', false);
		else if (e.key === 'ArrowDown') setPedal('brake', false);
	}

	// ── Flow ────────────────────────────────────────────────────────────────
	function choose(loc: HighwayLocation) {
		location = loc;
		menuOpen = false;
		resetDrive();
		void buildWorld(loc).then(() => {
			if (!ready) return;
			instruct('highway.start');
			if (firstTime('highway')) scheduler.after(1500, () => showHand(['[data-testid="gas"]']));
		});
	}
	function resetDrive() {
		speed = 0;
		lane = 1;
		carX = laneX(1);
		offset = 0;
		distance = 0;
		landmarkIndex = 0;
		pedals = { gas: false, brake: false };
		prompt = null;
		promptLabel = '';
		lastPrompt = clock;
		passes = 0;
		minGapSeen = 999;
		rng = createHighwayRng(Date.now() >>> 0);
		for (const v of traffic) disposeObj(v.obj);
		traffic = [];
		if (landmarkSign) disposeObj(landmarkSign.obj);
		landmarkSign = null;
		confetti?.clear();
	}
	function openMenu() {
		if (!location) return;
		menuOpen = true;
		pedals = { gas: false, brake: false };
		stopNarration();
		say('highway.paused');
	}
	function closeMenu() {
		menuOpen = false;
	}
	function restart() {
		resetDrive();
		menuOpen = false;
		instruct('highway.start');
	}
	function nextCamera() {
		camera = camera === 'chase' ? 'high' : camera === 'high' ? 'bumper' : 'chase';
	}
	function changePlace() {
		menuOpen = false;
		disposeStage();
		location = null;
		instruct('highway.choose');
	}

	$effect(() => {
		void ready;
		stage?.setPaused($paused || menuOpen || !location);
		if ($paused) pedals = { gas: false, brake: false };
	});
	const offPause = paused.subscribe((p) => (p ? scheduler.pause() : scheduler.resume()));

	onMount(() => instruct('highway.choose'));
	onDestroy(() => {
		destroyed = true;
		offPause();
		scheduler.cancelAll();
		hideHand();
		leaveScreen();
		setIdlePrompt(null);
		disposeStage();
		void audio?.close();
	});

	const NEEDLE_MIN = -120;
	const needle = $derived(NEEDLE_MIN + (Math.min(shownSpeed, MAX_SPEED) / MAX_SPEED) * 240);
	const promptColor = $derived(promptLabel.split('|')[0] ?? '');
	const promptKind = $derived(promptLabel.split('|')[1] ?? '');
	const kindIcon: Record<string, string> = { car: '🚗', truck: '🚚', bus: '🚌' };
</script>

<svelte:window {onkeydown} {onkeyup} onblur={() => (pedals = { gas: false, brake: false })} />

<TopBar onreplay={() => instruct(location ? 'highway.start' : 'highway.choose')} />

<section
	class="highway"
	data-location={location ?? undefined}
	data-ready={ready}
	data-lane={lane}
	data-speed={shownSpeed}
	data-gear={shownGear}
	data-camera={camera}
	data-menu={menuOpen}
	data-passes={passes}
	data-min-gap={minGapSeen}
>
	{#if !location}
		<div class="places">
			{#each LOCATIONS as l (l.id)}
				<button class="place {l.id}" data-place={l.id} aria-label={label(`highway.location.${l.id}`)} onfocus={() => speakLabel(`highway.location.${l.id}`)} onclick={() => choose(l.id)}>
					<span class="scene-icon" aria-hidden="true">{l.icon}🚗</span>
					<span class="name">{label(`highway.location.${l.id}`)}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="drive" class:hidden={!location}>
		<div class="view game-viewport">
			{#key canvasKey}<canvas bind:this={canvas} aria-hidden="true"></canvas>{/key}
			{#if location && !ready && !failed}<RumiLoading overlay delay={150} />{/if}
			{#if failed}
				<div class="failed"><p>🚗</p><GameButton action="choose-game" onclick={() => goto('/play')} /></div>
			{/if}

			<button class="pause-btn" data-testid="pause" aria-label={label('highway.menu')} onfocus={() => speakLabel('highway.menu')} onclick={openMenu}>
				<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
			</button>

			<!-- Journey to home: pictures only, no numbers. -->
			<div class="journey" aria-hidden="true">
				{#each LANDMARKS as lm, i (lm.id)}
					<span class="stop" style:left="{((i + 1) / LANDMARKS.length) * 100}%">{lm.icon}</span>
				{/each}
				<span class="me" style:left="{journey * 100}%">🚗</span>
			</div>

			{#if promptLabel}
				<div class="prompt" aria-hidden="true"><span class="swatch" style:background={promptColor}></span>{kindIcon[promptKind]}</div>
			{/if}

			<!-- Dashboard: a dial a child can read without numbers, plus the number for grown-ups. -->
			<div class="dash" aria-hidden="true">
				<svg viewBox="0 0 120 80" width="150" height="100">
					<path d="M12 70 A50 50 0 1 1 108 70" fill="none" stroke="#ffffff33" stroke-width="10" stroke-linecap="round" />
					<path d="M12 70 A50 50 0 1 1 108 70" fill="none" stroke="#35A66A" stroke-width="10" stroke-linecap="round" pathLength="100" stroke-dasharray="{(Math.min(shownSpeed, MAX_SPEED) / MAX_SPEED) * 100} 100" />
					<line x1="60" y1="62" x2="60" y2="22" stroke="#F2C94C" stroke-width="4" stroke-linecap="round" transform="rotate({needle} 60 62)" />
					<circle cx="60" cy="62" r="6" fill="#F2C94C" />
				</svg>
				<div class="dash-text">
					<strong>{num(shownSpeed)}</strong><small>{bn ? 'কিমি/ঘণ্টা' : 'km/h'}</small>
					<span class="gear">{bn ? 'গিয়ার' : 'Gear'} {num(shownGear)}</span>
				</div>
			</div>

			{#if menuOpen}
				<div class="menu" role="dialog" aria-modal="true" aria-label={label('highway.paused')}>
					<h2>⏸ {label('highway.paused')}</h2>
					<p class="where">{LOCATIONS.find((l) => l.id === location)?.icon} {location ? label(`highway.location.${location}`) : ''}</p>
					<button class="menu-btn go" data-testid="continue" onfocus={() => speakLabel('highway.continue')} onclick={closeMenu}>▶ {label('highway.continue')}</button>
					<button class="menu-btn" data-testid="restart" onfocus={() => speakLabel('highway.restart')} onclick={restart}>↻ {label('highway.restart')}</button>
					<button class="menu-btn" data-testid="camera" onfocus={() => speakLabel('highway.camera')} onclick={nextCamera}>🎥 {label('highway.camera')}</button>
					<button class="menu-btn" data-testid="place" onfocus={() => speakLabel('highway.place')} onclick={changePlace}>🗺️ {label('highway.place')}</button>
					<GameButton action="choose-game" onclick={() => goto('/play')} />
				</div>
			{/if}
		</div>

		<div class="controls">
			<div class="steer-pair">
				<button class="steer" class:hint={hintDir === -1} class:refused={refused === -1} data-steer="left" aria-label={label('drive.left')} onfocus={() => speakLabel('drive.left')} onclick={() => steer(-1)}>
					<svg viewBox="0 0 48 48" width="54" height="54" aria-hidden="true"><path d="M30 10 L14 24 L30 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
				</button>
				<button class="steer" class:hint={hintDir === 1} class:refused={refused === 1} data-steer="right" aria-label={label('drive.right')} onfocus={() => speakLabel('drive.right')} onclick={() => steer(1)}>
					<svg viewBox="0 0 48 48" width="54" height="54" aria-hidden="true"><path d="M18 10 L34 24 L18 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
				</button>
			</div>
			<button class="horn" data-testid="horn" aria-label={label('highway.horn')} onfocus={() => speakLabel('highway.horn')} onclick={horn}>📯</button>
			<div class="pedals">
				<button
					class="pedal brake"
					data-testid="brake"
					aria-label={label('highway.brake')}
					onfocus={() => speakLabel('highway.brake')}
					onpointerdown={() => setPedal('brake', true)}
					onpointerup={() => setPedal('brake', false)}
					onpointerleave={() => setPedal('brake', false)}
					onpointercancel={() => setPedal('brake', false)}
				><span aria-hidden="true">■</span></button>
				<button
					class="pedal gas"
					data-testid="gas"
					aria-label={label('highway.gas')}
					onfocus={() => speakLabel('highway.gas')}
					onpointerdown={() => setPedal('gas', true)}
					onpointerup={() => setPedal('gas', false)}
					onpointerleave={() => setPedal('gas', false)}
					onpointercancel={() => setPedal('gas', false)}
				><span aria-hidden="true">▲</span></button>
			</div>
		</div>
	</div>
</section>

<style>
	.highway {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		padding: 0 20px 14px;
	}
	.places {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 32px;
	}
	.place {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		width: 250px;
		padding: 26px 18px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		cursor: pointer;
		transition: transform 200ms ease;
	}
	.place:hover,
	.place:focus-visible {
		transform: translateY(-6px);
	}
	.place.green { background: linear-gradient(#bfe3f7, #dff3d4 60%, #9ed17e); }
	.place.city { background: linear-gradient(#cfdcec, #eef2f6 60%, #b9c0c8); }
	.place.sunset { background: linear-gradient(#a58bd0, #f6c58b 60%, #e8c48a); }
	.scene-icon {
		font-size: 64px;
		letter-spacing: 6px;
	}
	.name {
		font-size: 26px;
		font-weight: 700;
	}
	.drive {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
	}
	.drive.hidden {
		position: absolute;
		inset: 0;
		visibility: hidden;
		pointer-events: none;
	}
	.view {
		position: relative;
		flex: 1;
		min-height: 260px;
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
	.failed {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 12px;
		font-size: 80px;
	}
	.failed p {
		margin: 0;
	}
	.pause-btn {
		position: absolute;
		top: 12px;
		left: 12px;
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border: 0;
		border-radius: 18px;
		background: #263238cc;
		color: #ffffff;
		cursor: pointer;
	}
	.journey {
		position: absolute;
		top: 22px;
		left: 50%;
		width: min(420px, 50%);
		height: 34px;
		transform: translateX(-50%);
		border-radius: 17px;
		background: #ffffffcc;
	}
	.journey .stop,
	.journey .me {
		position: absolute;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 22px;
	}
	.journey .me {
		font-size: 26px;
		transition: left 200ms linear;
	}
	.prompt {
		position: absolute;
		top: 70px;
		left: 50%;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 16px;
		transform: translateX(-50%);
		border-radius: 20px;
		background: #ffffffe6;
		font-size: 40px;
		animation: bob 1s ease-in-out infinite alternate;
	}
	.swatch {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		border: 3px solid #263238;
	}
	.dash {
		position: absolute;
		right: 14px;
		bottom: 12px;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 6px 14px 6px 6px;
		border-radius: 22px;
		background: #263238d9;
		color: #ffffff;
	}
	.dash-text {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1.1;
	}
	.dash-text strong {
		font-size: 34px;
	}
	.dash-text small {
		font-size: 14px;
		opacity: 0.8;
	}
	.gear {
		margin-top: 4px;
		padding: 1px 8px;
		border-radius: 8px;
		background: #F2C94C;
		color: #263238;
		font-weight: 700;
		font-size: 16px;
	}
	.menu {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: #1c2328d9;
		color: #ffffff;
	}
	.menu h2 {
		margin: 0;
		font-size: 34px;
		color: #F2C94C;
	}
	.where {
		margin: 0 0 6px;
		font-size: 20px;
	}
	.menu-btn {
		width: min(380px, 80%);
		min-height: 60px;
		border: 2px solid #ffffff33;
		border-radius: 16px;
		background: #ffffff1a;
		color: #ffffff;
		font-size: 24px;
		font-weight: 700;
		cursor: pointer;
	}
	.menu-btn.go {
		background: #F2C94C;
		color: #263238;
		border-color: #F2C94C;
	}
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.steer-pair,
	.pedals {
		display: flex;
		gap: 16px;
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
	}
	.steer.hint {
		border-color: #F2C94C;
		animation: glow 0.8s ease-in-out infinite alternate;
	}
	.steer.refused {
		animation: wiggle 0.45s ease-in-out;
	}
	.horn {
		width: 84px;
		height: 84px;
		border-radius: 50%;
		border: 4px solid var(--border-soft);
		background: var(--surface);
		font-size: 40px;
		cursor: pointer;
	}
	.pedal {
		width: 96px;
		height: 120px;
		border-radius: 22px;
		border: 4px solid #263238;
		font-size: 40px;
		color: #ffffff;
		cursor: pointer;
		touch-action: none;
		user-select: none;
		background-image: repeating-linear-gradient(0deg, #ffffff22 0 8px, transparent 8px 16px);
	}
	.pedal:active {
		transform: scale(0.95) translateY(3px);
	}
	.pedal.brake {
		background-color: #E5484D;
		width: 104px;
		height: 96px;
	}
	.pedal.gas {
		background-color: #35A66A;
	}
	@keyframes glow {
		from { box-shadow: 0 0 0 0 #F2C94C00; }
		to { box-shadow: 0 0 0 10px #F2C94C88; }
	}
	@keyframes wiggle {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-6px); }
		75% { transform: translateX(6px); }
	}
	@keyframes bob {
		from { transform: translate(-50%, 0); }
		to { transform: translate(-50%, -6px); }
	}
	@media (prefers-reduced-motion: reduce) {
		.steer.hint, .steer.refused, .prompt { animation: none; }
	}
	@media (max-height: 700px) {
		.steer { width: 76px; height: 76px; }
		.pedal { width: 80px; height: 90px; }
		.pedal.brake { width: 86px; height: 76px; }
		.horn { width: 68px; height: 68px; font-size: 32px; }
	}
</style>
