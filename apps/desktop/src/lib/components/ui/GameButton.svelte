<script lang="ts" module>
	import type { IconName } from './Icon.svelte';
	import type { UiKey } from '#lib/i18n.ts';

	/** Standard child-facing actions: icon + color + spoken name, so no reading is needed (PR-26). */
	export type GameAction = 'play' | 'next' | 'replay' | 'choose-game' | 'hint' | 'reset';

	const ACTIONS: Record<GameAction, { icon: IconName; label: UiKey; speak: string; tone: 'go' | 'primary' | 'secondary' }> = {
		play: { icon: 'play', label: 'play', speak: 'ui.play', tone: 'go' },
		next: { icon: 'next', label: 'next', speak: 'ui.next', tone: 'go' },
		replay: { icon: 'replay', label: 'replayRound', speak: 'ui.replay', tone: 'primary' },
		'choose-game': { icon: 'choose-game', label: 'chooseGame', speak: 'ui.choose-game', tone: 'secondary' },
		hint: { icon: 'hint', label: 'hint', speak: 'ui.hint', tone: 'secondary' },
		reset: { icon: 'reset', label: 'reset', speak: 'ui.reset', tone: 'secondary' }
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { speakLabel } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	let {
		onclick,
		action,
		label,
		variant,
		size = 'large',
		children
	}: {
		onclick: () => void;
		/** Preferred: picks icon, color, text, and spoken name. */
		action?: GameAction;
		label?: string;
		variant?: 'primary' | 'secondary' | 'go';
		size?: 'large' | 'small';
		children?: Snippet;
	} = $props();

	const spec = $derived(action ? ACTIONS[action] : undefined);
	const text = $derived(label ?? (spec ? t(spec.label, $settings.language) : ''));
	const tone = $derived(variant ?? spec?.tone ?? 'primary');

	// Hearing the name: on keyboard focus, or after resting the mouse on it briefly.
	let hoverTimer: ReturnType<typeof setTimeout> | null = null;
	const cancelHover = () => {
		if (hoverTimer) clearTimeout(hoverTimer);
		hoverTimer = null;
	};
	// A button that disappears (next screen) must not speak later.
	$effect(() => () => cancelHover());
	function onpointerenter(e: PointerEvent) {
		if (!spec || e.pointerType !== 'mouse') return;
		cancelHover();
		hoverTimer = setTimeout(() => speakLabel(spec.speak), 700);
	}
	function onfocus(e: FocusEvent) {
		if (spec && (e.target as HTMLElement).matches(':focus-visible')) speakLabel(spec.speak);
	}
</script>

<button
	class="game-button {tone} {size}"
	class:has-icon={!!spec}
	aria-label={text}
	data-action={action}
	onclick={() => {
		cancelHover();
		onclick();
	}}
	{onpointerenter}
	onpointerleave={cancelHover}
	{onfocus}
>
	{#if spec}<Icon name={spec.icon} size={size === 'large' ? 44 : 30} />{/if}
	{#if children}{@render children()}{/if}
	<span class="text">{text}</span>
</button>

<style>
	.game-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-width: var(--target-min);
		min-height: var(--target-min);
		border: 4px solid transparent;
		border-radius: var(--radius-xl);
		cursor: pointer;
		font-weight: 700;
		transition: transform 150ms ease;
	}
	.game-button:hover {
		transform: translateY(-2px);
	}
	.game-button:active {
		transform: translateY(1px);
	}
	.large {
		min-height: var(--target-game);
		padding: 12px 40px;
		font-size: 32px;
	}
	.small {
		padding: 6px 18px;
		font-size: 20px;
	}
	/* With an icon, the picture leads and the word is a small helper for adults. */
	.has-icon.large {
		padding: 10px 30px;
		font-size: 24px;
	}
	.has-icon.small {
		font-size: 18px;
	}
	.primary {
		background: var(--text-primary);
		color: var(--bg-primary);
	}
	.secondary {
		background: var(--surface);
		border-color: var(--border-soft);
		color: var(--text-primary);
	}
	/* "Go" actions (play, next) are always the green arrow, a cue Rumi can name aloud. */
	.go {
		background: var(--learn-green);
		border-color: var(--text-primary);
		color: #fff;
	}
</style>
