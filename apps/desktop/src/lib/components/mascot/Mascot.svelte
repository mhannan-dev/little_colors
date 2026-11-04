<script lang="ts" module>
	/**
	 * PLACEHOLDER art (AS-20): Rumi, a Royal Bengal tiger cub drawn from simple shapes.
	 * States follow spec 03; final art will replace this component's SVG with the same API.
	 */
	export type MascotAnimation =
		| 'idle'
		| 'wave'
		| 'thinking'
		| 'celebrate'
		| 'kick'
		| 'encourage'
		| 'rest';
</script>

<script lang="ts">
	let { state = 'idle', size = 220 }: { state?: MascotAnimation; size?: number } = $props();
</script>

<div class="rumi {state}" style:width="{size}px" style:height="{size * 1.15}px" aria-hidden="true">
	<svg viewBox="0 0 200 230" width="100%" height="100%">
		<!-- tail -->
		<path class="tail" d="M150 175 q35 -5 30 -40" fill="none" stroke="var(--mascot-fur)" stroke-width="12" stroke-linecap="round" />
		<!-- legs -->
		<ellipse class="leg left" cx="78" cy="208" rx="17" ry="14" fill="var(--mascot-fur)" />
		<ellipse class="leg right kick-leg" cx="122" cy="208" rx="17" ry="14" fill="var(--mascot-fur)" />
		<!-- body -->
		<ellipse class="body" cx="100" cy="165" rx="52" ry="45" fill="var(--mascot-fur)" />
		<ellipse cx="100" cy="175" rx="30" ry="28" fill="var(--mascot-fur-light)" />
		<path d="M62 150 q8 6 4 16 M138 150 q-8 6 -4 16" stroke="var(--mascot-stripe)" stroke-width="5" fill="none" stroke-linecap="round" />
		<!-- arms -->
		<ellipse class="arm left-arm" cx="52" cy="160" rx="13" ry="22" fill="var(--mascot-fur)" />
		<ellipse class="arm right-arm" cx="148" cy="160" rx="13" ry="22" fill="var(--mascot-fur)" />
		<!-- scarf -->
		<path d="M62 124 q38 18 76 0 l-4 14 q-34 14 -68 0 z" fill="var(--mascot-scarf)" />
		<!-- head -->
		<g class="head">
			<circle cx="58" cy="48" r="18" fill="var(--mascot-fur)" />
			<circle cx="142" cy="48" r="18" fill="var(--mascot-fur)" />
			<circle cx="58" cy="48" r="9" fill="var(--mascot-fur-light)" />
			<circle cx="142" cy="48" r="9" fill="var(--mascot-fur-light)" />
			<circle cx="100" cy="78" r="52" fill="var(--mascot-fur)" />
			<path d="M100 28 v14 M84 31 l4 12 M116 31 l-4 12" stroke="var(--mascot-stripe)" stroke-width="5" stroke-linecap="round" />
			<path d="M50 78 h12 M138 78 h12" stroke="var(--mascot-stripe)" stroke-width="5" stroke-linecap="round" />
			<ellipse cx="100" cy="98" rx="30" ry="22" fill="var(--mascot-fur-light)" />
			<g class="eyes">
				<circle cx="80" cy="72" r="8" fill="var(--mascot-eye)" />
				<circle cx="120" cy="72" r="8" fill="var(--mascot-eye)" />
				<circle cx="83" cy="69" r="2.5" fill="#fff" />
				<circle cx="123" cy="69" r="2.5" fill="#fff" />
			</g>
			<ellipse cx="100" cy="90" rx="7" ry="5" fill="var(--mascot-stripe)" />
			<path class="mouth" d="M88 100 q12 12 24 0" fill="none" stroke="var(--mascot-eye)" stroke-width="3.5" stroke-linecap="round" />
		</g>
	</svg>
</div>

<style>
	.rumi {
		display: inline-block;
		transform-origin: 50% 100%;
	}
	svg {
		overflow: visible;
	}
	.body,
	.head {
		transform-box: fill-box;
		transform-origin: 50% 100%;
	}
	.eyes {
		transform-box: fill-box;
		transform-origin: 50% 50%;
		animation: blink 5s infinite;
	}
	.idle .body {
		animation: breathe 3.2s ease-in-out infinite;
	}
	.thinking .head {
		transform: rotate(-8deg);
		transition: transform 400ms ease;
	}
	.celebrate,
	.encourage {
		animation: hop 900ms ease-out 2;
	}
	.right-arm,
	.left-arm {
		transform-box: fill-box;
		transform-origin: 50% 10%;
	}
	.celebrate .left-arm,
	.celebrate .right-arm {
		animation: cheer 450ms ease-in-out 4 alternate;
	}
	.wave .right-arm,
	.encourage .right-arm {
		animation: wave 500ms ease-in-out 3 alternate;
	}
	.kick-leg {
		transform-box: fill-box;
		transform-origin: 30% 0%;
	}
	.kick .kick-leg {
		animation: kick 700ms ease-out 1;
	}
	.kick {
		animation: lean 700ms ease-out 1;
	}
	.rest .eyes {
		transform: scaleY(0.15);
		animation: none;
	}
	.rest .body {
		animation: breathe 5s ease-in-out infinite;
	}

	@keyframes breathe {
		0%, 100% { transform: scale(1, 1); }
		50% { transform: scale(1.02, 1.035); }
	}
	@keyframes blink {
		0%, 94%, 100% { transform: scaleY(1); }
		96% { transform: scaleY(0.1); }
	}
	@keyframes hop {
		0%, 100% { transform: translateY(0); }
		40% { transform: translateY(-26px); }
	}
	@keyframes cheer {
		from { transform: rotate(0deg); }
		to { transform: rotate(-150deg); }
	}
	@keyframes wave {
		from { transform: rotate(-20deg); }
		to { transform: rotate(-160deg); }
	}
	@keyframes kick {
		0% { transform: rotate(0deg); }
		40% { transform: rotate(35deg); }
		60% { transform: rotate(-60deg); }
		100% { transform: rotate(0deg); }
	}
	@keyframes lean {
		0%, 100% { transform: translateX(0); }
		50% { transform: translateX(24px); }
	}
</style>
