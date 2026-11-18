<script lang="ts">
	import { onMount } from 'svelte';
	import { advanceBall, aimAt, GOAL, kick, lastHighlight, moveKeeper, nextHighlight, opponentShot, pass, roundNumber, startMatch, TEAMS, type Point, type Result, type Team } from './match.ts';

	let { backHref, initialLanguage = 'en', initiallyMuted = false }: { backHref?: string; initialLanguage?: 'en' | 'bn'; initiallyMuted?: boolean } = $props();
	let language = $state<'en' | 'bn'>('en');
	let home = $state<Team>(TEAMS[0]);
	let away = $state<Team>(TEAMS[1]);
	let match = $state(startMatch());
	let started = $state(false);
	let muted = $state(false);
	let drag = $state<{ id: number; start: Point; end: Point } | null>(null);
	let pitch: SVGSVGElement;
	let audio: AudioContext | undefined;
	const tr = (en: string, bn: string) => language === 'bn' ? bn : en;
	const teamName = (team: Team) => tr(team.en, team.bn);
	const digit = (n: number) => n.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US');
	const attackTeam = $derived(match.attacking ? home : away);
	const defenseTeam = $derived(match.attacking ? away : home);
	const resultText: Record<Result, [string, string]> = {
		goal: ['Goal!', 'গোল!'], saved: ['Saved by the keeper!', 'গোলকিপার ঠেকিয়েছে!'],
		blocked: ['Blocked by a defender', 'ডিফেন্ডার বল ঠেকিয়েছে'], wide: ['The ball went out', 'বল মাঠের বাইরে গেছে']
	};
	const status = $derived(!started ? tr('Choose two teams', 'দুটি দল বেছে নাও') : match.phase === 'finished'
		? match.home === match.away ? tr('Match drawn', 'ম্যাচ ড্র') : tr(`${teamName(match.home > match.away ? home : away)} wins`, `${teamName(match.home > match.away ? home : away)} জিতেছে`)
		: match.phase === 'result' && match.result ? tr(...resultText[match.result])
		: match.phase === 'attack' ? tr('Your attack', 'তোমার আক্রমণ') : tr('You’re the goalkeeper', 'তুমি গোলকিপার'));
	const ready = $derived(started && !match.flight && match.phase === 'attack');

	function playSound(kind: 'kick' | 'goal' | 'whistle') {
		if (muted || typeof AudioContext === 'undefined') return;
		try {
			audio ??= new AudioContext();
			if (audio.state === 'suspended') void audio.resume().catch(() => {});
			const osc = audio.createOscillator();
			const gain = audio.createGain();
			const now = audio.currentTime;
			const duration = kind === 'kick' ? 0.09 : 0.23;
			osc.frequency.setValueAtTime(kind === 'kick' ? 140 : kind === 'goal' ? 520 : 1160, now);
			osc.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 48 : kind === 'goal' ? 780 : 940, now + duration);
			gain.gain.setValueAtTime(0.045, now);
			gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
			osc.connect(gain).connect(audio.destination);
			osc.start(now);
			osc.stop(now + duration);
		} catch { /* The match can run without audio. */ }
	}

	function begin() {
		match = startMatch();
		started = true;
		playSound('whistle');
	}
	function chooseHome(team: Team) {
		if (team.code === away.code) away = home;
		home = team;
	}
	function fieldPoint(event: PointerEvent): Point {
		const matrix = pitch.getScreenCTM();
		return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
	}
	function pointerDown(event: PointerEvent) {
		if (!started || event.button !== 0 || drag || (match.phase !== 'defend' && !ready)) return;
		const point = fieldPoint(event);
		pitch.setPointerCapture(event.pointerId);
		drag = { id: event.pointerId, start: point, end: point };
		if (match.phase === 'defend') moveKeeper(match, point.x);
	}
	function pointerMove(event: PointerEvent) {
		if (drag?.id !== event.pointerId) return;
		drag.end = fieldPoint(event);
		if (match.phase === 'defend') moveKeeper(match, drag.end.x);
	}
	function pointerUp(event: PointerEvent) {
		if (drag?.id !== event.pointerId) return;
		const end = fieldPoint(event);
		const direction = { x: end.x - drag.start.x, y: end.y - drag.start.y };
		drag = null;
		if (!ready) return;
		const distance = Math.hypot(direction.x, direction.y);
		if (distance > 15) {
			if (kick(match, direction, Math.min(885, 625 + distance * 0.85))) playSound('kick');
			return;
		}
		const teammate = match.players.findIndex((p, i) => i !== match.owner && Math.hypot(p.x - end.x, p.y - end.y) < 34);
		if (teammate !== -1) {
			if (pass(match, teammate)) playSound('kick');
		} else if (end.y < 118 && end.x > GOAL.left - 15 && end.x < GOAL.right + 15) {
			if (aimAt(match, end.x)) playSound('kick');
		}
	}
	function useLane(x: number) {
		if (match.phase === 'defend') moveKeeper(match, x);
		else if (aimAt(match, x)) playSound('kick');
	}

	onMount(() => {
		language = initialLanguage;
		muted = initiallyMuted;
		let frame = 0;
		let previous = performance.now();
		function tick(now: number) {
			if (match.flight && !document.hidden) {
				advanceBall(match, (now - previous) / 1000);
				if (match.result === 'goal') playSound('goal');
			}
			previous = now;
			frame = requestAnimationFrame(tick);
		}
		frame = requestAnimationFrame(tick);
		return () => { cancelAnimationFrame(frame); if (audio) void audio.close().catch(() => {}); };
	});
