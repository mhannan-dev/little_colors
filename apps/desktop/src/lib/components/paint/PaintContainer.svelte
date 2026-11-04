<script lang="ts">
	import type { Color } from '@little-colors/core';

	let {
		color,
		label,
		used = false,
		locked = false,
		wiggle = false,
		pouring = false,
		onselect
	}: {
		color: Color;
		label: string;
		used?: boolean;
		locked?: boolean;
		wiggle?: boolean;
		pouring?: boolean;
		onselect: (color: Color) => void;
	} = $props();
</script>

<!-- CM-20/22/23: tap or keyboard; color + written name so color is never the only cue. -->
<button
	class="paint"
	class:used
	class:wiggle
	class:pouring
	aria-disabled={locked}
	aria-label={label}
	onclick={() => onselect(color)}
>
	<svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
		<path d="M18 30 h64 l-7 60 q-1 6 -7 6 h-36 q-6 0 -7 -6 z" fill="var(--surface)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
		<path d="M21 46 h58 l-5 42 q-1 4 -5 4 h-38 q-4 0 -5 -4 z" fill="var(--learn-{color})" />
		<ellipse cx="50" cy="30" rx="32" ry="8" fill="var(--learn-{color})" stroke="var(--text-primary)" stroke-width="4" />
		<path d="M24 26 q26 -34 52 0" fill="none" stroke="var(--text-secondary)" stroke-width="4" stroke-linecap="round" />
	</svg>
	<span>{label}</span>
</button>

<style>
	.paint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-width: 132px;
		padding: 14px 18px 12px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		font-size: 24px;
		font-weight: 600;
		transition: transform 200ms ease, border-color 200ms ease;
	}
	.paint:hover:not([aria-disabled='true']) {
		transform: translateY(-4px);
		border-color: var(--text-secondary);
	}
	.paint[aria-disabled='true'] {
		cursor: default;
	}
	.used {
		border-color: var(--text-primary);
		border-style: dashed;
	}
	.pouring svg {
		transform: rotate(-35deg) translate(10px, -10px);
		transition: transform 300ms ease;
	}
	.wiggle {
		animation: wiggle 600ms ease-in-out;
	}
	@keyframes wiggle {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-6deg); }
		75% { transform: rotate(6deg); }
	}
</style>
