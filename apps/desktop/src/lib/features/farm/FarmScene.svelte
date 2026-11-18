<script lang="ts">
	/**
	 * Rumi's Farm (রুমির খামার): a sunny 3D farmyard. Tap any animal to hear its name and its call.
	 * Four little jobs, in any order: give the cow hay, put the eggs in the basket, walk the ducks
	 * to the pond and pick the mangoes, while Rumi counts. Rumi suggests the next job and a hand
	 * points; nothing can go wrong, no clock, no score (PR-07). All done: a farm party.
	 * three.js loads only on this screen; without WebGL the jobs work as big flat buttons.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		allJobsDone,
		createFarmDay,
		FARM_JOBS,
		freshProgress,
		jobDone,
		jobSize,
		narrationText,
		suggestedJob,
		type FarmAnimal,
		type FarmDay,
		type FarmJob,
		type FarmProgress
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { instruct, leaveScreen, say, setIdlePrompt, stopNarration } from '#lib/audio/narrator.ts';
	import { hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { chime } from '#lib/game/chime.ts';
	import { ANIMAL_CALL } from '#lib/game/toySounds.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import type * as Kit from '#lib/three3d/toyKit.ts';
	import type * as Animals from '#lib/three3d/animals.ts';

	const d = durations();
	const scheduler = createScheduler();
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	// svelte-ignore state_referenced_locally
	let day = $state<FarmDay>(createFarmDay($settings.difficulty, Date.now() >>> 0));
	let progress = $state<FarmProgress>(freshProgress());
	let partying = $state(false);
	let done = $state(false);
	let mascot = $state<MascotAnimation>('wave');
	let busyHay = $state(false);
	const suggest = $derived(suggestedJob(day, progress));

	// ── world layout ──
	const P = {
		cow: [-4, -2.6],
		hay: [-6.4, -0.2],
		barn: [-7, -8.2],
		hen: [-0.4, -4.4],
		nest: [1.3, -4.6],
		eggBasket: [3.3, -4.0],
		coop: [1.3, -7.4],
		pond: [6.6, 0.6],
		goat: [5.4, -5.6],
		tree: [-10.2, 1.2],
		mangoBasket: [-6.6, 4.4],
		ducks: [0.2, 2.8]
	} as const;

	// ── 3D ──
	let canvas = $state<HTMLCanvasElement | null>(null);
	let kit: typeof Kit | null = null;
	let animals: typeof Animals | null = null;
	let stage: Kit.Stage | null = null;
	let ready = $state(false);
	let failed = $state(false);
	let destroyed = false;
	let confetti: Kit.Confetti | null = null;
	let disposeSky: (() => void) | null = null;
	const disposers: (() => void)[] = [];

	type Tween = { from: Kit.THREE.Vector3; to: Kit.THREE.Vector3; t: number; dur: number; arc: number; waddle: boolean; then?: () => void };
	interface Thing {
		id: string;
		obj: Kit.THREE.Object3D;
		tween: Tween | null;
		hop: number;
		size: number;
		lift: number;
		home: Kit.THREE.Vector3;
		swim?: boolean;
	}
	let things = new Map<string, Thing>();
	let spots = $state<Record<string, { x: number; y: number }>>({});
	let frameCount = 0;
	let cowEat = 0;

	async function startStage() {
		try {
			kit = await import('#lib/three3d/toyKit.ts');
			animals = await import('#lib/three3d/animals.ts');
		} catch {
			failed = true;
			return;
		}
		if (!canvas || destroyed) return;
		const { THREE } = kit;
		try {
			stage = kit.createStage(canvas, { fov: 42, background: '#CFE8F7', skyTop: '#7DB8E8' });
		} catch {
			failed = true;
			return;
		}
		stage.camera.position.set(0, 10.5, 16.5);
		stage.camera.lookAt(0, 0, -1.2);
		stage.scene.fog = new THREE.Fog('#d9ecf5', 34, 70);
		try {
			disposeSky = await kit.useHdriSky(stage, '/hdri/sky_partly_cloudy_2k.hdr', { background: true, intensity: 0.85 });
		} catch {
			/* the painted sky stays */
		}
		if (destroyed || !stage) return;
		buildWorld();
		confetti = kit.createConfetti(stage.scene, d.reduced);
		stage.onFrame(frame);
		stage.setPaused($paused);
		ready = true;
		updateSpots();
	}

	const std = (color: string, roughness = 0.8) => new kit!.THREE.MeshStandardMaterial({ color, roughness });
	function add(o: Kit.THREE.Object3D, x: number, z: number, y = 0) {
		o.position.set(x, y, z);
		o.traverse((c) => {
			const m = c as Kit.THREE.Mesh;
			if (m.isMesh) {
				m.castShadow = true;
				m.receiveShadow = true;
			}
		});
		stage!.scene.add(o);
		return o;
	}
	function thing(id: string, obj: Kit.THREE.Object3D, size: number, lift = 0.4) {
		things.set(id, { id, obj, tween: null, hop: -1, size, lift, home: obj.position.clone() });
	}

	function buildWorld() {
		const { THREE } = kit!;
		const s = stage!;
		// Ground: real grass texture (CC0) with a dirt yard in the middle.
		const grass = kit!.pbrMaterial('/textures/highway/grass', [18, 14], '#bfe39a');
		disposers.push(grass.dispose);
		const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), grass.material);
		ground.rotation.x = -Math.PI / 2;
		ground.position.z = -10;
		ground.receiveShadow = true;
		s.scene.add(ground);
		const yard = new THREE.Mesh(new THREE.CircleGeometry(5.2, 40), std('#D9C29A', 1));
		yard.rotation.x = -Math.PI / 2;
		yard.scale.set(1.5, 1, 1);
		yard.position.set(-1, 0.01, -3.5);
		yard.receiveShadow = true;
		s.scene.add(yard);

		// Red barn with a white trim and a hay loft.
		const barn = new THREE.Group();
		const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3.4, 3.6), std('#C8453C', 0.7));
		body.position.y = 1.7;
		const roofShape = new THREE.Shape();
		roofShape.moveTo(-2.9, 0);
		roofShape.lineTo(0, 1.9);
		roofShape.lineTo(2.9, 0);
		roofShape.closePath();
		const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 4, bevelEnabled: false }), std('#6B4A3A', 0.9));
		roof.position.set(0, 3.4, -2);
		const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.3, 0.1), std('#F6EEE0'));
		door.position.set(0, 1.15, 1.82);
		const x1 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.12), std('#F6EEE0'));
		x1.position.set(0, 1.15, 1.9);
		x1.rotation.z = 0.9;
		const x2 = x1.clone();
		x2.rotation.z = -0.9;
		const loft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 0.1), std('#F6EEE0'));
		loft.position.set(0, 2.9, 1.82);
		barn.add(body, roof, door, x1, x2, loft);
		add(barn, P.barn[0], P.barn[1]);
		barn.rotation.y = 0.25;

		// Hen house on little legs.
		const coop = new THREE.Group();
		const cb = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.5, 1.6), std('#E9B96E'));
		cb.position.y = 1.25;
		const cr = new THREE.Mesh(new THREE.ConeGeometry(1.75, 0.9, 4), std('#3F7FB5'));
		cr.rotation.y = Math.PI / 4;
		cr.position.y = 2.45;
		const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), std('#3A2A1E'));
		hole.position.set(0, 1.2, 0.81);
		coop.add(cb, cr, hole);
		for (const [x, z] of [[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.6], [0.9, 0.6]]) {
			const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), std('#8A6A52'));
			leg.position.set(x!, 0.25, z!);
			coop.add(leg);
		}
		add(coop, P.coop[0], P.coop[1]);

		// Wooden fence along the back.
		const fenceMat = std('#C9A27A');
		for (let x = -16; x <= 16; x += 2) {
			const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.2, 0.18), fenceMat);
			post.position.set(x, 0.6, -11);
			s.scene.add(post);
		}
		for (const y of [0.45, 0.9]) {
			const rail = new THREE.Mesh(new THREE.BoxGeometry(32, 0.12, 0.08), fenceMat);
			rail.position.set(0, y, -11);
			rail.castShadow = true;
			s.scene.add(rail);
		}
		for (let k = 0; k < 9; k++) {
			const tree = kit!.toyTree();
			tree.scale.setScalar(1.4 + (k % 3) * 0.3);
			add(tree, -15 + k * 3.8 + (k % 2), -13.5 - (k % 3));
		}

		// Pond with lily pads and reeds.
		const water = new THREE.Mesh(
			new THREE.CircleGeometry(2.9, 48),
			new THREE.MeshPhysicalMaterial({ color: '#4FA9D9', roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92 })
		);
		water.rotation.x = -Math.PI / 2;
		water.scale.set(1.25, 1, 1);
		water.position.set(P.pond[0], 0.03, P.pond[1]);
		s.scene.add(water);
		const bank = new THREE.Mesh(new THREE.RingGeometry(2.85, 3.3, 48), std('#B79C74', 1));
		bank.rotation.x = -Math.PI / 2;
		bank.scale.set(1.25, 1, 1);
		bank.position.set(P.pond[0], 0.02, P.pond[1]);
		bank.receiveShadow = true;
		s.scene.add(bank);
		for (const [x, z] of [[-1.6, -1.2], [1.8, 0.9], [0.6, -1.8]]) {
			const pad = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16, 0.4, Math.PI * 1.8), std('#4E9F68'));
			pad.rotation.x = -Math.PI / 2;
			pad.position.set(P.pond[0] + x!, 0.05, P.pond[1] + z!);
			s.scene.add(pad);
		}
		for (let k = 0; k < 7; k++) {
			const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1 + (k % 3) * 0.3, 6), std('#5E8F3E'));
			const a = 2.2 + k * 0.18;
			reed.position.set(P.pond[0] + Math.cos(a) * 3.4, 0.5, P.pond[1] - Math.sin(a) * 2.8);
			s.scene.add(reed);
		}

		// Flowers dotted on the grass.
		const flowerColors = ['#FF8FA3', '#FFD166', '#FFFFFF', '#C3A6FF'];
		for (let k = 0; k < 40; k++) {
			const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std(flowerColors[k % 4]!, 0.6));
			const x = ((k * 37) % 30) - 15;
			const z = ((k * 53) % 18) - 9;
			if (Math.hypot(x - P.pond[0], z - P.pond[1]) < 4.2 || Math.hypot(x + 1, z + 3.5) < 6) continue;
			f.position.set(x, 0.09, z);
			s.scene.add(f);
		}

		// Mango tree: thick trunk, round leafy crown, ripe mangoes.
		const tree = new THREE.Group();
		const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.6, 10), std('#7A5A44'));
		trunk.position.y = 1.3;
		tree.add(trunk);
		for (const [x, y, z, r] of [[0, 3.4, 0, 1.9], [-1.3, 3, 0.4, 1.3], [1.3, 3.1, 0.3, 1.4], [0.2, 4.4, -0.2, 1.3]] as const) {
			const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), new THREE.MeshStandardMaterial({ color: '#3F8F4E', roughness: 0.9, flatShading: true }));
			leaf.position.set(x, y, z);
			tree.add(leaf);
		}
		add(tree, P.tree[0], P.tree[1]);
		const mangoSpots = [[0.4, 2.3, 2.1], [1.6, 2.6, 1.5], [2.3, 3.2, 0.8], [1.0, 3.4, 1.9], [-0.4, 2.9, 2.1]] as const;
		for (let i = 0; i < day.mangoes; i++) {
			const [x, y, z] = mangoSpots[i]!;
			const mango = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#FFB627', roughness: 0.35, clearcoat: 0.5 }));
			mango.scale.set(0.85, 1.15, 0.85);
			const blush = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), std('#F28C28', 0.5));
			blush.position.set(0.08, -0.06, 0.1);
			mango.add(blush);
			add(mango, P.tree[0] + x, P.tree[1] + z, y);
			thing(`mango-${i}`, mango, 70, 0);
		}

		// Baskets.
		const basket = (x: number, z: number) => {
			const b = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.55, 0.6, 18, 1, true), new THREE.MeshStandardMaterial({ color: '#C79A55', roughness: 0.9, side: THREE.DoubleSide }));
			b.position.y = 0.3;
			const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), std('#A97E42'));
			bottom.rotation.x = -Math.PI / 2;
			bottom.position.y = 0.02;
			const g = new THREE.Group();
			g.add(b, bottom);
			return add(g, x, z);
		};
		basket(P.mangoBasket[0], P.mangoBasket[1]);
		basket(P.eggBasket[0], P.eggBasket[1]);

		// Nest with eggs.
		const nest = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.25, 10, 28), std('#D9B45A', 1));
		nest.rotation.x = -Math.PI / 2;
		add(nest, P.nest[0], P.nest[1], 0.18);
		for (let i = 0; i < day.eggs; i++) {
			const a = (i / day.eggs) * Math.PI * 2;
			const egg = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshPhysicalMaterial({ color: '#FFF6E6', roughness: 0.4, clearcoat: 0.3 }));
			egg.scale.set(0.85, 1.15, 0.85);
			add(egg, P.nest[0] + Math.cos(a) * 0.55, P.nest[1] + Math.sin(a) * 0.45, 0.24);
			thing(`egg-${i}`, egg, 64, 0);
		}

		// Hay bale.
		const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.3, 20), std('#E7C35A', 1));
		hay.rotation.z = Math.PI / 2;
		add(hay, P.hay[0], P.hay[1], 0.75);
		thing('hay', hay, 100, 0);

		// Animals.
		const A = animals!;
		const cow = A.toyAnimal('cow');
		cow.scale.setScalar(1.7);
		add(cow, P.cow[0], P.cow[1]);
		cow.rotation.y = 0.5;
		thing('animal-cow', cow, 150);
		const hen = A.toyAnimal('hen');
		hen.scale.setScalar(1.3);
		add(hen, P.hen[0], P.hen[1]);
		hen.rotation.y = 0.6;
		thing('animal-hen', hen, 100);
		const goat = A.toyAnimal('goat');
		goat.scale.setScalar(1.4);
		add(goat, P.goat[0], P.goat[1]);
		goat.rotation.y = -0.5;
		thing('animal-goat', goat, 120);
		for (let i = 0; i < day.ducks; i++) {
			const duck = A.toyAnimal('duck');
			duck.scale.setScalar(1.05);
			add(duck, P.ducks[0] + i * 1.1, P.ducks[1] + (i % 2) * 0.5);
			duck.rotation.y = 0.9;
			thing(`duck-${i}`, duck, 90);
		}
	}

	const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
	const V = (x: number, y: number, z: number) => new kit!.THREE.Vector3(x, y, z);

	function move(th: Thing, to: Kit.THREE.Vector3, dur: number, arc: number, then?: () => void, waddle = false) {
		if (d.reduced) {
			th.obj.position.copy(to);
			then?.();
			return;
		}
		th.tween = { from: th.obj.position.clone(), to, t: 0, dur, arc, waddle, then };
	}

	function frame(dt: number, t: number) {
		for (const th of things.values()) {
			if (th.tween) {
				const tw = th.tween;
				tw.t = Math.min(1, tw.t + dt / tw.dur);
				const k = tw.waddle ? tw.t : ease(tw.t);
				th.obj.position.lerpVectors(tw.from, tw.to, k);
				th.obj.position.y += Math.sin(k * Math.PI) * tw.arc;
				if (tw.waddle) th.obj.rotation.z = Math.sin(t * 16) * 0.15;
				if (tw.t >= 1) {
					th.tween = null;
					th.obj.rotation.z = 0;
					tw.then?.();
				}
			} else if (th.hop >= 0 && kit) {
				th.hop += dt;
				const h = kit.squashHop(th.hop, th.lift);
				th.obj.position.y = th.home.y + h.y;
				if (h.done) th.hop = partying ? 0 : -1;
			} else if (th.swim) {
				th.obj.position.y = 0.05 + Math.sin(t * 2 + th.home.x) * 0.04;
				th.obj.rotation.y += dt * 0.25;
			}
			// Little life: heads nod, tails wag.
			const parts = (th.obj.userData as Animals.ToyAnimal['userData']).parts;
			if (parts) {
				const eating = th.id === 'animal-cow' && cowEat > 0;
				parts.head.rotation.x = eating ? 0.35 + Math.sin(t * 9) * 0.18 : Math.sin(t * 1.4 + th.home.x) * 0.06;
				if (parts.tail) parts.tail.rotation.z = Math.sin(t * 4 + th.home.z) * 0.3;
			}
		}
		if (cowEat > 0) cowEat = Math.max(0, cowEat - dt);
		confetti?.update(dt);
		if (++frameCount % 3 === 0) updateSpots();
	}

	function updateSpots() {
		if (!stage) return;
		const next: Record<string, { x: number; y: number }> = {};
		for (const th of things.values()) {
			if (!th.obj.visible) continue;
			const h = ((th.obj.userData as { height?: number }).height ?? 0.2) * th.obj.scale.y;
			next[th.id] = stage.toScreen(th.obj.position.clone().setY(th.obj.position.y + h * 0.55));
		}
		spots = next;
	}

	// ── play ──
	function hop(id: string) {
		const th = things.get(id);
		if (th && th.hop < 0 && !th.tween && !d.reduced) {
			th.home.copy(th.obj.position);
			th.hop = 0;
		}
	}

	function tapAnimal(a: FarmAnimal, id = `animal-${a}`) {
		ANIMAL_CALL[a]?.();
		say(`farm.sound.${a}`, { interrupt: true });
		hop(id);
	}

	function count(job: FarmJob) {
		progress = { ...progress, [job]: progress[job] + 1 };
		say(`number.${progress[job]}`, { interrupt: true });
		if (jobDone(day, progress, job)) finishJob(job);
	}

	function finishJob(job: FarmJob) {
		chime();
		mascot = 'celebrate';
		scheduler.after(1200, () => (mascot = 'idle'));
		say(`farm.${job === 'cow' ? 'cow-ate' : `${job}-done`}`);
		if (allJobsDone(day, progress)) {
			scheduler.after(d.reduced ? 600 : 1800, party);
			return;
		}
		const next = suggestedJob(day, progress);
		if (next) scheduler.after(d.reduced ? 600 : 2200, () => suggestJob(next));
	}

	function suggestJob(job: FarmJob) {
		if (partying) return;
		say(`farm.job.${job}`);
		setIdlePrompt(`farm.job.${job}`);
		const target = job === 'cow' ? 'hay' : job === 'eggs' ? firstLeft('egg', day.eggs, progress.eggs) : job === 'ducks' ? firstLeft('duck', day.ducks, progress.ducks) : firstLeft('mango', day.mangoes, progress.mangoes);
		scheduler.after(d.reduced ? 800 : 3500, () => suggest === job && showHand([`[data-target="${target}"]`]));
	}
	const firstLeft = (kind: string, _n: number, done: number) => `${kind}-${done}`;

	function tapHay() {
		if (busyHay || jobDone(day, progress, 'cow')) {
			ANIMAL_CALL.cow?.();
			return;
		}
		hideHand();
		busyHay = true;
		const hay = things.get('hay');
		if (!hay || !kit || !stage) {
			cowEat = 2.5;
			count('cow');
			busyHay = false;
			return;
		}
		// A bundle of hay flies to the cow; the cow munches.
		const bundle = new kit.THREE.Mesh(new kit.THREE.SphereGeometry(0.35, 10, 8), new kit.THREE.MeshStandardMaterial({ color: '#E7C35A', roughness: 1, flatShading: true }));
		bundle.scale.set(1.3, 0.6, 1);
		bundle.position.copy(hay.obj.position).setY(1.4);
		stage.scene.add(bundle);
		const b: Thing = { id: 'bundle', obj: bundle, tween: null, hop: -1, size: 0, lift: 0, home: bundle.position.clone() };
		things.set('bundle', b);
		move(b, V(P.cow[0] + 0.9, 0.25, P.cow[1] + 1.4), 0.8, 1.6, () => {
			cowEat = 3;
			ANIMAL_CALL.cow?.();
			scheduler.after(2600, () => {
				things.delete('bundle');
				stage?.scene.remove(bundle);
				bundle.geometry.dispose();
				(bundle.material as Kit.THREE.Material).dispose();
			});
			count('cow');
			busyHay = false;
		});
	}

	function tapEgg(i: number) {
		const id = `egg-${i}`;
		const th = things.get(id);
		if (th?.tween || takenEggs.has(i)) {
			const other = Array.from({ length: day.eggs }, (_, k) => k).find((k) => !takenEggs.has(k));
			if (other !== undefined && other !== i) tapEgg(other);
			return;
		}
		hideHand();
		takenEggs.add(i);
		const k = takenEggs.size - 1;
		if (!th) return count('eggs');
		move(th, V(P.eggBasket[0] + ((k % 3) - 1) * 0.28, 0.45 + Math.floor(k / 3) * 0.2, P.eggBasket[1] + (k % 2) * 0.2), 0.7, 1.4, () => count('eggs'));
		if (k === 0) ANIMAL_CALL.hen?.();
	}
	const takenEggs = new Set<number>();
	const sentDucks = new Set<number>();
	const pickedMangoes = new Set<number>();

	function tapDuck(i: number) {
		const id = `duck-${i}`;
		const th = things.get(id);
		if (sentDucks.has(i)) return tapAnimal('duck', id);
		if (th?.tween) return;
		hideHand();
		sentDucks.add(i);
		const k = sentDucks.size - 1;
		ANIMAL_CALL.duck?.();
		if (!th) return count('ducks');
		const a = k * 1.3 + 0.5;
		const to = V(P.pond[0] + Math.cos(a) * 1.6, 0.04, P.pond[1] + Math.sin(a) * 1.2);
		// Turn to face the pond (yaw only: lookAt can flip the Euler angles upside down).
		th.obj.rotation.set(0, Math.atan2(to.x - th.obj.position.x, to.z - th.obj.position.z), 0);
		move(th, to, 1.8, 0.1, () => {
			th.home.copy(to);
			th.swim = true;
			count('ducks');
		}, true);
	}

	function tapMango(i: number) {
		const id = `mango-${i}`;
		const th = things.get(id);
		if (th?.tween || pickedMangoes.has(i)) return;
		hideHand();
		pickedMangoes.add(i);
		const k = pickedMangoes.size - 1;
		if (!th) return count('mangoes');
		move(th, V(P.mangoBasket[0] + ((k % 3) - 1) * 0.3, 0.45 + Math.floor(k / 3) * 0.22, P.mangoBasket[1] + (k % 2) * 0.2), 0.75, 0.6, () => count('mangoes'));
	}

	function party() {
		partying = true;
		setIdlePrompt(null);
		hideHand();
		chime('big');
		say('farm.party', { interrupt: true });
		mascot = 'celebrate';
		for (const [id, th] of things) {
			if (id.startsWith('animal') || (id.startsWith('duck') && !th.swim)) {
				th.home.copy(th.obj.position);
				th.hop = d.reduced ? -1 : 0;
			}
		}
		if (kit) {
			for (const [x, z] of [[-4, -2], [2, -4], [6, 0], [-6, 4]]) confetti?.burst(V(x!, 2, z!), 22);
		}
		stage?.feedback(!d.reduced);
		ANIMAL_CALL.cow?.();
		scheduler.after(500, () => ANIMAL_CALL.goat?.());
		scheduler.after(1000, () => ANIMAL_CALL.duck?.());
		scheduler.after(d.reduced ? 600 : 2500, () => (done = true));
	}

	function newDay() {
		scheduler.cancelAll();
		hideHand();
		partying = false;
		done = false;
		day = createFarmDay($settings.difficulty, (Date.now() + 3) >>> 0);
		progress = freshProgress();
		takenEggs.clear();
		sentDucks.clear();
		pickedMangoes.clear();
		// A fresh yard: the old stage (and everything in it) is disposed, a new canvas starts.
		things = new Map();
		if (stage) restartStage();
		mascot = 'wave';
		hello();
	}

	let canvasKey = $state(0);
	async function restartStage() {
		confetti?.dispose();
		confetti = null;
		disposeSky?.();
		disposeSky = null;
		for (const x of disposers.splice(0)) x();
		stage?.dispose();
		stage = null;
		ready = false;
		canvasKey += 1;
		await Promise.resolve();
		await new Promise((r) => requestAnimationFrame(r));
		void startStage();
	}

	function hello() {
		instruct('farm.hello');
		const first = suggestedJob(day, progress);
		if (first) scheduler.after(d.reduced ? 1500 : 3200, () => suggestJob(first));
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
		stage?.dispose();
		stage = null;
	});

	type Target = { id: string; size: number; label: string; tap: () => void; done: boolean };
	const targets = $derived.by<Target[]>(() => {
		void progress;
		const list: Target[] = [
			{ id: 'hay', size: 100, label: label('farm.hay'), tap: tapHay, done: false },
			{ id: 'animal-cow', size: 150, label: label('farm.animal.cow'), tap: () => tapAnimal('cow'), done: false },
			{ id: 'animal-hen', size: 100, label: label('farm.animal.hen'), tap: () => tapAnimal('hen'), done: false },
			{ id: 'animal-goat', size: 120, label: label('farm.animal.goat'), tap: () => tapAnimal('goat'), done: false }
		];
		for (let i = 0; i < day.eggs; i++) list.push({ id: `egg-${i}`, size: 64, label: label('farm.egg'), tap: () => tapEgg(i), done: takenEggs.has(i) });
		for (let i = 0; i < day.ducks; i++) list.push({ id: `duck-${i}`, size: 90, label: label('farm.animal.duck'), tap: () => tapDuck(i), done: false });
		for (let i = 0; i < day.mangoes; i++) list.push({ id: `mango-${i}`, size: 70, label: label('farm.mango'), tap: () => tapMango(i), done: pickedMangoes.has(i) });
		return list;
	});
	const FLAT_ICON: Record<string, string> = { hay: '🌾', 'animal-cow': '🐄', 'animal-hen': '🐔', 'animal-goat': '🐐', egg: '🥚', duck: '🦆', mango: '🥭' };
