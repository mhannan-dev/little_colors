<script lang="ts">
	/**
	 * Picture-first choice of what to learn: ABC, অআই or ১২৩. The glyphs are the picture,
	 * and each card says its name on hover/focus, so no reading is needed (PR-26).
	 */
	import { formatNumeral, narrationText, type SymbolSet } from '@little-colors/core';
	import { speakLabel } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';

	let { onpick, onfree }: { onpick: (set: SymbolSet) => void; /** Shows a 4th card: drive freely, no questions. */ onfree?: () => void } = $props();

	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const cards = $derived<{ set: SymbolSet; glyphs: string; color: string }[]>([
		{ set: 'abc', glyphs: 'ABC', color: 'var(--learn-red)' },
		{ set: 'bangla', glyphs: 'অআই', color: 'var(--learn-blue)' },
		{ set: '123', glyphs: `${num(1)}${num(2)}${num(3)}`, color: 'var(--learn-green)' }
	]);
	const name = (set: SymbolSet) => narrationText(`play3d.set.${set}`, $settings.language, true);

	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	function hover(e: PointerEvent, set: SymbolSet) {
		if (e.pointerType !== 'mouse') return;
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = setTimeout(() => speakLabel(`play3d.set.${set}`), 600);
	}
	const unhover = () => hoverTimer && clearTimeout(hoverTimer);
</script>

	<div class="picker" class:reduced={$settings.reducedMotion}>
	<div class="intro"><span aria-hidden="true">✦</span><h1>{$settings.language === 'bn-BD' ? 'আজ কী নিয়ে খেলব?' : 'What shall we play with?'}</h1><p>{$settings.language === 'bn-BD' ? 'পছন্দের কার্ডে ট্যাপ করি, একসঙ্গে শিখি।' : 'Pick a card. Let’s learn and explore together.'}</p></div>
	{#each cards as c (c.set)}
		<button
			class="card"
			style:--card={c.color}
			data-set={c.set}
			aria-label={name(c.set)}
			onpointerenter={(e) => hover(e, c.set)}
			onpointerleave={unhover}
			onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel(`play3d.set.${c.set}`)}
			onclick={() => {
				unhover();
				onpick(c.set);
			}}
		>
			<span class="cubes" aria-hidden="true">
				{#each [...c.glyphs] as g, i (i)}
					<span class="cube" style:--i={i}>{g}</span>
				{/each}
			</span>
			<span class="name">{name(c.set)}</span>
			<span class="start" aria-hidden="true">↗</span>
		</button>
	{/each}
	{#if onfree}
		<button
			class="card"
			style:--card="var(--learn-orange)"
			data-set="free"
			aria-label={narrationText('race.free.card', $settings.language, true)}
			onpointerenter={(e) => {
				if (e.pointerType !== 'mouse') return;
				if (hoverTimer) clearTimeout(hoverTimer);
				hoverTimer = setTimeout(() => speakLabel('race.free.card'), 600);
			}}
			onpointerleave={unhover}
			onfocus={(e) => (e.target as HTMLElement).matches(':focus-visible') && speakLabel('race.free.card')}
			onclick={() => {
				unhover();
				onfree?.();
			}}
		>
			<span class="cubes" aria-hidden="true"><span class="cube free">🏎️</span><span class="cube free">🎈</span></span>
			<span class="name">{narrationText('race.free.card', $settings.language, true)}</span>
			<span class="start" aria-hidden="true">↗</span>
		</button>
	{/if}
</div>

<style>
	.picker {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 24px;
		padding: 24px;
		align-content: center;
		width: 100%;
		background: radial-gradient(ellipse at 50% 35%, #e9f3ec 0, transparent 65%);
	}
	.intro { flex-basis: 100%; text-align: center; margin-bottom: 16px; }
	.intro > span { color: var(--learn-green); font-size: 30px; }
	h1 { margin: 4px 0; font-size: 34px; line-height: 1.25; }
	p { margin: 8px 0 0; color: var(--text-secondary); font-size: 19px; }
	.card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 18px;
		padding: 32px 20px 54px;
		border: 2px solid color-mix(in srgb, var(--card) 25%, var(--border-soft));
		border-radius: var(--radius-xl);
		background: linear-gradient(155deg, var(--surface) 40%, color-mix(in srgb, var(--card) 9%, var(--surface)));
		box-shadow: var(--panel-shadow), inset 0 3px 0 var(--surface);
		cursor: pointer;
		transition: transform 250ms ease, border-color 250ms ease;
	}
	.card:hover,
	.card:focus-visible {
		transform: translateY(-6px);
		border-color: var(--card);
	}
	.card:active { transform: translateY(1px); }
	.start { position: absolute; bottom: 14px; right: 18px; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: color-mix(in srgb, var(--card) 12%, var(--surface)); color: var(--text-primary); font-size: 20px; }
	.cubes {
		display: flex;
		gap: 10px;
	}
	.cube {
		display: grid;
		place-items: center;
		width: clamp(56px, 5vw, 76px);
		height: clamp(56px, 5vw, 76px);
		border-radius: 16px;
		background: var(--card);
		box-shadow: inset 0 0 0 9px var(--card), inset 0 0 0 40px var(--surface), 0 6px 0 rgba(0, 0, 0, 0.15);
		font-size: 44px;
		font-weight: 700;
		color: var(--text-primary);
		transform: translateY(calc(var(--i) * -6px));
	}
	.cube.free {
		font-size: 40px;
	}
	.card[data-set='bangla'] .cube { font-size: 34px; }
	.name {
		font-size: 24px;
		font-weight: 700;
		color: var(--text-primary);
	}
	@media (prefers-reduced-motion: reduce) {
		.card {
			transition: none;
		}
		.card:hover, .card:active { transform: none; }
	}
	.reduced .card { transition: none; } .reduced .card:hover, .reduced .card:active { transform: none; }
	@media(max-height:700px) { .intro { margin-bottom: 0; } .intro > span { display: none; } .card { padding-top: 24px; padding-bottom: 42px; } }
</style>
