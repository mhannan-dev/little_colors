<script lang="ts">
	/**
	 * Rumi's Train (রুমির রেলগাড়ি): a calm 3D train ride past paddy fields, over a river bridge,
	 * through a village and the tea hills. Each station has a colour and a big number; animal
	 * friends wait on the platform and the child taps each one to climb aboard while Rumi counts.
	 * Toot the whistle, ride on; at home everyone hops off and waves. No steering, no clock, no
	 * score, every friend always gets a seat (PR-07). three.js loads only on this screen; without
	 * WebGL the same trip runs as big flat buttons.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		arriveSpeed,
		createTrainTrip,
		formatNumeral,
		narrationText,
		RIDERS,
		seatFor,
		STATION_COLORS,
		wagonsFor,
		type Rider,
		type TrainScenery,
		type TrainStop
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, instructAll, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { chime } from '#lib/game/chime.ts';
	import { ANIMAL_CALL, chug, whistle } from '#lib/game/toySounds.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import type * as Kit from '#lib/three3d/toyKit.ts';
	import type * as Animals from '#lib/three3d/animals.ts';

	const d = durations();
	const scheduler = createScheduler();
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);

	const MAX_SPEED = 7;
	const WAGON_GAP = 3.5;
	/** Where the train's nose stops at each station (three stations, then home). */
	const STOP_X = [44, 104, 164, 224];
	/** Platforms stand on the far side of the track so the canopy never hides the train. */
	const PLATFORM_Z = -2.9;
	const RIDER_ICON: Record<Rider, string> = { cat: '🐱', dog: '🐶', duck: '🦆', goat: '🐐', rabbit: '🐰', cow: '🐮', hen: '🐔', sheep: '🐑' };

	// svelte-ignore state_referenced_locally
	let trip = $state<TrainStop[]>(createTrainTrip($settings.difficulty, Date.now() >>> 0));
	/** 'ready': waiting to start · 'run': moving · 'board': friends climbing on · 'aboard': all on, toot! · 'home': the end. */
	let phase = $state<'ready' | 'run' | 'board' | 'aboard' | 'home'>('ready');
	/** Index of the station the train is at or heading to (3 = home). */
	let stop = $state(0);
	let boardedHere = $state(0);
	let totalBoarded = $state(0);
	let whistles = $state(0);
	let finished = $state(false);
	let mascot = $state<MascotAnimation>('wave');
	const station = $derived<TrainStop | undefined>(trip[stop]);
	const needHere = $derived(station?.riders.length ?? 0);

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

	let train: Kit.THREE.Group | null = null;
	let wagons: Kit.THREE.Group[] = [];
	let wheels: Kit.THREE.Mesh[] = [];
	let trainX = 0;
	let speed = 0;
	let chugDist = 0;
	let camX = 0;
	let sceneryTold = new Set<number>();
	type Tween = { from: Kit.THREE.Vector3; to: Kit.THREE.Vector3; t: number; dur: number; arc: number; then?: () => void };
	interface RiderObj {
		stop: number;
		index: number;
		kind: Rider;
		obj: Kit.THREE.Object3D;
		state: 'wait' | 'hop' | 'seated' | 'off';
		tween: Tween | null;
		hop: number;
		home: Kit.THREE.Vector3;
	}
	let riders: RiderObj[] = [];
	let steam: { mesh: Kit.THREE.Mesh; life: number }[] = [];
	let steamTimer = 0;
	let spots = $state<Record<string, { x: number; y: number }>>({});
	let frameCount = 0;

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
			stage = kit.createStage(canvas, { fov: 46, background: '#CFE8F7', skyTop: '#7DB8E8' });
		} catch {
			failed = true;
			return;
		}
		stage.scene.fog = new THREE.Fog('#d6e9f2', 40, 95);
		try {
			disposeSky = await kit.useHdriSky(stage, '/hdri/sky_partly_cloudy_2k.hdr', { background: true, intensity: 0.85 });
		} catch {
			/* painted sky stays */
		}
		if (destroyed || !stage) return;
		buildWorld();
		buildTrain();
		buildStations();
		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused);
		placeCamera(true);
		ready = true;
	}

	const std = (color: string, roughness = 0.8) => new kit!.THREE.MeshStandardMaterial({ color, roughness });
	function add(o: Kit.THREE.Object3D, x: number, y: number, z: number, parent?: Kit.THREE.Object3D) {
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
	/** Small seeded noise so scenery is the same every ride. */
	const noise = (i: number) => {
		const s = Math.sin(i * 127.1) * 43758.5453;
		return s - Math.floor(s);
	};

	function buildWorld() {
		const { THREE } = kit!;
		const s = stage!;
		const grass = kit!.pbrMaterial('/textures/highway/grass', [60, 24], '#c4e5a0');
		disposers.push(grass.dispose);
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(320, 130), grass.material);
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(110, 0, -20);
		ground.receiveShadow = true;
		s.scene.add(ground);

		// Track: gravel bed, sleepers, two shiny rails.
		const bed = new THREE.Mesh(new THREE.BoxGeometry(300, 0.12, 2.4), std('#A89F94', 1));
		bed.position.set(110, 0.06, 0);
		bed.receiveShadow = true;
		s.scene.add(bed);
		const sleeperGeo = new THREE.BoxGeometry(0.35, 0.08, 1.9);
		const sleepers = new THREE.InstancedMesh(sleeperGeo, std('#6E5440', 0.9), 300);
		const m4 = new THREE.Matrix4();
		for (let i = 0; i < 300; i++) sleepers.setMatrixAt(i, m4.makeTranslation(-40 + i, 0.15, 0));
		sleepers.receiveShadow = true;
		s.scene.add(sleepers);
		for (const z of [-0.55, 0.55]) {
			const rail = new THREE.Mesh(new THREE.BoxGeometry(300, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: '#B8BEC6', metalness: 0.8, roughness: 0.3 }));
			rail.position.set(110, 0.24, z);
			s.scene.add(rail);
		}

		// Scenery between stations: 0 field, 1 bridge, 2 village, 3 tea hills.
		const segments: [TrainScenery, number, number][] = [
			['field', -30, STOP_X[0]! - 10],
			['bridge', STOP_X[0]! + 6, STOP_X[1]! - 10],
			['village', STOP_X[1]! + 6, STOP_X[2]! - 10],
			['tea', STOP_X[2]! + 6, STOP_X[3]! + 30]
		];
		for (const [kind, x0, x1] of segments) {
			if (kind === 'field') paddy(x0, x1);
			if (kind === 'bridge') river((x0 + x1) / 2);
			if (kind === 'village') village(x0, x1);
			if (kind === 'tea') tea(x0, x1);
			palms(x0, x1, kind === 'tea' ? 3 : 7);
		}
	}

	function palm(x: number, z: number, h = 4) {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, h, 8), std('#8B6B4E'));
		trunk.position.y = h / 2;
		trunk.rotation.z = 0.08;
		g.add(trunk);
		for (let k = 0; k < 7; k++) {
			const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.3, 2.2, 4), std('#3E8E4A'));
			leaf.scale.set(1, 1, 0.25);
			const pivot = new THREE.Group();
			pivot.rotation.y = (k / 7) * Math.PI * 2;
			pivot.add(leaf);
			leaf.position.set(0.9, h - 0.1, 0);
			leaf.rotation.set(0, 0, -1.25);
			g.add(pivot);
		}
		add(g, x, 0, z);
	}
	function palms(x0: number, x1: number, n: number) {
		for (let k = 0; k < n; k++) {
			const x = x0 + ((k + 0.5) / n) * (x1 - x0);
			palm(x + noise(x) * 4, -9 - noise(x + 1) * 10, 3.5 + noise(x + 2) * 2);
			if (k % 2) palm(x + 2, 9 + noise(x + 3) * 6, 3.4 + noise(x + 4) * 1.5);
		}
	}
	function paddy(x0: number, x1: number) {
		const { THREE } = kit!;
		const rows = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.35, 0.35), std('#7CC35A', 1), 400);
		const m4 = new THREE.Matrix4();
		let i = 0;
		for (let x = x0; x < x1 && i < 400; x += 1.3) {
			for (const z of [-4.5, -5.6, -6.7, -7.8, 5, 6.1, 7.2]) {
				if (i >= 400) break;
				m4.makeScale(1, 0.7 + noise(x * z) * 0.5, 1).setPosition(x, 0.15, z);
				rows.setMatrixAt(i++, m4);
			}
		}
		rows.count = i;
		rows.castShadow = true;
		stage!.scene.add(rows);
		const water = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 5), std('#9CCFD9', 0.2));
		water.rotation.x = -Math.PI / 2;
		water.position.set((x0 + x1) / 2, 0.02, -6.2);
		stage!.scene.add(water);
	}
	function river(cx: number) {
		const { THREE } = kit!;
		const water = new THREE.Mesh(new THREE.PlaneGeometry(14, 140), new THREE.MeshPhysicalMaterial({ color: '#4FA3D1', roughness: 0.1, clearcoat: 1 }));
		water.rotation.x = -Math.PI / 2;
		water.position.set(cx, 0.03, -20);
		stage!.scene.add(water);
		for (const sx of [-1, 1]) {
			const bank = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 140), std('#B79C74', 1));
			bank.position.set(cx + sx * 7.4, 0.05, -20);
			stage!.scene.add(bank);
		}
		// Red steel bridge: side girders with diagonal trusses, piers in the water.
		const steel = std('#C8453C', 0.5);
		for (const z of [-1.4, 1.4]) {
			for (const y of [0.4, 2.6]) add(new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 0.2), steel), cx, y, z);
			for (let k = -4; k <= 4; k++) {
				const diag = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), steel);
				diag.rotation.z = k % 2 ? 0.6 : -0.6;
				add(diag, cx + k * 1.8, 1.5, z);
			}
		}
		for (const k of [-4, 0, 4]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.2, 12), std('#9AA0A6')), cx + k, -0.3, 0);
		// A little country boat.
		const boat = new THREE.Group();
		const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.4, 3.4, 12, 1, false, 0, Math.PI), std('#8A5A3C'));
		hull.rotation.set(Math.PI / 2, 0, Math.PI / 2);
		hull.rotation.order = 'YXZ';
		const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#E0B84E', side: THREE.DoubleSide }));
		roof.rotation.x = Math.PI / 2;
		roof.position.y = 0.4;
		boat.add(hull, roof);
		boat.rotation.y = Math.PI / 2;
		add(boat, cx + 2, 0.2, -10);
	}
	function village(x0: number, x1: number) {
		const { THREE } = kit!;
		const walls = ['#F1D7A8', '#E8C1A0', '#F5E6C8', '#D9E4C3'];
		const roofs = ['#8E9AA6', '#C8453C', '#3F7FB5', '#8E9AA6'];
		for (let k = 0; k < 8; k++) {
			const x = x0 + 4 + k * ((x1 - x0 - 8) / 7);
			const side = k % 2 ? 1 : -1;
			const h = new THREE.Group();
			const body = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.4), std(walls[k % 4]!));
			body.position.y = 1;
			const roofShape = new THREE.Shape();
			roofShape.moveTo(-1.8, 0);
			roofShape.lineTo(0, 1.2);
			roofShape.lineTo(1.8, 0);
			roofShape.closePath();
			const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 2.8, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: roofs[k % 4], metalness: 0.4, roughness: 0.45 }));
			roof.position.set(0, 2, -1.4);
			const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.05), std('#7A5A44'));
			door.position.set(0, 0.6, 1.22);
			h.add(body, roof, door);
			add(h, x, 0, side * (8 + noise(k) * 3));
			h.rotation.y = side > 0 ? Math.PI : 0;
			const stack = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 12), std('#E7C35A', 1));
			add(stack, x + 2.4, 0.9, side * (7 + noise(k + 9) * 2));
		}
	}
	function tea(x0: number, x1: number) {
		const { THREE } = kit!;
		const bushGeo = new THREE.SphereGeometry(0.45, 10, 8);
		const bushes = new THREE.InstancedMesh(bushGeo, std('#2F7D3B', 0.9), 500);
		const m4 = new THREE.Matrix4();
		let i = 0;
		for (let x = x0; x < x1 && i < 500; x += 1.1) {
			for (let r = 0; r < 6 && i < 500; r++) {
				const z = -5 - r * 1.3;
				const hill = Math.sin((x - x0) * 0.08) * 1.2 + r * 0.45;
				m4.makeScale(1.1, 0.7, 1).setPosition(x + (r % 2) * 0.5, 0.25 + hill, z);
				bushes.setMatrixAt(i++, m4);
			}
		}
		bushes.count = i;
		bushes.castShadow = true;
		stage!.scene.add(bushes);
		for (let k = 0; k < 4; k++) {
			const hill = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), std('#5FA055', 1));
			hill.scale.set(1.6, 0.35, 1);
			add(hill, x0 + 10 + k * 16, 0, -18 - (k % 2) * 4);
		}
	}

	function buildTrain() {
		const { THREE } = kit!;
		const plastic = stage!.surface('plastic');
		const paint = (c: string) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, normalMap: plastic.normalMap });
		train = new THREE.Group();
		wheels = [];
		const wheel = (parent: Kit.THREE.Object3D, x: number, r = 0.42) => {
			for (const z of [-0.62, 0.62]) {
				const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 18), std('#2E2E38', 0.5));
				w.rotation.x = Math.PI / 2;
				w.position.set(x, r + 0.15, z);
				const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.2, 12), std('#E5484D', 0.4));
				hub.rotation.x = Math.PI / 2;
				hub.position.set(x, r + 0.15, z * 1.02);
				parent.add(w, hub);
				wheels.push(w);
			}
		};
		// Locomotive (nose at x = 0).
		const loco = new THREE.Group();
		const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 1.6), paint('#2E2E38'));
		base.position.set(-1.4, 0.75, 0);
		const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.2, 20), paint('#E5484D'));
		boiler.rotation.z = Math.PI / 2;
		boiler.position.set(-0.9, 1.55, 0);
		const front = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.12, 20), paint('#F2C94C'));
		front.rotation.z = Math.PI / 2;
		front.position.set(0.22, 1.55, 0);
		const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), new THREE.MeshStandardMaterial({ color: '#FFF4B0', emissive: '#FFE58A', emissiveIntensity: 0.8 }));
		lamp.position.set(0.3, 1.75, 0);
		const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.9, 14), paint('#2E2E38'));
		chimney.position.set(-0.4, 2.45, 0);
		const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), paint('#F2C94C'));
		dome.position.set(-1.1, 2.15, 0);
		const cab = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.6), paint('#3478D4'));
		cab.position.set(-2.4, 1.7, 0);
		const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.16, 1.9), paint('#2E2E38'));
		cabRoof.position.set(-2.4, 2.55, 0);
		const window1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.02), std('#BFE3F5', 0.1));
		window1.position.set(-2.4, 1.95, 0.81);
		const cow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 4), paint('#F2C94C'));
		cow.rotation.set(0, Math.PI / 4, -Math.PI / 2);
		cow.scale.set(1, 1, 1.6);
		cow.position.set(0.55, 0.65, 0);
		loco.add(base, boiler, front, lamp, chimney, dome, cab, cabRoof, window1, cow);
		// Rumi waves from the cab window.
		const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), std('#E3B48A', 0.7));
		head.position.set(-2.4, 2.0, 0.5);
		for (const sz of [-1, 1]) {
			const ear = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), std('#E3B48A', 0.7));
			ear.position.set(-2.4, 2.28, 0.5 + sz * 0.22);
			loco.add(ear);
		}
		const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), std('#FFF1E0'));
		muzzle.position.set(-2.4, 1.92, 0.78);
		loco.add(head, muzzle);
		wheel(loco, -0.5, 0.36);
		wheel(loco, -1.6, 0.5);
		wheel(loco, -2.7, 0.5);
		train.add(loco);
		// Open wagons, one colour each.
		const n = wagonsFor(trip);
		wagons = [];
		for (let k = 0; k < n; k++) {
			const w = new THREE.Group();
			const color = kit!.TOY_COLORS[(k * 2 + 1) % kit!.TOY_COLORS.length]!;
			const floor = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 1.6), paint('#8A6A52'));
			floor.position.y = 0.8;
			w.add(floor);
			for (const [sx, sz, lx, lz] of [[0, -0.75, 3, 0.1], [0, 0.75, 3, 0.1], [-1.45, 0, 0.1, 1.6], [1.45, 0, 0.1, 1.6]] as const) {
				const wall = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.5, lz), paint(color));
				wall.position.set(sx, 1.15, sz);
				w.add(wall);
			}
			wheel(w, -0.9, 0.36);
			wheel(w, 0.9, 0.36);
			w.position.x = -3.4 - WAGON_GAP * (k + 0.5);
			const link = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), std('#2E2E38'));
			link.position.set(1.75, 0.7, 0);
			w.add(link);
			train.add(w);
			wagons.push(w);
		}
		add(train, trainX, 0, 0);
	}

	function stationX(i: number) {
		return STOP_X[i]!;
	}
	function buildStations() {
		const { THREE } = kit!;
		riders = [];
		const A = animals!;
		for (let i = 0; i < 4; i++) {
			const x = stationX(i) - 5;
			const color = i < 3 ? STATION_COLORS[trip[i]!.color].hex : '#FF8FA3';
			const g = new THREE.Group();
			const deck = new THREE.Mesh(new THREE.BoxGeometry(14, 0.55, 3), std('#D8CFC2', 0.9));
			deck.position.set(0, 0.28, 0);
			const edge = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 0.3), std('#F2C94C', 0.6));
			edge.position.set(0, 0.58, 1.35);
			g.add(deck, edge);
			for (const px of [-5.5, 0, 5.5]) {
				const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.8, 10), std('#F6EEE0'));
				post.position.set(px, 1.95, -1.1);
				g.add(post);
			}
			const roof = new THREE.Mesh(new THREE.BoxGeometry(14.6, 0.25, 3.4), new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.6 }));
			roof.position.set(0, 3.4, -0.6);
			roof.rotation.x = 0.1;
			g.add(roof);
			// Big sign: the colour and the station number (home has a heart).
			const glyph = i < 3 ? num(trip[i]!.number) : '♥';
			const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 0.12), new THREE.MeshStandardMaterial({ map: kit!.glyphTexture(glyph, color), roughness: 0.5 }));
			sign.position.set(6.4, 2.4, 0.9);
			sign.rotation.y = -0.25;
			const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), std('#F6EEE0'));
			pole.position.set(6.4, 0.8, 0.9);
			g.add(sign, pole);
			if (i === 3) {
				for (let b = 0; b < 6; b++) {
					const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 12), new THREE.MeshPhysicalMaterial({ color: kit!.TOY_COLORS[b]!, roughness: 0.25, clearcoat: 1 }));
					balloon.scale.set(1, 1.2, 1);
					balloon.position.set(-5.5 + b * 2.2, 4.3 + (b % 2) * 0.4, -1.2);
					g.add(balloon);
				}
			}
			add(g, x, 0, PLATFORM_Z);
			// Friends waiting on the platform.
			if (i < 3) {
				trip[i]!.riders.forEach((kind, j) => {
					const a = A.toyAnimal(kind);
					a.scale.setScalar(1.15);
					add(a, x - 3.5 + j * 1.5, 0.56, PLATFORM_Z + 0.4);
					a.rotation.y = -0.25;
					riders.push({ stop: i, index: j, kind, obj: a, state: 'wait', tween: null, hop: -1, home: a.position.clone() });
				});
			}
		}
	}

	const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

	function placeCamera(snap = false) {
		if (!stage) return;
		const target = trainX - 4;
		camX = snap ? target : camX + (target - camX) * 0.06;
		stage.camera.position.set(camX - 2, 8.2, 14.5);
		stage.camera.lookAt(camX + 1.5, 1.0, -1);
	}

	function frame(dt: number, t: number) {
		const { THREE } = kit!;
		if (phase === 'run' && train) {
			const target = stationX(stop);
			const remaining = target - trainX;
			speed = Math.min(speed + 2.2 * dt, arriveSpeed(remaining, MAX_SPEED, 2.4));
			trainX += speed * dt;
			train.position.x = trainX;
			for (const w of wheels) w.rotation.y -= (speed * dt) / 0.45;
			chugDist += speed * dt;
			if (chugDist > 2.2) {
				chugDist = 0;
				chug(Math.min(1, speed / MAX_SPEED + 0.3));
			}
			// Tell what we're passing, once per stretch.
			const segStart = stop === 0 ? 0 : stationX(stop - 1);
			if (!sceneryTold.has(stop) && trainX > segStart + (target - segStart) * 0.35) {
				sceneryTold.add(stop);
				const kind: TrainScenery = (['field', 'bridge', 'village', 'tea'] as const)[stop]!;
				say(`rail.scene.${kind}`);
			}
			if (remaining < 0.02 || (speed < 0.02 && remaining < 0.4)) arrive();
		}
		// Gentle chuff of steam while moving.
		steamTimer -= dt;
		if (train && speed > 0.5 && steamTimer <= 0 && !d.reduced) {
			steamTimer = 0.32;
			puff(0.5);
		}
		for (let i = steam.length - 1; i >= 0; i--) {
			const p = steam[i]!;
			p.life -= dt;
			p.mesh.position.y += dt * 1.2;
			p.mesh.position.x -= dt * (0.6 + speed * 0.5);
			p.mesh.scale.multiplyScalar(1 + dt * 0.9);
			(p.mesh.material as Kit.THREE.MeshStandardMaterial).opacity = Math.max(0, p.life / 1.6) * 0.75;
			if (p.life <= 0) {
				stage!.scene.remove(p.mesh);
				(p.mesh.material as Kit.THREE.Material).dispose();
				steam.splice(i, 1);
			}
		}
		for (const r of riders) {
			if (r.tween) {
				const tw = r.tween;
				tw.t = Math.min(1, tw.t + dt / tw.dur);
				const k = ease(tw.t);
				r.obj.position.lerpVectors(tw.from, tw.to, k);
				r.obj.position.y += Math.sin(k * Math.PI) * tw.arc;
				if (tw.t >= 1) {
					r.tween = null;
					tw.then?.();
				}
			} else if (r.hop >= 0) {
				r.hop += dt;
				const h = kit!.squashHop(r.hop, 0.7);
				r.obj.position.y = r.home.y + h.y;
				if (h.done) r.hop = phase === 'home' ? 0 : -1;
			}
			const parts = (r.obj.userData as Animals.ToyAnimal['userData']).parts;
			if (parts) {
				parts.head.rotation.x = Math.sin(t * 1.6 + r.index) * 0.08;
				if (parts.tail) parts.tail.rotation.z = Math.sin(t * 5 + r.index) * 0.35;
			}
		}
		confetti?.update(dt);
		placeCamera();
		void THREE;
		if (++frameCount % 3 === 0) updateSpots();
	}

	function puff(size: number) {
		const { THREE } = kit!;
		if (!train || steam.length > 24) return;
		const m = new THREE.Mesh(steamGeo ??= new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.75, roughness: 1, depthWrite: false }));
		m.position.set(trainX - 0.4, 3.0, 0);
		m.scale.setScalar(size + Math.random() * 0.3);
		stage!.scene.add(m);
		steam.push({ mesh: m, life: 1.6 });
	}
	let steamGeo: Kit.THREE.SphereGeometry | null = null;

	function updateSpots() {
		if (!stage) return;
		const next: Record<string, { x: number; y: number }> = {};
		for (const r of riders) {
			if (r.state !== 'wait' || r.stop !== stop || phase !== 'board') continue;
			next[`${r.stop}-${r.index}`] = stage.toScreen(r.obj.position.clone().setY(r.obj.position.y + 0.7));
		}
		spots = next;
	}

	// ── the ride ──
	function go() {
		if (phase === 'run' || phase === 'board' || phase === 'home') return;
		hideHand();
		setIdlePrompt(null);
		if (phase === 'aboard') {
			whistle();
			whistles += 1;
			for (let k = 0; k < 3; k++) scheduler.after(k * 120, () => puff(0.9));
			stop += 1;
		}
		say('rail.go', { interrupt: true });
		mascot = 'idle';
		boardedHere = 0;
		phase = 'run';
		if (failed) scheduler.after(d.reduced ? 300 : 1200, arrive);
	}

	function toot() {
		// All aboard: the whistle is also the "off we go" button.
		if (phase === 'aboard') return go();
		whistle();
		whistles += 1;
		say('rail.whistle', { interrupt: true });
		for (let k = 0; k < 3; k++) scheduler.after(k * 120, () => puff(0.9));
	}

	function arrive() {
		if (phase !== 'run') return;
		speed = 0;
		if (train) {
			trainX = stationX(stop);
			train.position.x = trainX;
		}
		if (stop >= 3) return arriveHome();
		phase = 'board';
		mascot = 'wave';
		const s = trip[stop]!;
		instructAll([`rail.color.${s.color}`, `number.${s.number}`, 'rail.number', 'rail.board']);
		setIdlePrompt('rail.board');
		scheduler.after(d.reduced ? 2000 : 6500, () => {
			if (phase === 'board' && boardedHere === 0) showHand([`[data-rider="${stop}-0"]`]);
		});
	}

	function board(r: RiderObj) {
		if (phase !== 'board' || r.state !== 'wait' || r.stop !== stop) return;
		hideHand();
		r.state = 'hop';
		const seatNo = totalBoarded;
		totalBoarded += 1;
		boardedHere += 1;
		const n = boardedHere;
		ANIMAL_CALL[r.kind]?.();
		say(`number.${n}`, { interrupt: true });
		const done = () => {
			r.state = 'seated';
			if (n === needHere) allAboard();
		};
		const { wagon, seat } = seatFor(seatNo);
		const w = wagons[Math.min(wagon, wagons.length - 1)];
		if (!w || !kit) return done();
		const world = new kit.THREE.Vector3(-1 + seat, 0.95, 0);
		w.localToWorld(world);
		r.tween = { from: r.obj.position.clone(), to: world, t: 0, dur: d.reduced ? 0.15 : 0.75, arc: d.reduced ? 0 : 1.6, then: () => {
			w.attach(r.obj);
			r.obj.rotation.set(0, Math.PI / 2, 0);
			r.obj.scale.setScalar(0.95);
			done();
		} };
	}

	function allAboard() {
		phase = 'aboard';
		chime();
		mascot = 'celebrate';
		say('rail.all-aboard');
		setIdlePrompt('rail.all-aboard');
		scheduler.after(d.reduced ? 1500 : 4500, () => phase === 'aboard' && showHand(['[data-testid="whistle"]']));
	}

	function arriveHome() {
		phase = 'home';
		setIdlePrompt(null);
		chime('big');
		say('rail.home', { interrupt: true });
		mascot = 'celebrate';
		const x0 = stationX(3) - 5;
		riders.forEach((r, k) => {
			scheduler.after(d.reduced ? 0 : 300 + k * 220, () => {
				if (!kit || !stage) return;
				stage.scene.attach(r.obj);
				r.obj.rotation.set(0, -0.2, 0);
				r.obj.scale.setScalar(1.15);
				const to = new kit.THREE.Vector3(x0 - 5 + (k % 9) * 1.3, 0.56, PLATFORM_Z + 0.4 - (k >= 9 ? 0.9 : 0));
				r.state = 'off';
				r.tween = { from: r.obj.position.clone(), to, t: 0, dur: d.reduced ? 0.15 : 0.7, arc: d.reduced ? 0 : 1.4, then: () => {
					r.home.copy(to);
					r.hop = d.reduced ? -1 : (k % 3) * 0.3;
					ANIMAL_CALL[r.kind]?.();
				} };
			});
		});
		scheduler.after(d.reduced ? 400 : 1200, () => {
			if (kit) for (const dx of [-6, 0, 6]) confetti?.burst(new kit.THREE.Vector3(x0 + dx, 3, PLATFORM_Z), 24);
			stage?.feedback(!d.reduced);
		});
		scheduler.after(d.reduced ? 800 : 2400 + riders.length * 220, () => {
			say('rail.done');
			finished = true;
		});
		if (failed) finished = true;
	}

	function newTrip() {
		scheduler.cancelAll();
		hideHand();
		trip = createTrainTrip($settings.difficulty, (Date.now() + 5) >>> 0);
		phase = 'ready';
		stop = 0;
		boardedHere = 0;
		totalBoarded = 0;
		finished = false;
		trainX = 0;
		speed = 0;
		sceneryTold = new Set();
		mascot = 'wave';
		if (stage) void restartStage();
		hello();
	}

	async function restartStage() {
		confetti?.dispose();
		confetti = null;
		disposeSky?.();
		disposeSky = null;
		for (const x of disposers.splice(0)) x();
		steam = [];
		steamGeo = null;
		riders = [];
		stage?.dispose();
		stage = null;
		ready = false;
		canvasKey += 1;
		await new Promise((r) => requestAnimationFrame(r));
		void startStage();
	}

	function hello() {
		instruct('rail.start');
		setIdlePrompt('rail.start');
		scheduler.after(d.reduced ? 1500 : 5000, () => phase === 'ready' && showHand(['[data-action="play"]']));
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === ' ' || e.key === 'Enter') {
			if (phase === 'ready' || phase === 'aboard') {
				e.preventDefault();
				go();
			}
		}
		if (e.key.toLowerCase() === 'h') toot();
	}

	onMount(() => {
		void startStage();
		hello();
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
		hideHand();
		leaveScreen();
		confetti?.dispose();
		disposeSky?.();
		for (const x of disposers) x();
		steamGeo?.dispose();
		stage?.dispose();
		stage = null;
	});

	const waiting = $derived(phase === 'board' && station ? station.riders.map((kind, j) => ({ id: `${stop}-${j}`, kind, j })) : []);
	let seatedIds = $state<string[]>([]);
	function tapRider(id: string) {
		const r = riders.find((x) => `${x.stop}-${x.index}` === id);
		if (r) {
			board(r);
			return;
		}
		// Flat mode (no WebGL): count without 3D objects.
		if (!failed || phase !== 'board' || seatedIds.includes(id)) return;
		seatedIds = [...seatedIds, id];
		totalBoarded += 1;
		boardedHere += 1;
		const kind = station!.riders[0]!;
		ANIMAL_CALL[kind]?.();
		say(`number.${boardedHere}`, { interrupt: true });
		if (boardedHere === needHere) allAboard();
	}
	$effect(() => {
		void stop;
		seatedIds = [];
	});
