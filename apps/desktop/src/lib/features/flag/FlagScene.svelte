<script lang="ts">
	import { goto } from '$app/navigation';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	type Country = {
		id: string;
		label: { bn: string; en: string };
		accent: string;
	};

	const countries: Country[] = [
		{ id: 'bangladesh', label: { bn: 'বাংলাদেশ', en: 'Bangladesh' }, accent: '#006a4e' },
		{ id: 'india', label: { bn: 'ভারত', en: 'India' }, accent: '#ff9933' },
		{ id: 'japan', label: { bn: 'জাপান', en: 'Japan' }, accent: '#ffffff' },
		{ id: 'france', label: { bn: 'ফ্রান্স', en: 'France' }, accent: '#0055a4' },
		{ id: 'germany', label: { bn: 'জার্মানি', en: 'Germany' }, accent: '#000000' },
		{ id: 'brazil', label: { bn: 'ব্রাজিল', en: 'Brazil' }, accent: '#009b3a' }
	];

	let round = $state(0);
	let score = $state(0);
	let answered = $state(false);
	let selectedId: string | null = $state(null);

	const current = $derived(countries[round % countries.length]);
	const lang = $derived($settings.language);

	const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);

	const options = $derived(() => {
		const others = shuffle(countries.filter((c) => c.id !== current.id)).slice(0, 3);
		return shuffle([current, ...others]);
	});

	function nextRound() {
		answered = false;
		selectedId = null;
		round += 1;
	}

	function checkAnswer(id: string) {
		if (answered) return;
		selectedId = id;
		answered = true;
		if (id === current.id) {
			score += 1;
		}
		setTimeout(() => {
			nextRound();
		}, 1200);
	}

	const flagSvg = (countryId: string) => {
		switch (countryId) {
			case 'bangladesh':
				return `
					<svg viewBox="0 0 120 80" aria-hidden="true">
						<rect width="120" height="80" fill="#006a4e"/>
						<circle cx="60" cy="40" r="17" fill="#f42a41"/>
					</svg>`;
			case 'india':
				return `
					<svg viewBox="0 0 120 80" aria-hidden="true">
						<rect width="120" height="26.67" fill="#ff9933"/>
						<rect y="26.67" width="120" height="26.66" fill="#ffffff"/>
						<rect y="53.33" width="120" height="26.67" fill="#128807"/>
						<circle cx="60" cy="40" r="9" fill="none" stroke="#000080" stroke-width="1.5"/>
						<circle cx="60" cy="40" r="1.5" fill="#000080"/>
						<g stroke="#000080" stroke-width="0.8">
							<path d="M60 31v18" />
							<path d="M60 31v18" transform="rotate(15 60 40)" />
							<path d="M60 31v18" transform="rotate(30 60 40)" />
							<path d="M60 31v18" transform="rotate(45 60 40)" />
							<path d="M60 31v18" transform="rotate(60 60 40)" />
							<path d="M60 31v18" transform="rotate(75 60 40)" />
							<path d="M60 31v18" transform="rotate(90 60 40)" />
							<path d="M60 31v18" transform="rotate(105 60 40)" />
							<path d="M60 31v18" transform="rotate(120 60 40)" />
							<path d="M60 31v18" transform="rotate(135 60 40)" />
							<path d="M60 31v18" transform="rotate(150 60 40)" />
							<path d="M60 31v18" transform="rotate(165 60 40)" />
						</g>
					</svg>`;
			case 'japan':
				return `
					<svg viewBox="0 0 120 80" aria-hidden="true">
						<rect width="120" height="80" fill="#ffffff"/>
						<circle cx="60" cy="40" r="20" fill="#bc002d"/>
					</svg>`;
			case 'france':
				return `
					<svg viewBox="0 0 120 80" aria-hidden="true">
						<rect width="40" height="80" fill="#0055a4"/>
						<rect x="40" width="40" height="80" fill="#ffffff"/>
						<rect x="80" width="40" height="80" fill="#ef4135"/>
					</svg>`;
			case 'germany':
				return `
					<svg viewBox="0 0 120 80" aria-hidden="true">
						<rect width="120" height="26.7" fill="#000000"/>
						<rect y="26.7" width="120" height="26.7" fill="#dd0000"/>
						<rect y="53.4" width="120" height="26.6" fill="#ffce00"/>
					</svg>`;
			case 'brazil':
				return `
					<svg viewBox="0 0 120 80" aria-hidden="true">
						<rect width="120" height="80" fill="#009b3a"/>
						<path d="M10 40 L60 12 L110 40 L60 68 Z" fill="#ffdf00"/>
						<circle cx="60" cy="40" r="12" fill="#002776"/>
					</svg>`;
			default:
				return '';
		}
	};

	function statusText() {
		if (!answered) {
			return lang === 'bn-BD' ? 'কোন দেশের পতাকা?' : 'Which country flag?';
		}
		if (selectedId === current.id) {
			return lang === 'bn-BD' ? 'সঠিক! খুব ভালো!' : 'Correct! Great job!';
		}
		return lang === 'bn-BD' ? `ভুল! সঠিক উত্তর: ${current.label.bn}` : `Not quite — it is ${current.label.en}`;
	}