</script>

{#snippet player(point: Point, team: Team, number: number, keeper = false, active = false)}
	<g transform="translate({point.x} {point.y})">
		<ellipse cx="3" cy="8" rx="21" ry="14" fill="#082e2666" />
		{#if active}<ellipse rx="25" ry="22" fill="none" stroke="#ffdf79" stroke-width="3" stroke-dasharray="5 3" />{/if}
		<path d="M-7 8v13m14-13v13" stroke="#273d4b" stroke-width="8" stroke-linecap="round" />
		<path d="M-8 15v4m16-4v4" stroke={team.primary} stroke-width="6" />
		<path d="M-12-3l-7 10m31-10l7 10" stroke={keeper ? '#ffae65' : team.primary} stroke-width="8" stroke-linecap="round" />
		<rect x="-13" y="-9" width="26" height="24" rx="7" fill={keeper ? '#e6864e' : team.primary} stroke={keeper ? '#913d26' : team.trim} stroke-width="2" />
		<circle cy="-11" r="9" fill={number % 2 ? '#d5a37d' : '#a86a4d'} />
		<path d="M-8-12q0-10 8-10t8 10q-7-4-16 0" fill="#242a31" />
		<text x="0" y="9" text-anchor="middle" font-size="10" font-weight="800" fill={team.code === 'BAN' || keeper ? 'white' : '#203640'}>{number}</text>
	</g>
{/snippet}

<section class="soccer" lang={language === 'bn' ? 'bn-BD' : 'en'}>
	<header class="masthead">
		{#if backHref}<a href={backHref} class="back" aria-label={tr('Back to games', 'খেলার মেনুতে ফিরি')}>←</a>{/if}
		<div class="brand"><span class="brand-ball" aria-hidden="true">⚽</span><div><p>{tr('INTERNATIONAL FOOTBALL', 'আন্তর্জাতিক ফুটবল')}</p><h1>{tr('World Soccer Cup', 'বিশ্ব ফুটবল কাপ')}</h1></div></div>
		<div class="settings"><button onclick={() => language = language === 'en' ? 'bn' : 'en'}>{tr('বাংলা', 'English')}</button><button aria-label={tr('Mute sound', 'শব্দ বন্ধ')} aria-pressed={muted} onclick={() => muted = !muted}>{muted ? '🔇' : '♪'}</button></div>
	</header>
	<div class="stadium" class:setup={!started}>
		<div class="field-side">
			<div class="scoreboard" aria-label={`${teamName(home)} ${match.home}, ${teamName(away)} ${match.away}`}>
				<div class="side"><i style:--team={home.primary}></i><strong>{home.code}</strong></div>
				<div class="goals"><span>{digit(match.home)}</span><b>:</b><span>{digit(match.away)}</span></div>
				<div class="side"><strong>{away.code}</strong><i style:--team={away.primary}></i></div>
			</div>
			<!-- The pitch is a custom pointer control. Every action also has a button in the match panel. -->
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_static_element_interactions -->
			<svg class="pitch" bind:this={pitch} viewBox="0 0 600 661" aria-label={tr('Soccer pitch', 'ফুটবল মাঠ')} role="application"
				onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={() => drag = null} onlostpointercapture={() => drag = null}>
				<defs>
					<pattern id="soccer-seats" width="12" height="11" patternUnits="userSpaceOnUse"><rect width="9" height="6" rx="2" fill="#8a9c9b" opacity=".35" /><rect x="2" y="1" width="3" height="2" rx="1" fill="#c5d6b0" opacity=".5" /></pattern>
					<pattern id="soccer-grass" width="524" height="112" patternUnits="userSpaceOnUse"><rect width="524" height="112" fill="#398252" /><rect width="524" height="56" fill="#44945c" /></pattern>
					<pattern id="soccer-net" width="10" height="9" patternUnits="userSpaceOnUse"><path d="M0 0h10v9" fill="none" stroke="#e9f6e8" stroke-width="1" opacity=".55" /></pattern>
					<linearGradient id="soccer-shade" x2="0" y2="1"><stop stop-color="#132b34" stop-opacity=".24" /><stop offset=".45" stop-color="#ffffff" stop-opacity="0" /><stop offset="1" stop-color="#132b34" stop-opacity=".16" /></linearGradient>
				</defs>
				<rect width="600" height="661" rx="22" fill="#263e46" />
				<rect x="12" y="11" width="576" height="43" rx="8" fill="url(#soccer-seats)" />
				<rect x="12" y="61" width="576" height="585" rx="10" fill="#234f46" />
				<rect x="38" y="76" width="524" height="555" fill="url(#soccer-grass)" />
				<rect x="38" y="76" width="524" height="555" fill="url(#soccer-shade)" />
				<g fill="none" stroke="#e9f3dd" stroke-width="3" opacity=".84">
					<path d="M38 76h524v555H38z M126 76v154h348V76 M202 76v65h196V76 M38 631h524" />
					<path d="M240 230a67 67 0 0 0 120 0M218 631a82 82 0 0 1 164 0" />
					<path d="M38 90a14 14 0 0 0 14-14M548 76a14 14 0 0 0 14 14" />
				</g>
				<circle cx="300" cy="185" r="3" fill="#e9f3dd" />
				<rect x="210" y="51" width="180" height="25" fill="#daeedd29" />
				<rect x="210" y="51" width="180" height="25" fill="url(#soccer-net)" stroke="#f4fbf5" stroke-width="4" />
				{#if started && match.phase === 'defend'}<path d="M217 112h166" stroke="#ffdf79" stroke-width="2" stroke-dasharray="4 6" opacity=".7" />{/if}
				{@render player({ x: match.keeperX, y: GOAL.keeperY }, defenseTeam, 1, true, started && !match.attacking)}
				{#if match.attacking}
					{#each match.defenders as p, i}{@render player(p, defenseTeam, i + 2)}{/each}
					{#each match.players as p, i}{@render player(p, attackTeam, [10, 7, 11, 9][i], false, started && match.owner === i)}{/each}
				{:else}
					{@render player(match.players[0], attackTeam, 10)}
					{@render player({ x: 165, y: 297 }, defenseTeam, 4)}
					{@render player({ x: 443, y: 320 }, attackTeam, 7)}
				{/if}
				{#if drag && ready}
					<path d="M{match.ball.x} {match.ball.y}l{drag.end.x - drag.start.x} {drag.end.y - drag.start.y}" stroke="#ffec9f" stroke-width="4" stroke-dasharray="7 7" stroke-linecap="round" />
				{/if}
				{#if match.flight}<path d="M{match.ball.x} {match.ball.y}l{-match.flight.vx * .04} {-match.flight.vy * .04}" stroke="#fff6c8" stroke-opacity=".55" stroke-width="4" stroke-linecap="round" />{/if}
				<g transform="translate({match.ball.x} {match.ball.y + (match.flight ? 0 : 13)})"><ellipse cy="5" rx="8" ry="5" fill="#163b2b77" /><circle r="6" fill="#fffdf4" stroke="#254237" stroke-width="1" /><path d="M0-3l3 2-1 4h-4l-1-4z" fill="#213b34" /></g>
			</svg>
		</div>
		<aside class="panel">
			{#if !started}
				<p class="kicker">{tr('EXHIBITION MATCH', 'প্রদর্শনী ম্যাচ')}</p>
				<h2>{status}</h2>
				<label for="soccer-home">{tr('Your team', 'তোমার দল')}</label>
				<select id="soccer-home" value={home.code} onchange={(e) => chooseHome(TEAMS.find(t => t.code === e.currentTarget.value)!)}>
					{#each TEAMS as team (team.code)}<option value={team.code}>{teamName(team)}</option>{/each}
				</select>
				<label for="soccer-away">{tr('Opponent', 'প্রতিপক্ষ')}</label>
				<select id="soccer-away" value={away.code} onchange={(e) => away = TEAMS.find(t => t.code === e.currentTarget.value)!}>
					{#each TEAMS as team (team.code)}<option value={team.code} disabled={team.code === home.code}>{teamName(team)}</option>{/each}
				</select>
				<button class="primary" onclick={begin}>{tr('Kick off', 'খেলা শুরু')} <span aria-hidden="true">→</span></button>
				<p class="detail">{tr('Take turns attacking and defending in six match highlights.', 'ছয়টি মুহূর্তে পালা করে আক্রমণ ও রক্ষণ করো।')}</p>
			{:else}
				<p class="kicker">{match.phase === 'finished' ? tr('FULL TIME', 'ম্যাচ শেষ') : tr(`ROUND ${digit(roundNumber(match))} OF 3`, `রাউন্ড ${digit(roundNumber(match))} / ৩`)}</p>
				<h2 aria-live="polite">{status}</h2>
				{#if match.phase === 'attack' || match.phase === 'defend'}
					<p class="detail">{match.attacking ? tr('Tap a teammate to pass. Swipe toward the goal to shoot.', 'পাস দিতে সতীর্থকে ট্যাপ করো। শট নিতে গোলের দিকে সোয়াইপ করো।') : tr('Drag the keeper across the goal to stop the shot.', 'শট ঠেকাতে গোলের সামনে গোলকিপারকে টেনে নাও।')}</p>
					<div class="lanes" role="group" aria-label={match.attacking ? tr('Shoot direction', 'শটের দিক') : tr('Keeper position', 'গোলকিপারের জায়গা')}>
						{#each [{ x: 226, icon: '↖', label: tr('Left', 'বাঁয়ে') }, { x: 300, icon: '↑', label: tr('Center', 'মাঝে') }, { x: 374, icon: '↗', label: tr('Right', 'ডানে') }] as lane (lane.x)}
							<button disabled={match.attacking && !ready} onclick={() => useLane(lane.x)}><span aria-hidden="true">{lane.icon}</span>{lane.label}</button>
						{/each}
					</div>
					{#if match.attacking}
						<div class="passes" role="group" aria-label={tr('Pass to a teammate', 'সতীর্থকে পাস দাও')}>
							{#each match.players as _, i (i)}
								{#if i !== match.owner}<button disabled={!ready} onclick={() => { if (pass(match, i)) playSound('kick'); }}>{tr('Pass', 'পাস')} {digit([10, 7, 11, 9][i])}</button>{/if}
							{/each}
						</div>
					{:else}
						<button class="primary" disabled={!!match.flight} onclick={() => { if (opponentShot(match)) playSound('kick'); }}>{tr('Face the shot', 'শট ঠেকাই')} <span aria-hidden="true">→</span></button>
					{/if}
				{:else if match.phase === 'result'}
					<button class="primary" onclick={() => match = nextHighlight(match)}>{lastHighlight(match) ? tr('See final result', 'ফলাফল দেখি') : tr('Next highlight', 'পরের মুহূর্ত')} <span aria-hidden="true">→</span></button>
				{:else}
					<button class="primary" onclick={begin}>{tr('Play again', 'আবার খেলি')} <span aria-hidden="true">→</span></button>
					<button onclick={() => { started = false; match = startMatch(); }}>{tr('Choose teams', 'দল বেছে নাও')}</button>
				{/if}
			{/if}
		</aside>
	</div>
</section>

<style>
	.brand-ball { box-shadow: inset 0 1px 0 #ffffff28, 0 6px 20px #060f1838; }
	.panel { box-shadow: 0 16px 40px #060f1838; }
	.scoreboard { box-shadow: inset 0 1px 0 #ffffff10, 0 8px 20px #060f1830; }
	.pitch { border-radius: 18px; box-shadow: 0 16px 40px #060f1840; }
	.primary { box-shadow: 0 4px 0 #89aa68, 0 8px 18px #060f1830; }
	.soccer { flex: 1; min-height: 100%; padding: 20px clamp(12px, 3vw, 40px) 24px; background: radial-gradient(ellipse at 30% 0%, #294c4259, transparent 65%), #101e2a; color: #eff8f0; font: 16px/1.35 system-ui, sans-serif; }
	.masthead { display: flex; align-items: center; gap: 12px; max-width: 1120px; margin: 0 auto 18px; }
	.brand { display: flex; align-items: center; gap: 12px; flex: 1; }
	.brand-ball { display: grid; place-items: center; width: 44px; height: 44px; border-radius: 12px; background: #2d4c45; font-size: 26px; }
	.brand p, .kicker { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: .13em; color: #addcaa; }
	h1 { margin: 2px 0 0; font-size: clamp(20px, 3vw, 34px); line-height: 1.08; }
	.settings, .lanes, .passes { display: flex; gap: 8px; }
	button, select, .back { border: 1px solid #4d6b6e; border-radius: 11px; color: #eff8f0; background: #29434b; padding: 9px 12px; min-height: 44px; font: inherit; font-weight: 650; }
	button, select { cursor: pointer; touch-action: manipulation; } button:hover, select:hover { background: #36565d; } button:disabled { opacity: .55; cursor: default; }
	button:focus-visible, select:focus-visible, .back:focus-visible { outline: 3px solid #ffdf79; outline-offset: 2px; }
	.back { display: grid; place-items: center; text-decoration: none; }
	.stadium { display: grid; grid-template-columns: minmax(0, 1fr) minmax(245px, 320px); gap: 22px; max-width: 960px; margin: auto; align-items: start; }
	.field-side { min-width: 0; display: flex; flex-direction: column; align-items: center; }
	.scoreboard { width: min(100%, 540px); display: flex; justify-content: center; gap: 15px; align-items: center; border: 1px solid #355259; padding: 7px; border-radius: 13px; background: #203741; margin-bottom: 9px; }
	.side { display: flex; gap: 7px; align-items: center; font-size: 15px; }
	.side i { width: 14px; height: 14px; border-radius: 4px; background: var(--team); }
	.goals { display: flex; gap: 8px; align-items: center; font-weight: 800; font-size: 22px; font-variant-numeric: tabular-nums; }
	.goals b { color: #9bc3b0; }
	.pitch { display: block; width: 100%; max-width: 540px; max-height: calc(100dvh - 152px); min-height: 220px; height: auto; touch-action: none; user-select: none; }
	.panel { display: flex; flex-direction: column; gap: 10px; background: linear-gradient(145deg, #29445166, transparent), #1b303d; border: 1px solid #355259; padding: 20px; border-radius: 16px; }
	.panel h2 { margin: 0 0 3px; font-size: 25px; line-height: 1.1; }
	.panel label { font-size: 14px; color: #c7d8d1; }
	.detail { margin: 0; color: #c7d8d1; font-size: 14px; line-height: 1.45; }
	.primary { background: #c7e99b; color: #172d2a; border-color: #c7e99b; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.primary:hover { background: #dcf8bb; }
	.lanes button, .passes button { flex: 1; padding-inline: 5px; font-size: 13px; }
	.lanes button span { display: block; font-size: 20px; }
	@media (max-width: 640px) {
		.soccer { padding: 10px 10px 16px; }
		.masthead { margin-bottom: 10px; gap: 6px; }
		.brand { gap: 6px; }
		.brand-ball { display: none; }
		.brand p { font-size: 8px; }
		.settings { gap: 4px; }
		.settings button, .back { padding-inline: 8px; }
		.stadium { display: flex; flex-direction: column; gap: 9px; align-items: stretch; }
		.stadium.setup .panel { order: -1; }
		.panel { padding: 12px; gap: 7px; }
		.panel h2 { font-size: 21px; }
		.pitch { max-height: min(52dvh, 460px); }
	}
	@media (max-height: 540px) and (min-width: 641px) {
		.soccer { padding-block: 8px; }
		.masthead { margin-bottom: 7px; }
		.pitch { max-height: calc(100dvh - 108px); }
		.panel { padding: 12px; gap: 6px; }
	}
</style>
