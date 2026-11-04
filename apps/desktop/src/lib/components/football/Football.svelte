<script lang="ts">
	import type { Color } from '@little-colors/core';

	let {
		color = 'white',
		mixing = false,
		kicked = false,
		dropColor = null,
		transitionMs = 900,
		size = 200,
		label = ''
	}: {
		color?: Color | 'white';
		mixing?: boolean;
		kicked?: boolean;
		dropColor?: Color | null;
		transitionMs?: number;
		size?: number;
		label?: string;
	} = $props();

	const fill = $derived(color === 'white' ? 'var(--surface)' : `var(--learn-${color})`);
</script>

<div
	class="ball"
	class:mixing
	class:kicked
	style:width="{size}px"
	style:height="{size}px"
	role="img"
	aria-label={label}
>
	{#if dropColor}
		{#key dropColor}
			<div class="drop" style:background="var(--learn-{dropColor})"></div>
		{/key}
	{/if}
	<svg viewBox="0 0 100 100" width="100%" height="100%">
		<circle cx="50" cy="50" r="46" style:fill style:transition="fill {transitionMs}ms ease" stroke="var(--text-primary)" stroke-width="3" />
		<!-- panels -->
		<polygon points="50,30 63,39 58,54 42,54 37,39" fill="var(--text-primary)" opacity="0.85" />
		<path d="M50 30 V8 M63 39 L84 30 M58 54 L70 74 M42 54 L30 74 M37 39 L16 30" stroke="var(--text-primary)" stroke-width="3" fill="none" />
		<path d="M30 74 Q50 88 70 74 M16 30 Q12 50 22 68 M84 30 Q88 50 78 68" stroke="var(--text-primary)" stroke-width="2" fill="none" opacity="0.5" />
		<circle cx="35" cy="24" r="7" fill="#fff" opacity="0.35" />
	</svg>
</div>

<style>
	.ball {
		position: relative;
		transition: transform 900ms cubic-bezier(0.3, 0.6, 0.3, 1);
	}
	.mixing svg {
		animation: swirl 1.2s ease-in-out;
	}
	.kicked {
		/* Lands in the goal's centre: ball radius (100) + field gap (24) + half goal width (75). */
		transform: translateX(199px) translateY(14px) rotate(540deg) scale(0.55);
	}
	.drop {
		position: absolute;
		left: 50%;
		top: -60px;
		width: 34px;
		height: 44px;
		margin-left: -17px;
		border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
		animation: fall 700ms ease-in forwards;
		z-index: 2;
	}
	@keyframes fall {
		0% { transform: translateY(-40px) scale(0.6); opacity: 0; }
		30% { opacity: 1; }
		100% { transform: translateY(110px) scale(1.4); opacity: 0; }
	}
	@keyframes swirl {
		0% { transform: rotate(0deg) scale(1); }
		50% { transform: rotate(200deg) scale(1.06); }
		100% { transform: rotate(360deg) scale(1); }
	}
</style>
