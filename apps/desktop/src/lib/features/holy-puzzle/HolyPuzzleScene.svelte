<script lang="ts">
	import { goto } from '$app/navigation';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	type PuzzlePicture = {
		id: 'mosque' | 'kaaba';
		label: { bn: string; en: string };
		image: string;
	};

	const svgImage = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

	const pictures: PuzzlePicture[] = [
		{
			id: 'mosque',
			label: { bn: 'মসজিদ', en: 'Mosque' },
			image: svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
				<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#bde9f4"/><stop offset="1" stop-color="#fff3d8"/></linearGradient></defs>
				<rect width="600" height="600" fill="url(#sky)"/>
				<circle cx="488" cy="94" r="44" fill="#ffd66b"/>
				<path d="M0 460Q150 420 300 460t300 0v140H0" fill="#8bcf9c"/>
				<path d="M66 520V254h74v266M460 520V254h74v266" fill="#f3d9a8" stroke="#674f41" stroke-width="9"/>
				<path d="M48 256h110l-18-28H66zM442 256h110l-18-28h-74z" fill="#ce9d5a"/>
				<path d="M98 226V160h10v66M492 226V160h10v66" stroke="#674f41" stroke-width="10"/>
				<path d="M100 153l13 15H87zM494 153l13 15h-26z" fill="#d29542"/>
				<path d="M110 520V350Q110 290 180 266Q250 290 250 350V520" fill="#f8e6c6" stroke="#674f41" stroke-width="10"/>
				<path d="M170 267Q180 191 190 267Q222 275 244 302H116Q138 275 170 267" fill="#45a995" stroke="#674f41" stroke-width="9"/>
				<path d="M238 520V322Q238 244 310 214Q382 244 382 322V520" fill="#f8e6c6" stroke="#674f41" stroke-width="10"/>
				<path d="M300 214Q310 118 320 214Q354 222 378 258H242Q266 222 300 214" fill="#37a88f" stroke="#674f41" stroke-width="9"/>
				<path d="M350 520V350Q350 290 420 266Q490 290 490 350V520" fill="#f8e6c6" stroke="#674f41" stroke-width="10"/>
				<path d="M410 267Q420 191 430 267Q462 275 484 302H356Q378 275 410 267" fill="#45a995" stroke="#674f41" stroke-width="9"/>
				<g fill="#4a372f"><path d="M276 520V427a34 34 0 0 1 68 0v93z"/><path d="M158 520V407a23 23 0 0 1 46 0v113z"/><path d="M396 520V407a23 23 0 0 1 46 0v113z"/></g>
				<g fill="#a9d8e8"><path d="M78 306h48v70H78zM472 306h48v70h-48z"/><path d="M136 334h35v42h-35zM429 334h35v42h-35z"/></g>
				<path d="M200 560h200" stroke="#e8c278" stroke-width="12" stroke-linecap="round"/>
			</svg>`)
		},
		{
			id: 'kaaba',
			label: { bn: 'কাবা', en: 'Kaaba' },
			image: svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
				<defs><linearGradient id="night" x2="0" y2="1"><stop stop-color="#243b5a"/><stop offset="1" stop-color="#6b86a1"/></linearGradient></defs>
				<rect width="600" height="600" fill="url(#night)"/>
				<circle cx="92" cy="98" r="3" fill="#fff3be"/><circle cx="172" cy="68" r="4" fill="#fff3be"/>
				<circle cx="450" cy="114" r="3" fill="#fff3be"/><circle cx="535" cy="72" r="4" fill="#fff3be"/>
				<path d="M0 420Q110 386 220 420t220 0 160 0v180H0" fill="#d8c6a4"/>
				<ellipse cx="300" cy="488" rx="228" ry="48" fill="#eee2c9"/>
				<path d="M155 255l145-78 145 78v225l-145 70-145-70z" fill="#211e20"/>
				<path d="M155 255l145 68 145-68-145-78z" fill="#302b2a"/>
				<path d="M300 323v227l145-70V255z" fill="#171719"/>
				<path d="M155 282l145 67 145-67" fill="none" stroke="#d6ad55" stroke-width="20"/>
				<path d="M155 300l145 67 145-67" fill="none" stroke="#f0d477" stroke-width="5"/>
				<path d="M205 348v121l72 34V383zM323 387v112l90-43V342z" fill="#b68e49"/>
				<path d="M218 362v93l46 22v-93zM338 397v80l60-29v-80z" fill="#39302a"/>
				<path d="M0 524h600v76H0z" fill="#c7b28d"/>
				<path d="M85 520q215-46 430 0" fill="none" stroke="#fff5df" stroke-width="10" opacity=".8"/>
			</svg>`)
		}
	];

	let pictureId = $state<PuzzlePicture['id']>('mosque');
	let gridSize = $state(2);
	let pieces = $state<number[]>([]);
	let selectedSlot = $state<number | null>(null);
	let moves = $state(0);
	let lang = $derived($settings.language);
	let picture = $derived(pictures.find((item) => item.id === pictureId)!);
	let solved = $derived(pieces.length > 0 && pieces.every((piece, index) => piece === index));

	function shufflePieces(size = gridSize) {
		const shuffled = Array.from({ length: size * size }, (_, index) => index);
		for (let index = shuffled.length - 1; index > 0; index--) {
			const swapIndex = Math.floor(Math.random() * (index + 1));
			[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
		}
		if (shuffled.every((piece, index) => piece === index)) {
			[shuffled[0], shuffled[1]] = [shuffled[1]!, shuffled[0]!];
		}
		pieces = shuffled;
		selectedSlot = null;
		moves = 0;
	}

	function choosePicture(id: PuzzlePicture['id']) {
		pictureId = id;
		shufflePieces();
	}

	function chooseLevel(size: number) {
		gridSize = size;
		shufflePieces(size);
	}

	function selectPiece(slot: number) {
		if (solved) return;
		if (selectedSlot === null) {
			selectedSlot = slot;
			return;
		}
		if (selectedSlot === slot) {
			selectedSlot = null;
			return;
		}
		const nextPieces = [...pieces];
		[nextPieces[selectedSlot], nextPieces[slot]] = [nextPieces[slot]!, nextPieces[selectedSlot]!];
		pieces = nextPieces;
		selectedSlot = null;
		moves += 1;
	}

	function tileStyle(piece: number) {
		const x = (piece % gridSize) * (100 / (gridSize - 1));
		const y = Math.floor(piece / gridSize) * (100 / (gridSize - 1));
		return `background-image:${picture.image};background-size:${gridSize * 100}% ${gridSize * 100}%;background-position:${x}% ${y}%`;
	}

	shufflePieces();
</script>

<TopBar backTo="/play" />

<section class="puzzle-scene">
	<header>
		<h1>{lang === 'bn-BD' ? 'মসজিদ ও কাবার পাজল' : 'Mosque and Kaaba Puzzle'}</h1>
		<p>{lang === 'bn-BD' ? 'ছবির টুকরোগুলো ট্যাপ করে সাজাও' : 'Tap two tiles to swap them into place'}</p>
	</header>

	<div class="picture-picker" aria-label={lang === 'bn-BD' ? 'ছবি বেছে নাও' : 'Choose a picture'}>
		{#each pictures as item (item.id)}
			<button
				class:active={pictureId === item.id}
				class="picture-choice"
				type="button"
				aria-pressed={pictureId === item.id}
				onclick={() => choosePicture(item.id)}
			>{lang === 'bn-BD' ? item.label.bn : item.label.en}</button>
		{/each}
	</div>

	<div class="level-picker" aria-label={lang === 'bn-BD' ? 'কঠিনের মাত্রা' : 'Puzzle difficulty'}>
		<button class:active={gridSize === 2} type="button" aria-pressed={gridSize === 2} onclick={() => chooseLevel(2)}>
			{lang === 'bn-BD' ? 'সহজ · ৪ টুকরো' : 'Easy · 4 tiles'}
		</button>
		<button class:active={gridSize === 3} type="button" aria-pressed={gridSize === 3} onclick={() => chooseLevel(3)}>
			{lang === 'bn-BD' ? 'কঠিন · ৯ টুকরো' : 'Hard · 9 tiles'}
		</button>
	</div>

	<div
		class="puzzle-board"
		class:complete={solved}
		style={`--grid-size:${gridSize}`}
		role="group"
		aria-label={`${lang === 'bn-BD' ? picture.label.bn : picture.label.en} puzzle`}
		data-testid="puzzle-board"
	>
		{#each pieces as piece, slot (slot)}
			<button
				class="tile"
				class:selected={selectedSlot === slot}
				class:placed={solved}
				type="button"
				style={tileStyle(piece)}
				aria-label={lang === 'bn-BD'
					? `টুকরো ${slot + 1}, ${selectedSlot === slot ? 'নির্বাচিত' : 'বেছে নাও'}`
					: `Tile ${slot + 1}${selectedSlot === slot ? ', selected' : ''}`}
				aria-pressed={selectedSlot === slot}
				data-slot={slot}
				data-piece={piece}
				onclick={() => selectPiece(slot)}
			></button>
		{/each}
	</div>

	<div class="status" aria-live="polite">
		{#if solved}
			<strong>{lang === 'bn-BD' ? 'দারুণ! পাজলটি মিলে গেছে!' : 'Wonderful! Puzzle complete!'}</strong>
		{:else}
			<span>{lang === 'bn-BD' ? `চাল: ${moves}` : `Moves: ${moves}`}</span>
			<span>{lang === 'bn-BD' ? 'একটি টুকরো বেছে নিয়ে, তারপর অন্যটিতে ট্যাপ করো' : 'Select one tile, then tap another to swap'}</span>
		{/if}
	</div>

	<div class="actions">
		{#if solved}
			<button class="action" type="button" onclick={() => shufflePieces()}>
				{lang === 'bn-BD' ? 'আবার খেলি' : 'Play again'}
			</button>
		{:else}
			<button class="action" type="button" onclick={() => shufflePieces()}>
				{lang === 'bn-BD' ? 'নতুন করে সাজাই' : 'Shuffle again'}
			</button>
		{/if}
		<GameButton label={t('chooseGame', lang)} variant="secondary" size="small" onclick={() => goto('/play')} />
	</div>
</section>

<style>
	.puzzle-scene {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(6px, 1vh, 12px);
		padding: 6px 16px 12px;
		overflow-y: auto;
	}
	header {
		text-align: center;
	}
	h1 {
		margin: 0;
		font-size: clamp(24px, 3vw, 38px);
		line-height: 1.2;
	}
	header p {
		margin: 2px 0 0;
		font-size: clamp(14px, 1.6vw, 18px);
	}
	.picture-picker,
	.level-picker,
	.actions {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-wrap: wrap;
		gap: 8px;
	}
	.picture-choice,
	.level-picker button,
	.action {
		min-height: 40px;
		padding: 4px 16px;
		border: 2px solid var(--border-soft);
		border-radius: 14px;
		background: var(--surface);
		font: inherit;
		font-size: clamp(14px, 1.6vw, 18px);
		font-weight: 600;
		cursor: pointer;
	}
	.picture-choice.active,
	.level-picker button.active {
		border-color: var(--learn-green);
		background: var(--bg-secondary);
	}
	.puzzle-board {
		display: grid;
		grid-template-columns: repeat(var(--grid-size), minmax(0, 1fr));
		grid-template-rows: repeat(var(--grid-size), minmax(0, 1fr));
		width: min(46vh, 420px, 86vw);
		aspect-ratio: 1;
		flex: 0 0 auto;
		overflow: hidden;
		border: 4px solid var(--surface);
		border-radius: 18px;
		background: var(--surface);
		box-shadow: 0 5px 16px rgb(0 0 0 / 12%);
	}
	.tile {
		min-width: 0;
		min-height: 0;
		padding: 0;
		border: 1px solid rgb(255 255 255 / 90%);
		border-radius: 0;
		background-repeat: no-repeat;
		cursor: pointer;
		touch-action: manipulation;
	}
	.tile.selected {
		position: relative;
		z-index: 1;
		outline: 5px solid var(--focus);
		outline-offset: -5px;
	}
	.puzzle-board.complete .tile {
		border-color: transparent;
	}
	.status {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 4px 16px;
		min-height: 24px;
		text-align: center;
		font-size: clamp(14px, 1.5vw, 18px);
	}
	.status strong {
		color: var(--learn-green);
	}
	.action {
		min-height: 40px;
	}
	@media (max-height: 620px) {
		.puzzle-scene {
			justify-content: flex-start;
		}
		.puzzle-board {
			width: min(38vh, 340px, 78vw);
		}
	}
	@media (max-width: 420px) {
		.puzzle-board {
			width: min(42vh, 86vw);
		}
		.picture-choice,
		.level-picker button {
			padding-inline: 10px;
		}
	}
</style>
