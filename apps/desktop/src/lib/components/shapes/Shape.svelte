<script lang="ts">
	/**
	 * Spec 06 shape library as SVG (SM-03). PLACEHOLDER art (AS-20), original.
	 * - solid:   the draggable object (full color, dark outline)
	 * - outline: the target slot (light tint of its color + dashed outline)
	 */
	import type { Color, ShapeKey } from '@little-colors/core';

	let {
		shape,
		color,
		variant = 'solid',
		size = 96
	}: {
		shape: ShapeKey | 'paint-drop';
		color: Color;
		variant?: 'solid' | 'outline';
		size?: number;
	} = $props();

	const solid = $derived(variant === 'solid');
	const fill = $derived(`var(--learn-${color})`);
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" class:outline={!solid}>
	<!-- Outline slots keep their color visible (dashed stroke in the color + tint), so
	     color-matching targets are distinguishable at a glance (PR-24). -->
	<g
		fill={fill}
		fill-opacity={solid ? 1 : 0.38}
		stroke={solid ? 'var(--text-primary)' : fill}
		stroke-width={solid ? 4 : 6}
		stroke-dasharray={solid ? undefined : '9 6'}
		stroke-linejoin="round"
		stroke-linecap="round"
	>
		{#if shape === 'circle'}
			<circle cx="50" cy="50" r="40" />
		{:else if shape === 'football'}
			<circle cx="50" cy="50" r="40" />
		{:else if shape === 'star'}
			<polygon points="50,8 61,37 92,38 67,57 76,88 50,70 24,88 33,57 8,38 39,37" />
		{:else if shape === 'crescent'}
			<!-- Chunky crescent: outer r40, inner arc r38 (~30 units thick in the middle). -->
			<path d="M66 14 A40 40 0 1 0 66 86 A38 38 0 0 1 66 14 Z" />
		{:else if shape === 'square'}
			<rect x="13" y="13" width="74" height="74" rx="8" />
		{:else if shape === 'triangle'}
			<polygon points="50,10 91,86 9,86" />
		{:else if shape === 'leaf'}
			<path d="M50 8 C82 26 88 62 50 92 C12 62 18 26 50 8 Z" />
		{:else if shape === 'apple'}
			<path d="M50 30 C30 16 9 31 13 56 C17 81 36 93 50 86 C64 93 83 81 87 56 C91 31 70 16 50 30 Z" />
		{:else if shape === 'paint-drop'}
			<path d="M50 8 C50 8 18 46 18 64 A32 32 0 0 0 82 64 C82 46 50 8 50 8 Z" />
		{/if}
	</g>

	<!-- Details drawn on top (never the only cue, PR-24). -->
	{#if shape === 'football'}
		<g stroke="var(--text-primary)" stroke-width="3" fill="none" opacity={solid ? 1 : 0.5}>
			<polygon points="50,33 62,41 58,55 42,55 38,41" fill="var(--text-primary)" />
			<path d="M50 33 V12 M62 41 L82 33 M58 55 L69 74 M42 55 L31 74 M38 41 L18 33" />
		</g>
	{:else if shape === 'leaf'}
		<path d="M50 20 V82 M50 45 L36 34 M50 60 L64 49" stroke={solid ? 'var(--text-primary)' : 'var(--text-secondary)'} stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7" />
	{:else if shape === 'apple'}
		<path d="M50 30 Q51 18 57 11" stroke="var(--text-primary)" stroke-width="4" fill="none" stroke-linecap="round" opacity={solid ? 1 : 0.5} />
		<path d="M54 19 Q66 12 72 18 Q64 26 54 19 Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="2.5" opacity={solid ? 1 : 0.5} />
	{/if}
</svg>

<style>
	svg {
		display: block;
		overflow: visible;
	}
</style>
