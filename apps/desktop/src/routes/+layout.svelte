<script lang="ts">
	import '#lib/styles/global.css';
	import favicon from '#lib/assets/favicon.svg';
	import { toCssVariables } from '@little-colors/design-tokens';
	import { onMount } from 'svelte';
	import { installDesktopBehavior } from '#lib/desktop.ts';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const tokens = `<style>:root{${toCssVariables('light')}}</style>`;

	// DS-40 / OF-15: designed at 1280×800; scale up proportionally on larger windows (max 1.6×).
	const BASE_W = 1280;
	const BASE_H = 800;
	let scale = $state(1);
	let viewportH = $state(800);
	function fit() {
		viewportH = window.innerHeight;
		scale = Math.min(1.6, Math.max(1, Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H)));
	}

	onMount(() => {
		fit();
		window.addEventListener('resize', fit);
		const off = installDesktopBehavior();
		return () => {
			window.removeEventListener('resize', fit);
			off();
		};
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Little Colors</title>
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- static tokens from design-tokens -->
	{@html tokens}
</svelte:head>

<main style:zoom={scale} style:height="{viewportH / scale}px">
	{@render children()}
</main>

<style>
	main {
		height: 100vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
</style>
