<script lang="ts">
	import type { AlphabetEntry } from '@little-colors/core';
	let { entry }: { entry: AlphabetEntry } = $props();
</script>
<span class="picture" role="img" aria-label={entry.word}>
	{#if entry.picture === 'xylophone'}<svg viewBox="0 0 140 110" aria-hidden="true"><path d="M20 80 H122 M30 95 L112 18" stroke="var(--text-primary)" stroke-width="5"/>{#each [0,1,2,3,4] as i}<rect x={16+i*22} y={18+i*7} width="18" height={72-i*9} rx="5" fill={['var(--learn-blue)','var(--learn-green)','var(--learn-orange)','var(--learn-blue)','var(--learn-green)'][i]} stroke="var(--text-primary)" stroke-width="2"/>{/each}<path d="M32 96 L104 26" stroke="var(--text-primary)" stroke-width="5"/><circle cx="106" cy="24" r="9" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="3"/></svg>
	{:else if entry.picture === 'yo-yo'}<svg viewBox="0 0 140 110" aria-hidden="true"><path d="M74 12 Q120 12 78 62" fill="none" stroke="var(--text-primary)" stroke-width="4"/><circle cx="67" cy="73" r="31" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4"/><circle cx="67" cy="73" r="20" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3"/><circle cx="67" cy="73" r="6" fill="var(--surface)"/></svg>
	{:else}<span aria-hidden="true">{entry.picture}</span>{/if}
</span>
<style>.picture{display:inline-grid;place-items:center;width:140px;height:120px;font-family:'Segoe UI Emoji',sans-serif;font-size:86px;line-height:1}.picture svg{width:140px;height:110px}</style>
