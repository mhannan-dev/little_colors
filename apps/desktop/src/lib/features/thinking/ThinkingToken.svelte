<script lang="ts">
	import type { ThinkingToken } from '@little-colors/core';
	let { token, size = 64 }: { token: ThinkingToken; size?: number } = $props();
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
	<g fill="var(--learn-{token.color})" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round">
		{#if token.shape === 'circle'}<circle cx="50" cy="50" r="36" />
		{:else if token.shape === 'square'}<rect x="16" y="16" width="68" height="68" rx="8" />
		{:else if token.shape === 'triangle'}<path d="M50 12 L90 84 H10 Z" />
		{:else}<path d="M50 8 L62 36 L92 38 L69 58 L76 88 L50 72 L24 88 L31 58 L8 38 L38 36 Z" />{/if}
	</g>
</svg>
