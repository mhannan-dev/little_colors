<script lang="ts">
	// Dev-only voice recording studio. Not linked from the child UI; absent from release builds' logic.
	import RecordStudio from '#lib/record/RecordStudio.svelte';
	const dev = import.meta.env.DEV;
</script>

{#if dev}
	<RecordStudio />
{:else}
	<p style="padding:24px">Recording is available only in development mode.</p>
{/if}
