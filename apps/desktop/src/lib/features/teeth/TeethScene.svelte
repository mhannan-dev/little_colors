<script lang="ts">
	/**
	 * Toothie's Morning Adventure (টুথির সকাল) — a tooth-brushing game for ages 2–5.
	 * Pick a friend, feed them breakfast, put paste on the brush, then rub over the teeth (any
	 * direction counts) until each part sparkles and the goofy germs giggle away. Rinse, admire the
	 * smile in the mirror, pop balloons and always get a sticker. No timer, no score, nothing to
	 * fail (PR-07/PR-08). "Brush with me" guides real brushing with the song, one part per verse.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import {
		breakfast,
		freshDirt,
		isClean,
		MOUTH_ZONES,
		narrationText,
		nextDirtyZone,
		scrub,
		TEETH_FOODS,
		TOOTH_FRIENDS,
		zoneAt,
		type Dirt,
		type MouthZone,
		type TeethFood,
		type TeethStep,
		type ToothFriend
	} from '@little-colors/core';
	import Mascot, { type MascotAnimation } from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import ParticleCanvas, { type ParticleCue } from '#lib/components/visuals/ParticleCanvas.svelte';
	import { instruct, leaveScreen, say, setIdlePrompt, speakLabel, stopNarration } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { createScheduler, durations } from '#lib/game/scheduler.ts';
	import { chime } from '#lib/game/chime.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { giggle, popSound, scrubSound, startTune, stopTune, swishSound } from './teethAudio.ts';

	type Step = TeethStep | 'real';
	const FRIENDS = Object.keys(TOOTH_FRIENDS) as ToothFriend[];
	const FOOD_ICON: Record<TeethFood, string> = { cake: '🍰', chocolate: '🍫', laddu: '', apple: '🍎', carrot: '🥕' };
	const GERM_COLOR: Record<MouthZone, string> = { 'top-left': '#8BD45B', 'top-right': '#B48CF0', 'bottom-left': '#FFB347', 'bottom-right': '#5EC8E8' };
	/** Where each zone sits on the open mouth (percent of the mouth box), for germs and sparkles. */
	const ZONE_POS: Record<MouthZone, { x: number; y: number }> = {
		'top-left': { x: 28, y: 24 },
		'top-right': { x: 72, y: 24 },
		'bottom-left': { x: 32, y: 68 },
		'bottom-right': { x: 68, y: 68 }
	};
	const REAL_ZONE_MS = 25_000;
	const STICKER_KEY = 'lc.teeth.stickers';

	const d = durations();
	const scheduler = createScheduler();
	const bn = $derived($settings.language === 'bn-BD');
	const label = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	let step = $state<Step>('pick');
	let friend = $state<ToothFriend>('dino');
	let foods = $state<TeethFood[]>([]);
	let eaten = $state<TeethFood[]>([]);
	let chewing = $state(false);
	let dirt = $state<Dirt>(freshDirt());
	let hasPaste = $state(false);
	let squeezing = $state(false);
	let rinsing = $state(false);
	let realZone = $state(0);
	let balloons = $state<{ id: number; x: number; color: string; delay: number; popped: boolean }[]>([]);
	let stickers = $state<ToothFriend[]>([]);
	let newSticker = $state(false);
	let mascot = $state<MascotAnimation>('wave');
	let particles = $state.raw<ParticleCue | null>(null);
	let foam = $state<{ id: number; x: number; y: number }[]>([]);
	let brushing = $state(false);
	let brushPos = $state<{ x: number; y: number } | null>(null);

	const mouthOpen = $derived(step === 'paste' || step === 'brush' || step === 'real');
	const cleanCount = $derived(MOUTH_ZONES.filter((z) => dirt[z] <= 0).length);
	const totalDirt = $derived(MOUTH_ZONES.reduce((n, z) => n + dirt[z], 0));
	const nextZone = $derived(nextDirtyZone(dirt));
	const popped = $derived(balloons.filter((b) => b.popped).length);
	const friendName = (f: ToothFriend) => (bn ? TOOTH_FRIENDS[f].bn : TOOTH_FRIENDS[f].en);

	// ---------- stickers (kept on this computer; a collection, never a score) ----------
	function loadStickers() {
		try {
			const v = JSON.parse(localStorage.getItem(STICKER_KEY) ?? '[]');
			stickers = Array.isArray(v) ? v.filter((f): f is ToothFriend => FRIENDS.includes(f)).slice(-30) : [];
		} catch {
			stickers = [];
		}
	}
	function awardSticker() {
		stickers = [...stickers, friend].slice(-30);
		newSticker = true;
		try {
			localStorage.setItem(STICKER_KEY, JSON.stringify(stickers));
		} catch {
			/* storage blocked: the sticker still shows today */
		}
	}

	// ---------- dirt layer: food crumbs drawn on a canvas over the teeth ----------
	type Speck = { zone: MouthZone; x: number; y: number; r: number; color: string; life: number; plaque: boolean };
	let specks: Speck[] = [];
	let mouthEl = $state<HTMLDivElement | null>(null);
	let canvas = $state<HTMLCanvasElement | null>(null);
	let wrapEl = $state<HTMLDivElement | null>(null);
	let raf = 0;

	function makeSpecks(seed: number) {
		let s = seed >>> 0 || 1;
		const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
		const crumbs = ['#8B5A2B', '#6B3E1F', '#C68E3F', '#E0B656', '#A0522D'];
		specks = [];
		for (const zone of MOUTH_ZONES) {
			const left = zone.endsWith('left');
			const top = zone.startsWith('top');
			const x0 = left ? 0.1 : 0.52;
			const y0 = top ? 0.13 : 0.56;
			const yr = top ? 0.24 : 0.2;
			for (let i = 0; i < 3; i++) specks.push({ zone, x: x0 + rnd() * 0.36, y: y0 + rnd() * yr, r: 0.06 + rnd() * 0.03, color: '#D9C76A', life: 1, plaque: true });
			for (let i = 0; i < 15; i++) specks.push({ zone, x: x0 + rnd() * 0.38, y: y0 + rnd() * yr, r: 0.018 + rnd() * 0.03, color: crumbs[Math.floor(rnd() * crumbs.length)]!, life: 1, plaque: false });
		}
	}

	function paint() {
		raf = 0;
		if (!canvas || !mouthEl) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const w = mouthEl.clientWidth;
		const h = mouthEl.clientHeight;
		ctx.clearRect(0, 0, w, h);
		for (const sp of specks) {
			const a = Math.min(sp.life, dirt[sp.zone] * 1.4);
			if (a <= 0.02) continue;
			ctx.globalAlpha = sp.plaque ? a * 0.45 : a;
			ctx.fillStyle = sp.color;
			ctx.beginPath();
			ctx.arc(sp.x * w, sp.y * h, sp.r * w, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.globalAlpha = 1;
	}
	const repaint = () => {
		if (!raf) raf = requestAnimationFrame(paint);
	};

	function sizeCanvas() {
		if (!canvas || !mouthEl) return;
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.round(mouthEl.clientWidth * dpr);
		canvas.height = Math.round(mouthEl.clientHeight * dpr);
		canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
		paint();
	}

	$effect(() => {
		if (!mouthEl || !canvas) return;
		const ro = new ResizeObserver(sizeCanvas);
		ro.observe(mouthEl);
		sizeCanvas();
		return () => ro.disconnect();
	});

	// ---------- the flow ----------
	function choose(f: ToothFriend) {
		friend = f;
		speakLabel(`teeth.friend.${f}`);
		startMorning();
	}

	function startMorning() {
		scheduler.cancelAll();
		hideHand();
		stopTune();
		foods = breakfast(Date.now() >>> 0);
		eaten = [];
		dirt = freshDirt();
		makeSpecks(Date.now());
		hasPaste = false;
		rinsing = false;
		newSticker = false;
		balloons = [];
		foam = [];
		mascot = 'idle';
		step = 'eat';
		instruct('teeth.eat');
		setIdlePrompt('teeth.eat');
		if (firstTime('teeth')) scheduler.after(d.reduced ? 1200 : 2800, () => step === 'eat' && showHand([`[data-food="${foods[0]}"]`]));
	}

	function eat(food: TeethFood) {
		if (step !== 'eat' || eaten.includes(food)) return;
		hideHand();
		eaten = [...eaten, food];
		chewing = true;
		say(`teeth.food.${food}`, { interrupt: true });
		say(TEETH_FOODS[food].sweet ? 'teeth.yum' : 'teeth.healthy');
		scheduler.after(d.reduced ? 300 : 1100, () => (chewing = false));
		if (eaten.length === foods.length) {
			setIdlePrompt(null);
			scheduler.after(d.reduced ? 700 : 1700, () => {
				step = 'paste';
				mascot = 'encourage';
				say('teeth.dirty', { interrupt: true });
				instruct('teeth.paste');
				setIdlePrompt('teeth.paste');
				scheduler.after(d.reduced ? 1500 : 4200, () => step === 'paste' && showHand(['[data-testid="toothpaste"]']));
			});
		}
	}

	function squeeze() {
		if (step !== 'paste' || squeezing) return;
		hideHand();
		squeezing = true;
		speakLabel('teeth.toothpaste');
		scheduler.after(d.reduced ? 250 : 800, () => {
			squeezing = false;
			hasPaste = true;
			step = 'brush';
			mascot = 'idle';
			stopNarration();
			instruct('teeth.brush');
			setIdlePrompt('teeth.brush');
			startTune();
			nudge();
		});
	}

	/** After a quiet moment, a hand shows a side-to-side rub on the next dirty part. */
	let cancelNudge: (() => void) | null = null;
	function nudge(ms = 5200) {
		cancelNudge?.();
		cancelNudge = scheduler.after(d.reduced ? 2500 : ms, () => {
			const z = nextDirtyZone(dirt);
			if (step !== 'brush' || !z) return;
			showHand([`[data-zone="${z}"] .ha`, `[data-zone="${z}"] .hb`], { drag: true });
			say(`teeth.zone.${z}`);
		});
	}

	function applyScrub(zone: MouthZone, stroke: number) {
		if (step !== 'brush') return;
		const r = scrub(dirt[zone], stroke);
		if (r.dirt === dirt[zone]) return;
		dirt = { ...dirt, [zone]: r.dirt };
		repaint();
		if (!r.justCleaned) return;
		chime();
		giggle();
		particles = { kind: 'stars', anchor: document.querySelector(`[data-zone="${zone}"]`) };
		hideHand();
		if (isClean(dirt)) {
			brushing = false;
			setIdlePrompt(null);
			cancelNudge?.();
			say('teeth.germ-bye', { interrupt: true });
			mascot = 'celebrate';
			scheduler.after(d.reduced ? 700 : 1800, () => {
				step = 'rinse';
				mascot = 'idle';
				instruct('teeth.rinse');
				setIdlePrompt('teeth.rinse');
				scheduler.after(d.reduced ? 1500 : 4000, () => step === 'rinse' && showHand(['[data-testid="cup"]']));
			});
		} else {
			say('teeth.zone-clean', { interrupt: true });
			const z = nextDirtyZone(dirt);
			if (z) say(`teeth.zone.${z}`);
		}
	}

	// Pointer brushing: anywhere over the face counts; strokes inside the mouth clean the teeth.
	let last: { x: number; y: number } | null = null;
	function mouthPoint(e: PointerEvent) {
		const r = mouthEl!.getBoundingClientRect();
		return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, w: r.width, h: r.height };
	}
	function trackBrush(e: PointerEvent) {
		if (!wrapEl) return;
		const r = wrapEl.getBoundingClientRect();
		brushPos = { x: e.clientX - r.left, y: e.clientY - r.top };
	}
	function onDown(e: PointerEvent) {
		if (step !== 'brush' || !mouthEl) return;
		brushing = true;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
		trackBrush(e);
		const p = mouthPoint(e);
		last = p;
		const z = zoneAt(p.x, p.y);
		if (z) applyScrub(z, 0.15);
		hideHand();
		nudge();
	}
	function onMove(e: PointerEvent) {
		if (step !== 'brush' || !mouthEl) return;
		trackBrush(e);
		if (!brushing || !last) return;
		const p = mouthPoint(e);
		const mid = { x: (p.x + last.x) / 2, y: (p.y + last.y) / 2 };
		// Pixel distance relative to one zone's width, so speed and screen size don't matter.
		const dist = Math.hypot((p.x - last.x) * p.w, (p.y - last.y) * p.h) / (p.w / 2);
		const inside = mid.x > -0.08 && mid.x < 1.08 && mid.y > -0.1 && mid.y < 1.1;
		if (inside && dist > 0.01) {
			rubSpecks(last, p, p.w, p.h);
			const z = zoneAt(Math.min(1, Math.max(0, mid.x)), Math.min(1, Math.max(0, mid.y)));
			if (z) applyScrub(z, Math.min(dist, 0.6));
			scrubSound();
			addFoam(p.x, p.y);
			nudge();
		}
		last = p;
	}
	function onUp() {
		brushing = false;
		last = null;
	}

	function rubSpecks(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number) {
		const R = 0.1 * w;
		const ax = a.x * w, ay = a.y * h, bx = b.x * w, by = b.y * h;
		const dx = bx - ax, dy = by - ay;
		const len2 = dx * dx + dy * dy || 1;
		for (const sp of specks) {
			const px = sp.x * w, py = sp.y * h;
			const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
			if (Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) < R + sp.r * w) sp.life = Math.max(0, sp.life - 0.3);
		}
		repaint();
	}

	let foamId = 1;
	let lastFoam = 0;
	function addFoam(x: number, y: number) {
		const now = performance.now();
		if (now - lastFoam < 90 || x < 0 || x > 1 || y < 0 || y > 1) return;
		lastFoam = now;
		const id = foamId++;
		foam = [...foam.slice(-14), { id, x: x * 100 + (Math.random() * 10 - 5), y: y * 100 + (Math.random() * 10 - 5) }];
		setTimeout(() => (foam = foam.filter((f) => f.id !== id)), 1000);
	}

	function zoneKey(e: KeyboardEvent, z: MouthZone) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		scrubSound();
		applyScrub(z, 1);
	}

	function rinse() {
		if (step !== 'rinse' || rinsing) return;
		hideHand();
		setIdlePrompt(null);
		rinsing = true;
		speakLabel('teeth.cup');
		swishSound();
		scheduler.after(d.reduced ? 600 : 2000, () => {
			rinsing = false;
			stopTune();
			step = 'mirror';
			mascot = 'celebrate';
			say('teeth.mirror', { interrupt: true });
			chime('big');
			particles = { kind: 'stars', anchor: document.querySelector('.mirror') };
			scheduler.after(d.reduced ? 1200 : 3000, celebrate);
		});
	}

	const BALLOON_COLORS = ['#FF8FA3', '#FFD166', '#7BD3EA', '#A0E7A0', '#C3A6FF', '#FFB38A', '#8FB8FF'];
	function celebrate() {
		step = 'celebrate';
		balloons = BALLOON_COLORS.map((color, i) => ({ id: i, x: 8 + i * 13 + (i % 2) * 3, color, delay: -((i * 1.3) % 9), popped: false }));
		awardSticker();
		say('teeth.sticker', { interrupt: true });
		say('teeth.balloons');
		particles = { kind: 'confetti', anchor: document.querySelector('.sticker.big') };
	}

	function pop(id: number, e: MouseEvent) {
		const b = balloons.find((x) => x.id === id);
		if (!b || b.popped) return;
		balloons = balloons.map((x) => (x.id === id ? { ...x, popped: true } : x));
		popSound();
		particles = { kind: 'confetti', point: { x: e.clientX, y: e.clientY } };
	}

	// ---------- "Brush with me": real brushing guided by the song ----------
	let cancelVerse: (() => void) | null = null;
	function startReal() {
		scheduler.cancelAll();
		hideHand();
		dirt = freshDirt();
		makeSpecks(Date.now());
		step = 'real';
		realZone = -1;
		mascot = 'wave';
		instruct('teeth.real-start');
		setIdlePrompt(null);
		cancelVerse = scheduler.after(d.reduced ? 2500 : 5000, () => verse(0));
	}
	function verse(i: number) {
		cancelVerse?.();
		realZone = i;
		mascot = 'idle';
		const z = MOUTH_ZONES[i]!;
		// The friend's teeth in the zones already sung are clean.
		dirt = Object.fromEntries(MOUTH_ZONES.map((m, j) => [m, j < i ? 0 : 1])) as Dirt;
		repaint();
		say(`teeth.song.${z}`, { interrupt: true });
		if (i === 0) startTune();
		cancelVerse = scheduler.after(REAL_ZONE_MS, () => (i < 3 ? verse(i + 1) : finishReal()));
	}
	function nextVerse() {
		if (step !== 'real') return;
		if (realZone < 3) verse(realZone + 1);
		else finishReal();
	}
	function finishReal() {
		cancelVerse?.();
		dirt = { 'top-left': 0, 'top-right': 0, 'bottom-left': 0, 'bottom-right': 0 };
		repaint();
		chime();
		step = 'rinse';
		instruct('teeth.rinse');
		setIdlePrompt('teeth.rinse');
	}

	function again() {
		scheduler.cancelAll();
		stopTune();
		step = 'pick';
		mascot = 'wave';
		instruct('teeth.choose');
		setIdlePrompt('teeth.choose');
	}

	function replay() {
		stopNarration();
		const key: Record<Step, string> = {
			pick: 'teeth.choose',
			eat: 'teeth.eat',
			paste: 'teeth.paste',
			brush: nextZone ? `teeth.zone.${nextZone}` : 'teeth.brush',
			rinse: 'teeth.rinse',
			mirror: 'teeth.mirror',
			celebrate: 'teeth.balloons',
			real: realZone >= 0 ? `teeth.song.${MOUTH_ZONES[realZone]}` : 'teeth.real-start'
		};
		say(key[step], { interrupt: true });
	}

	onMount(() => {
		loadStickers();
		instruct('teeth.choose');
		setIdlePrompt('teeth.choose');
	});

	const offPause = paused.subscribe((p) => {
		if (p) {
			scheduler.pause();
			stopNarration();
			stopTune();
			brushing = false;
		} else {
			scheduler.resume();
			if (step === 'brush' || (step === 'real' && realZone >= 0)) startTune();
		}
	});

	onDestroy(() => {
		offPause();
		scheduler.cancelAll();
		stopTune();
		hideHand();
		leaveScreen();
		if (raf) cancelAnimationFrame(raf);
	});
