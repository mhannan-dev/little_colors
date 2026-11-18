<script lang="ts">
	import { formatNumeral } from '@little-colors/core';
	import { settings } from '#lib/stores/settings.ts';
	import type { Token } from './lessons.ts';
	let { token }: { token: Token } = $props();
</script>

<svg viewBox="0 0 100 100" aria-hidden="true">
	{#if token.kind === 'number'}
		<text x="50" y="59" text-anchor="middle" font-size="57" font-weight="700" fill={token.hex}>{formatNumeral(token.value!, $settings.numeralStyle)}</text>
		{#each Array(token.value) as _, i}<circle cx={50 + (i - (token.value! - 1) / 2) * 15} cy="82" r="5" fill={token.hex} />{/each}
	{:else if token.shape === 'circle'}<circle cx="50" cy="50" r="34" fill={token.hex} stroke="#354b53" stroke-width="3" />
	{:else if token.shape === 'square'}<rect x="17" y="17" width="66" height="66" rx="8" fill={token.hex} stroke="#354b53" stroke-width="3" />
	{:else}<path d="M50 12 89 82H11Z" fill={token.hex} stroke="#354b53" stroke-width="3" stroke-linejoin="round" />{/if}
</svg>

<style>svg { display: block; width: 100%; height: 100%; }</style>
