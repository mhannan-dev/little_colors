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
		{ id: 'numbers', key: 'mode.numbers', href: '/numbers' },
		{ id: 'football', key: 'mode.football', href: '/football' },
		{ id: 'car', key: 'mode.car', href: '/car' },
		{ id: 'flag', key: 'mode.flag', href: '/flag' },
		{ id: 'bird', key: 'mode.bird', href: '/bird' },
		{ id: 'holy-puzzle', key: 'mode.holy-puzzle', href: '/holy-puzzle' }
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
					{:else if m.id === 'numbers'}
						{#each [30, 80, 130] as x (x)}
							<circle cx={x} cy="40" r="20" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" />
						{/each}
						<text x="80" y="104" text-anchor="middle" font-size="40" font-weight="700" fill="var(--text-primary)">৩</text>
					{:else if m.id === 'football'}
						<circle cx="80" cy="50" r="32" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4" />
						<polygon points="80,30 90,39 84,52 72,52 66,39" fill="var(--text-primary)" />
						<path d="M49 78 L111 78" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
						<path d="M53 65 L42 82" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
						<path d="M107 65 L118 82" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
					{:else if m.id === 'car'}
						<rect x="26" y="58" width="108" height="30" rx="8" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="52" y="40" width="42" height="22" rx="5" fill="var(--bg-primary)" stroke="var(--text-primary)" stroke-width="4" />
						<circle cx="48" cy="90" r="12" fill="var(--text-primary)" />
						<circle cx="112" cy="90" r="12" fill="var(--text-primary)" />
					{:else if m.id === 'flag'}
						<rect x="78" y="28" width="6" height="64" fill="var(--text-primary)" rx="3" />
						<path d="M84 30 L126 40 L84 52 Z" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="3" stroke-linejoin="round" />
						<circle cx="116" cy="40" r="6" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="3" />
					{:else if m.id === 'holy-puzzle'}
						<path d="M22 84h116v8H22z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M34 82V50l18-16 18 16v32M78 82V48l21-18 21 18v34" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
						<path d="M28 52h48M72 50h54" stroke="var(--learn-green)" stroke-width="7" />
						<path d="M90 62h20v20H90z" fill="var(--text-primary)" />
						<path d="M94 67h12v4H94z" fill="var(--learn-yellow)" />
					{:else}
						<path d="M42 72 C48 56, 56 42, 68 42 C76 42, 82 48, 86 58 C92 70, 98 72, 104 68 C111 64, 118 54, 122 42 C126 30, 133 36, 138 46 L136 78 C130 70, 122 66, 116 68 C110 70, 105 76, 98 80 C92 84, 82 86, 76 80 C68 72, 60 70, 52 74 Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
						<circle cx="78" cy="56" r="6" fill="var(--bg-primary)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M94 48 L108 34" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
						<path d="M104 48 L118 34" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
					{/if}
				</svg>
				<span>{label(m.key)}</span>
			</button>
		{/each}
	</div>
	<button class="thinking-link" onclick={() => { say('thinking.title', { interrupt: true }); goto('/thinking'); }}>
		<span>{label('thinking.title')}</span>
		<small>{$settings.language === 'bn-BD' ? '৫–১০ বছরের জন্য চারটি নতুন পাঠ' : 'Four new lessons for ages 5–10'}</small>
		<span aria-hidden="true">→</span>
	</button>
</section>

<style>
	.thinking-link { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 14px; padding: 16px 28px; min-height: 76px; border: 3px solid var(--border-soft); border-radius: var(--radius-lg); background: var(--bg-secondary); cursor: pointer; font-size: 26px; font-weight: 700; }
	.thinking-link small { font-size: 20px; font-weight: 400; }
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
		width: clamp(160px, 24vw, 260px);
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
	@media (max-height: 700px) {
		section { gap: 14px; padding-bottom: 20px; }
		h2 { font-size: 30px; }
		.card { padding: 14px; font-size: 24px; }
		.card svg { width: 140px; height: 90px; }
		.thinking-link { padding: 8px 20px; min-height: 64px; }
	}
</style>
