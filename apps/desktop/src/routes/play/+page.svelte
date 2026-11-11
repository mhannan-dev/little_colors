<script lang="ts">
	import { goto } from '$app/navigation';
	import { narrationText } from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { say } from '#lib/audio/narrator.ts';
	import { settings } from '#lib/stores/settings.ts';
	import { t } from '#lib/i18n.ts';
	import { PICKER_GROUPS } from '@little-colors/core';

	// Grouped so a child sees a few big choices at a time (visual audit 2026-11-10).
	const modes = [
		{ id: 'mixing', key: 'mode.mixing', href: '/mixing', group: 'learn' },
		{ id: 'matching', key: 'mode.matching', href: '/matching', group: 'learn' },
		{ id: 'numbers', key: 'mode.numbers', href: '/numbers', group: 'learn' },
		{ id: 'abc3d', key: 'mode.abc3d', href: '/abc-123', group: 'learn' },
		{ id: 'sorter', key: 'mode.sorter', href: '/shape-sorter', group: 'learn' },
		{ id: 'flag', key: 'mode.flag', href: '/flag', group: 'learn' },
		{ id: 'fruit', key: 'mode.fruit', href: '/fruit', group: 'learn' },
		{ id: 'flower', key: 'mode.flower', href: '/flower', group: 'learn' },
		{ id: 'animals', key: 'mode.animals', href: '/animals', group: 'learn' },
		{ id: 'color-blocks', key: 'mode.color-blocks', href: '/color-blocks', group: 'learn' },
		{ id: 'holy-puzzle', key: 'mode.holy-puzzle', href: '/holy-puzzle', group: 'learn' },
		{ id: 'football', key: 'mode.football', href: '/football', group: 'play' },
		{ id: 'car', key: 'mode.car', href: '/car', group: 'play' },
		{ id: 'bird', key: 'mode.bird', href: '/bird', group: 'play' },
		{ id: 'kitchen', key: 'mode.kitchen', href: '/kitchen', group: 'play' },
		{ id: 'teeth', key: 'mode.teeth', href: '/teeth', group: 'play' },
		{ id: 'farm', key: 'mode.farm', href: '/farm', group: 'play' },
		{ id: 'blocks3d', key: 'mode.blocks3d', href: '/blocks-3d', group: 'play' },
		{ id: 'garden3d', key: 'mode.garden3d', href: '/garden-3d', group: 'play' },
		{ id: 'car3d', key: 'mode.car3d', href: '/toy-car', group: 'drive' },
		{ id: 'race3d', key: 'mode.race3d', href: '/race', group: 'drive' },
		{ id: 'highway', key: 'mode.highway', href: '/highway', group: 'drive' },
		{ id: 'bike', key: 'mode.bike', href: '/bike', group: 'drive' },
		{ id: 'train', key: 'mode.rail', href: '/train', group: 'drive' },
		{ id: 'city-bus-driver', key: 'mode.city-bus-driver', href: '/city-bus-driver', group: 'older' },
		{ id: 'formula-circuit', key: 'mode.formula-circuit', href: '/formula-circuit', group: 'older' },
		{ id: 'world-soccer', key: 'mode.world-soccer', href: '/world-soccer', group: 'older' },
		{ id: 'tic-tac-toe', key: 'mode.tic-tac-toe', href: '/tic-tac-toe', group: 'older' }
	] as const;

	// Search (for grown-ups): matches a game's Bengali or English name, or its id.
	let query = $state('');
	const norm = (x: string) => x.toLowerCase().normalize('NFC').replace(/s+/g, ' ').trim();
	const matches = (m: (typeof modes)[number]) => {
		const q = norm(query);
		if (!q) return true;
		return [narrationText(m.key, 'bn-BD', true), narrationText(m.key, 'en-US', true), m.id.replace(/-/g, ' ')].some((n) => norm(n).includes(q));
	};
	const shown = $derived(modes.filter(matches));

	const label = (key: string) =>
		narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);

	// SC-11: a tap opens the mode and speaks its label; keyboard focus alone speaks it.
	function open(m: (typeof modes)[number]) {
		say(m.key, { interrupt: true });
		void goto(m.href);
	}
</script>

<TopBar backTo="/" />