</script>

<TopBar onreplay={() => say(suggest ? `farm.job.${suggest}` : 'farm.hello', { interrupt: true })} />

<section
	class="farm"
	class:paused={$paused}
	data-ready={ready || failed}
	data-cow={progress.cow}
	data-eggs={progress.eggs}
	data-ducks={progress.ducks}
	data-mangoes={progress.mangoes}
	data-need={FARM_JOBS.map((j) => `${j}:${jobSize(day, j)}`).join(',')}
	data-suggest={suggest ?? ''}
	data-done={done}
>
	<div class="view game-viewport">
		{#key canvasKey}<canvas bind:this={canvas} aria-hidden="true"></canvas>{/key}
		{#if failed}
			<div class="flat">
				{#each targets as tg (tg.id)}
					{#if !tg.done}
						<button class="flat-btn" data-target={tg.id} aria-label={tg.label} onclick={tg.tap}>{FLAT_ICON[tg.id] ?? FLAT_ICON[tg.id.split('-')[0]!]}</button>
					{/if}
				{/each}
			</div>
		{:else if ready}
			{#each targets as tg (tg.id)}
				{@const s = spots[tg.id]}
				{#if s && !tg.done}
					<button
						class="tap"
						data-target={tg.id}
						aria-label={tg.label}
						style:left="{s.x}px"
						style:top="{s.y}px"
						style:width="{tg.size}px"
						style:height="{tg.size}px"
						onclick={tg.tap}
					></button>
				{/if}
			{/each}
		{/if}
		<div class="jobs" aria-hidden="true">
			{#each FARM_JOBS as j (j)}
				<span class="job-chip" class:done={jobDone(day, progress, j)} class:now={suggest === j}>{{ cow: '🐄', eggs: '🥚', ducks: '🦆', mangoes: '🥭' }[j]}{#if jobDone(day, progress, j)}<b>✓</b>{/if}</span>
			{/each}
		</div>
		<div class="rumi"><Mascot state={mascot} size={120} /></div>
		{#if done}
			<div class="finish">
				<GameButton action="replay" onclick={newDay} />
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		{/if}
	</div>
</section>

<style>
	.farm {
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
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
	}
	.tap:focus-visible {
		outline: 5px solid var(--text-primary);
		outline-offset: 2px;
	}
	.jobs {
		position: absolute;
		top: 12px;
		right: 14px;
		display: flex;
		gap: 10px;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.82);
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.1);
		border: 1px solid #ffffffb3;
		backdrop-filter: blur(12px);
	}
	.job-chip {
		position: relative;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: #f3efe6;
		font-size: 30px;
		transition: transform 200ms ease;
	}
	.job-chip.now {
		background: #fff3b0;
		box-shadow: 0 0 0 3px #ffd84d;
		animation: nudge 1.4s ease-in-out infinite;
	}
	.job-chip.done {
		background: #d8f3dc;
		box-shadow: inset 0 0 0 2px #83bd92;
	}
	.job-chip b {
		position: absolute;
		right: -4px;
		bottom: -4px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #35a66a;
		color: #fff;
		font-size: 14px;
	}
	.rumi {
		position: absolute;
		left: 12px;
		bottom: 8px;
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
		border: 1px solid #ffffffc9;
		backdrop-filter: blur(12px);
	}
	.flat {
		position: absolute;
		inset: 0;
		display: flex;
		flex-wrap: wrap;
		align-content: center;
		justify-content: center;
		gap: 18px;
		padding: 80px 30px 30px;
		background: #dff0d0;
	}
	.flat-btn {
		width: 110px;
		height: 110px;
		border: 4px solid var(--border-soft);
		border-radius: 26px;
		background: var(--surface);
		font-size: 60px;
		cursor: pointer;
	}
	@keyframes nudge {
		50% {
			transform: scale(1.1);
		}
	}
</style>
