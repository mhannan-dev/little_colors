<script lang="ts">
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	let { completed = 0, hat = false, compact = false, label }: { completed?: number; hat?: boolean; compact?: boolean; label: string } = $props();
</script>

<div class="picnic-scene" class:compact data-testid="picnic-scene" data-completed={completed}>
	<svg viewBox="0 0 800 220" role="img" aria-label={label}>
		<rect x="0" y="12" width="800" height="208" rx="30" fill="var(--bg-secondary)" />
		<path d="M0 174 Q130 127 290 166 T570 156 T800 167 V220 H0 Z" fill="var(--border-soft)" fill-opacity="0.45" />
		<path d="M390 12 Q348 72 403 122 T405 220 H447 Q464 165 431 118 T430 12 Z" fill="var(--learn-blue)" fill-opacity="0.22" />
		<path d="M171 180 Q260 151 344 163 M465 163 Q522 146 630 178" fill="none" stroke="var(--text-secondary)" stroke-width="4" stroke-dasharray="5 12" stroke-linecap="round" />
		<path d="M650 134 V58" stroke="var(--text-secondary)" stroke-width="8" stroke-linecap="round" />
		<path d="M626 64 Q600 23 648 22 Q687 6 703 45 Q718 79 681 88 H636 Q606 86 626 64" fill="var(--learn-green)" fill-opacity="0.22" stroke="var(--border-soft)" stroke-width="3" />
		<path d="M724 142 V66 L765 80 L724 98" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
		<path d="M568 157 L719 157 L759 203 H545 Z" fill="var(--surface)" stroke="var(--learn-green)" stroke-width="3" stroke-linejoin="round" />
		<path d="M594 158 L577 202 M628 158 L620 202 M666 158 L667 202 M700 158 L718 202 M556 187 H744 M563 173 H732" stroke="var(--learn-green)" stroke-opacity="0.3" stroke-width="3" />
		<g stroke="var(--text-secondary)" stroke-width="3" fill="var(--surface)">
			<rect x="344" y="146" width="30" height="37" rx="5" />
			<rect x="421" y="146" width="30" height="37" rx="5" />
			{#if completed >= 3}<rect data-testid="picnic-bridge" x="382" y="146" width="31" height="37" rx="5" fill="var(--learn-orange)" fill-opacity="0.5" />
			{:else}<rect x="382" y="146" width="31" height="37" rx="5" fill="none" stroke-dasharray="5 4" />{/if}
		</g>
		<g transform={hat ? 'translate(90, 43)' : 'translate(225, 148)'} data-testid={hat ? 'picnic-hat' : 'picnic-basket'}>
			<path d="M8 12 Q32 -24 56 12" fill="none" stroke="var(--text-secondary)" stroke-width="5" />
			<path d="M0 10 H64 L56 48 H8 Z" fill="var(--learn-orange)" fill-opacity="0.6" stroke="var(--text-secondary)" stroke-width="3" stroke-linejoin="round" />
			<path d="M5 23 H59 M9 35 H55 M20 12 L24 45 M43 12 L40 45" fill="none" stroke="var(--surface)" stroke-width="2" />
		</g>
		{#if completed >= 1}
			<g data-testid="picnic-packed" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="2">
				<path d="M235 155 C220 131 242 123 249 137 C261 119 280 136 265 155 Z" />
				<path d="M260 155 C247 134 270 129 277 141 C290 126 305 140 289 155 Z" />
			</g>
		{/if}
		{#if completed >= 2}
			<g data-testid="picnic-supplies">
				<rect x="295" y="151" width="19" height="43" rx="6" fill="var(--learn-blue)" fill-opacity="0.75" stroke="var(--text-primary)" stroke-width="2" />
				<rect x="298" y="144" width="13" height="8" rx="2" fill="var(--text-primary)" />
				<path d="M198 189 L215 160 L231 189 Z" fill="var(--learn-orange)" fill-opacity="0.6" stroke="var(--text-primary)" stroke-width="2" />
			</g>
		{/if}
		{#if completed >= 4}
			<g data-testid="picnic-feast">
				<ellipse cx="690" cy="181" rx="29" ry="10" fill="var(--surface)" stroke="var(--text-secondary)" stroke-width="2" />
				<path d="M676 180 L687 160 L700 180 Z" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="2" />
				<circle cx="716" cy="180" r="8" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="2" />
				<rect x="646" y="167" width="12" height="25" rx="4" fill="var(--learn-blue)" />
			</g>
		{/if}
	</svg>
	<div class="character" class:arrived={completed >= 4}><Mascot state={completed >= 4 ? 'celebrate' : compact ? 'idle' : hat ? 'thinking' : 'wave'} size={120} /></div>
</div>

<style>
	.picnic-scene { position: relative; width: 100%; max-width: 840px; margin: 0 auto; isolation: isolate; }
	svg { width: 100%; height: auto; display: block; }
	.character { position: absolute; width: 15%; left: 8%; bottom: 9%; transition: left 600ms ease; pointer-events: none; }
	.character :global(.rumi) { width: 100% !important; height: auto !important; }
	.compact { max-width: 440px; }
	@media (prefers-reduced-motion: reduce) { .character { transition: none !important; } }
</style>
