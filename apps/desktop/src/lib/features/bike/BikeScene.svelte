<script lang="ts">
	/**
	 * Rumi's Bicycle — a gentle 3D bike ride for ages 3–6 (core rules: packages/core/src/bike).
	 * Hold the pedal to ride, brake, change lanes, ring the bell. Fruit drops into the basket,
	 * friends on the path step aside for the bell, traffic lights teach stop/go, bumps make a hop,
	 * and the basket's fruit goes to Grandma's house. Nothing can be hit (the bike stops by
	 * itself). No score, no counter, no game over (PR-07).
	 */
	import { onDestroy, onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		BASKET_SIZE,
		BIKE_FRUITS,
		BIKE_LANES,
		BIKE_MAX_SPEED,
		BIKE_PLACES,
		BIKE_STOP_EVERY,
		BIKE_STOPS,
		createHighwayRng,
		CROSSING_EVERY,
		formatNumeral,
		friendToRingFor,
		lightAt,
		narrationText,
		pedalSpeed,
		reachedBike,
		safeBikeSpeed,
		spawnThing,
		type BikeFruit,
		type BikePlace,
		type LightColor,
		type PathFriend,
		type PathThing
	} from '@little-colors/core';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import RumiLoading from '#lib/components/ui/RumiLoading.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { chime } from '#lib/game/chime.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import type * as Kit from '#lib/three3d/toyKit.ts';

	const d = durations();
	const scheduler = createScheduler();
	const U = 1 / 1.7; // scene units per metre
	const LANE_W = 2.5;
	const laneX = (l: number) => (l - (BIKE_LANES - 1) / 2) * LANE_W;
	const PATH_W = BIKE_LANES * LANE_W + 1.2;
	const maxSpeed = d.reduced ? 16 : BIKE_MAX_SPEED;

	let place = $state<BikePlace | null>(null);
	let menuOpen = $state(false);
	let camera = $state<'chase' | 'side' | 'high'>('chase');
	let lane = $state(1);
	let ready = $state(false);
	let failed = $state(false);
	let shownSpeed = $state(0);
	let journey = $state(0);
	let basket = $state<BikeFruit[]>([]);
	let light = $state<LightColor | null>(null);
	let bellHint = $state(false);
	// Hidden test hooks (never shown on screen).
	let picked = $state(0);
	let rings = $state(0);
	let jumps = $state(0);
	let minGapSeen = $state(999);

	const bn = $derived($settings.language === 'bn-BD');
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	let canvas = $state<HTMLCanvasElement | null>(null);
	let canvasKey = $state(0);
	let canvasUsed = false;
	let kit: typeof Kit | null = null;
	let stage: Kit.Stage | null = null;
	let confetti: Kit.Confetti | null = null;
	let destroyed = false;

	type Thing = PathThing & { obj: Kit.THREE.Group; t0: number; said?: boolean; saidGreen?: boolean; leaveT?: number };
	let speed = 0;
	let bikeX = laneX(1);
	let offset = 0;
	let distance = 0;
	let pedals = { pedal: false, brake: false };
	let things: Thing[] = [];
	let nextId = 1;
	let rng = createHighwayRng(Date.now() >>> 0);
	let spawnAcc = 0;
	let nextCrossing = CROSSING_EVERY;
	let world: Kit.THREE.Group | null = null;
	let bike: Kit.THREE.Group | null = null;
	let wheels: Kit.THREE.Object3D[] = [];
	let crank: Kit.THREE.Object3D | null = null;
	let basketFruit: Kit.THREE.Group | null = null;
	let scenery: { obj: Kit.THREE.Object3D; base: number; span: number }[] = [];
	let stopSign: { obj: Kit.THREE.Group; index: number; said: boolean } | null = null;
	let stopIndex = 0;
	let hopT = 0;
	let clock = 0;
	let dashT = 0;
	let lastRingHint = -99;
	let basketFullSaid = false;

	// ── 3D world ────────────────────────────────────────────────────────────
	const LOOK: Record<BikePlace, { sky: string; horizon: string; ground: string; path: string }> = {
		park: { sky: '#86C3EE', horizon: '#E3F3FB', ground: '#9ED17E', path: '#DCC9A4' },
		village: { sky: '#8FC6E8', horizon: '#EAF5E4', ground: '#A9D37F', path: '#C9A27A' },
		river: { sky: '#7DBCE8', horizon: '#E0F1FA', ground: '#A4D486', path: '#DCC9A4' }
	};

	async function buildWorld(p: BikePlace) {
		if (!kit) {
			try {
				kit = await import('#lib/three3d/toyKit.ts');
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
		const look = LOOK[p];
		try {
			stage = kit.createStage(canvas, { fov: 55, background: look.horizon, skyTop: look.sky });
		} catch {
			failed = true;
			return;
		}
		stage.scene.fog = new THREE.Fog(look.horizon, 40, 85);
		world = new THREE.Group();
		stage.scene.add(world);

		const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 220), new THREE.MeshStandardMaterial({ color: look.ground, roughness: 1 }));
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(0, -0.02, -70);
		ground.receiveShadow = true;
		const path = new THREE.Mesh(new THREE.PlaneGeometry(PATH_W, 220), new THREE.MeshStandardMaterial({ color: look.path, roughness: 1 }));
		path.rotation.x = -Math.PI / 2;
		path.position.set(0, 0, -70);
		path.receiveShadow = true;
		world.add(ground, path);
		if (p === 'river') {
			const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 220), new THREE.MeshStandardMaterial({ color: '#5DA9E0', roughness: 0.25, metalness: 0.1 }));
			water.rotation.x = -Math.PI / 2;
			water.position.set(-PATH_W / 2 - 24, 0.01, -70);
			world.add(water);
		}
		// Little edge stones and lane dots, scrolling.
		const stoneMat = new THREE.MeshStandardMaterial({ color: '#F4F0E6' });
		const stoneGeo = new THREE.SphereGeometry(0.18, 8, 6);
		for (let k = 0; k < 40; k++) {
			for (const side of [-1, 1]) {
				const st = new THREE.Mesh(stoneGeo, stoneMat);
				st.position.set(side * (PATH_W / 2 + 0.2), 0.08, 0);
				world.add(st);
				scenery.push({ obj: st, base: -k * 2.5, span: 100 });
			}
		}
		for (let k = 0; k < 12; k++) {
			for (const side of [-1, 1]) {
				if (p === 'river' && side < 0) continue;
				const thing = roadside(p, k, side);
				thing.position.x = side * (PATH_W / 2 + 3.5 + (k % 3) * 2.6);
				world.add(thing);
				scenery.push({ obj: thing, base: -k * 8.5 - (side > 0 ? 4 : 0), span: 102 });
			}
		}
		if (p === 'river') {
			for (let k = 0; k < 4; k++) {
				const boat = boatModel(k);
				boat.position.x = -PATH_W / 2 - 9 - (k % 2) * 7;
				world.add(boat);
				scenery.push({ obj: boat, base: -k * 26, span: 104 });
			}
		}

		bike = bikeModel();
		world.add(bike);
		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused || menuOpen);
		ready = true;
	}

	function roadside(p: BikePlace, k: number, side: number): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		if (p === 'village' && k % 3 !== 0) {
			if (k % 3 === 1) {
				// A hut: walls + a straw cone roof.
				const wall = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.2), new THREE.MeshStandardMaterial({ color: '#E8D3B0' }));
				wall.position.y = 0.8;
				const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.6, 4), new THREE.MeshStandardMaterial({ color: '#C79A55' }));
				roof.position.y = 2.4;
				roof.rotation.y = Math.PI / 4;
				g.add(wall, roof);
			} else {
				// A palm tree.
				const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#9C7A55' }));
				trunk.position.y = 1.6;
				g.add(trunk);
				const leaf = new THREE.MeshStandardMaterial({ color: '#4E9F68', side: THREE.DoubleSide });
				for (let i = 0; i < 6; i++) {
					const l = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 4), leaf);
					l.position.y = 3.25;
					l.rotation.z = Math.PI / 2.6;
					l.rotation.y = (i / 6) * Math.PI * 2;
					l.translateY(0.7);
					g.add(l);
				}
			}
		} else if (p === 'park' && k % 4 === 2) {
			// A bench and a bed of flowers.
			const wood = new THREE.MeshStandardMaterial({ color: '#B9865A' });
			const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.5), wood);
			seat.position.y = 0.5;
			const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.1), wood);
			back.position.set(0, 0.8, -0.22);
			g.add(seat, back);
			for (let i = 0; i < 7; i++) {
				const f = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: kit!.TOY_COLORS[i % 6] }));
				f.position.set(-1.2 + i * 0.4, 0.18, 0.8);
				g.add(f);
			}
		} else {
			const t = kit!.toyTree();
			t.scale.setScalar(1 + (k % 3) * 0.25);
			g.add(t);
		}
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	function boatModel(k: number): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const wood = new THREE.MeshStandardMaterial({ color: k % 2 ? '#B9865A' : '#E5484D', roughness: 0.7 });
		// A little country boat: a hull with a pointed bow and stern, and a white sail.
		const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 3), wood);
		hull.position.y = 0.3;
		for (const z of [-1.9, 1.9]) {
			const tip = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.8, 4), wood);
			tip.rotation.x = z < 0 ? -Math.PI / 2 : Math.PI / 2;
			tip.rotation.y = Math.PI / 4;
			tip.scale.set(1, 1, 0.55);
			tip.position.set(0, 0.32, z);
			g.add(tip);
		}
		const inside = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 2.7), new THREE.MeshStandardMaterial({ color: '#7A5A3A' }));
		inside.position.y = 0.56;
		const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#8A6A52' }));
		mast.position.y = 1.7;
		const sail = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2, 3), new THREE.MeshStandardMaterial({ color: '#F4F0E6' }));
		sail.scale.set(1, 1, 0.15);
		sail.position.set(0, 1.8, 0.35);
		g.add(hull, inside, mast, sail);
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	/** Rumi on a bicycle: wheels and crank turn while riding; a basket on the front. */
	function bikeModel(): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const paint = new THREE.MeshStandardMaterial({ color: '#3478D4', roughness: 0.4 });
		const dark = new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.8 });
		const silver = new THREE.MeshStandardMaterial({ color: '#C8CDD2', metalness: 0.5, roughness: 0.35 });
		wheels = [];
		for (const z of [-0.95, 0.95]) {
			const wheel = new THREE.Group();
			const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 10, 28), dark);
			wheel.add(tyre);
			for (let i = 0; i < 6; i++) {
				const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.96, 4), silver);
				spoke.rotation.z = (i / 6) * Math.PI;
				wheel.add(spoke);
			}
			wheel.rotation.y = Math.PI / 2;
			wheel.position.set(0, 0.57, z);
			g.add(wheel);
			wheels.push(wheel);
		}
		const tube = (len: number, x: number, y: number, z: number, rx: number) => {
			const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 8), paint);
			m.position.set(x, y, z);
			m.rotation.x = rx;
			g.add(m);
		};
		tube(1.5, 0, 0.95, 0, Math.PI / 2.2);
		tube(0.9, 0, 0.8, 0.45, -0.5);
		tube(0.9, 0, 0.8, -0.45, 0.5);
		tube(0.7, 0, 1.15, -0.85, 0.3);
		const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), silver);
		bar.rotation.z = Math.PI / 2;
		bar.position.set(0, 1.5, -0.95);
		const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.45), dark);
		seat.position.set(0, 1.42, 0.45);
		g.add(bar, seat);
		crank = new THREE.Group();
		const pedalBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), silver);
		crank.add(pedalBar);
		crank.position.set(0, 0.6, 0.1);
		g.add(crank);
		// Basket with the picked fruit.
		const basketMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.34, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#C79A55', side: THREE.DoubleSide, roughness: 0.9 }));
		basketMesh.position.set(0, 1.45, -1.3);
		g.add(basketMesh);
		basketFruit = new THREE.Group();
		basketFruit.position.set(0, 1.5, -1.3);
		g.add(basketFruit);
		// Rumi: body, head with ears, green scarf, arms to the handlebar.
		const fur = new THREE.MeshStandardMaterial({ color: '#E3B48A', roughness: 0.8 });
		const light = new THREE.MeshStandardMaterial({ color: '#F6E3CF', roughness: 0.8 });
		const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), fur);
		body.scale.set(1, 1.25, 0.9);
		body.position.set(0, 1.88, 0.35);
		const belly = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), light);
		belly.position.set(0, 1.85, 0.08);
		const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), fur);
		head.position.set(0, 2.45, 0.25);
		const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 8, 20), new THREE.MeshStandardMaterial({ color: '#5E8C6A' }));
		scarf.rotation.x = Math.PI / 2;
		scarf.position.set(0, 2.18, 0.28);
		g.add(body, belly, head, scarf);
		for (const x of [-0.22, 0.22]) {
			const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fur);
			ear.position.set(x, 2.72, 0.27);
			const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.95, 8), fur);
			arm.position.set(x * 1.3, 1.72, -0.35);
			arm.rotation.x = 1.0;
			g.add(ear, arm);
		}
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	function fruitModel(f: BikeFruit): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const color = BIKE_FRUITS[f].color;
		const shape = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: color, emissiveIntensity: 0.12 }));
		if (f === 'banana') shape.scale.set(1.5, 0.55, 0.55);
		if (f === 'mango') shape.scale.set(0.85, 1.15, 0.85);
		const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 5), new THREE.MeshStandardMaterial({ color: '#4E9F68' }));
		leaf.position.y = 0.48;
		g.add(shape, leaf);
		g.position.y = 1.1;
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	const FRIEND_COLOR: Record<PathFriend, string> = { duck: '#F4F0E6', cat: '#9AA3AD', dog: '#B9865A', goat: '#F4F4F0' };
	function friendModel(f: PathFriend): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const mat = new THREE.MeshStandardMaterial({ color: FRIEND_COLOR[f], roughness: 0.8 });
		const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), mat);
		body.scale.set(0.8, 0.75, 1.25);
		body.position.y = f === 'duck' ? 0.45 : 0.7;
		const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat);
		head.position.set(0, f === 'duck' ? 0.95 : 1.05, 0.5);
		g.add(body, head);
		if (f === 'duck') {
			const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), new THREE.MeshStandardMaterial({ color: '#F28C28' }));
			beak.rotation.x = Math.PI / 2;
			beak.position.set(0, 0.92, 0.82);
			g.add(beak);
		} else {
			for (const x of [-0.18, 0.18]) {
				const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), mat);
				ear.position.set(x, 1.3, 0.45);
				g.add(ear);
			}
			for (const [x, z] of [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.3], [0.2, 0.3]] as const) {
				const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 6), mat);
				leg.position.set(x, 0.24, z);
				g.add(leg);
			}
		}
		for (const x of [-0.11, 0.11]) {
			const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: '#263238' }));
			eye.position.set(x, head.position.y + 0.06, 0.75);
			g.add(eye);
		}
		g.rotation.y = Math.PI; // walking the same way as the bike
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	function rampModel(): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const shape = new THREE.Shape();
		shape.moveTo(-1.2, 0);
		shape.lineTo(1.2, 0);
		shape.lineTo(1.2, 0.35);
		shape.closePath();
		const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false });
		const ramp = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#F2C94C', roughness: 0.7 }));
		ramp.rotation.y = Math.PI / 2;
		ramp.position.x = -0.9;
		g.add(ramp);
		g.traverse((o) => ((o as Kit.THREE.Mesh).castShadow = true));
		return g;
	}

	function crossingModel(): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const white = new THREE.MeshStandardMaterial({ color: '#F4F4F0' });
		for (let i = 0; i < 6; i++) {
			const stripe = new THREE.Mesh(new THREE.BoxGeometry(PATH_W, 0.02, 0.35), white);
			stripe.position.set(0, 0.015, -i * 0.7);
			g.add(stripe);
		}
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), new THREE.MeshStandardMaterial({ color: '#4A5058' }));
		pole.position.set(PATH_W / 2 + 0.6, 1.6, 0.4);
		const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.4), new THREE.MeshStandardMaterial({ color: '#263238' }));
		box.position.set(PATH_W / 2 + 0.6, 3.3, 0.4);
		const red = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: '#5a1d1d', emissive: '#E5484D', emissiveIntensity: 0 }));
		red.position.set(PATH_W / 2 + 0.6, 3.55, 0.62);
		red.name = 'red';
		const green = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), new THREE.MeshStandardMaterial({ color: '#1d4a2c', emissive: '#35A66A', emissiveIntensity: 0 }));
		green.position.set(PATH_W / 2 + 0.6, 3.05, 0.62);
		green.name = 'green';
		g.add(pole, box, red, green);
		return g;
	}

	function stopModel(index: number): Kit.THREE.Group {
		const { THREE } = kit!;
		const g = new THREE.Group();
		const stop = BIKE_STOPS[index]!;
		const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3, 8), new THREE.MeshStandardMaterial({ color: '#F4F4F0' }));
		post.position.y = 1.5;
		const face = new THREE.MeshStandardMaterial({ map: kit!.glyphTexture(stop.icon, '#3478D4') });
		const side = new THREE.MeshStandardMaterial({ color: '#3478D4' });
		const board = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.15), [side, side, side, side, face, side]);
		board.position.y = 3.6;
		g.add(post, board);
		g.position.x = PATH_W / 2 + 2;
		return g;
	}

	function wrapZ(v: number, span: number) {
		const w = (((12 - v) % span) + span) % span;
		return 12 - w;
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
		confetti?.dispose();
		confetti = null;
		stage?.dispose();
		stage = null;
		world = null;
		bike = null;
		crank = null;
		basketFruit = null;
		wheels = [];
		things = [];
		scenery = [];
		stopSign = null;
		ready = false;
	}

	/** Show the basket's fruit in 3D too. */
	function refreshBasket() {
		if (!kit || !basketFruit) return;
		for (const c of [...basketFruit.children]) disposeObj(c);
		basket.forEach((f, i) => {
			const m = new kit!.THREE.Mesh(new kit!.THREE.SphereGeometry(0.11, 10, 8), new kit!.THREE.MeshStandardMaterial({ color: BIKE_FRUITS[f].color }));
			m.position.set(((i % 3) - 1) * 0.17, Math.floor(i / 3) * 0.14, 0);
			basketFruit!.add(m);
		});
	}

	// ── Riding ──────────────────────────────────────────────────────────────
	function frame(dt: number) {
		if (!bike || !world || !kit) return;
		clock += dt;
		const carLane = Math.round(bikeX / LANE_W + (BIKE_LANES - 1) / 2);
		const crossing = things.find((t) => t.kind === 'crossing' && t.z > -2);
		const lc = crossing ? lightAt(clock - crossing.t0) : null;
		if (lc !== light) light = lc;
		const desired = pedalSpeed(speed, pedals, dt, maxSpeed);
		speed = safeBikeSpeed(desired, lane, things, lc);

		// Light talk: once when it's red ahead, once when it turns green while waiting.
		if (crossing && crossing.z < 24 && crossing.z > 0) {
			if (lc === 'red' && !crossing.said) {
				crossing.said = true;
				say('bike.red', { interrupt: true });
			}
			if (lc === 'green' && crossing.said && !crossing.saidGreen && speed < 3) {
				crossing.saidGreen = true;
				say('bike.green', { interrupt: true });
			}
			for (const c of crossing.obj.children) {
				const m = c as Kit.THREE.Mesh;
				if (m.name === 'red' || m.name === 'green') (m.material as Kit.THREE.MeshStandardMaterial).emissiveIntensity = m.name === lc ? 1.6 : 0;
			}
		} else if (crossing) {
			for (const c of crossing.obj.children) {
				const m = c as Kit.THREE.Mesh;
				if (m.name === 'red' || m.name === 'green') (m.material as Kit.THREE.MeshStandardMaterial).emissiveIntensity = m.name === lc ? 1.6 : 0;
			}
		}

		// A friend ahead in our lane: suggest the bell (at most every 8 s).
		const friend = friendToRingFor(things, lane, 16);
		if (friend && desired - speed > 3 && clock - lastRingHint > 8) {
			lastRingHint = clock;
			bellHint = true;
			say(`bike.ring.${friend.friend}`, { interrupt: true });
			scheduler.after(4000, () => (bellHint = false));
		}
		if (friend) minGapSeen = Math.min(minGapSeen, Math.round(friend.z * 10) / 10);

		const mps = speed / 3.6;
		const moved = mps * dt * U;
		offset += moved;
		distance += mps * dt;

		for (const t of things) {
			const before = t.z;
			t.z += ((t.speed - speed) / 3.6) * dt;
			if (t.kind === 'friend' && t.leaving) {
				t.leaveT = (t.leaveT ?? 0) + dt;
				const side = t.lane === 0 ? -1 : 1;
				t.obj.position.x = laneX(t.lane) + side * Math.min(1, t.leaveT) * (PATH_W / 2 + 1.5 - Math.abs(laneX(t.lane)) * side * side);
				t.obj.position.y = d.reduced ? 0 : Math.abs(Math.sin(t.leaveT * 9)) * 0.25 * Math.max(0, 1 - t.leaveT);
			} else if (t.kind === 'friend') {
				t.obj.position.y = d.reduced ? 0 : Math.abs(Math.sin(clock * 6 + t.id)) * 0.06;
			}
			if (t.kind === 'fruit' && t.obj.visible && !d.reduced) t.obj.rotation.y += dt * 1.5;
			t.obj.position.z = -t.z * U;
			if (reachedBike(before, t.z) && t.lane === carLane) {
				if (t.kind === 'fruit' && t.obj.visible) pick(t);
				if (t.kind === 'ramp') hop();
			}
		}
		for (const t of things.filter((x) => x.z < -30 || (x.kind === 'friend' && x.leaving && (x.leaveT ?? 0) > 1.6))) disposeObj(t.obj);
		things = things.filter((x) => x.z >= -30 && !(x.kind === 'friend' && x.leaving && (x.leaveT ?? 0) > 1.6));

		// New things ahead: a crossing every CROSSING_EVERY metres, otherwise fruit/friends/bumps.
		spawnAcc += mps * dt;
		if (distance + 110 > nextCrossing) {
			nextCrossing += CROSSING_EVERY;
			const obj = crossingModel();
			world.add(obj);
			things.push({ id: nextId++, kind: 'crossing', lane: 1, z: 110, speed: 0, obj, t0: clock });
		} else if (spawnAcc > 11) {
			spawnAcc = 0;
			const t = spawnThing(rng, things, nextId++, 110);
			if (t) {
				const obj = t.kind === 'fruit' ? fruitModel(t.fruit!) : t.kind === 'friend' ? friendModel(t.friend!) : rampModel();
				obj.position.x = laneX(t.lane);
				world.add(obj);
				things.push({ ...t, obj, t0: clock });
			}
		}

		// Stops on the way to Grandma's house.
		const nextAt = (stopIndex + 1) * BIKE_STOP_EVERY;
		if (!stopSign && nextAt - distance < 100) {
			const idx = stopIndex % BIKE_STOPS.length;
			const obj = stopModel(idx);
			world.add(obj);
			stopSign = { obj, index: idx, said: false };
		}
		if (stopSign) {
			const z = nextAt - distance;
			stopSign.obj.position.z = -z * U;
			if (!stopSign.said && z < 18) {
				stopSign.said = true;
				const s = BIKE_STOPS[stopSign.index]!;
				if (s.id === 'grandma' && basket.length > 0) {
					say('bike.grandma', { interrupt: true });
					confetti?.burst(new kit.THREE.Vector3(bikeX, 2.5, -5), 60, kit.TOY_COLORS);
					chime('big');
					basket = [];
					basketFullSaid = false;
					refreshBasket();
				} else say(`bike.stop.${s.id}`, { interrupt: true });
			}
			if (z < -30) {
				disposeObj(stopSign.obj);
				stopSign = null;
				stopIndex += 1;
			}
		}

		for (const s of scenery) s.obj.position.z = wrapZ(s.base + offset, s.span);

		// The bike: glide between lanes, wheels and pedals turn with the distance, a little hop on bumps.
		const tx = laneX(lane);
		bikeX += (tx - bikeX) * Math.min(1, dt * (d.reduced ? 20 : 5));
		bike.position.x = bikeX;
		bike.rotation.z = d.reduced ? 0 : (tx - bikeX) * 0.12;
		const turn = (mps * dt) / 0.5;
		for (const w of wheels) w.rotation.x -= turn;
		if (crank) crank.rotation.x -= turn * 0.5;
		if (hopT > 0) {
			hopT = Math.max(0, hopT - dt);
			bike.position.y = Math.sin((1 - hopT / 0.7) * Math.PI) * 0.7;
		} else bike.position.y = 0;
		confetti?.update(dt, moved * 0.5);

		const cam = stage!.camera;
		const pose = camera === 'side' ? [bikeX + 7, 2.6, 1.5, bikeX, -2] : camera === 'high' ? [bikeX * 0.5, 11, 9, bikeX * 0.3, -9] : [bikeX + 2.2, 3.3, 6.2, bikeX * 0.5, -10];
		cam.position.x += (pose[0]! - cam.position.x) * Math.min(1, dt * 5);
		cam.position.y += (pose[1]! - cam.position.y) * Math.min(1, dt * 5);
		cam.position.z += (pose[2]! - cam.position.z) * Math.min(1, dt * 5);
		cam.lookAt(pose[3]!, 1.2, pose[4]!);

		dashT += dt;
		if (dashT > 0.1) {
			dashT = 0;
			shownSpeed = Math.round(speed);
			journey = (distance % (BIKE_STOP_EVERY * BIKE_STOPS.length)) / (BIKE_STOP_EVERY * BIKE_STOPS.length);
		}
	}

	function pick(t: Thing) {
		if (basket.length >= BASKET_SIZE) {
			if (!basketFullSaid) {
				basketFullSaid = true;
				say('bike.basket-full', { interrupt: true });
			}
			return;
		}
		t.obj.visible = false;
		basket = [...basket, t.fruit!];
		picked += 1;
		refreshBasket();
		chime();
		if (kit && !d.reduced) confetti?.burst(new kit.THREE.Vector3(laneX(t.lane), 1.4, 0), 14, [BIKE_FRUITS[t.fruit!].color, '#ffffff', '#F2C94C'], { speed: 0.5, up: 0.6 });
		say(`bike.fruit.${t.fruit}`);
		if (basket.length >= BASKET_SIZE && !basketFullSaid) {
			basketFullSaid = true;
			scheduler.after(1400, () => say('bike.basket-full'));
		}
	}

	function hop() {
		jumps += 1;
		hopT = d.reduced ? 0 : 0.7;
		if (jumps % 2 === 1) say('bike.jump');
	}

	// ── Controls ────────────────────────────────────────────────────────────
	const riding = $derived(!!place && ready && !menuOpen && !$paused);

	function steer(dir: -1 | 1) {
		if (!riding) return;
		const to = lane + dir;
		if (to < 0 || to >= BIKE_LANES) return;
		lane = to;
		hideHand();
	}
	function setPedal(which: 'pedal' | 'brake', down: boolean) {
		pedals = { ...pedals, [which]: down && riding };
		if (down) hideHand();
	}

	let audio: AudioContext | null = null;
	function bellSound() {
		const v = $settings.soundEnabled ? $settings.volume : 0;
		if (!(v > 0)) return;
		try {
			audio ??= new AudioContext();
			void audio.resume();
			const t0 = audio.currentTime;
			for (const at of [0, 0.16]) {
				for (const f of [2093, 2637]) {
					const o = audio.createOscillator();
					const g = audio.createGain();
					o.type = 'sine';
					o.frequency.value = f;
					g.gain.setValueAtTime(0, t0 + at);
					g.gain.linearRampToValueAtTime(0.12 * v, t0 + at + 0.005);
					g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + 0.5);
					o.connect(g).connect(audio.destination);
					o.start(t0 + at);
					o.stop(t0 + at + 0.55);
				}
			}
		} catch {
			/* no audio: fine */
		}
	}
	function ring() {
		if (!riding) return;
		rings += 1;
		bellSound();
		bellHint = false;
		const friend = friendToRingFor(things, lane, 30);
		if (friend) {
			friend.leaving = true;
			scheduler.after(250, () => say('bike.thanks', { interrupt: true }));
		}
	}

	function onkeydown(e: KeyboardEvent) {
		if (!place) return;
		if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select')) return;
		if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
			menuOpen ? (menuOpen = false) : openMenu();
			e.preventDefault();
			return;
		}
		if (menuOpen) return;
		if (e.key === 'ArrowLeft') steer(-1);
		else if (e.key === 'ArrowRight') steer(1);
		else if (e.key === 'ArrowUp') setPedal('pedal', true);
		else if (e.key === 'ArrowDown') setPedal('brake', true);
		else if (e.key === 'b' || e.key === 'B' || e.key === ' ') {
			if (!e.repeat) ring();
		} else return;
		e.preventDefault();
	}
	function onkeyup(e: KeyboardEvent) {
		if (e.key === 'ArrowUp') setPedal('pedal', false);
		else if (e.key === 'ArrowDown') setPedal('brake', false);
	}

	// ── Flow ────────────────────────────────────────────────────────────────
	function choose(p: BikePlace) {
		place = p;
		menuOpen = false;
		resetRide();
		void buildWorld(p).then(() => {
			if (!ready) return;
			instruct('bike.start');
			if (firstTime('bike')) scheduler.after(1500, () => showHand(['[data-testid="pedal"]']));
		});
	}
	function resetRide() {
		speed = 0;
		lane = 1;
		bikeX = laneX(1);
		offset = 0;
		distance = 0;
		stopIndex = 0;
		nextCrossing = CROSSING_EVERY;
		spawnAcc = 0;
		pedals = { pedal: false, brake: false };
		basket = [];
		basketFullSaid = false;
		picked = 0;
		rings = 0;
		jumps = 0;
		minGapSeen = 999;
		rng = createHighwayRng(Date.now() >>> 0);
		for (const t of things) disposeObj(t.obj);
		things = [];
		if (stopSign) disposeObj(stopSign.obj);
		stopSign = null;
		confetti?.clear();
		refreshBasket();
	}
	function openMenu() {
		if (!place) return;
		menuOpen = true;
		pedals = { pedal: false, brake: false };
		stopNarration();
		say('highway.paused');
	}
	function restart() {
		resetRide();
		menuOpen = false;
		instruct('bike.start');
	}
	function nextCamera() {
		camera = camera === 'chase' ? 'side' : camera === 'side' ? 'high' : 'chase';
	}
	function changePlace() {
		menuOpen = false;
		disposeStage();
		place = null;
		instruct('bike.choose');
	}

	$effect(() => {
		void ready;
		stage?.setPaused($paused || menuOpen || !place);
		if ($paused) pedals = { pedal: false, brake: false };
	});
	const offPause = paused.subscribe((p) => (p ? scheduler.pause() : scheduler.resume()));

	onMount(() => instruct('bike.choose'));
	onDestroy(() => {
		destroyed = true;
		offPause();
		scheduler.cancelAll();
		hideHand();
		leaveScreen();
		disposeStage();
		void audio?.close();
	});
