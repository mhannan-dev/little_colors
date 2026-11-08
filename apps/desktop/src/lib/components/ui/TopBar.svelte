<script lang="ts">
	import { goto } from '$app/navigation';
	import { settings } from '#lib/stores/settings.ts';
	import { caption } from '#lib/audio/narrator.ts';
	import { t } from '#lib/i18n.ts';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	let { onreplay, backTo = '/play' }: { onreplay?: () => void; backTo?: string } = $props();

	const toggleSound = () => settings.update((s) => ({ ...s, soundEnabled: !s.soundEnabled }));
</script>

<header>
	<button class="icon" onclick={() => goto(backTo)} aria-label={t('back', $settings.language)}>
		<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>

	<p class="caption" aria-live="polite">{$caption}</p>

	<div class="right">
		<LanguageSwitcher onchange={onreplay} />
		{#if onreplay}
			<button class="icon" onclick={onreplay} aria-label={t('replayInstruction', $settings.language)}>
				<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true"><path d="M4 12 a8 8 0 1 0 3 -6.2 M4 4 v5 h5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
		{/if}
		<button
			class="icon"
			data-testid="sound-toggle"
			onclick={toggleSound}
			aria-pressed={$settings.soundEnabled}
			aria-label={t($settings.soundEnabled ? 'soundOn' : 'soundOff', $settings.language)}
		>
			<svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
				<path d="M4 9 h4 l5 -4 v14 l-5 -4 h-4 z" fill="currentColor" />
				{#if $settings.soundEnabled}
					<path d="M16 8.5 q2.5 3.5 0 7 M18.5 6 q4.5 6 0 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
				{:else}
					<path d="M16 9 l5 6 M21 9 l-5 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
				{/if}
			</svg>
		</button>
	</div>
</header>

<style>
	header {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 16px;
		padding: 16px 24px;
	}
	.right {
		display: flex;
		gap: 12px;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border: 3px solid var(--border-soft);
		border-radius: var(--radius-lg);
		background: var(--surface);
		cursor: pointer;
	}
	.caption {
		margin: 0;
		text-align: center;
		font-size: clamp(24px, 3vw, 36px);
		font-weight: 600;
		min-height: 1.4em;
	}
</style>
