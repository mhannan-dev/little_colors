<script lang="ts">
	import { goto } from '$app/navigation';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import { say } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';

	// SC-02: the Play tap is the first user gesture, so narration may start after it.
	function play() {
		say('welcome.hello', { interrupt: true });
		goto('/play');
	}
</script>

<section class="welcome">
	<h1>
		<span style:color="var(--learn-red)">ছো</span><span style:color="var(--learn-yellow)">ট্ট</span>
		<span style:color="var(--learn-blue)">রং</span>
	</h1>
	<p class="sub">Little Colors</p>
	<Mascot state="wave" size={260} />
	<GameButton label={t('play', $settings.language)} onclick={play}>
		<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true"><path d="M7 4 L20 12 L7 20 Z" fill="currentColor" /></svg>
	</GameButton>
</section>

<style>
	.welcome {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: var(--bg-primary);
	}
	h1 {
		margin: 0;
		font-size: clamp(56px, 8vw, 96px);
		line-height: 1;
		-webkit-text-stroke: 2px var(--text-primary);
	}
	.sub {
		margin: 0;
		color: var(--text-secondary);
		font-size: 24px;
		font-weight: 600;
	}
</style>