</script>

<svelte:window {onkeydown} />

<TopBar onreplay={() => say(phase === 'board' ? 'rail.board' : phase === 'aboard' ? 'rail.all-aboard' : 'rail.start', { interrupt: true })} />

<section
	class="train"
	class:paused={$paused}
	data-ready={ready || failed}
	data-phase={phase}
	data-stop={stop}
	data-boarded={totalBoarded}
	data-need={needHere}
	data-whistles={whistles}
	data-done={finished}
>
	<div class="view game-viewport">
		{#key canvasKey}<canvas bind:this={canvas} aria-hidden="true"></canvas>{/key}
		{#if station && (phase === 'board' || phase === 'aboard')}
			<div class="station-card" style:--c={STATION_COLORS[station.color].hex} aria-hidden="true">
				<span class="big-num">{num(station.number)}</span>
			</div>
		{/if}
		{#if failed}
			<div class="flat">
				{#if phase === 'board'}
					{#each waiting as w (w.id)}
						{#if !seatedIds.includes(w.id)}
							<button class="flat-rider" data-rider={w.id} aria-label={label(`rail.rider.${w.kind}`)} onclick={() => tapRider(w.id)}>{RIDER_ICON[w.kind]}</button>
						{/if}
					{/each}
				{:else}
					<span class="flat-train" aria-hidden="true">🚂🚃🚃</span>
				{/if}
			</div>
		{:else if ready}
			{#each waiting as w (w.id)}
				{@const s = spots[w.id]}
				{#if s}
					<button class="tap" data-rider={w.id} aria-label={label(`rail.rider.${w.kind}`)} style:left="{s.x}px" style:top="{s.y}px" onclick={() => tapRider(w.id)}></button>
				{/if}
			{/each}
		{/if}
		<div class="rumi"><Mascot state={mascot} size={110} /></div>
		{#if finished}
			<div class="finish">
				<GameButton action="replay" onclick={newTrip} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		{/if}
	</div>
	<div class="controls">
		<button class="whistle" class:glow={phase === 'aboard'} data-testid="whistle" aria-label={label('rail.whistle-button')} onfocus={() => speakLabel('rail.whistle-button')} onclick={toot}>
			<svg viewBox="0 0 64 64" width="54" height="54" aria-hidden="true">
				<rect x="10" y="26" width="38" height="18" rx="9" fill="#F2C94C" stroke="#263238" stroke-width="4" />
				<rect x="44" y="20" width="10" height="30" rx="4" fill="#E5484D" stroke="#263238" stroke-width="4" />
				<path d="M18 22 q-4 -8 2 -14 M28 20 q-4 -8 2 -14" fill="none" stroke="#9CC7D6" stroke-width="4" stroke-linecap="round" />
			</svg>
		</button>
		{#if phase === 'ready' || phase === 'aboard'}
			<GameButton action="play" onclick={go} />
		{/if}
	</div>
</section>

<style>
	.train {
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
	.tap {
		position: absolute;
		width: 110px;
		height: 120px;
		transform: translate(-50%, -50%);
		border: 0;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
	}
	.tap:focus-visible {
		outline: 5px solid var(--text-primary);
		outline-offset: 2px;
	}
	.station-card {
		position: absolute;
		top: 14px;
		right: 16px;
		display: grid;
		place-items: center;
		width: 96px;
		height: 96px;
		border-radius: 26px;
		background: var(--c);
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
		animation: pop-in 400ms cubic-bezier(0.2, 1.5, 0.4, 1);
	}
	.big-num {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: 18px;
		background: #ffffff;
		color: var(--text-primary);
		font-size: 52px;
		font-weight: 800;
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
		min-height: 96px;
	}
	.whistle {
		display: grid;
		place-items: center;
		width: 92px;
		height: 92px;
		border-radius: 50%;
		border: 4px solid var(--border-soft);
		background: var(--surface);
		cursor: pointer;
		transition: transform 150ms ease;
	}
	.whistle:active {
		transform: scale(0.94);
	}
	.whistle.glow {
		border-color: #ffd84d;
		box-shadow: 0 0 0 6px rgba(255, 216, 77, 0.45);
	}
	.whistle:focus-visible {
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
		background: #dff0d0;
	}
	.flat-rider {
		width: 120px;
		height: 120px;
		border: 4px solid var(--border-soft);
		border-radius: 28px;
		background: var(--surface);
		font-size: 70px;
		cursor: pointer;
	}
	.flat-train {
		font-size: 90px;
	}
	@keyframes pop-in {
		from {
			transform: scale(0.3);
			opacity: 0;
		}
	}
</style>
