<script lang="ts">
	import { goto } from '$app/navigation';
	import { asset } from '$app/paths';
	import TopBar from '#lib/components/ui/TopBar.svelte';

	let frame = $state<HTMLIFrameElement>();

	function onmessage(event: MessageEvent) {
		if (event.origin === window.location.origin && event.source === frame?.contentWindow &&
			event.data === 'formula-circuit-back') {
			void goto('/play');
		}
	}
</script>

<svelte:window {onmessage} />
<TopBar />
<section aria-label="Formula Circuit">
	<div class="heading">
		<h1>Formula Circuit</h1>
		<p>WASD / arrows · R reset · F3 colliders · Esc back</p>
	</div>
	<!-- Leaving the route destroys the iframe and its Bevy event loop. -->
	<iframe bind:this={frame} src={asset('formula-circuit-web/index.html')} title="Formula Circuit"></iframe>
</section>

<style>
	section { flex: 1; min-height: 0; padding: 0 18px 16px; display: flex; flex-direction: column; }
	.heading { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 6px 16px; }
	h1 { margin: 0; font-size: 34px; }
	p { margin: 0 0 8px; }
	iframe { width: 100%; flex: 1; min-height: 0; border: 2px solid var(--border-soft); border-radius: 14px; background: #182a39; }
</style>