</script>

<svelte:window {onkeydown} {onkeyup} onblur={() => (pedals = { pedal: false, brake: false })} />

<TopBar onreplay={() => instruct(place ? 'bike.start' : 'bike.choose')} />

<section
	class="bike"
	data-place={place ?? undefined}
	data-ready={ready}
	data-lane={lane}
	data-speed={shownSpeed}
	data-camera={camera}
	data-menu={menuOpen}
	data-light={light ?? 'none'}
	data-basket={basket.length}
	data-picked={picked}
	data-rings={rings}
	data-jumps={jumps}
	data-min-gap={minGapSeen}
>
	{#if !place}
		<div class="places">
			{#each BIKE_PLACES as p (p.id)}
				<button class="place {p.id}" data-place={p.id} aria-label={label(`bike.place.${p.id}`)} onfocus={() => speakLabel(`bike.place.${p.id}`)} onclick={() => choose(p.id)}>
					<span class="scene-icon" aria-hidden="true">{p.icon}🚲</span>
					<span class="name">{label(`bike.place.${p.id}`)}</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="ride" class:hidden={!place}>
		<div class="view">
			{#key canvasKey}<canvas bind:this={canvas} aria-hidden="true"></canvas>{/key}
			{#if place && !ready && !failed}<RumiLoading overlay delay={150} />{/if}
			{#if failed}
				<div class="failed"><p>🚲</p><GameButton action="choose-game" onclick={() => goto('/play')} /></div>
			{/if}
			<button class="pause-btn" data-testid="pause" aria-label={label('highway.menu')} onfocus={() => speakLabel('highway.menu')} onclick={openMenu}>
				<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.5" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1.5" fill="currentColor" /></svg>
			</button>

			<div class="journey" aria-hidden="true">
				<span class="stop start">🏠</span>
				{#each BIKE_STOPS as s, i (s.id)}
					<span class="stop" style:left="{((i + 1) / BIKE_STOPS.length) * 100}%">{s.icon}</span>
				{/each}
				<span class="me" style:left="{journey * 100}%">🚲</span>
			</div>

			<!-- The basket shows the fruit as pictures, never a number. -->
			<div class="basket" aria-hidden="true">
				<svg viewBox="0 0 80 56" width="96" height="67">
					<path d="M6 18 H74 L66 52 H14 Z" fill="#C79A55" stroke="#8A6A3A" stroke-width="3" stroke-linejoin="round" />
					<path d="M12 28 H68 M16 40 H64" stroke="#8A6A3A" stroke-width="2" />
					{#each basket as f, i (i)}
						<circle cx={16 + (i % 3) * 24} cy={i < 3 ? 13 : 4} r="9" fill={BIKE_FRUITS[f].color} stroke="#263238" stroke-width="2" />
					{/each}
				</svg>
			</div>

			{#if light}
				<div class="light-pill {light}" aria-hidden="true"><span class="lamp red"></span><span class="lamp green"></span></div>
			{/if}

			<div class="dash" aria-hidden="true"><strong>{num(shownSpeed)}</strong><small>{bn ? 'কিমি/ঘণ্টা' : 'km/h'}</small></div>

			{#if menuOpen}
				<div class="menu" role="dialog" aria-modal="true" aria-label={label('highway.paused')}>
					<h2>⏸ {label('highway.paused')}</h2>
					<p class="where">{BIKE_PLACES.find((x) => x.id === place)?.icon} {place ? label(`bike.place.${place}`) : ''}</p>
					<button class="menu-btn go" data-testid="continue" onfocus={() => speakLabel('highway.continue')} onclick={() => (menuOpen = false)}>▶ {label('highway.continue')}</button>
					<button class="menu-btn" data-testid="restart" onfocus={() => speakLabel('highway.restart')} onclick={restart}>↻ {label('highway.restart')}</button>
					<button class="menu-btn" data-testid="camera" onfocus={() => speakLabel('highway.camera')} onclick={nextCamera}>🎥 {label('highway.camera')}</button>
					<button class="menu-btn" data-testid="place" onfocus={() => speakLabel('highway.place')} onclick={changePlace}>🗺️ {label('highway.place')}</button>
					<GameButton action="choose-game" onclick={() => goto('/play')} />
				</div>
			{/if}
		</div>

		<div class="controls">
			<div class="pair">
				<button class="steer" data-steer="left" aria-label={label('drive.left')} onfocus={() => speakLabel('drive.left')} onclick={() => steer(-1)}>
					<svg viewBox="0 0 48 48" width="54" height="54" aria-hidden="true"><path d="M30 10 L14 24 L30 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
				</button>
				<button class="steer" data-steer="right" aria-label={label('drive.right')} onfocus={() => speakLabel('drive.right')} onclick={() => steer(1)}>
					<svg viewBox="0 0 48 48" width="54" height="54" aria-hidden="true"><path d="M18 10 L34 24 L18 38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" /></svg>
				</button>
			</div>
			<button class="bell" class:hint={bellHint} data-testid="bell" aria-label={label('bike.bell')} onfocus={() => speakLabel('bike.bell')} onclick={ring}>🔔</button>
			<div class="pair">
				<button class="pedal-btn brake" data-testid="brake" aria-label={label('bike.brake')} onfocus={() => speakLabel('bike.brake')}
					onpointerdown={() => setPedal('brake', true)} onpointerup={() => setPedal('brake', false)} onpointerleave={() => setPedal('brake', false)} onpointercancel={() => setPedal('brake', false)}
				><span aria-hidden="true">■</span></button>
				<button class="pedal-btn pedal" data-testid="pedal" aria-label={label('bike.pedal')} onfocus={() => speakLabel('bike.pedal')}
					onpointerdown={() => setPedal('pedal', true)} onpointerup={() => setPedal('pedal', false)} onpointerleave={() => setPedal('pedal', false)} onpointercancel={() => setPedal('pedal', false)}
				><svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="5" /><path d="M24 15 V6 M24 33 V42" stroke="currentColor" stroke-width="5" stroke-linecap="round" /><rect x="14" y="2" width="20" height="7" rx="3" fill="currentColor" /><rect x="14" y="39" width="20" height="7" rx="3" fill="currentColor" /></svg></button>
			</div>
		</div>
	</div>
</section>

<style>
	.bike {
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
	.place:focus-visible { transform: translateY(-6px); }
	.place.park { background: linear-gradient(#bfe3f7, #e4f4d8 60%, #9ed17e); }
	.place.village { background: linear-gradient(#c3e2f3, #f0f2d8 60%, #c9a27a); }
	.place.river { background: linear-gradient(#bfe0f5, #e0f1fa 55%, #5da9e0); }
	.scene-icon { font-size: 64px; letter-spacing: 6px; }
	.name { font-size: 26px; font-weight: 700; }
	.ride {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 0;
	}
	.ride.hidden {
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
	.failed p { margin: 0; }
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
	.journey .start { left: 0; }
	.journey .me { font-size: 26px; transition: left 200ms linear; }
	.basket {
		position: absolute;
		top: 12px;
		right: 14px;
		padding: 4px 8px 2px;
		border-radius: 18px;
		background: #ffffffcc;
	}
	.light-pill {
		position: absolute;
		top: 92px;
		right: 22px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		border-radius: 18px;
		background: #263238e6;
	}
	.lamp {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		opacity: 0.25;
	}
	.lamp.red { background: #E5484D; }
	.lamp.green { background: #35A66A; }
	.light-pill.red .lamp.red,
	.light-pill.green .lamp.green {
		opacity: 1;
		box-shadow: 0 0 18px currentColor;
	}
	.dash {
		position: absolute;
		right: 14px;
		bottom: 12px;
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 18px;
		background: #263238d9;
		color: #ffffff;
	}
	.dash strong { font-size: 30px; }
	.dash small { font-size: 14px; opacity: 0.8; }
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
	.menu h2 { margin: 0; font-size: 34px; color: #F2C94C; }
	.where { margin: 0 0 6px; font-size: 20px; }
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
	.menu-btn.go { background: #F2C94C; color: #263238; border-color: #F2C94C; }
	.controls {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.pair { display: flex; gap: 16px; }
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
	.bell {
		width: 96px;
		height: 96px;
		border-radius: 50%;
		border: 4px solid var(--border-soft);
		background: var(--surface);
		font-size: 46px;
		cursor: pointer;
	}
	.bell.hint {
		border-color: #F2C94C;
		animation: glow 0.8s ease-in-out infinite alternate;
	}
	.bell:active { transform: rotate(-12deg) scale(0.96); }
	.pedal-btn {
		display: grid;
		place-items: center;
		width: 100px;
		height: 110px;
		border-radius: 22px;
		border: 4px solid #263238;
		color: #ffffff;
		font-size: 40px;
		cursor: pointer;
		touch-action: none;
		user-select: none;
	}
	.pedal-btn:active { transform: scale(0.95) translateY(3px); }
	.pedal-btn.brake { background: #E5484D; height: 92px; }
	.pedal-btn.pedal { background: #35A66A; }
	@keyframes glow {
		from { box-shadow: 0 0 0 0 #F2C94C00; }
		to { box-shadow: 0 0 0 12px #F2C94C88; }
	}
	@media (prefers-reduced-motion: reduce) {
		.bell.hint { animation: none; }
	}
	@media (max-height: 700px) {
		.steer, .bell { width: 76px; height: 76px; }
		.bell { font-size: 36px; }
		.pedal-btn { width: 84px; height: 90px; }
		.pedal-btn.brake { height: 76px; }
	}
</style>
