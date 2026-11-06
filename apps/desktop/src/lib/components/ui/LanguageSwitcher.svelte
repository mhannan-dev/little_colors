<script lang="ts">
	import type { Locale } from '@little-colors/core';
	import { clearCaption, stopNarration } from '#lib/audio/narrator.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { settings, setLanguage } from '#lib/stores/settings.ts';

	let { onchange }: { onchange?: () => void } = $props();
	const languages = [
		{ locale: 'bn-BD', label: 'বাংলা' },
		{ locale: 'en-US', label: 'English' }
	] as const;

	function choose(locale: Locale) {
		if (locale === $settings.language) return;
		stopNarration();
		clearCaption();
		setLanguage(locale);
		if (!$paused) onchange?.();
	}
</script>

<div class="language-switcher" role="group" aria-label={$settings.language === 'bn-BD' ? 'ভাষা' : 'Language'}>
	{#each languages as { locale, label } (locale)}
		<button lang={locale} aria-pressed={$settings.language === locale} onclick={() => choose(locale)}>{label}</button>
	{/each}
</div>

<style>
	.language-switcher {
		display: inline-flex;
		align-self: center;
		padding: 3px;
		gap: 3px;
		border: 3px solid var(--border-soft);
		border-radius: var(--radius-lg);
		background: var(--surface);
	}
	button {
		min-height: 44px;
		padding: 4px 10px;
		border: 2px solid transparent;
		border-radius: 12px;
		background: var(--surface);
		font-size: 18px;
		font-weight: 600;
		cursor: pointer;
	}
	button[aria-pressed='true'] {
		border-color: var(--text-primary);
		background: var(--bg-secondary);
	}
</style>
