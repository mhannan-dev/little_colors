<script lang="ts">
	import { goto } from '$app/navigation';
	import Mascot from '#lib/components/mascot/Mascot.svelte';
	import GameButton from '#lib/components/ui/GameButton.svelte';
	import { say } from '#lib/audio/narrator.ts';

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
