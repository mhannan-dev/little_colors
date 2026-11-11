<script lang="ts">
	import SoccerMatch from '#lib/features/world-soccer/SoccerMatch.svelte';
	import { settings } from '#lib/stores/settings.ts';
</script>

<svelte:head><title>World Soccer Cup · Rumi Learning Adventures</title></svelte:head>
<SoccerMatch backHref="/play" initialLanguage={$settings.language === 'bn-BD' ? 'bn' : 'en'} initiallyMuted={!$settings.soundEnabled} />