</script>

<TopBar backTo="/play" />

<section class="flag-game">
	<div class="header">
		<h2>{lang === 'bn-BD' ? 'দেশের পতাকা চিনো' : 'Guess the country flag'}</h2>
		<p>{lang === 'bn-BD' ? `স্কোর: ${score}` : `Score: ${score}`}</p>
	</div>

	<div class="flag-panel">
		{@html flagSvg(current.id)}
	</div>

	<div class="choices">
		{#each options() as option (option.id)}
			<button
				class:correct={answered && option.id === current.id}
				class:wrong={answered && option.id === selectedId && option.id !== current.id}
				type="button"
				onclick={() => checkAnswer(option.id)}
			>
				{lang === 'bn-BD' ? option.label.bn : option.label.en}
			</button>
		{/each}
	</div>

	<p class="status">{statusText()}</p>

	<GameButton label={t('chooseGame', lang)} variant="secondary" onclick={() => goto('/play')} />
</section>

<style>
	.flag-game {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 1.5vh, 20px);
		padding: clamp(8px, 1.5vh, 20px) 16px;
		background: var(--bg-primary);
	}
	.header {
		text-align: center;
	}
	.header h2 {
		margin: 0;
		font-size: clamp(28px, 4vw, 48px);
		line-height: 1.2;
	}
	.header p {
		margin: 4px 0 0;
		font-size: clamp(18px, 2vw, 22px);
		font-weight: 600;
	}
	.flag-panel {
		width: min(460px, 80vw, 42vh);
		flex: 0 1 auto;
		aspect-ratio: 3 / 2;
		max-height: 42vh;
		background: #f4f0ea;
		border: 4px solid var(--border-soft);
		border-radius: 24px;
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.06);
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.flag-panel :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: clamp(8px, 1.25vh, 16px);
		width: min(560px, 90vw);
	}
	button {
		padding: clamp(8px, 1.5vh, 16px) 12px;
		border: 3px solid var(--border-soft);
		border-radius: 18px;
		background: var(--surface);
		font-size: clamp(18px, 2vw, 22px);
		font-weight: 700;
		cursor: pointer;
		transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
	}
	button:hover {
		transform: translateY(-2px);
		border-color: var(--text-secondary);
	}
	button.correct {
		background: #d9f7e9;
		border-color: #1fa861;
	}
	button.wrong {
		background: #ffe0e0;
		border-color: #d84b4b;
	}
	.status {
		margin: 0;
		min-height: 28px;
		font-size: clamp(16px, 1.8vw, 20px);
		font-weight: 600;
	}
	@media (max-width: 520px) {
		.choices {
			grid-template-columns: 1fr;
		}
	}
	@media (max-height: 680px) {
		.flag-game {
			justify-content: flex-start;
		}
		.flag-panel {
			width: min(400px, 70vw, 34vh);
			max-height: 34vh;
		}
	}
</style>
