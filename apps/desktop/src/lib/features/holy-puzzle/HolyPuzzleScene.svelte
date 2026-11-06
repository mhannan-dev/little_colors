<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatNumeral } from '@little-colors/core';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	type PuzzlePicture = {
		id: 'mosque' | 'kaaba' | 'sixty-dome' | 'star-mosque' | 'baitul-mukarram' | 'nabawi';
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
		},
		// Original, simplified drawings of well-known mosques (Bangladesh first). Respectful
		// depiction only: pieces are gently placed, never thrown or hit (PR-13). Needs content
		// review before release (SM-02, AU-42).
		{
			id: 'sixty-dome',
			label: { bn: 'ষাট গম্বুজ মসজিদ', en: 'Sixty Dome Mosque' },
			image: svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
				<defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#cfeefa"/><stop offset="1" stop-color="#fdf1dc"/></linearGradient></defs>
				<rect width="600" height="600" fill="url(#s)"/>
				<circle cx="90" cy="96" r="38" fill="#ffd66b"/>
				<path d="M0 470Q300 440 600 470v130H0" fill="#8bcf9c"/>
				<g fill="#b9563b" stroke="#6b2f22" stroke-width="5">
					${Array.from({ length: 11 }, (_, i) => `<path d="M${70 + i * 46} 262a23 23 0 0 1 46 0z"/>`).join('')}
				</g>
				<g fill="#c9643f" stroke="#6b2f22" stroke-width="5">
					${Array.from({ length: 10 }, (_, i) => `<path d="M${93 + i * 46} 286a23 23 0 0 1 46 0z"/>`).join('')}
				</g>
				<path d="M60 286Q300 270 540 286V478H60z" fill="#c4623f" stroke="#6b2f22" stroke-width="8"/>
				<path d="M60 300Q300 284 540 300" fill="none" stroke="#8f3f2b" stroke-width="6"/>
				<g fill="#5a2a1f">
					${Array.from({ length: 7 }, (_, i) => `<path d="M${118 + i * 58} 478v-80a20 22 0 0 1 40 0v80z"/>`).join('')}
				</g>
				<g fill="#b9563b" stroke="#6b2f22" stroke-width="6">
					<path d="M28 478V270h44v208zM528 478V270h44v208z"/>
					<path d="M28 270a22 24 0 0 1 44 0zM528 270a22 24 0 0 1 44 0z"/>
				</g>
				<path d="M32 330h36M32 390h36M532 330h36M532 390h36" stroke="#8f3f2b" stroke-width="5"/>
				<path d="M40 478h520" stroke="#6b2f22" stroke-width="10" stroke-linecap="round"/>
			</svg>`)
		},
		{
			id: 'star-mosque',
			label: { bn: 'তারা মসজিদ', en: 'Star Mosque' },
			image: svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
				<defs><linearGradient id="t" x2="0" y2="1"><stop stop-color="#bfe3ff"/><stop offset="1" stop-color="#f4f9ff"/></linearGradient>
				<pattern id="st" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="#ffffff"/><path d="M17 5l3.5 8 8.5.7-6.5 5.6 2 8.4L17 23.3 9.5 27.7l2-8.4L5 13.7l8.5-.7z" fill="#2f6fd1"/></pattern></defs>
				<rect width="600" height="600" fill="url(#t)"/>
				<path d="M0 480h600v120H0z" fill="#9fd3a4"/>
				<g stroke="#2a3f5c" stroke-width="7">
					<path d="M150 300a40 46 0 0 1 80 0z" fill="url(#st)"/>
					<path d="M370 300a40 46 0 0 1 80 0z" fill="url(#st)"/>
					<path d="M220 300a80 92 0 0 1 160 0z" fill="url(#st)"/>
					<path d="M70 320a30 34 0 0 1 60 0zM470 320a30 34 0 0 1 60 0z" fill="url(#st)"/>
				</g>
				<path d="M300 208v-34" stroke="#2a3f5c" stroke-width="6"/><circle cx="300" cy="168" r="8" fill="#ffd66b" stroke="#2a3f5c" stroke-width="4"/>
				<path d="M60 300h480v180H60z" fill="url(#st)" stroke="#2a3f5c" stroke-width="8"/>
				<path d="M60 318h480" stroke="#2f6fd1" stroke-width="8"/>
				<g fill="#24365a">
					<path d="M268 480v-82a32 34 0 0 1 64 0v82z"/>
					<path d="M150 480v-62a22 24 0 0 1 44 0v62zM406 480v-62a22 24 0 0 1 44 0v62z"/>
				</g>
				<g fill="#ffffff" stroke="#2a3f5c" stroke-width="6">
					<path d="M44 480V250h28v230zM528 480V250h28v230z"/>
				</g>
				<path d="M44 250l14-26 14 26zM528 250l14-26 14 26z" fill="#2f6fd1" stroke="#2a3f5c" stroke-width="5"/>
			</svg>`)
		},
		{
			id: 'baitul-mukarram',
			label: { bn: 'বায়তুল মোকাররম', en: 'Baitul Mukarram' },
			image: svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
				<defs><linearGradient id="b" x2="0" y2="1"><stop stop-color="#c8ecf7"/><stop offset="1" stop-color="#fff8e6"/></linearGradient></defs>
				<rect width="600" height="600" fill="url(#b)"/>
				<path d="M0 500h600v100H0z" fill="#8bcf9c"/>
				<path d="M60 500h480l-30-24H90zM100 476h400l-26-22H126zM140 454h320l-22-20H162z" fill="#e7dcc6" stroke="#7a6a55" stroke-width="5"/>
				<path d="M170 434V180h260v254z" fill="#fbfaf6" stroke="#5f5a52" stroke-width="9"/>
				<path d="M170 210h260" stroke="#5f5a52" stroke-width="7"/>
				<g fill="#7fb7d6" stroke="#5f5a52" stroke-width="4">
					${[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4].map((c) => `<rect x="${190 + c * 46}" y="${232 + r * 46}" width="30" height="32" rx="4"/>`)).join('')}
				</g>
				<path d="M280 434v-46a20 20 0 0 1 40 0v46z" fill="#5f5a52"/>
				<path d="M486 434V200h26v234z" fill="#fbfaf6" stroke="#5f5a52" stroke-width="6"/>
				<path d="M486 200l13-24 13 24z" fill="#3d9a7d" stroke="#5f5a52" stroke-width="4"/>
				<ellipse cx="110" cy="440" rx="46" ry="12" fill="#a9dcef" stroke="#7a6a55" stroke-width="4"/>
				<path d="M110 440v-30" stroke="#a9dcef" stroke-width="6" stroke-linecap="round"/>
			</svg>`)
		},
		{
			id: 'nabawi',
			label: { bn: 'মসজিদে নববী', en: 'Masjid an-Nabawi' },
			image: svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
				<defs><linearGradient id="n" x2="0" y2="1"><stop stop-color="#bfe6f5"/><stop offset="1" stop-color="#fff4dc"/></linearGradient></defs>
				<rect width="600" height="600" fill="url(#n)"/>
				<path d="M0 490h600v110H0z" fill="#e8dcc0"/>
				<g fill="#f6efe2" stroke="#7d6a52" stroke-width="6">
					<path d="M86 490V170h30v320zM484 490V170h30v320z"/>
				</g>
				<path d="M80 236h42M80 300h42M478 236h42M478 300h42" stroke="#7d6a52" stroke-width="6"/>
				<path d="M86 170l15-40 15 40zM484 170l15-40 15 40z" fill="#d9c39a" stroke="#7d6a52" stroke-width="5"/>
				<path d="M130 490V330h340v160z" fill="#f6efe2" stroke="#7d6a52" stroke-width="8"/>
				<g fill="#c9b58e">
					${Array.from({ length: 7 }, (_, i) => `<path d="M${146 + i * 46} 490v-80a17 22 0 0 1 34 0v80z"/>`).join('')}
				</g>
				<path d="M250 330a50 58 0 0 1 100 0z" fill="#3aa070" stroke="#24563f" stroke-width="7"/>
				<path d="M246 330h108" stroke="#24563f" stroke-width="8"/>
				<path d="M300 272v-22" stroke="#b9902f" stroke-width="6"/><circle cx="300" cy="244" r="7" fill="#e3bd52"/>
				<path d="M160 330a26 28 0 0 1 52 0zM388 330a26 28 0 0 1 52 0z" fill="#e9dcc3" stroke="#7d6a52" stroke-width="5"/>
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
			>
				<!-- Picture first, so a child who can't read can still choose (PR-25). -->
				<span class="thumb" style={`background-image:${item.image}`} aria-hidden="true"></span>
				<span class="choice-label">{lang === 'bn-BD' ? item.label.bn : item.label.en}</span>
			</button>
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

	<div class="board-row">
	<!-- The finished picture to aim for. -->
	<div class="target-preview" style={`background-image:${picture.image}`} aria-hidden="true" data-testid="puzzle-preview"></div>
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
	</div>

	<div class="status" aria-live="polite">
		{#if solved}
			<strong>{lang === 'bn-BD' ? 'দারুণ! পাজলটি মিলে গেছে!' : 'Wonderful! Puzzle complete!'}</strong>
		{:else}
			<span>{lang === 'bn-BD' ? `চাল: ${formatNumeral(moves, $settings.numeralStyle)}` : `Moves: ${formatNumeral(moves, $settings.numeralStyle)}`}</span>
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
	/* Six pictures: one scrollable row so the board always stays on screen. */
	.picture-picker {
		flex-wrap: nowrap;
		justify-content: flex-start;
		max-width: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 6px 6px 8px; /* room for the active border; overflow-x would clip it */
		scrollbar-width: thin;
	}
	.picture-choice {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 4px 8px;
		min-width: 76px;
	}
	.thumb {
		width: 56px;
		height: 56px;
		border-radius: 10px;
		background-size: cover;
		background-position: center;
		box-shadow: inset 0 0 0 1px rgb(0 0 0 / 10%);
	}
	.choice-label {
		font-size: clamp(12px, 1.3vw, 15px);
		line-height: 1.15;
		white-space: nowrap;
	}
	.board-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}
	.target-preview {
		width: clamp(70px, 12vh, 120px);
		aspect-ratio: 1;
		flex: 0 0 auto;
		border: 3px solid var(--surface);
		border-radius: 12px;
		background-size: cover;
		box-shadow: 0 3px 10px rgb(0 0 0 / 12%);
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
	@media (max-width: 600px) {
		.target-preview {
			display: none; /* the board needs the width on phones */
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