</script>

{#snippet laddu(size: number)}
	<svg viewBox="0 0 60 60" width={size} height={size} aria-hidden="true">
		<circle cx="30" cy="32" r="24" fill="#F5A623" stroke="#C77A0E" stroke-width="3" />
		{#each [[20, 24], [36, 20], [40, 36], [24, 40], [31, 31], [16, 34], [44, 28]] as [x, y] (`${x}-${y}`)}
			<circle cx={x} cy={y} r="2.6" fill="#FFE08A" />
		{/each}
		<ellipse cx="22" cy="22" rx="7" ry="4" fill="#ffffff" opacity="0.35" />
	</svg>
{/snippet}

{#snippet face(f: ToothFriend, mood: 'smile' | 'chew' | 'open' | 'grin' | 'swish')}
	<svg class="face-svg" viewBox="0 -40 400 440" aria-hidden="true">
		{#if f === 'dino'}
			{#each [[120, 112], [165, 86], [215, 80], [262, 92]] as [x, y] (x)}
				<path d="M{x - 24} {y + 26} L{x} {y - 22} L{x + 24} {y + 26} Z" fill="#F6C453" stroke="#C99522" stroke-width="5" stroke-linejoin="round" />
			{/each}
			<circle cx="200" cy="230" r="150" fill="#7CD3A8" stroke="#3F8F6B" stroke-width="7" />
			<ellipse cx="200" cy="292" rx="112" ry="78" fill="#B5EBCB" />
			<ellipse cx="182" cy="234" rx="6" ry="4" fill="#2F6B4F" /><ellipse cx="218" cy="234" rx="6" ry="4" fill="#2F6B4F" />
			{#each [[300, 170], [96, 160], [118, 330]] as [x, y] (x)}<circle cx={x} cy={y} r="11" fill="#5DBB8C" />{/each}
		{:else if f === 'panda'}
			<circle cx="88" cy="108" r="48" fill="#2E2E38" /><circle cx="312" cy="108" r="48" fill="#2E2E38" />
			<circle cx="200" cy="230" r="150" fill="#FAFAF7" stroke="#2E2E38" stroke-width="7" />
			<ellipse cx="146" cy="184" rx="42" ry="50" transform="rotate(-25 146 184)" fill="#2E2E38" />
			<ellipse cx="254" cy="184" rx="42" ry="50" transform="rotate(25 254 184)" fill="#2E2E38" />
			<ellipse cx="200" cy="232" rx="20" ry="13" fill="#2E2E38" />
		{:else}
			<ellipse cx="140" cy="62" rx="34" ry="80" transform="rotate(-8 140 62)" fill="#F7B6CF" stroke="#C96A92" stroke-width="6" />
			<ellipse cx="140" cy="66" rx="16" ry="56" transform="rotate(-8 140 66)" fill="#FFE1EC" />
			<ellipse cx="260" cy="62" rx="34" ry="80" transform="rotate(8 260 62)" fill="#F7B6CF" stroke="#C96A92" stroke-width="6" />
			<ellipse cx="260" cy="66" rx="16" ry="56" transform="rotate(8 260 66)" fill="#FFE1EC" />
			<circle cx="200" cy="230" r="150" fill="#F7B6CF" stroke="#C96A92" stroke-width="7" />
			<ellipse cx="200" cy="290" rx="100" ry="72" fill="#FFE1EC" />
			<path d="M188 226 h24 l-12 13 z" fill="#E0567F" />
			<path d="M120 246 h-58 M122 262 h-54 M280 246 h58 M278 262 h54" stroke="#C96A92" stroke-width="4" stroke-linecap="round" />
		{/if}
		<g class="eyes">
			{#each [148, 252] as x (x)}
				<circle cx={x} cy="180" r="27" fill="#ffffff" />
				<circle cx={x + 3} cy="184" r="15" fill="#1E1E28" />
				<circle cx={x + 8} cy="177" r="5" fill="#ffffff" />
			{/each}
		</g>
		<circle cx="108" cy="258" r="20" fill="#FF8FA3" opacity="0.5" /><circle cx="292" cy="258" r="20" fill="#FF8FA3" opacity="0.5" />
		{#if mood === 'smile'}
			<path d="M150 288 Q200 338 250 288" fill="none" stroke="#5A2232" stroke-width="8" stroke-linecap="round" />
		{:else if mood === 'chew'}
			<ellipse class="chew" cx="200" cy="300" rx="34" ry="20" fill="#7A2335" />
		{:else if mood === 'swish'}
			<ellipse cx="200" cy="300" rx="20" ry="12" fill="#5A2232" />
		{:else if mood === 'grin'}
			<path d="M128 272 Q200 382 272 272 Z" fill="#7A2335" stroke="#5A2232" stroke-width="5" stroke-linejoin="round" />
			<path d="M138 278 Q200 304 262 278 L256 296 Q200 318 144 296 Z" fill="#ffffff" />
			<ellipse cx="200" cy="335" rx="36" ry="12" fill="#E86A7F" />
		{/if}
	</svg>
{/snippet}

{#snippet brush(withPaste: boolean)}
	<svg viewBox="0 0 220 64" width="220" height="64" aria-hidden="true">
		<rect x="60" y="24" width="156" height="18" rx="9" fill="#5EC8E8" stroke="#2A7F9E" stroke-width="3" />
		<rect x="4" y="22" width="66" height="22" rx="6" fill="#ffffff" stroke="#2A7F9E" stroke-width="3" />
		{#each [10, 20, 30, 40, 50, 60] as x (x)}<rect x={x} y="8" width="6" height="16" rx="2" fill="#FFFFFF" stroke="#9CC7D6" stroke-width="1.5" />{/each}
		{#if withPaste}
			<path d="M6 10 q10 -12 20 -2 q10 -10 20 0 q10 -10 20 0 q6 4 0 8 H8 q-6 -2 -2 -6Z" fill="#E8F6FF" stroke="#7BC3E8" stroke-width="2" />
			<path d="M14 6 q8 -6 16 0 M38 6 q8 -6 16 0" fill="none" stroke="#FF8FA3" stroke-width="3" stroke-linecap="round" />
		{/if}
	</svg>
{/snippet}

<TopBar onreplay={replay} />

<ParticleCanvas cue={particles} paused={$paused} reducedMotion={d.reduced} />
<section
	class="teeth"
	class:paused={$paused}
	data-step={step}
	data-friend={friend}
	data-clean={cleanCount}
	data-dirt={totalDirt.toFixed(2)}
	data-popped={popped}
	data-stickers={stickers.length}
	data-real-zone={realZone}
>
	{#if step === 'pick'}
		<div class="pick">
			<div class="friends">
				{#each FRIENDS as f (f)}
					<button class="friend-card" data-friend={f} aria-label={friendName(f)} onfocus={() => speakLabel(`teeth.friend.${f}`)} onclick={() => choose(f)}>
						<span class="mini">{@render face(f, 'grin')}</span>
						<span class="name">{friendName(f)}</span>
					</button>
				{/each}
			</div>
			<button class="real-btn" data-testid="real-brush" aria-label={label('teeth.real')} onfocus={() => speakLabel('teeth.real')} onclick={startReal}>
				<span class="real-icon" aria-hidden="true">🪥🎵</span>
				<span>{label('teeth.real')}</span>
			</button>
			{#if stickers.length > 0}
				<div class="album" aria-label={label('teeth.sticker')}>
					{#each stickers.slice(-12) as s, i (i)}
						<span class="sticker small">{@render face(s, 'grin')}</span>
					{/each}
				</div>
			{/if}
		</div>
	{:else if step === 'celebrate'}
		<div class="party">
			<div class="balloons">
				{#each balloons as b (b.id)}
					<button
						class="balloon"
						class:popped={b.popped}
						data-balloon={b.id}
						style:left="{b.x}%"
						style:--c={b.color}
						style:animation-delay="{b.delay}s"
						aria-label={bn ? 'বেলুন' : 'Balloon'}
						disabled={b.popped}
						onclick={(e) => pop(b.id, e)}
					>
						<svg viewBox="0 0 80 130" aria-hidden="true">
							<path d="M40 96 q-6 14 4 34" fill="none" stroke="#9A8F86" stroke-width="2" />
							<ellipse cx="40" cy="48" rx="34" ry="44" fill="var(--c)" />
							<path d="M34 92 h12 l-6 8z" fill="var(--c)" />
							<ellipse cx="28" cy="30" rx="8" ry="13" fill="#ffffff" opacity="0.45" />
						</svg>
					</button>
				{/each}
			</div>
			<div class="award">
				<div class="sticker big" class:fresh={newSticker}>
					{@render face(friend, 'grin')}
					<span class="ribbon">✨ {bn ? 'ঝকঝকে হাসি' : 'Shiny smile'} ✨</span>
				</div>
				<Mascot state="celebrate" size={150} />
			</div>
			<div class="actions">
				<GameButton action="replay" onclick={startMorning} />
				<button class="again-friend" aria-label={label('teeth.choose')} onclick={again}>
					{#each FRIENDS as f (f)}<span class="tiny">{@render face(f, 'smile')}</span>{/each}
				</button>
				<GameButton action="choose-game" onclick={() => goto('/play')} />
			</div>
		</div>
	{:else}
		<div class="room">
			<div class="stage">
				<div class="mirror" class:shine={step === 'mirror'}>
					<div
						class="face-wrap"
						class:brushing
						class:rinsing
						bind:this={wrapEl}
						role="application"
						aria-label={friendName(friend)}
						onpointerdown={onDown}
						onpointermove={onMove}
						onpointerup={onUp}
						onpointercancel={onUp}
						onpointerleave={() => !brushing && (brushPos = null)}
					>
						{@render face(friend, step === 'eat' ? (chewing ? 'chew' : 'smile') : mouthOpen ? 'open' : rinsing ? 'swish' : step === 'mirror' ? 'grin' : 'smile')}
						{#if mouthOpen}
							<div class="mouth" bind:this={mouthEl}>
								<svg class="teeth-svg" viewBox="0 0 170 110" preserveAspectRatio="none" aria-hidden="true">
									<path d="M4 18 Q85 -8 166 18 Q172 72 85 108 Q-2 72 4 18 Z" fill="#7A2335" stroke="#5A2232" stroke-width="4" />
									<ellipse cx="85" cy="88" rx="44" ry="16" fill="#E86A7F" />
									{#each [0, 1, 2, 3, 4, 5] as i (i)}
										<rect x={16 + i * 23} y={12 + (i === 0 || i === 5 ? 3 : 0)} width="21" height={i === 0 || i === 5 ? 24 : 28} rx="6" fill="#FFFDF6" stroke="#E7DCC8" stroke-width="1.5" />
									{/each}
									{#each [0, 1, 2, 3, 4] as i (i)}
										<rect x={28 + i * 23} y="60" width="21" height="22" rx="6" fill="#FFFDF6" stroke="#E7DCC8" stroke-width="1.5" />
									{/each}
								</svg>
								<canvas bind:this={canvas}></canvas>
								{#each foam as f (f.id)}<span class="foam" style:left="{f.x}%" style:top="{f.y}%"></span>{/each}
								{#each MOUTH_ZONES as z (z)}
									{@const clean = dirt[z] <= 0}
									<span class="germ" class:bye={clean} class:right={z.endsWith('right')} style:left="{ZONE_POS[z].x}%" style:top="{ZONE_POS[z].y}%" style:--g={GERM_COLOR[z]} aria-hidden="true">
										<svg viewBox="0 0 60 60">
											<path d="M30 6 q8 -6 10 4 q10 -4 10 8 q10 4 4 14 q8 8 -2 14 q2 10 -10 8 q-4 8 -12 2 q-8 6 -12 -2 q-12 2 -10 -8 q-10 -6 -2 -14 q-6 -10 4 -14 q0 -12 10 -8 q2 -10 10 -4z" fill="var(--g)" stroke="#4B3B5C" stroke-width="2.5" />
											<circle cx="22" cy="26" r="7" fill="#fff" /><circle cx="38" cy="26" r="7" fill="#fff" />
											<circle cx="23" cy="27" r="3.5" fill="#222" /><circle cx="37" cy="27" r="3.5" fill="#222" />
											<path d="M22 38 q8 8 16 0" fill="#5A2232" stroke="#4B3B5C" stroke-width="2" />
											<path d="M27 39 v3 M33 39 v3" stroke="#fff" stroke-width="2" />
										</svg>
									</span>
									{#if clean}<span class="sparkle" style:left="{ZONE_POS[z].x}%" style:top="{ZONE_POS[z].y}%" aria-hidden="true">✦</span>{/if}
									{#if step === 'real' && realZone >= 0 && MOUTH_ZONES[realZone] === z}
										<span class="real-glow" class:top={z.startsWith('top')} class:right={z.endsWith('right')} aria-hidden="true"></span>
									{/if}
									<button
										class="zone"
										class:top={z.startsWith('top')}
										class:right={z.endsWith('right')}
										data-zone={z}
										tabindex={step === 'brush' && !clean ? 0 : -1}
										aria-label={label(`teeth.zone.${z}`)}
										onkeydown={(e) => zoneKey(e, z)}
									>
										<span class="ha"></span><span class="hb"></span>
									</button>
								{/each}
							</div>
						{/if}
						{#if step === 'brush'}
							<span
								class="brush-tool"
								class:held={brushPos !== null}
								style:transform={brushPos ? `translate(${brushPos.x - 30}px, ${brushPos.y - 34}px) rotate(-12deg)` : undefined}
								aria-hidden="true">{@render brush(hasPaste)}</span>
						{/if}
						{#if step === 'real' && realZone >= 0}
							<span class="brush-tool demo {MOUTH_ZONES[realZone]}" aria-hidden="true">{@render brush(true)}</span>
						{/if}
						{#if rinsing}
							{#each [0, 1, 2, 3, 4, 5] as i (i)}<span class="bubble" style:--i={i} aria-hidden="true"></span>{/each}
						{/if}
					</div>
					{#if step === 'mirror'}
						{#each [[18, 22], [80, 18], [70, 70], [24, 76], [50, 10]] as [x, y] (`${x}${y}`)}
							<span class="glint" style:left="{x}%" style:top="{y}%" aria-hidden="true">✨</span>
						{/each}
					{/if}
				</div>
			</div>

			<aside class="tools">
				{#if step === 'eat'}
					<div class="plate" role="group" aria-label={label('teeth.eat')}>
						{#each foods as f (f)}
							<button class="food" class:gone={eaten.includes(f)} data-food={f} aria-label={label(`teeth.food.${f}`)} disabled={eaten.includes(f)} onclick={() => eat(f)}>
								{#if f === 'laddu'}{@render laddu(78)}{:else}<span aria-hidden="true">{FOOD_ICON[f]}</span>{/if}
							</button>
						{/each}
					</div>
				{:else if step === 'paste' || step === 'brush'}
					<button class="tube" class:squeeze={squeezing} class:done={hasPaste} data-testid="toothpaste" aria-label={label('teeth.toothpaste')} disabled={step !== 'paste'} onclick={squeeze}>
						<svg viewBox="0 0 160 90" aria-hidden="true">
							<path d="M10 18 h96 l20 14 v26 l-20 14 H10 q-6 -27 0 -54z" fill="#ffffff" stroke="#5EC8E8" stroke-width="5" stroke-linejoin="round" />
							<path d="M24 30 h60 M24 45 h46 M24 60 h60" stroke="#FF8FA3" stroke-width="7" stroke-linecap="round" />
							<rect x="126" y="34" width="26" height="22" rx="5" fill="#5EC8E8" />
						</svg>
					</button>
					{#if step === 'paste'}<span class="rest-brush" class:pasted={hasPaste} aria-hidden="true">{@render brush(hasPaste)}</span>{/if}
					<div class="zones-map" aria-hidden="true">
						{#each MOUTH_ZONES as z (z)}<span class="dot" class:on={dirt[z] <= 0}>{dirt[z] <= 0 ? '✨' : ''}</span>{/each}
					</div>
				{:else if step === 'rinse'}
					<button class="cup" class:tilt={rinsing} data-testid="cup" aria-label={label('teeth.cup')} disabled={rinsing} onclick={rinse}>
						<svg viewBox="0 0 100 120" aria-hidden="true">
							<path d="M14 20 h72 l-10 92 H24z" fill="#FFD6E0" stroke="#E0567F" stroke-width="5" stroke-linejoin="round" />
							<path d="M19 40 h62 l-6 66 H25z" fill="#9EE3F7" opacity="0.85" />
							<path d="M30 52 q20 -8 40 0" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
						</svg>
					</button>
				{:else if step === 'real'}
					<div class="zones-map big" aria-hidden="true">
						{#each MOUTH_ZONES as z, i (z)}<span class="dot" class:on={i < realZone} class:now={i === realZone}>{i < realZone ? '✨' : i === realZone ? '🪥' : ''}</span>{/each}
					</div>
					<GameButton action="next" onclick={nextVerse} />
				{/if}
				<div class="rumi"><Mascot state={mascot} size={130} /></div>
			</aside>
		</div>
	{/if}
</section>

<style>
	.teeth {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
		/* A pastel bathroom: soft tiles and a shelf line. */
		background:
			linear-gradient(to bottom, transparent 84%, #d7eef2 84%, #c4e3e9 100%),
			repeating-linear-gradient(0deg, transparent 0 58px, rgba(255, 255, 255, 0.7) 58px 61px),
			repeating-linear-gradient(90deg, transparent 0 58px, rgba(255, 255, 255, 0.7) 58px 61px),
			linear-gradient(160deg, #e6f6fb, #fdeef4);
	}
	.paused :global(*) {
		animation-play-state: paused !important;
	}

	/* ----- pick ----- */
	.pick {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 26px;
		padding: 16px;
	}
	.friends {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 28px;
	}
	.friend-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		width: 230px;
		padding: 16px 12px 14px;
		border: 5px solid #ffffff;
		border-radius: 34px;
		background: rgba(255, 255, 255, 0.75);
		box-shadow: 0 10px 0 rgba(94, 200, 232, 0.35), 0 18px 30px rgba(60, 90, 120, 0.12);
		cursor: pointer;
		transition: transform 180ms ease;
	}
	.friend-card:hover,
	.friend-card:focus-visible {
		transform: translateY(-6px) scale(1.03);
	}
	.mini {
		width: 180px;
		display: block;
		animation: bob 2.6s ease-in-out infinite;
	}
	.friend-card:nth-child(2) .mini {
		animation-delay: 0.4s;
	}
	.friend-card:nth-child(3) .mini {
		animation-delay: 0.8s;
	}
	.name {
		font-size: 30px;
		font-weight: 800;
		color: var(--text-primary);
	}
	.real-btn {
		display: flex;
		align-items: center;
		gap: 14px;
		min-height: var(--target-game);
		padding: 12px 30px;
		border: 4px solid #2a7f9e;
		border-radius: var(--radius-xl);
		background: #5ec8e8;
		color: #0f3b4a;
		font-size: 24px;
		font-weight: 800;
		cursor: pointer;
	}
	.real-icon {
		font-size: 36px;
	}
	.album {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 8px;
		max-width: 700px;
	}

	/* ----- room ----- */
	.room {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		gap: 18px;
		padding: 6px 28px 18px;
		min-height: 0;
	}
	.stage {
		display: grid;
		place-items: center;
		min-height: 0;
		height: 100%;
	}
	.mirror {
		position: relative;
		padding: 18px;
		border-radius: 50% / 46%;
		background: radial-gradient(ellipse at 35% 25%, rgba(255, 255, 255, 0.95), rgba(214, 240, 250, 0.85));
		border: 14px solid #f7d7a8;
		box-shadow: 0 0 0 6px #e9b97a, 0 18px 40px rgba(80, 100, 130, 0.18);
		transition: box-shadow 500ms ease;
	}
	.mirror.shine {
		box-shadow: 0 0 0 6px #e9b97a, 0 0 60px 18px rgba(255, 230, 140, 0.8);
	}
	.face-wrap {
		position: relative;
		width: min(64vh, 560px, 58vw);
		aspect-ratio: 400 / 440;
		touch-action: none;
		user-select: none;
	}
	.face-wrap.rinsing {
		animation: swish 400ms ease-in-out 4;
	}
	.face-svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.face-wrap .face-svg {
		position: absolute;
		inset: 0;
		height: 100%;
		overflow: visible;
	}
	.face-svg :global(.eyes) {
		transform-origin: 200px 180px;
		animation: blink 4.5s infinite;
	}
	.face-svg :global(.chew) {
		transform-origin: 200px 300px;
		animation: chew 260ms ease-in-out infinite alternate;
	}
	.mouth {
		position: absolute;
		left: 28.75%;
		top: 64.77%;
		width: 42.5%;
		height: 25%;
		animation: open 300ms ease-out;
	}
	.teeth-svg,
	.mouth canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
	.mouth canvas {
		/* Clip crumbs to the open mouth's rounded shape. */
		clip-path: ellipse(50% 52% at 50% 46%);
	}
	.zone {
		position: absolute;
		width: 50%;
		height: 50%;
		left: 0;
		top: 50%;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: inherit;
	}
	.zone.top {
		top: 0;
	}
	.zone.right {
		left: 50%;
	}
	.zone:focus-visible {
		outline: 4px dashed #2a7f9e;
		outline-offset: -4px;
	}
	.ha,
	.hb {
		position: absolute;
		top: 50%;
		width: 2px;
		height: 2px;
	}
	.ha {
		left: 18%;
	}
	.hb {
		left: 82%;
	}
	.germ {
		position: absolute;
		width: 26%;
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		pointer-events: none;
		animation: wiggle 900ms ease-in-out infinite alternate;
		filter: drop-shadow(0 3px 2px rgba(0, 0, 0, 0.2));
	}
	.germ svg {
		width: 100%;
		height: 100%;
	}
	.brushing .germ:not(.bye) {
		animation-duration: 260ms;
	}
	.germ.bye {
		animation: run-left 900ms ease-in forwards;
	}
	.germ.bye.right {
		animation-name: run-right;
	}
	.sparkle {
		position: absolute;
		transform: translate(-50%, -50%);
		font-size: clamp(18px, 3vw, 34px);
		color: #fff7b0;
		text-shadow: 0 0 10px #fff;
		pointer-events: none;
		animation: twinkle 1.2s ease-in-out infinite;
	}
	.foam {
		position: absolute;
		width: 9%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #ffffff, #dff3ff 70%);
		border: 1px solid rgba(120, 180, 210, 0.5);
		transform: translate(-50%, -50%);
		pointer-events: none;
		animation: foam 1s ease-out forwards;
	}
	.real-glow {
		position: absolute;
		left: 2%;
		top: 50%;
		width: 46%;
		height: 46%;
		border-radius: 40%;
		box-shadow: 0 0 0 4px #fff3a0, 0 0 24px 8px rgba(255, 240, 150, 0.9);
		pointer-events: none;
		animation: twinkle 1.4s ease-in-out infinite;
	}
	.real-glow.top {
		top: 4%;
	}
	.real-glow.right {
		left: 52%;
	}
	.brush-tool {
		position: absolute;
		left: 0;
		top: 0;
		pointer-events: none;
		transform: translate(calc(min(64vh, 560px, 58vw) * 0.72), calc(min(64vh, 560px, 58vw) * 0.95)) rotate(-30deg);
		transition: transform 60ms linear;
		filter: drop-shadow(0 6px 4px rgba(0, 0, 0, 0.18));
		z-index: 2;
	}
	.brush-tool:not(.held) {
		transition: transform 300ms ease;
	}
	.brush-tool.demo {
		transition: none;
		animation: demo-scrub 420ms ease-in-out infinite alternate;
	}
	.brush-tool.demo.top-left {
		--bx: 32%;
		--by: 63%;
	}
	.brush-tool.demo.top-right {
		--bx: 52%;
		--by: 63%;
	}
	.brush-tool.demo.bottom-left {
		--bx: 34%;
		--by: 75%;
	}
	.brush-tool.demo.bottom-right {
		--bx: 50%;
		--by: 75%;
	}
	.brush-tool.demo {
		left: var(--bx);
		top: var(--by);
		transform: none;
	}
	.bubble {
		position: absolute;
		left: calc(35% + var(--i) * 6%);
		top: 72%;
		width: 7%;
		aspect-ratio: 1;
		border-radius: 50%;
		border: 3px solid #8fd6ef;
		background: rgba(220, 245, 255, 0.6);
		animation: rise 1.4s ease-out calc(var(--i) * 0.15s) infinite;
		pointer-events: none;
	}
	.glint {
		position: absolute;
		font-size: 42px;
		animation: twinkle 1s ease-in-out infinite;
		pointer-events: none;
	}

	/* ----- tools ----- */
	.tools {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 22px;
		min-width: 230px;
	}
	.plate {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 22px 26px;
		border-radius: 50%;
		background: radial-gradient(circle, #ffffff 58%, #e9eef2 60%, #ffffff 72%);
		box-shadow: 0 8px 0 #d6dde3;
	}
	.food {
		display: grid;
		place-items: center;
		width: 104px;
		height: 104px;
		border: 0;
		border-radius: 28px;
		background: transparent;
		font-size: 74px;
		line-height: 1;
		cursor: pointer;
		transition: transform 180ms ease;
	}
	.food:hover {
		transform: scale(1.08) rotate(-4deg);
	}
	.food.gone {
		animation: eaten 500ms ease-in forwards;
	}
	.tube {
		width: 210px;
		padding: 8px;
		border: 0;
		border-radius: 26px;
		background: rgba(255, 255, 255, 0.85);
		box-shadow: 0 8px 0 rgba(94, 200, 232, 0.35);
		cursor: pointer;
	}
	.tube svg,
	.cup svg {
		animation: bob 2s ease-in-out infinite;
	}
	.tube:disabled svg {
		animation: none;
	}
	.tube:disabled {
		opacity: 0.75;
		cursor: default;
	}
	.tube.squeeze svg {
		animation: squeeze 400ms ease-in-out 2;
	}
	.rest-brush {
		transform: rotate(-8deg) scale(0.9);
	}
	.rest-brush.pasted {
		animation: hop 500ms ease-out;
	}
	.zones-map {
		display: grid;
		grid-template-columns: repeat(2, 44px);
		gap: 8px;
		padding: 10px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.7);
	}
	.zones-map.big {
		grid-template-columns: repeat(2, 70px);
	}
	.dot {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: 50%;
		background: #f1e6c9;
		border: 3px solid #e0cf9e;
		font-size: 22px;
	}
	.big .dot {
		font-size: 34px;
	}
	.dot.on {
		background: #fffbe0;
		border-color: #ffd84d;
	}
	.dot.now {
		background: #dff6ff;
		border-color: #5ec8e8;
		animation: hop 900ms ease-in-out infinite;
	}
	.cup {
		width: 150px;
		padding: 10px;
		border: 0;
		border-radius: 26px;
		background: rgba(255, 255, 255, 0.85);
		box-shadow: 0 8px 0 rgba(224, 86, 127, 0.3);
		cursor: pointer;
	}
	.cup.tilt svg {
		animation: tilt 500ms ease-in-out 3 alternate;
	}

	/* ----- celebrate ----- */
	.party {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		padding: 16px;
		min-height: 0;
	}
	.balloons {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.balloon {
		position: absolute;
		bottom: -10%;
		width: 110px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
		animation: float-up 9s linear infinite;
	}
	.balloon.popped {
		animation: pop 260ms ease-out forwards;
		pointer-events: none;
	}
	.award {
		display: flex;
		align-items: flex-end;
		gap: 24px;
		z-index: 1;
	}
	.sticker {
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: radial-gradient(circle, #fffbe8 60%, #ffe28a 61%, #ffd24d 100%);
		border: 5px solid #ffffff;
		box-shadow: 0 6px 14px rgba(0, 0, 0, 0.15);
	}
	.sticker :global(svg) {
		width: 78%;
	}
	.sticker.small {
		width: 52px;
		height: 52px;
		border-width: 3px;
	}
	.sticker.big {
		position: relative;
		width: min(300px, 36vh);
		height: min(300px, 36vh);
	}
	.sticker.big.fresh {
		animation: stamp 700ms cubic-bezier(0.2, 1.6, 0.4, 1);
	}
	.ribbon {
		position: absolute;
		bottom: -8px;
		padding: 6px 18px;
		border-radius: 999px;
		background: #ff8fa3;
		color: #ffffff;
		font-size: 22px;
		font-weight: 800;
		white-space: nowrap;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 18px;
		z-index: 1;
	}
	.again-friend {
		display: flex;
		gap: 2px;
		min-height: var(--target-game);
		padding: 6px 14px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
	}
	.tiny {
		width: 54px;
		display: block;
	}

	@keyframes bob {
		50% { transform: translateY(-8px); }
	}
	@keyframes blink {
		0%, 92%, 100% { transform: scaleY(1); }
		95% { transform: scaleY(0.1); }
	}
	@keyframes chew {
		to { transform: scaleY(0.35); }
	}
	@keyframes open {
		from { transform: scaleY(0.2); opacity: 0; }
	}
	@keyframes wiggle {
		from { transform: translate(-50%, -50%) rotate(-10deg) scale(1); }
		to { transform: translate(-50%, -54%) rotate(10deg) scale(1.06); }
	}
	@keyframes run-left {
		30% { transform: translate(-50%, -80%) rotate(-20deg) scale(1.1); opacity: 1; }
		to { transform: translate(-420%, -160%) rotate(-40deg) scale(0.6); opacity: 0; }
	}
	@keyframes run-right {
		30% { transform: translate(-50%, -80%) rotate(20deg) scale(1.1); opacity: 1; }
		to { transform: translate(320%, -160%) rotate(40deg) scale(0.6); opacity: 0; }
	}
	@keyframes twinkle {
		50% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.8); }
	}
	@keyframes foam {
		from { transform: translate(-50%, -50%) scale(0.4); opacity: 1; }
		to { transform: translate(-50%, -90%) scale(1.3); opacity: 0; }
	}
	@keyframes demo-scrub {
		from { transform: translateX(-14%) rotate(-10deg); }
		to { transform: translateX(14%) rotate(-10deg); }
	}
	@keyframes swish {
		50% { transform: scaleX(1.05) rotate(2deg); }
	}
	@keyframes rise {
		from { transform: translateY(0) scale(0.6); opacity: 1; }
		to { transform: translateY(-160%) scale(1.2); opacity: 0; }
	}
	@keyframes eaten {
		to { transform: translateX(-140px) scale(0); opacity: 0; }
	}
	@keyframes squeeze {
		50% { transform: scaleY(0.7) scaleX(1.06); }
	}
	@keyframes hop {
		40% { transform: translateY(-12px); }
	}
	@keyframes tilt {
		to { transform: rotate(-35deg); }
	}
	@keyframes float-up {
		from { transform: translateY(0) rotate(-3deg); }
		50% { transform: translateY(-55vh) rotate(3deg); }
		to { transform: translateY(-115vh) rotate(-3deg); }
	}
	@keyframes pop {
		to { transform: scale(1.6); opacity: 0; }
	}
	@keyframes stamp {
		from { transform: scale(2.2) rotate(-20deg); opacity: 0; }
	}
	@media (prefers-reduced-motion: reduce) {
		.teeth :global(*) {
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
		}
		.balloon:not(.popped) {
			animation: none;
			bottom: 30%;
		}
	}
</style>
