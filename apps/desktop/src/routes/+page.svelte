<script lang="ts">
	import { goto } from '$app/navigation';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import LanguageSwitcher from '#lib/components/ui/LanguageSwitcher.svelte';
	import { say } from '#lib/audio/narrator.ts';
	import { t } from '#lib/i18n.ts';
	import { settings } from '#lib/stores/settings.ts';

	const secondaryLanguage = $derived($settings.language === 'bn-BD' ? 'en-US' : 'bn-BD');

	// SC-02: the Play tap is the first user gesture, so narration may start after it.
	function play() {
		say('welcome.hello', { interrupt: true });
		goto('/play');
	}
</script>

<section class="welcome">
	<LanguageSwitcher />
	<h1 lang={$settings.language}>{t('appName', $settings.language)}</h1>
	<p class="sub" lang={secondaryLanguage}>{t('appName', secondaryLanguage)}</p>
	<Mascot state="wave" size={260} />
	<GameButton action="play" onclick={play} />
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
		max-width: 95%;
		font-size: clamp(48px, 7vw, 88px);
		line-height: 1.2;
		text-align: center;
		color: var(--learn-blue);
		-webkit-text-stroke: 2px var(--text-primary);
	}
	.sub {
		margin: 0;
		color: var(--text-secondary);
		font-size: 24px;
		font-weight: 600;
	}
</style>
