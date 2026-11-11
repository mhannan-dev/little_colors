<script lang="ts">
	/**
	 * Shown while a screen is loading (a game's code or 3D kit), instead of a blank page.
	 * Rumi bounces gently; no text is needed (PR-26). Appears only after a short delay so
	 * fast loads never flash.
	 */
	import { onMount } from 'svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';

	let { delay = 250, overlay = false }: { delay?: number; overlay?: boolean } = $props();
	let visible = $state(false);
	onMount(() => {
		const t = setTimeout(() => (visible = true), delay);
		return () => clearTimeout(t);
	});
</script>

{#if visible}
	<div class="loading" class:overlay role="status" aria-label="লোড হচ্ছে / Loading" data-testid="rumi-loading">
		<div class="hop"><Mascot state="wave" size={150} /></div>
		<div class="dots" aria-hidden="true"><span></span><span></span><span></span></div>
	</div>
{/if}

<style>
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 14px;
		width: 100%;
		height: 100%;
		min-height: 240px;
		background: var(--bg-primary);
		animation: fade 300ms ease-out;
	}
	.loading.overlay {
		position: absolute;
		inset: 0;
		z-index: 20;
	}
	.hop {
		animation: hop 900ms ease-in-out infinite alternate;
	}
	.dots {
		display: flex;
		gap: 10px;
	}
	.dots span {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--learn-orange);
		animation: dot 900ms ease-in-out infinite;
	}
	.dots span:nth-child(2) {
		background: var(--learn-green);
		animation-delay: 150ms;
	}
	.dots span:nth-child(3) {
		background: var(--learn-blue);
		animation-delay: 300ms;
	}
	@keyframes hop {
		from { transform: translateY(0); }
		to { transform: translateY(-14px); }
	}
	@keyframes dot {
		0%, 100% { transform: scale(0.7); opacity: 0.5; }
		50% { transform: scale(1); opacity: 1; }
	}
	@keyframes fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@media (prefers-reduced-motion: reduce) {
		.hop, .dots span, .loading { animation: none; }
	}
</style>
