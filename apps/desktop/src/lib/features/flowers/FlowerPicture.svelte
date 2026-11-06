<script lang="ts">
	import type { LearningFlowerId } from '@little-colors/core';
	let { id, size = 100 }: { id: LearningFlowerId; size?: number } = $props();
</script>

<svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
	<g stroke="#25363b" stroke-width="2.5" stroke-linejoin="round">
		{#if id === 'water-lily'}
			<path d="M18 86 Q30 64 86 70 Q112 77 105 96 Q80 111 22 101 L48 87Z" fill="#72a85b" />
			<path d="M61 83 Q36 81 26 55 Q52 57 59 71 Q48 51 60 31 Q74 53 66 70 Q83 53 98 55 Q89 80 61 83Z" fill="#f7d6ee" />
			<path d="M52 74 Q60 58 70 74Z" fill="#ffc24f" />
		{:else}
			<path d="M60 57 V108 M60 94 Q35 95 30 77 Q52 74 60 94 M60 100 Q70 78 91 81 Q89 100 60 100" fill="#72a85b" stroke="#356c42" stroke-width="4" />
			{#if id === 'rose'}
				<path d="M60 74 Q24 69 24 38 Q34 20 52 31 Q70 13 92 33 Q101 59 60 74Z" fill="#de515d" />
				<path d="M28 36 Q37 56 60 58 Q87 55 92 33 M45 41 Q62 25 75 41 Q69 54 54 48" fill="none" stroke="#8f2c44" />
			{:else if id === 'sunflower'}
				{#each Array(12) as _, index}
					<ellipse cx="60" cy="24" rx="9" ry="17" fill="#ffd64f" transform="rotate({index * 30} 60 49)" />
				{/each}
				<circle cx="60" cy="49" r="20" fill="#875832" />
			{:else if id === 'marigold'}
				<path d="M27 47 Q18 35 32 30 Q29 17 45 19 Q50 8 62 17 Q76 8 83 23 Q97 20 96 36 Q108 44 97 55 Q99 69 83 71 Q76 84 62 77 Q49 85 41 73 Q26 75 27 61 Q16 56 27 47Z" fill="#f5a52d" />
				<path d="M36 43 Q45 31 52 40 Q61 27 68 37 Q81 30 86 44 Q74 47 76 57 Q64 54 60 66 Q54 54 44 58 Q48 47 36 43Z" fill="#ffd161" stroke="#b76722" />
			{:else if id === 'jasmine'}
				{#each Array(5) as _, index}
					<ellipse cx="60" cy="30" rx="11" ry="22" fill="#fff9ee" transform="rotate({index * 72} 60 49)" />
				{/each}
				<circle cx="60" cy="49" r="7" fill="#f4d164" />
			{:else}
				{#each Array(5) as _, index}
					<ellipse cx="60" cy="29" rx="16" ry="22" fill="#eb637c" transform="rotate({index * 72} 60 49)" />
				{/each}
				<circle cx="60" cy="49" r="9" fill="#a43054" />
				<path d="M60 49 Q72 38 85 35" fill="none" stroke="#ffe17a" stroke-width="5" />
				<circle cx="86" cy="35" r="5" fill="#ffe17a" />
			{/if}
		{/if}
	</g>
</svg>
