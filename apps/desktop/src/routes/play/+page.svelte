<script lang="ts">
	import { goto } from '$app/navigation';
	import { narrationText } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { say } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	const modes = [
		{ id: 'mixing', key: 'mode.mixing', href: '/mixing' },
		{ id: 'matching', key: 'mode.matching', href: '/matching' },
		{ id: 'numbers', key: 'mode.numbers', href: '/numbers' }
	] as const;

	const label = (key: string) =>
		narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	// SC-11: a tap opens the mode and speaks its label; keyboard focus alone speaks it.
	function open(m: (typeof modes)[number]) {
		say(m.key, { interrupt: true });
		goto(m.href);
	}
</script>

<TopBar backTo="/" />

<section>
	<h2>{t('chooseMode', $settings.language)}</h2>
	<div class="cards">
		{#each modes as m (m.id)}
			<button class="card" onclick={() => open(m)} onfocus={() => say(m.key, { interrupt: true })}>
				<svg viewBox="0 0 160 110" width="200" height="140" aria-hidden="true">
					{#if m.id === 'mixing'}
						<circle cx="80" cy="45" r="32" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4" />
						<polygon points="80,30 90,37 86,48 74,48 70,37" fill="var(--text-primary)" />
						<rect x="14" y="70" width="34" height="34" rx="8" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="3" />
						<rect x="112" y="70" width="34" height="34" rx="8" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="3" />
					{:else if m.id === 'matching'}
						<circle cx="40" cy="55" r="26" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" />
						<polygon points="120,22 129,46 154,46 134,61 141,86 120,71 99,86 106,61 86,46 111,46" fill="none" stroke="var(--text-primary)" stroke-width="4" stroke-dasharray="8 6" stroke-linejoin="round" />
					{:else}
						{#each [30, 80, 130] as x (x)}
							<circle cx={x} cy="40" r="20" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" />
						{/each}
						<text x="80" y="104" text-anchor="middle" font-size="40" font-weight="700" fill="var(--text-primary)">৩</text>
					{/if}
				</svg>
				<span>{label(m.key)}</span>
			</button>
		{/each}
	</div>
</section>

<style>
	section {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 32px;
		padding: 0 24px 48px;
	}
	h2 {
		margin: 0;
		font-size: 40px;
	}
	.cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 32px;
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: 260px;
		padding: 28px 20px 24px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		font-size: 30px;
		font-weight: 700;
		transition: transform 200ms ease, border-color 200ms ease;
	}
	.card:hover {
		transform: translateY(-6px);
		border-color: var(--text-secondary);
	}
</style>
