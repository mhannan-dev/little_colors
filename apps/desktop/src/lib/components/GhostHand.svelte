<script lang="ts">
	/** Renders the ghost-hand demonstration (see lib/game/hand.ts). Never intercepts input. */
	import { hand, hideHand, type HandPath } from '#lib/game/hand.ts';

	const STEP_MS = 1400;
	let el = $state<HTMLDivElement | null>(null);
	let current = $state<HandPath | null>(null);
	let animation: Animation | null = null;

	const reduced = () =>
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		const path = $hand;
		animation?.cancel();
		animation = null;
		current = path;
		if (!path || !el) return;
		const [first] = path.points;
		const last = path.points.at(-1)!;
		// Fingertip sits at the top-left of the SVG; offset so it touches the target centre.
		const at = (p: { x: number; y: number }, s = 1) => `translate(${p.x - 14}px, ${p.y - 6}px) scale(${s})`;

		if (reduced()) {
			// Static pointer at the target (DS-32), no motion.
			el.style.transform = at(last);
			const t = setTimeout(hideHand, 2500);
			return () => clearTimeout(t);
		}

		// Every middle frame states opacity 1 so the hand stays solid while it taps;
		// only the entry and exit frames fade.
		const frames: Keyframe[] = [{ transform: at({ x: first!.x + 60, y: first!.y + 90 }), opacity: 0 }];
		path.points.forEach((p, i) => {
			frames.push({ transform: at(p), opacity: 1 });
			if (!path.drag || i === 0 || i === path.points.length - 1) {
				// tap / press, then a short hold so a child can see where it touched
				frames.push({ transform: at(p, 0.82), opacity: 1 }, { transform: at(p), opacity: 1 }, { transform: at(p), opacity: 1 });
			}
		});
		frames.push({ transform: at({ x: last.x + 40, y: last.y + 60 }), opacity: 0 });
		animation = el.animate(frames, {
			duration: STEP_MS * (path.points.length + 1),
			easing: 'ease-in-out',
			iterations: 2, // show it twice: young children often miss the first time
			fill: 'forwards'
		});
		animation.onfinish = () => hideHand();
	});
</script>

<div class="hand-layer" aria-hidden="true">
	<div class="hand" class:show={current !== null} bind:this={el} data-testid="ghost-hand">
		<svg viewBox="0 0 64 72" width="64" height="72">
			<path
				d="M14 6 a6 6 0 0 1 12 0 V30 l14 3 a7 7 0 0 1 5.5 7.6 L42 62 a7 7 0 0 1 -6.9 6 H22 a7 7 0 0 1 -5.6 -2.8 L4 49 a5 5 0 0 1 7.3 -6.8 L14 45 Z"
				fill="var(--surface)"
				stroke="var(--text-primary)"
				stroke-width="3.5"
				stroke-linejoin="round"
			/>
			<path d="M26 30 V40 M33 32 V41" stroke="var(--text-secondary)" stroke-width="3" stroke-linecap="round" />
		</svg>
	</div>
</div>

<style>
	.hand-layer {
		position: fixed;
		inset: 0;
		pointer-events: none; /* never blocks the child's own taps */
		z-index: 50;
		overflow: hidden;
	}
	.hand {
		position: absolute;
		left: 0;
		top: 0;
		opacity: 0;
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.25));
	}
	.hand.show {
		opacity: 1;
	}
</style>
