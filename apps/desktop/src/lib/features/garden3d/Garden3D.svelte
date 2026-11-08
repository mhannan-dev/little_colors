<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { instruct, leaveScreen, say, setIdlePrompt } from '#lib/audio/narrator.ts';
	import { playFlowerPickupChime, playGardenCelebrationChime } from './gardenSfx.ts';

	type Vec = [number, number, number];
	type Face = { points: Vec[]; color: string; depth: number };
	type Particle = { x: number; y: number; z: number; vx: number; vy: number; vz: number; color: string; life: number };

	const flowers = [
		{ x: 0, z: 2, color: '#e7a333', bn: 'হলুদ ফুল', en: 'Yellow flower' },
		{ x: -3, z: 0, color: '#e77c95', bn: 'গোলাপি ফুল', en: 'Pink flower' },
		{ x: 3, z: -1, color: '#8f80d5', bn: 'বেগুনি ফুল', en: 'Purple flower' },
		{ x: -2, z: -4, color: '#5baaca', bn: 'নীল ফুল', en: 'Blue flower' },
		{ x: 2, z: -5, color: '#e99357', bn: 'কমলা ফুল', en: 'Orange flower' }
	];
	const directions = [
		{ key: 'ArrowUp', icon: '↑', bn: 'সামনে', en: 'Forward' },
		{ key: 'ArrowLeft', icon: '←', bn: 'বামে', en: 'Left' },
		{ key: 'ArrowDown', icon: '↓', bn: 'পেছনে', en: 'Backward' },
		{ key: 'ArrowRight', icon: '→', bn: 'ডানে', en: 'Right' }
	];
	let canvas: HTMLCanvasElement;
	let collected = $state<number[]>([]);
	let manualPause = $state(false);
	let help = $state(false);
	let unavailable = $state(false);
	let lastPicked = $state<(typeof flowers)[number] | null>(null);
	let player = { x: 0, z: 4.5 };
	const keys = new Set<string>();
	const pointers = new Map<number, string>();
	const particles: Particle[] = [];
	let redraw = () => {};
	const bn = $derived($settings.language === 'bn-BD');
	const done = $derived(collected.length === flowers.length);

	function clearInput() { keys.clear(); pointers.clear(); }
	function restart() {
		player = { x: 0, z: 4.5 };
		collected = [];
		manualPause = false;
		help = false;
		lastPicked = null;
		particles.length = 0;
		clearInput();
		instruct('garden3d.intro');
		redraw();
	}
	function keyboard(event: KeyboardEvent, down: boolean) {
		if (event.altKey || event.ctrlKey || event.metaKey) return;
		const key = ({ w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' } as Record<string, string>)[event.key.toLowerCase()] ?? event.key;
		if (!directions.some(d => d.key === key)) return;
		event.preventDefault();
		if (down) keys.add(key); else keys.delete(key);
	}
	function press(event: PointerEvent, key: string) {
		(event.currentTarget as HTMLButtonElement).setPointerCapture(event.pointerId);
		pointers.set(event.pointerId, key);
	}
	$effect(() => { if ($paused || manualPause || done) clearInput(); });

	onMount(() => {
		const ctx = canvas.getContext('2d');
		if (!ctx) { unavailable = true; return; }
		const context = ctx;
		let frame = 0;
		let last = performance.now();
		let width = 1000;
		let height = 480;
		let walkCycle = 0;
		let isMoving = false;

		// Perspective camera at (0, 12, 20), looking down onto the garden.
		function camera([x, y, z]: Vec): Vec {
			return [x, y * 0.857 - z * 0.514, 23.32 - y * 0.514 - z * 0.857];
		}
		function project(point: Vec): [number, number] {
			const [x, y, depth] = camera(point);
			const focal = Math.min(width * 1.12, height * 1.95);
			return [width / 2 + (x * focal) / depth, height * 0.47 - (y * focal) / depth];
		}

		function render(now = performance.now()) {
			context.clearRect(0, 0, width, height);
			const sky = context.createLinearGradient(0, 0, 0, height);
			sky.addColorStop(0, '#dcefee'); sky.addColorStop(1, '#fbf4df');
			context.fillStyle = sky; context.fillRect(0, 0, width, height);

			// Gentle glowing sun
			context.fillStyle = '#fff7d0';
			context.beginPath();
			context.arc(width * 0.84, height * 0.17, height * 0.065, 0, Math.PI * 2);
			context.fill();

			const faces: Face[] = [];
			function face(points: Vec[], color: string) {
				faces.push({ points, color, depth: points.reduce((sum, p) => sum + camera(p)[2], 0) / points.length });
			}
			function box(x: number, y: number, z: number, w: number, h: number, d: number, colors: [string, string, string]) {
				const a = x - w / 2, b = x + w / 2, c = z - d / 2, e = z + d / 2;
				face([[a,y+h,c],[b,y+h,c],[b,y+h,e],[a,y+h,e]], colors[0]);
				face([[a,y,e],[b,y,e],[b,y+h,e],[a,y+h,e]], colors[1]);
				if (x < 0) face([[b,y,e],[b,y,c],[b,y+h,c],[b,y+h,e]], colors[2]);
				else face([[a,y,c],[a,y,e],[a,y+h,e],[a,y+h,c]], colors[2]);
			}

			// Green island terrain
			box(0, -0.65, -0.5, 12, 0.65, 14, ['#aad398', '#83af79', '#6c996b']);
			faces.forEach(f => { f.depth += 100; });

			// Cobblestone path
			for (let z = -6; z <= 5; z++) {
				box(0, 0.012, z, 1.1, 0.025, 0.78, ['#e6d8ad', '#d1c197', '#d1c197']);
			}

			// Trees in four corners
			for (const [x,z] of [[-4.8,-5.5], [4.7,-5], [-4.8,2], [4.8,3]]) {
				box(x, 0, z, 0.3, 1.35, 0.3, ['#b79267','#aa8058','#8c6948']);
				box(x, 1, z, 1.35, 1.25, 1.35, ['#70ad83','#599773','#488466']);
				box(x, 2.1, z, 0.85, 0.55, 0.85, ['#8bbd8b','#70ad83','#599773']);
			}

			// ── Flowers with gentle wind sway ──
			flowers.forEach((f, index) => {
				if (collected.includes(index)) return;
				const sway = Math.sin(now * 0.003 + f.x * 1.5) * 0.05;

				if (help && index === flowers.findIndex((_, i) => !collected.includes(i))) {
					box(f.x, 0.02, f.z, 1.35, 0.04, 1.35, ['#fff3b2','#e3d17c','#e3d17c']);
				}
				// Stem
				box(f.x + sway * 0.3, 0, f.z, 0.12, 0.85, 0.12, ['#559d72','#488566','#377252']);
				// Leaf
				box(f.x + 0.2 + sway * 0.4, 0.3, f.z, 0.4, 0.12, 0.22, ['#7ab57d','#559d72','#488566']);
				// Petals
				for (const [dx,dy] of [[-0.23,0],[0.23,0],[0,0.23],[0,-0.23]]) {
					box(f.x + dx + sway, 0.9 + dy, f.z, 0.28, 0.28, 0.25, [f.color,f.color,f.color]);
				}
				// Center bud
				box(f.x + sway, 0.92, f.z + 0.16, 0.22, 0.22, 0.2, ['#fff1b0','#ffdb6e','#e9bc58']);
			});

			// ── Flying 3D Butterfly ──
			const bTime = now * 0.0012;
			const bX = Math.sin(bTime) * 3.6;
			const bZ = Math.sin(bTime * 2) * 2.8;
			const bY = 1.6 + Math.sin(now * 0.005) * 0.28;
			const wingFlap = Math.sin(now * 0.035) * 0.28;
			box(bX, bY, bZ, 0.1, 0.1, 0.24, ['#453229', '#34261f', '#241a15']);
			face([
				[bX, bY, bZ - 0.1],
				[bX - 0.4, bY + wingFlap, bZ - 0.2],
				[bX - 0.45, bY + wingFlap, bZ + 0.15],
				[bX, bY, bZ + 0.1]
			], '#fab650');
			face([
				[bX, bY, bZ - 0.1],
				[bX + 0.4, bY + wingFlap, bZ - 0.2],
				[bX + 0.45, bY + wingFlap, bZ + 0.15],
				[bX, bY, bZ + 0.1]
			], '#fab650');

			// ── Player with walking bob animation ──
			const bob = isMoving ? Math.abs(Math.sin(walkCycle)) * 0.08 : 0;
			const py = bob;

			// Shadow
			box(player.x, 0.02, player.z, 0.8, 0.035, 0.65, ['#6b966e','#6b966e','#6b966e']);
			// Feet
			for (const dx of [-0.2,0.2]) {
				const footY = isMoving ? Math.max(0, Math.sin(walkCycle + (dx > 0 ? 0 : Math.PI)) * 0.06) : 0;
				box(player.x + dx, 0.05 + footY, player.z, 0.25, 0.3, 0.35, ['#476a79','#385864','#2c4855']);
			}
			// Body & Clothes
			box(player.x, 0.33 + py, player.z, 0.72, 0.7, 0.48, ['#f2bd64','#df9b48','#ca873b']);
			// Head
			box(player.x, 1.03 + py, player.z, 0.62, 0.58, 0.56, ['#ffe1b5','#f0c99a','#dfb583']);
			// Hat rim & crown
			box(player.x, 1.57 + py, player.z, 0.85, 0.12, 0.78, ['#6a9c9a','#508581','#42716e']);
			box(player.x, 1.69 + py, player.z, 0.55, 0.27, 0.5, ['#81afaa','#6a9c9a','#508581']);
			// Eyes
			for (const dx of [-0.16,0.16]) box(player.x+dx, 1.28 + py, player.z+0.29, 0.065, 0.09, 0.025, ['#384e51','#384e51','#384e51']);

			// Render sorted 3D faces
			faces.sort((a,b) => b.depth - a.depth);
			for (const f of faces) {
				context.beginPath();
				f.points.forEach((p,i) => {
					const [x,y] = project(p);
					if (i === 0) context.moveTo(x,y); else context.lineTo(x,y);
				});
				context.closePath();
				context.fillStyle = f.color;
				context.fill();
				context.strokeStyle = '#34574c18';
				context.lineWidth = 0.7;
				context.stroke();
			}

			// ── Render Petal Burst Particles ──
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				const [sx, sy] = project([p.x, p.y, p.z]);
				const alpha = Math.max(0, p.life);
				context.fillStyle = p.color;
				context.globalAlpha = alpha;
				context.beginPath();
				context.arc(sx, sy, 5 * alpha, 0, Math.PI * 2);
				context.fill();
			}
			context.globalAlpha = 1;
		}

		redraw = () => render(performance.now());
		const observer = new ResizeObserver(() => {
			width = canvas.clientWidth; height = canvas.clientHeight;
			const ratio = Math.min(window.devicePixelRatio || 1, 2);
			canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
			context.setTransform(ratio, 0, 0, ratio, 0, 0); render(performance.now());
		});
		observer.observe(canvas);

		function tick(now: number) {
			const dt = Math.min((now - last) / 1000, 0.05); last = now;
			isMoving = false;

			if (!$paused && !manualPause && !done) {
				const held = new Set([...keys, ...pointers.values()]);
				let dx = Number(held.has('ArrowRight')) - Number(held.has('ArrowLeft'));
				let dz = Number(held.has('ArrowDown')) - Number(held.has('ArrowUp'));
				const length = Math.hypot(dx,dz);

				if (length) {
					isMoving = true;
					walkCycle += dt * 10;
					dx /= length; dz /= length;
					player.x = Math.max(-5.3, Math.min(5.3, player.x + dx * dt * 3.5));
					player.z = Math.max(-6.5, Math.min(5.5, player.z + dz * dt * 3.5));

					flowers.forEach((f, i) => {
						if (!collected.includes(i) && Math.hypot(player.x - f.x, player.z - f.z) < 0.7) {
							collected = [...collected, i];
							lastPicked = f;

							// Spawn petal confetti particles
							for (let k = 0; k < 12; k++) {
								const ang = (k / 12) * Math.PI * 2;
								const spd = 0.6 + Math.random() * 0.8;
								particles.push({
									x: f.x,
									y: 0.9,
									z: f.z,
									vx: Math.cos(ang) * spd,
									vy: 1.2 + Math.random() * 1.0,
									vz: Math.sin(ang) * spd,
									color: f.color,
									life: 1.0
								});
							}

							const vol = $settings.soundEnabled ? $settings.volume : 0;
							if (collected.length === flowers.length) {
								setIdlePrompt(null);
								playGardenCelebrationChime(vol);
								say('garden3d.done', { interrupt: true });
							} else {
								playFlowerPickupChime(i, vol);
								say('feedback.celebrate', { interrupt: true });
							}
						}
					});
				}
			}

			// Update particles
			for (let i = particles.length - 1; i >= 0; i--) {
				const p = particles[i];
				p.x += p.vx * dt;
				p.y += p.vy * dt;
				p.z += p.vz * dt;
				p.vy -= 1.8 * dt; // gravity
				p.life -= dt * 1.2;
				if (p.life <= 0) particles.splice(i, 1);
			}

			render(now);
			frame = requestAnimationFrame(tick);
		}

		frame = requestAnimationFrame(tick);
		instruct('garden3d.intro');
		return () => { cancelAnimationFrame(frame); observer.disconnect(); clearInput(); leaveScreen(); redraw = () => {}; };
	});
</script>

<svelte:window onkeydown={(e) => keyboard(e, true)} onkeyup={(e) => keyboard(e, false)} onblur={clearInput} />
<svelte:head><title>3D Flower Garden · Little Colors</title></svelte:head>
<TopBar onreplay={() => instruct(done ? 'garden3d.done' : 'garden3d.intro')} />
<section class="garden">
	<div class="heading">
		<div><p class="eyebrow">{bn ? 'ছোট্ট এক অভিযান' : 'A LITTLE ADVENTURE'}</p><h1>{bn ? 'থ্রিডি ফুলের বাগান' : '3D Flower Garden'}</h1></div>
		<div class="bouquet" aria-label={bn ? `${collected.length}টি ফুল পাওয়া গেছে` : `${collected.length} of 5 flowers collected`}>
			{#each flowers as f, i}<span class:found={collected.includes(i)} style:color={f.color} aria-hidden="true">✿</span>{/each}
		</div>
	</div>
	<div class="world">
		<canvas bind:this={canvas} aria-label={bn ? 'ফুল আর গাছে ভরা থ্রিডি বাগান। নিচের তীর চিহ্ন দিয়ে হাঁটি।' : 'A 3D island with trees and flowers. Move with the arrow controls below.'}></canvas>

		<!-- Found flower notification toast -->
		{#if lastPicked && !done}
			<div class="flower-toast" style:border-color={lastPicked.color}>
				<span class="toast-icon" style:color={lastPicked.color} aria-hidden="true">✿</span>
				<span>{bn ? `${lastPicked.bn} পাওয়া গেছে!` : `Found ${lastPicked.en}!`}</span>
			</div>
		{/if}

		{#if done || manualPause || unavailable}
			<div class="overlay"><div class="message" role="status">
				<span class="big-icon" aria-hidden="true">{done ? '✿' : 'Ⅱ'}</span>
				<h2>{unavailable ? (bn ? 'বাগানটি খুলতে পারিনি' : 'The garden could not open') : done ? (bn ? 'আমাদের ফুলের তোড়া!' : 'Our lovely bouquet!') : (bn ? 'একটু বিরতি' : 'A little break')}</h2>
				{#if !unavailable}<button class="primary" onclick={() => done ? restart() : manualPause = false}>▶ {done ? (bn ? 'আবার খেলি' : 'Play again') : (bn ? 'আবার চলি' : 'Keep exploring')}</button>{/if}
			</div></div>
		{/if}
	</div>
	<div class="toolbar">
		<div class="instructions"><strong>{bn ? 'হেঁটে ফুলের কাছে যাই' : 'Walk up to the flowers'}</strong><small>{bn ? 'তীর চিহ্ন চেপে রাখি • কিবোর্ডেও খেলা যায়' : 'Hold an arrow • Arrow keys or WASD also work'}</small></div>
		<div class="controls" role="group" aria-label={bn ? 'হাঁটার দিক' : 'Movement controls'}>
			{#each directions as direction}
				<button class="arrow" disabled={done || manualPause || unavailable} aria-label={bn ? direction.bn : direction.en}
					onpointerdown={(e) => press(e, direction.key)} onpointerup={(e) => pointers.delete(e.pointerId)} onpointercancel={(e) => pointers.delete(e.pointerId)} onlostpointercapture={(e) => pointers.delete(e.pointerId)}
					onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); keys.add(direction.key); } }}
					onkeyup={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); keys.delete(direction.key); } }} onblur={() => keys.delete(direction.key)}>{direction.icon}</button>
			{/each}
		</div>
		<div class="actions">
			<button disabled={done} aria-pressed={help} onclick={() => { help = !help; instruct('garden3d.intro'); }}>{bn ? '☞ সাহায্য' : '☞ Hint'}</button>
			<button disabled={done} aria-label={bn ? 'বিরতি' : 'Pause'} onclick={() => { manualPause = true; clearInput(); }}>Ⅱ</button>
			<button aria-label={bn ? 'আবার শুরু' : 'Start over'} onclick={restart}>↻</button>
		</div>
	</div>
	<p class="status" aria-live="polite">{done ? (bn ? 'পাঁচটি ফুল পেয়েছি! কী সুন্দর!' : 'All five flowers found. Beautiful!') : bn ? `${collected.length.toLocaleString('bn-BD')} / ৫টি ফুল পাওয়া গেছে` : `${collected.length} / 5 flowers found`}</p>
