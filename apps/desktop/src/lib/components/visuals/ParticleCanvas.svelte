<script lang="ts" module>
	export type ParticleCue = {
		kind: 'confetti' | 'stars' | 'dust';
		anchor?: Element | null;
		point?: { x: number; y: number };
		label?: string;
	};
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { learning } from '@little-colors/design-tokens';

	let { cue = null, paused = false, reducedMotion = false, ambient = false }: {
		cue?: ParticleCue | null; paused?: boolean; reducedMotion?: boolean; ambient?: boolean;
	} = $props();
	let canvas: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null = null;
	let width = 1, height = 1, frame = 0, last = 0, time = 0;
	let count = 0;
	let label: { text: string; x: number; y: number; life: number } | null = null;
	const colors = Object.values(learning);
	const capacity = 96;
	type Piece = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: ParticleCue['kind'] };
	const pool: Piece[] = Array.from({ length: capacity }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, color: '', kind: 'stars' }));

	function schedule() {
		if (context && !frame && !paused && !reducedMotion && (count || label || ambient)) {
			last = performance.now();
			frame = requestAnimationFrame(draw);
		}
	}

	function draw(now: number) {
		const g = context;
		frame = 0;
		if (!g || paused || reducedMotion) return;
		if (ambient && !count && !label && now - last < 30) {
			frame = requestAnimationFrame(draw);
			return;
		}
		const dt = Math.min((now - last) / 1000, 0.05);
		last = now;
		time += dt;
		g.clearRect(0, 0, width, height);
		if (ambient) {
			g.globalAlpha = 0.13;
			g.fillStyle = learning.purple;
			for (let i = 0; i < 9; i++) {
				const x = width * (0.08 + i * 0.105) + Math.sin(time * 0.38 + i) * 12;
				const y = height * (0.14 + ((i * 7) % 9) * 0.085) + Math.cos(time * 0.32 + i) * 9;
				g.beginPath(); g.arc(x, y, 2 + i % 3, 0, Math.PI * 2); g.fill();
			}
		}
		for (let i = count - 1; i >= 0; i--) {
			const p = pool[i];
			p.life -= dt;
			if (p.life <= 0) { pool[i] = pool[--count]; pool[count] = p; continue; }
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vy += (p.kind === 'dust' ? 18 : 240) * dt;
			g.globalAlpha = Math.min(0.9, p.life / (p.max * 0.45));
			g.fillStyle = p.color;
			if (p.kind === 'confetti') {
				g.fillRect(p.x, p.y, p.size, Math.max(1, p.size * Math.abs(Math.cos(p.life * 11))));
			} else {
				g.beginPath();
				if (p.kind === 'dust') g.arc(p.x, p.y, p.size * (1 + (p.max - p.life)), 0, Math.PI * 2);
				else {
					g.moveTo(p.x, p.y - p.size); g.lineTo(p.x + p.size * 0.34, p.y - p.size * 0.34);
					g.lineTo(p.x + p.size, p.y); g.lineTo(p.x + p.size * 0.34, p.y + p.size * 0.34);
					g.lineTo(p.x, p.y + p.size); g.lineTo(p.x - p.size * 0.34, p.y + p.size * 0.34);
					g.lineTo(p.x - p.size, p.y); g.lineTo(p.x - p.size * 0.34, p.y - p.size * 0.34);
					g.closePath();
				}
				g.fill();
			}
		}
		if (label) {
			label.life -= dt;
			const age = 1 - label.life;
			g.globalAlpha = Math.max(0, Math.min(1, label.life * 3));
			g.textAlign = 'center';
			g.font = `700 ${22 + 4 * Math.sin(Math.min(1, age * 3) * Math.PI)}px "Hind Siliguri", system-ui`;
			g.lineWidth = 5;
			g.strokeStyle = '#fff9f0';
			g.fillStyle = '#263238';
			const y = Math.max(28, label.y - 16 - age * 48);
			g.strokeText(label.text, label.x, y);
			g.fillText(label.text, label.x, y);
			if (label.life <= 0) label = null;
		}
		g.globalAlpha = 1;
		if (count || label || ambient) frame = requestAnimationFrame(draw);
	}

	function emit(event: ParticleCue) {
		const rect = canvas.getBoundingClientRect();
		const anchor = event.anchor?.getBoundingClientRect();
		const point = event.point ?? (anchor && { x: anchor.x + anchor.width / 2, y: anchor.y + anchor.height / 2 });
		const x = point && rect.width ? (point.x - rect.x) / rect.width * width : width / 2;
		const y = point && rect.height ? (point.y - rect.y) / rect.height * height : height / 2;
		const amount = event.kind === 'dust' ? 12 : event.kind === 'stars' ? 20 : 36;
		for (let i = 0; i < amount && count < capacity; i++) {
			const p = pool[count++];
			p.x = x; p.y = y;
			p.vx = (Math.random() - 0.5) * (event.kind === 'dust' ? 100 : 260);
			p.vy = -25 - Math.random() * (event.kind === 'dust' ? 35 : 180);
			p.life = p.max = (event.kind === 'dust' ? 0.35 : 0.55) + Math.random() * 0.45;
			p.size = 3 + Math.random() * 5;
			p.color = event.kind === 'dust' ? '#b59873' : colors[i % colors.length];
			p.kind = event.kind;
		}
		if (event.label) label = { text: event.label, x: Math.max(85, Math.min(width - 85, x)), y, life: 1 };
	}

	let previous: ParticleCue | null = null;
	$effect(() => {
		if (cue !== previous) {
			previous = cue;
			if (cue && !reducedMotion && !paused) emit(cue);
			else { count = 0; label = null; context?.clearRect(0, 0, width, height); }
		}
		if (paused || reducedMotion) {
			cancelAnimationFrame(frame); frame = 0;
			if (reducedMotion) { count = 0; label = null; context?.clearRect(0, 0, width, height); }
		} else schedule();
	});
	onMount(() => {
		context = canvas.getContext('2d');
		const resize = () => {
			width = Math.max(1, canvas.clientWidth);
			height = Math.max(1, canvas.clientHeight);
			const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			context?.setTransform(ratio, 0, 0, ratio, 0, 0);
		};
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();
		schedule();
		return () => { observer.disconnect(); cancelAnimationFrame(frame); context = null; };
	});
</script>

<canvas bind:this={canvas} aria-hidden="true" class="particles"></canvas>

<style>
	.particles { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 12; }
	@media (prefers-reduced-motion: reduce) { .particles { display: none; } }
</style>
