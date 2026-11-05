<script lang="ts">
	import type { ThinkingToken } from '@little-colors/core';
	let { token, size = 64 }: { token: ThinkingToken; size?: number } = $props();
</script>

<svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
	{#if token.picture}
		<g stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
			{#if token.picture === 'apple'}
				<path d="M50 31 C29 11 8 34 19 64 C29 95 41 83 50 84 C63 87 77 87 84 60 C92 31 71 14 50 31 Z" fill="var(--learn-green)" />
				<path d="M50 30 V13 M52 21 Q65 3 77 13 Q68 27 52 21" fill="var(--learn-green)" />
			{:else if token.picture === 'sandwich'}
				<path d="M12 78 L50 17 L88 78 Z" fill="var(--learn-orange)" fill-opacity="0.6" />
				<path d="M22 69 L50 26 L78 69 Z" fill="var(--surface)" />
				<path d="M18 71 H82 M24 63 H76" stroke="var(--learn-green)" />
			{:else if token.picture === 'bottle'}
				<rect x="29" y="29" width="42" height="60" rx="12" fill="var(--learn-blue)" fill-opacity="0.65" />
				<rect x="36" y="11" width="28" height="17" rx="4" fill="var(--surface)" />
				<path d="M34 49 H66 M34 69 H66" stroke="var(--surface)" />
			{:else if token.picture === 'napkin'}
				<rect x="14" y="16" width="72" height="70" rx="7" fill="var(--surface)" />
				<path d="M34 18 V84 M61 18 V84 M16 37 H84 M16 64 H84" stroke="var(--learn-green)" />
			{:else}
				<path d="M35 10 H68 V55 Q95 62 78 78 L47 91 Q24 91 24 75 L35 55 Z" fill="var(--learn-blue)" />
				<path d="M36 22 H67 M36 35 H67" stroke="var(--surface)" />
			{/if}
		</g>
	{:else}
	<g fill="var(--learn-{token.color})" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round">
		{#if token.shape === 'circle'}<circle cx="50" cy="50" r="36" />
		{:else if token.shape === 'square'}<rect x="16" y="16" width="68" height="68" rx="8" />
		{:else if token.shape === 'triangle'}<path d="M50 12 L90 84 H10 Z" />
		{:else}<path d="M50 8 L62 36 L92 38 L69 58 L76 88 L50 72 L24 88 L31 58 L8 38 L38 36 Z" />{/if}
	</g>
	{/if}
</svg>