<section>
	<h2>{t('chooseMode', $settings.language)}</h2>
	<div class="search" role="search">
		<span class="glass" aria-hidden="true">🔍</span>
		<input
			type="search"
			data-testid="game-search"
			bind:value={query}
			placeholder={$settings.language === 'bn-BD' ? 'খেলা খুঁজি… (যেমন: গাড়ি, ফুল, ABC)' : 'Search games… (e.g. car, flower, ABC)'}
			aria-label={$settings.language === 'bn-BD' ? 'খেলা খুঁজি' : 'Search games'}
			onkeydown={(e) => e.key === 'Escape' && (query = '')}
		/>
		{#if query}<button class="clear" aria-label={$settings.language === 'bn-BD' ? 'মুছে দিই' : 'Clear'} onclick={() => (query = '')}>✕</button>{/if}
	</div>
	{#if shown.length === 0}
		<p class="nothing" data-testid="no-results"><span aria-hidden="true">🙈</span> {$settings.language === 'bn-BD' ? 'কিছু পাওয়া যায়নি। অন্য নাম লিখে দেখি।' : 'Nothing found. Try another name.'}</p>
	{/if}
	{#each PICKER_GROUPS.filter((g) => shown.some((m) => m.group === g.id)) as g (g.id)}
	<h3 class="group-title" data-group={g.id}><span aria-hidden="true">{g.icon}</span> {label(`picker.group.${g.id}`)}</h3>
	<div class="cards" data-group={g.id}>
		{#each shown.filter((m) => m.group === g.id) as m (m.id)}
			<button class="card" onclick={() => open(m)} onfocus={() => say(m.key, { interrupt: true })}>
				<svg viewBox="0 0 160 110" width="160" height="112" aria-hidden="true">
					{#if m.id === 'mixing'}
						<circle cx="80" cy="45" r="32" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4" />
						<polygon points="80,30 90,37 86,48 74,48 70,37" fill="var(--text-primary)" />
						<rect x="14" y="70" width="34" height="34" rx="8" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="3" />
						<rect x="112" y="70" width="34" height="34" rx="8" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="3" />
					{:else if m.id === 'matching'}
						<circle cx="40" cy="55" r="26" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" />
						<polygon points="120,22 129,46 154,46 134,61 141,86 120,71 99,86 106,61 86,46 111,46" fill="none" stroke="var(--text-primary)" stroke-width="4" stroke-dasharray="8 6" stroke-linejoin="round" />
					{:else if m.id === 'numbers'}
						{#each [30, 80, 130] as x (x)}
							<circle cx={x} cy="40" r="20" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" />
						{/each}
						<text x="80" y="104" text-anchor="middle" font-size="40" font-weight="700" fill="var(--text-primary)">৩</text>
					{:else if m.id === 'city-bus-driver'}
						<rect x="16" y="25" width="128" height="64" rx="14" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="4" />
						<path d="M26 40h94v25H26z" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M52 40v25m29-25v25m22-25v43" stroke="var(--text-primary)" stroke-width="3" />
						<circle cx="42" cy="86" r="12" fill="var(--text-primary)" />
						<circle cx="117" cy="86" r="12" fill="var(--text-primary)" />
					{:else if m.id === 'formula-circuit'}
						<path d="M15 71h130v21H15z" fill="var(--text-primary)" />
						<path d="M19 67 57 58 66 43 92 43 103 57 143 65v13H19z" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="4" />
						<path d="M72 43v-9h16v9m37 17V49h17" fill="none" stroke="var(--text-primary)" stroke-width="5" />
						<circle cx="46" cy="79" r="14" fill="var(--text-primary)" />
						<circle cx="118" cy="79" r="14" fill="var(--text-primary)" />
						<circle cx="46" cy="79" r="5" fill="var(--surface)" />
						<circle cx="118" cy="79" r="5" fill="var(--surface)" />
				{:else if m.id === 'sorter'}
						<rect x="24" y="40" width="112" height="58" rx="10" fill="#5EB5E8" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="18" y="28" width="124" height="18" rx="6" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="4" />
						<circle cx="52" cy="37" r="6" fill="var(--text-primary)" /><rect x="74" y="31" width="12" height="12" fill="var(--text-primary)" /><path d="M108 43 l7 -12 7 12z" fill="var(--text-primary)" />
						<path d="M72 4 l6 12 13 1 -10 8 4 13 -13 -7 -12 7 4 -13 -10 -8 13 -1z" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="3" stroke-linejoin="round" />
				{:else if m.id === 'farm'}
						<rect x="22" y="44" width="60" height="52" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="4" />
						<path d="M14 46 L52 16 L90 46 Z" fill="#6B4A3A" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
						<path d="M40 96 V70 h24 v26 M40 70 l24 26 M64 70 l-24 26" fill="none" stroke="#ffffff" stroke-width="4" />
						<ellipse cx="118" cy="76" rx="24" ry="18" fill="#ffffff" stroke="var(--text-primary)" stroke-width="4" />
						<circle cx="118" cy="50" r="14" fill="#ffffff" stroke="var(--text-primary)" stroke-width="4" />
						<ellipse cx="112" cy="76" rx="7" ry="6" fill="var(--text-primary)" /><ellipse cx="118" cy="56" rx="7" ry="5" fill="#F7B6C2" />
				{:else if m.id === 'train'}
						<path d="M6 96 H154" stroke="var(--text-primary)" stroke-width="5" stroke-linecap="round" />
						<rect x="78" y="52" width="56" height="34" rx="8" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="112" y="30" width="28" height="56" rx="5" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="86" y="34" width="12" height="20" fill="var(--text-primary)" />
						<circle cx="80" cy="20" r="8" fill="#E6EEF2" /><circle cx="66" cy="12" r="6" fill="#E6EEF2" />
						<rect x="14" y="58" width="56" height="28" rx="6" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="4" />
						<circle cx="30" cy="52" r="8" fill="#ffffff" stroke="var(--text-primary)" stroke-width="3" /><circle cx="52" cy="52" r="8" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="3" />
						{#each [28, 56, 92, 124] as x (x)}<circle cx={x} cy="90" r="8" fill="var(--text-primary)" />{/each}
				{:else if m.id === 'teeth'}
						<circle cx="62" cy="56" r="38" fill="#7CD3A8" stroke="var(--text-primary)" stroke-width="4" />
						<circle cx="50" cy="46" r="6" fill="var(--text-primary)" /><circle cx="74" cy="46" r="6" fill="var(--text-primary)" />
						<path d="M42 64 Q62 90 82 64 Z" fill="#7A2335" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M46 66 h32 l-3 7 h-26z" fill="#ffffff" />
						<rect x="96" y="30" width="12" height="66" rx="6" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" transform="rotate(20 102 63)" />
						<rect x="98" y="14" width="20" height="20" rx="5" fill="#ffffff" stroke="var(--text-primary)" stroke-width="3" transform="rotate(20 108 24)" />
						<path d="M128 20 l4 8 8 4 -8 4 -4 8 -4 -8 -8 -4 8 -4z" fill="var(--learn-yellow)" />
				{:else if m.id === 'kitchen'}
						<path d="M27 64h106q-3 28-20 28H47Q30 92 27 64Z" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4" />
						<path d="M20 61h120M56 47q-9-10 0-19m24 19q-9-12 0-25m24 25q-9-10 0-19" fill="none" stroke="var(--text-primary)" stroke-width="5" stroke-linecap="round" />
					{:else if m.id === 'tic-tac-toe'}
						<rect x="34" y="9" width="92" height="92" rx="15" fill="#e0edce" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M66 17v76m28-76v76M42 41h76M42 69h76" stroke="#69836b" stroke-width="3" />
						<path d="m46 22 14 14m0-14L46 36m27 12 14 14m0-14L73 62m27 12 14 14m0-14-14 14" stroke="#ab4d3d" stroke-width="4" stroke-linecap="round" />
						<g fill="none" stroke="#285d94" stroke-width="4"><circle cx="106" cy="29" r="8" /><circle cx="53" cy="81" r="8" /></g>
					{:else if m.id === 'world-soccer'}
						<rect x="20" y="12" width="120" height="86" rx="13" fill="#459462" stroke="#20483f" stroke-width="4" />
						<path d="M34 24h92v62H34z M34 55h92 M59 24v15h42V24 M59 86V71h42v15" fill="none" stroke="#edf5df" stroke-width="3" />
						<circle cx="80" cy="55" r="15" fill="#faf4de" stroke="#20483f" stroke-width="3" />
						<path d="M80 46l8 6-3 9H75l-3-9Z" fill="#20483f" />
					{:else if m.id === 'football'}
						<circle cx="80" cy="50" r="32" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="4" />
						<polygon points="80,30 90,39 84,52 72,52 66,39" fill="var(--text-primary)" />
						<path d="M49 78 L111 78" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
						<path d="M53 65 L42 82" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
						<path d="M107 65 L118 82" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
					{:else if m.id === 'car'}
						<rect x="26" y="58" width="108" height="30" rx="8" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="52" y="40" width="42" height="22" rx="5" fill="var(--bg-primary)" stroke="var(--text-primary)" stroke-width="4" />
						<circle cx="48" cy="90" r="12" fill="var(--text-primary)" />
						<circle cx="112" cy="90" r="12" fill="var(--text-primary)" />
					{:else if m.id === 'garden3d'}
						<path d="M18 68 80 36 142 68 80 102Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M57 30 80 18 103 30 80 43Z" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M57 30v30l23 14V43Z" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M80 43v31l23-14V30Z" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" />
						<circle cx="122" cy="47" r="11" fill="var(--learn-red)" />
						<path d="M122 58v18" stroke="var(--text-primary)" stroke-width="4" />
					{:else if m.id === 'color-blocks'}
						<rect x="21" y="17" width="118" height="76" rx="13" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="29" y="40" width="30" height="30" rx="5" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" />
						<rect x="102" y="40" width="30" height="30" rx="5" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="3" stroke-dasharray="4 3" />
						<path d="M44 47l8 8-8 8-8-8Z M117 47l8 8-8 8-8-8Z" fill="var(--text-primary)" />
						<path d="M68 55h23m-8-7 8 7-8 7" fill="none" stroke="var(--text-primary)" stroke-width="3" stroke-linecap="round" />
					{:else if m.id === 'blocks3d'}
						{#each [{x:30,y:65,c:'var(--learn-blue)'},{x:80,y:65,c:'var(--learn-green)'},{x:55,y:27,c:'var(--learn-orange)'}] as block}
							<path d="M{block.x} {block.y} l25 -13 25 13 -25 13Z" fill={block.c} stroke="var(--text-primary)" stroke-width="2" />
							<path d="M{block.x} {block.y} v25 l25 13 25 -13 v-25 l-25 13Z" fill={block.c} stroke="var(--text-primary)" stroke-width="2" />
							<path d="M{block.x+25} {block.y+13} v25" stroke="var(--text-primary)" stroke-width="2" />
						{/each}
					{:else if m.id === 'abc3d'}
						{#each [{ x: 14, c: 'var(--learn-red)', g: 'A' }, { x: 60, c: 'var(--learn-blue)', g: 'অ' }, { x: 106, c: 'var(--learn-green)', g: '১' }] as b (b.x)}
							<rect x={b.x} y="34" width="40" height="40" rx="8" fill={b.c} stroke="var(--text-primary)" stroke-width="3" />
							<rect x={b.x + 7} y="41" width="26" height="26" rx="5" fill="var(--surface)" />
							<text x={b.x + 20} y="62" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text-primary)">{b.g}</text>
						{/each}
					{:else if m.id === 'car3d'}
						<rect x="77" y="22" width="5" height="34" fill="var(--text-primary)" />
						<rect x="58" y="4" width="44" height="30" rx="5" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="3" />
						<text x="80" y="27" text-anchor="middle" font-size="22" font-weight="700" fill="var(--surface)">B</text>
						<rect x="44" y="70" width="72" height="24" rx="8" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="4" />
						<rect x="60" y="56" width="40" height="18" rx="5" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3" />
						<circle cx="80" cy="52" r="7" fill="var(--mascot-fur-light)" stroke="var(--text-primary)" stroke-width="2" />
						<circle cx="58" cy="96" r="9" fill="var(--text-primary)" />
						<circle cx="102" cy="96" r="9" fill="var(--text-primary)" />
					{:else if m.id === 'bike'}
						<circle cx="40" cy="78" r="22" fill="none" stroke="var(--text-primary)" stroke-width="6" />
						<circle cx="120" cy="78" r="22" fill="none" stroke="var(--text-primary)" stroke-width="6" />
						<path d="M40 78 L66 46 L104 46 L120 78 M66 46 L80 78 L104 46 M58 38 H76 M104 46 L98 30 H112" fill="none" stroke="var(--learn-blue)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
						<path d="M106 18 h18 l-4 12 h-12 z" fill="#C79A55" stroke="var(--text-primary)" stroke-width="2.5" />
						<circle cx="111" cy="16" r="4.5" fill="var(--learn-red)" /><circle cx="119" cy="16" r="4.5" fill="var(--learn-yellow)" />
					{:else if m.id === 'highway'}
						<path d="M58 10 L102 10 L150 104 L10 104 Z" fill="#4A5058" />
						<path d="M80 16 v10 M80 38 v14 M80 64 v18 M80 92 v10" stroke="#F4F4F0" stroke-width="4" stroke-linecap="round" />
						<rect x="92" y="30" width="20" height="26" rx="5" fill="var(--learn-blue)" stroke="var(--text-primary)" stroke-width="2.5" />
						<rect x="44" y="66" width="32" height="34" rx="7" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="3" />
						<circle cx="60" cy="64" r="7" fill="var(--mascot-fur-light)" stroke="var(--text-primary)" stroke-width="2" />
					{:else if m.id === 'race3d'}
						<rect x="74" y="6" width="4" height="44" fill="var(--text-primary)" />
						{#each [0, 1, 2, 3] as i (i)}
							{#each [0, 1] as j (j)}
								<rect x={78 + i * 9} y={6 + j * 9} width="9" height="9" fill={(i + j) % 2 ? 'var(--text-primary)' : 'var(--surface)'} />
							{/each}
						{/each}
						{#each [{ x: 6, c: 'var(--learn-blue)' }, { x: 56, c: 'var(--learn-red)' }, { x: 106, c: 'var(--learn-yellow)' }] as car (car.x)}
							<rect x={car.x} y="72" width="48" height="20" rx="6" fill={car.c} stroke="var(--text-primary)" stroke-width="3" />
							<rect x={car.x + 12} y="60" width="24" height="14" rx="4" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="3" />
							<circle cx={car.x + 12} cy="94" r="7" fill="var(--text-primary)" />
							<circle cx={car.x + 36} cy="94" r="7" fill="var(--text-primary)" />
						{/each}
					{:else if m.id === 'flag'}
						<rect x="78" y="28" width="6" height="64" fill="var(--text-primary)" rx="3" />
						<path d="M84 30 L126 40 L84 52 Z" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="3" stroke-linejoin="round" />
						<circle cx="116" cy="40" r="6" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="3" />
					{:else if m.id === 'animals'}
						<path d="M98 74l28 26" stroke="var(--text-primary)" stroke-width="12" stroke-linecap="round" />
						<circle cx="70" cy="49" r="35" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="5" />
						<path d="M59 62 Q55 55 63 49 Q70 41 77 49 Q85 55 81 62 Q78 67 70 63 Q62 67 59 62Z" fill="var(--text-primary)" />
						{#each [55, 65, 76, 85] as x, i}
							<ellipse cx={x} cy={i === 0 || i === 3 ? 43 : 36} rx="4" ry="6" fill="var(--text-primary)" />
						{/each}
					{:else if m.id === 'flower'}
						<path d="M80 58v44 M80 88 Q45 92 46 71 Q73 68 80 88Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" />
						{#each [0, 72, 144, 216, 288] as angle}
							<ellipse cx="80" cy="24" rx="14" ry="19" transform="rotate({angle} 80 45)" fill="var(--learn-orange)" stroke="var(--text-primary)" stroke-width="3" />
						{/each}
						<circle cx="80" cy="45" r="12" fill="var(--learn-yellow)" stroke="var(--text-primary)" stroke-width="3" />
					{:else if m.id === 'fruit'}
						<path d="M67 38 Q43 19 28 43 Q15 66 35 94 Q51 111 67 100 Q84 112 99 94 Q119 66 106 43 Q91 20 67 38Z" fill="var(--learn-red)" stroke="var(--text-primary)" stroke-width="4" />
						<path d="M67 38 Q65 19 77 9 M74 23 Q94 5 110 24 Q89 38 74 23Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" />
					{:else if m.id === 'holy-puzzle'}
						<path d="M22 84h116v8H22z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M34 82V50l18-16 18 16v32M78 82V48l21-18 21 18v34" fill="var(--bg-secondary)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
						<path d="M28 52h48M72 50h54" stroke="var(--learn-green)" stroke-width="7" />
						<path d="M90 62h20v20H90z" fill="var(--text-primary)" />
						<path d="M94 67h12v4H94z" fill="var(--learn-yellow)" />
					{:else}
						<path d="M42 72 C48 56, 56 42, 68 42 C76 42, 82 48, 86 58 C92 70, 98 72, 104 68 C111 64, 118 54, 122 42 C126 30, 133 36, 138 46 L136 78 C130 70, 122 66, 116 68 C110 70, 105 76, 98 80 C92 84, 82 86, 76 80 C68 72, 60 70, 52 74 Z" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" />
						<circle cx="78" cy="56" r="6" fill="var(--bg-primary)" stroke="var(--text-primary)" stroke-width="3" />
						<path d="M94 48 L108 34" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
						<path d="M104 48 L118 34" stroke="var(--text-primary)" stroke-width="4" stroke-linecap="round" />
					{/if}
				</svg>
				<span>{label(m.key)}</span>
			</button>
		{/each}
	</div>
	{/each}
	<button class="thinking-link" onclick={() => { say('thinking.title', { interrupt: true }); goto('/thinking'); }}>
		<span>{label('thinking.title')}</span>
		<small>{$settings.language === 'bn-BD' ? '৫–১০ বছরের জন্য চারটি নতুন পাঠ' : 'Four new lessons for ages 5–10'}</small>
		<span aria-hidden="true">→</span>
	</button>
</section>

<style>
	.thinking-link { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 14px; padding: 16px 28px; min-height: 76px; border: 3px solid var(--border-soft); border-radius: var(--radius-lg); background: var(--bg-secondary); cursor: pointer; font-size: 26px; font-weight: 700; }
	/* Many cards no longer fit small windows: keep this entry on screen instead of below the fold. */
	.thinking-link { position: sticky; bottom: 12px; z-index: 2; box-shadow: 0 6px 18px #0002; }
	.thinking-link small { font-size: 20px; font-weight: 400; }
	section {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: safe center;
		gap: 14px;
		padding: 0 24px 48px;
	}
	h2 {
		margin: 0;
		font-size: 40px;
	}
	.search {
		position: relative;
		display: flex;
		align-items: center;
		width: min(560px, 100%);
	}
	.search input {
		width: 100%;
		min-height: 56px;
		padding: 8px 56px 8px 56px;
		border: 3px solid var(--border-soft);
		border-radius: 28px;
		background: var(--surface);
		font: inherit;
		font-size: 22px;
		color: var(--text-primary);
	}
	/* Our own big clear button replaces the small browser one. */
	.search input::-webkit-search-cancel-button {
		display: none;
	}
	.search input:focus {
		outline: none;
		border-color: var(--focus);
	}
	.search .glass {
		position: absolute;
		left: 18px;
		font-size: 24px;
		pointer-events: none;
	}
	.search .clear {
		position: absolute;
		right: 8px;
		width: 42px;
		height: 42px;
		border: 0;
		border-radius: 50%;
		background: var(--bg-secondary);
		font-size: 20px;
		cursor: pointer;
	}
	.nothing {
		margin: 20px 0;
		font-size: 24px;
		color: var(--text-secondary);
	}
	.group-title {
		margin: 10px 0 0;
		width: min(1180px, 100%);
		font-size: 28px;
		color: var(--text-secondary);
	}
	.group-title span {
		font-size: 34px;
	}
	.cards {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-start;
		gap: 20px;
		width: min(1180px, 100%);
	}
	.cards[data-group='older'] .card {
		background: var(--bg-secondary);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		width: clamp(150px, 17vw, 210px);
		padding: 18px 14px 16px;
		border: 4px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
		cursor: pointer;
		font-size: 24px;
		font-weight: 700;
		transition: transform 200ms ease, border-color 200ms ease;
	}
	.card:hover {
		transform: translateY(-6px);
		border-color: var(--text-secondary);
	}
	@media (max-height: 700px) {
		section { gap: 14px; padding-bottom: 20px; }
		h2 { font-size: 30px; }
		.card { padding: 14px; font-size: 24px; }
		.card svg { width: 140px; height: 90px; }
		.thinking-link { padding: 8px 20px; min-height: 64px; }
	}
</style>