</section>

<style>
	.garden { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 14px; padding: 0 32px 16px; max-width: 1500px; width: 100%; margin: auto; }
	.heading { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
	.eyebrow { margin: 0; font-size: 15px; letter-spacing: 0.12em; color: var(--text-secondary); }
	h1 { margin: 0; font-size: 34px; } .bouquet { display: flex; gap: 12px; font-size: 40px; }
	.bouquet span { opacity: 0.25; } .bouquet .found { opacity: 1; text-shadow: 0 2px white; }
	.world { flex: 1; min-height: 260px; position: relative; overflow: hidden; border: 3px solid #b8cdb7; border-radius: 28px; background: #dcefee; }
	canvas { width: 100%; height: 100%; display: block; position: absolute; }
	.flower-toast { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: #ffffffeb; border: 2.5px solid #e7a333; border-radius: 20px; padding: 8px 18px; font-size: 18px; font-weight: 700; color: #355342; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px #0000001a; animation: toastIn 350ms ease-out; }
	.toast-icon { font-size: 24px; }
	@keyframes toastIn { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
	.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
	.instructions { display: flex; flex-direction: column; } strong { font-size: 23px; } small { color: var(--text-secondary); font-size: 17px; }
	.controls, .actions { display: flex; gap: 9px; }
	button { min-width: 58px; min-height: 58px; border: 2px solid var(--border-soft); border-radius: 16px; background: var(--surface); padding: 8px 14px; cursor: pointer; font-weight: 600; }
	.arrow { font-size: 32px; touch-action: none; } button:hover { background: #e5eddf; } button:active { transform: translateY(2px); } button:disabled { opacity: 0.45; cursor: default; }
	.status { margin: 0; text-align: center; font-size: 18px; color: var(--text-secondary); }
	.overlay { position: absolute; inset: 0; display: grid; place-items: center; background: #edf4e9b8; }
	.message { background: var(--surface); padding: 24px 40px; border-radius: 24px; border: 3px solid var(--border-soft); text-align: center; }
	.message h2 { margin: 0 0 18px; font-size: 30px; } .big-icon { font-size: 54px; color: #be7959; }
	.primary { background: #d8ebce; border-color: #8bad7d; }
	@media (max-height: 720px) { .garden { gap: 8px; } h1 { font-size: 28px; } .eyebrow { display: none; } }
</style>
