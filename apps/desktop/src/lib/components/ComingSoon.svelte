<script lang="ts">
	// DEV PLACEHOLDER: shown for game modes that are not built yet (Phase 3 / 3B).
	import { onMount } from 'svelte';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { caption, say } from '#lib/audio/narrator.ts';

	onMount(() => say('mode.coming-soon'));
</script>

<TopBar />
<section>
	<Mascot state="thinking" size={240} />
	<p>{$caption}</p>
</section>

<style>
	section {
		flex: 1;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 16px;
		font-size: 32px;
		font-weight: 600;
	}
	p {
		margin: 0;
	}
</style>
