<script lang="ts">
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import CounterRush from '#lib/features/counter-rush/App.svelte';
</script>

<TopBar />
<section class="kitchen" aria-label="Counter Rush"><CounterRush embedded /></section>

<style>
	.kitchen { flex: 1; min-height: 0; overflow: auto; }
</style>
