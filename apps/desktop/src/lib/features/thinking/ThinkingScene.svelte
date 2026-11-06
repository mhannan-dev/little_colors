<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import {
		THINKING_KINDS, THINKING_DIRECTIONS, createThinkingRound, initialThinkingProgress, thinkingReducer, thinkingHint,
		sameCell, narrationText, formatNumeral,
		createPicnicAdventure, initialPicnicProgress, picnicReducer,
		initialCreativePlayground,
		type PicnicAdventure, type PicnicProgress,
		type ThinkingAgeBand, type ThinkingKind, type ThinkingLesson, type ThinkingProgress, type ThinkingAction, type ThinkingToken, type GridDirection
	} from '@little-colors/core';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { t } from '#lib/i18n.ts';
	import ThinkingTokenView from './ThinkingToken.svelte';
	import PicnicScene from './PicnicScene.svelte';
	import CreativePlayground from './CreativePlayground.svelte';
	import TreasureAdventure from './TreasureAdventure.svelte';
	import SillyShop from './SillyShop.svelte';
	import PatternTrain from './PatternTrain.svelte';
	import EnglishLetters from './EnglishLetters.svelte';
	import ArithmeticRally from './ArithmeticRally.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { paused } from '#lib/stores/pause.ts';
	import { caption, say, stopNarration } from '#lib/audio/narrator.ts';

	let ageBand = $state<ThinkingAgeBand>('5-7');
	let round = $state<ThinkingLesson[]>([]);
	let index = $state(0);
	let done = $state(false);
	let practiceProgress = $state<ThinkingProgress | null>(null);
	let picnicPlan = $state<PicnicAdventure | null>(null);
	let picnic = $state<PicnicProgress | null>(null);
	let jokeFixed = $state(false);
	let playground = $state(false);
	let treasure = $state(false);
	let shop = $state(false);
	let train = $state(false);
	let letters = $state(false);
	let arithmetic = $state<'add'|'subtract'|null>(null);
	let creativeMode = $state<'arrange' | 'pattern'>('arrange');
	let creation = $state(initialCreativePlayground());
	let scroller = $state<HTMLDivElement>();
	const stage = $derived(picnicPlan && picnic ? picnicPlan.stages[picnic.stageIndex] : null);
	const progress = $derived(picnic?.lessonProgress ?? practiceProgress);
	const lesson = $derived(stage?.lesson ?? round[index] ?? null);
	const hint = $derived(lesson && progress?.hintVisible ? thinkingHint(lesson, progress) : null);
	const active = $derived(!!lesson && !done);
	const text = (key: string) => narrationText(key, $settings.language, $settings.islamicExpressionsEnabled);
	const numeral = (n: number) => formatNumeral(n, $settings.numeralStyle);
	const tokenName = (token: ThinkingToken) => token.picture ? text(`picnic.item.${token.picture}`) : `${text(`thinking.color.${token.color}`)} ${text(`thinking.shape.${token.shape}`)}`;
	const instruction = $derived(lesson?.kind === 'sequence-memory' && progress?.phase !== 'observe' ? picnicPlan ? 'picnic.instruction.memory.recall' : 'thinking.instruction.memory.recall' : lesson?.instructionKey ?? 'thinking.subtitle');
	const captionKey = $derived(playground ? creativeMode === 'arrange' ? 'playground.instruction' : 'playground.pattern.instruction' : picnic?.phase === 'finished' ? 'picnic.done' : picnic?.phase === 'intro' ? stage!.storyKey : picnic?.phase === 'chapter-complete' ? stage!.successKey : done ? 'thinking.done' : progress?.feedbackKey ?? 'thinking.subtitle');
	const arrow: Record<GridDirection, string> = { up: '↑', down: '↓', left: '←', right: '→' };
	function focusChapter() {
		void tick().then(() => { scroller?.scrollTo(0, 0); scroller?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true }); });
	}
	function beginPicnic() {
		stopNarration();
		playground = false;
		picnicPlan = createPicnicAdventure(ageBand, Date.now() >>> 0);
		picnic = initialPicnicProgress(picnicPlan); jokeFixed = false;
		round = []; practiceProgress = null; done = false;
		say(picnicPlan.stages[0]!.storyKey, { interrupt: true }); focusChapter();
	}
	function beginChapter() {
		if (!picnicPlan || !picnic || $paused) return;
		picnic = picnicReducer(picnicPlan, picnic, { type: 'BEGIN' });
		say(stage!.lesson.instructionKey, { interrupt: true }); focusChapter();
	}

	function begin(kind: ThinkingKind) {
		stopNarration();
		playground = false;
		picnicPlan = null; picnic = null;
		round = createThinkingRound(kind, ageBand, Date.now() >>> 0);
		index = 0; done = false; practiceProgress = initialThinkingProgress(round[0]!);
		say(round[0]!.instructionKey, { interrupt: true });
		focusChapter();
	}
	function dispatch(action: ThinkingAction) {
		if (!lesson || !progress || $paused) return;
		if (picnicPlan && picnic) {
			const next = picnicReducer(picnicPlan, picnic, { type: 'PLAY', action });
			if (next === picnic) return;
			picnic = next;
			say(next.phase === 'chapter-complete' ? stage!.successKey : action.type === 'REMEMBER' ? 'picnic.instruction.memory.recall' : next.lessonProgress.feedbackKey, { interrupt: true });
			return;
		}
		const next = thinkingReducer(lesson, progress, action);
		if (next === progress) return;
		practiceProgress = next;
		say(next.feedbackKey, { interrupt: true });
	}
	function nextLesson() {
		if (progress?.phase !== 'success' || $paused) return;
		stopNarration();
		if (picnicPlan && picnic) {
			picnic = picnicReducer(picnicPlan, picnic, { type: 'NEXT' }); jokeFixed = false;
			say(picnic.phase === 'finished' ? 'picnic.done' : stage!.storyKey, { interrupt: true }); focusChapter(); return;
		}
		if (index + 1 >= round.length) { done = true; say('thinking.done', { interrupt: true }); return; }
		index += 1; practiceProgress = initialThinkingProgress(round[index]!);
		say(round[index]!.instructionKey, { interrupt: true });
		focusChapter();
	}
	function hub() { stopNarration(); playground = false; round = []; practiceProgress = null; done = false; picnicPlan = null; picnic = null; focusChapter(); }
	function openPlayground() { stopNarration(); creativeMode = 'arrange'; playground = true; say('playground.instruction', { interrupt: true }); focusChapter(); }
	function closePlayground() { stopNarration(); playground = false; focusChapter(); }
	function gridKey(event: KeyboardEvent) {
		const directions: Record<string, GridDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
		const direction = directions[event.key];
		if (direction) { event.preventDefault(); dispatch({ type: 'MOVE', direction }); }
	}

	$effect(() => { if (!treasure && !shop && !train && !letters && !arithmetic) caption.set(text(captionKey)); });
	const offPause = paused.subscribe((value) => { if (value) stopNarration(); });
	onMount(() => { stopNarration(); });
	onDestroy(() => { offPause(); stopNarration(); caption.set(''); });
</script>

{#if arithmetic}
	<ArithmeticRally {ageBand} operation={arithmetic} onexit={() => { stopNarration(); arithmetic = null; focusChapter(); }} />
{:else if letters}
	<EnglishLetters {ageBand} onexit={() => { stopNarration(); letters = false; focusChapter(); }} />
{:else if train}
	<PatternTrain {ageBand} onexit={() => { stopNarration(); train = false; focusChapter(); }} />
{:else if shop}
	<SillyShop {ageBand} onexit={() => { stopNarration(); shop = false; focusChapter(); }} />
{:else if treasure}
	<TreasureAdventure {ageBand} onexit={() => { stopNarration(); treasure = false; focusChapter(); }} />
{:else}
<div class="thinking-shell" class:creative-open={playground}>
<TopBar onreplay={() => say(playground || picnic?.phase === 'intro' || picnic?.phase === 'finished' ? captionKey : instruction, { interrupt: true })} />
<div class="thinking" data-testid="thinking-scene" bind:this={scroller}>
	{#if playground}
		<CreativePlayground bind:model={creation} bind:activity={creativeMode} {ageBand} onexit={closePlayground} />
	{:else if !lesson}
		<section class="hub">
			<div class="eyebrow">{t('appName', $settings.language)} · Think & Play</div>
			<h1 tabindex="-1">{text('thinking.title')}</h1>
			<p class="subtitle">{text('thinking.subtitle')}</p>
			<div class="age-bands" role="group" aria-label={$settings.language === 'bn-BD' ? 'পাঠের স্তর' : 'Lesson level'}>
				{#each ['5-7', '8-10'] as band}
					<button class:chosen={ageBand === band} aria-pressed={ageBand === band} onclick={() => ageBand = band as ThinkingAgeBand} data-testid="age-{band}">{text(band === '5-7' ? 'thinking.age.younger' : 'thinking.age.older')}</button>
				{/each}
			</div>
			<div class="treasure-hero"><h2>{text('letters.title')} · A–Z</h2><p>{text('letters.subtitle')}</p><button class="primary" data-testid="start-letters" onclick={() => { stopNarration(); letters = true; }}>{text('letters.start')} →</button></div>
			<div class="picnic-hero">
				<div class="hero-art"><PicnicScene hat label={text('picnic.scene')} /></div>
				<div class="hero-copy"><h2>{text('picnic.title')}</h2><p>{text('picnic.subtitle')}</p><div class="hero-buttons"><button class="primary" data-testid="start-picnic" onclick={beginPicnic}>{text('picnic.start')} →</button><button class="quiet" data-testid="open-playground" onclick={openPlayground}>{text('playground.title')}</button></div></div>
			</div>
			<div class="treasure-hero"><h2>{text('treasure.title')}</h2><p>{text('treasure.subtitle')}</p><button class="primary" data-testid="start-treasure" onclick={() => { stopNarration(); treasure = true; }}>{text('treasure.start')} →</button></div>
			<div class="treasure-hero"><h2>{text('shop.title')}</h2><p>{text('shop.subtitle')}</p><button class="primary" data-testid="start-shop" onclick={() => { stopNarration(); shop = true; }}>{text('shop.start')} →</button></div>
			<div class="treasure-hero"><h2>{text('train.title')}</h2><p>{text('train.subtitle')}</p><button class="primary" data-testid="start-train" onclick={() => { stopNarration(); train = true; }}>{text('train.start')} →</button></div>
			<h2 class="practice-title">{text('picnic.practice')}</h2>
			<div class="lesson-cards">
				{#each THINKING_KINDS as kind, i}
					<button class="lesson-card" onclick={() => begin(kind)} data-testid="lesson-{kind}" onfocus={() => say(`thinking.kind.${kind}`, { interrupt: true })}>
						<div class="card-symbol" aria-hidden="true">{['◇ ◇ △', '● ▲ ■', '2 · 4 · ?', '↗'][i]}</div>
						<div><h2>{text(`thinking.kind.${kind}`)}</h2><p>{text(`thinking.detail.${kind}`)}</p></div>
						<span class="card-arrow" aria-hidden="true">→</span>
					</button>
				{/each}
			</div>
		</section>
	{:else if done || picnic?.phase === 'finished'}
		<section class="round-done" data-testid={picnicPlan ? 'picnic-done' : 'thinking-done'}>
			{#if picnicPlan}<PicnicScene completed={4} label={text('picnic.scene')} />{:else}<div class="done-symbol" aria-hidden="true">✓</div>{/if}
			<h1 tabindex="-1">{text(picnicPlan ? 'picnic.title' : 'thinking.success')}</h1><p>{text(picnicPlan ? 'picnic.done' : 'thinking.done')}</p>
			{#if picnicPlan}<button class="primary" data-testid="picnic-replay" onclick={beginPicnic}>{text('picnic.replay')}</button>{/if}
			{#if picnicPlan}<button class="primary" data-testid="picnic-playground" onclick={openPlayground}>{text('playground.title')}</button>{/if}
			<button class="primary" onclick={hub}>{text('thinking.hub')}</button>
		</section>
	{:else if picnic && stage && picnic.phase === 'intro'}
		<section class="picnic-intro" data-testid="picnic-intro" data-chapter={stage.id}>
			<div class="activity-heading"><button class="quiet" onclick={hub}>← {text('thinking.hub')}</button><span>{text('picnic.chapter')} {numeral(picnic.stageIndex + 1)} / {numeral(4)}</span></div>
			<h1 tabindex="-1">{text(stage.titleKey)}</h1>
			<PicnicScene completed={picnic.completedChapters.length} hat={picnic.stageIndex === 0 && !jokeFixed} label={text('picnic.scene')} />
			<p class="story-copy">{text(stage.storyKey)}</p>
			<div class="story-actions">
				{#if picnic.stageIndex === 0}<button class="quiet" data-testid="picnic-fix-hat" disabled={jokeFixed || $paused} onclick={() => { jokeFixed = true; say('picnic.joke.fixed', { interrupt: true }); }}>{jokeFixed ? '✓ ' : ''}{text('picnic.joke.fix')}</button>{/if}
				<button class="primary" data-testid="picnic-begin-chapter" disabled={$paused} onclick={beginChapter}>{text('picnic.begin')} →</button>
			</div>
		</section>
	{:else if active && progress}
		<section class="activity" data-testid="activity-{lesson.kind}">
			<div class="activity-heading"><button class="quiet" onclick={hub}>← {text('thinking.hub')}</button><span>{text(picnic ? 'picnic.chapter' : 'thinking.lesson')} {numeral((picnic?.stageIndex ?? index) + 1)} / {numeral(picnicPlan?.stages.length ?? round.length)} · {text(ageBand === '5-7' ? 'thinking.age.younger' : 'thinking.age.older')}</span></div>
			<h1 tabindex="-1">{text(stage?.titleKey ?? `thinking.kind.${lesson.kind}`)}</h1>
			{#if lesson.kind==='number-pattern'&&!picnic}<div class="arithmetic-launcher" role="group" aria-label={text('rally.title')}><button class="quiet" data-testid="open-addition" disabled={$paused} onclick={()=>{stopNarration();arithmetic='add';}}>+ {text('rally.add')}</button><button class="quiet" data-testid="open-subtraction" disabled={$paused} onclick={()=>{stopNarration();arithmetic='subtract';}}>− {text('rally.subtract')}</button></div>{/if}
			{#if picnic}<div class="picnic-strip"><PicnicScene completed={picnic.completedChapters.length} compact label={text('picnic.scene')} /></div>{/if}
			<p class="instruction">{text(instruction)}</p>
			<div class="workspace" class:paused={$paused}>
				{#if lesson.kind === 'odd-one-out'}
					<div class="observation-options">
						{#each lesson.options as option, i}
							<button class="option observation" data-option-id={option.id} disabled={progress.phase === 'success' || $paused} aria-label={`${text('thinking.choice')} ${numeral(i + 1)}: ${numeral(option.quantity)} ${tokenName(option.token)}`} onclick={() => dispatch({ type: 'ANSWER', optionId: option.id })}>
								<div class="objects">{#each Array(option.quantity) as _}<ThinkingTokenView token={option.token} size={option.quantity > 1 ? 38 : 80} />{/each}</div>
								<span>{numeral(option.quantity)} · {option.token.picture ? tokenName(option.token) : text(`thinking.shape.${option.token.shape}`)}</span>
							</button>
						{/each}
					</div>
				{:else if lesson.kind === 'sequence-memory'}
					<div class="memory-sequence" data-testid="memory-sequence">
						{#each lesson.sequence as token, i}
							<div class="memory-slot" class:current={progress.phase === 'play' && i === progress.memoryIndex} aria-label={progress.phase === 'observe' || i < progress.memoryIndex ? tokenName(token) : text('thinking.next.slot')} data-token-id={progress.phase === 'observe' || i < progress.memoryIndex ? token.id : undefined}>
								<small>{numeral(i + 1)}</small>
								{#if progress.phase === 'observe' || i < progress.memoryIndex}<ThinkingTokenView {token} size={64} />{:else}<span aria-hidden="true">?</span>{/if}
							</div>
						{/each}
					</div>
					{#if progress.phase === 'observe'}
						<button class="primary" data-testid="remember" disabled={$paused} onclick={() => dispatch({ type: 'REMEMBER' })}>{text('thinking.remember')}</button>
					{:else if progress.phase === 'play'}
						<div class="memory-options">{#each lesson.options as token}<button class="option" data-option-id={token.id} disabled={$paused} aria-label={tokenName(token)} onclick={() => dispatch({ type: 'ANSWER', optionId: token.id })}><ThinkingTokenView {token} /><span>{tokenName(token)}</span></button>{/each}</div>
					{/if}
				{:else if lesson.kind === 'number-pattern'}
					<div class="number-sequence" class:bridge={!!picnic} data-testid="number-sequence">
						{#each lesson.sequence as value}<div class="number-group" data-value={value}><strong>{numeral(value)}</strong><div class="dots" aria-hidden="true">{#each Array(value) as _}<i></i>{/each}</div></div>{/each}
						<div class="number-group missing" class:repaired={picnic?.bridgeNumber !== null && picnic?.bridgeNumber !== undefined} aria-label={text('thinking.next.slot')} data-testid="missing-plank">
							{#if picnic?.bridgeNumber}<strong>{numeral(picnic.bridgeNumber)}</strong><div class="dots" aria-hidden="true">{#each Array(picnic.bridgeNumber) as _}<i></i>{/each}</div>{:else}?{/if}
						</div>
					</div>
					<div class="number-options">{#each lesson.options as option}<button class="option number-group" disabled={progress.phase === 'success' || $paused} data-option-id={option.id} aria-label={numeral(option.value)} onclick={() => dispatch({ type: 'ANSWER', optionId: option.id })}><strong>{numeral(option.value)}</strong><div class="dots" aria-hidden="true">{#each Array(option.value) as _}<i></i>{/each}</div></button>{/each}</div>
				{:else}
					<div class="path-workspace">
						<div class="path-grid" role="grid" tabindex="0" onkeydown={gridKey} aria-label={text('thinking.path.board')} aria-rowcount={lesson.size} aria-colcount={lesson.size} aria-activedescendant="thinking-cell-{progress.position.row}-{progress.position.column}" data-testid="path-grid" data-size={lesson.size}>
							{#each Array(lesson.size) as _, row}
							<div class="grid-row" role="row" style:grid-template-columns="repeat({lesson.size}, 1fr)">
							{#each Array(lesson.size) as _, column}
								{@const cell = { row, column }}
								{@const wall = lesson.walls.some((wall) => sameCell(wall, cell))}
								{@const ball = sameCell(progress.position, cell)}
								{@const goal = sameCell(lesson.goal, cell)}
								{@const cellLabel = text(ball ? picnic ? 'picnic.cell.rumi' : 'thinking.cell.ball' : wall ? picnic ? 'picnic.cell.rock' : 'thinking.cell.wall' : goal ? 'thinking.cell.goal' : 'thinking.cell.empty')}
								<div class="cell" id="thinking-cell-{row}-{column}" role="gridcell" aria-selected={ball} aria-label={`${numeral(row + 1)}, ${numeral(column + 1)}: ${cellLabel}`} class:wall class:ball class:goal class:clue={hint?.kind === 'grid-path' && hint.cell && sameCell(hint.cell, cell)} data-row={cell.row} data-column={cell.column} data-wall={wall} data-ball={ball} data-goal={goal}>
									{#if ball}{#if picnic}<div class="grid-rumi" aria-hidden="true"><svg viewBox="0 0 60 60" width="48" height="48"><circle cx="12" cy="14" r="8" fill="var(--mascot-fur)" /><circle cx="48" cy="14" r="8" fill="var(--mascot-fur)" /><circle cx="30" cy="31" r="24" fill="var(--mascot-fur)" stroke="var(--text-primary)" stroke-width="2" /><path d="M30 9 V18 M8 29 H17 M43 29 H52" stroke="var(--mascot-stripe)" stroke-width="3" /><circle cx="22" cy="29" r="3" /><circle cx="38" cy="29" r="3" /><path d="M23 41 Q30 49 37 41" fill="none" stroke="var(--text-primary)" stroke-width="3" stroke-linecap="round" /></svg></div>{:else}<span class="ball-marker" aria-hidden="true">●</span>{/if}{:else if wall}<span aria-hidden="true">▧</span>{:else if goal}<svg viewBox="0 0 60 60" width="40" height="40" aria-hidden="true"><path d="M18 52 V8 L46 19 L18 30" fill="var(--learn-green)" stroke="var(--text-primary)" stroke-width="4" stroke-linejoin="round" /></svg>{/if}
								</div>
							{/each}
							</div>
							{/each}
						</div>
						<div class="directions" aria-label={text('thinking.path.board')} role="group">{#each THINKING_DIRECTIONS as direction}<button class="option direction" data-direction={direction} disabled={progress.phase === 'success' || $paused} aria-label={text(`thinking.${direction}`)} onclick={() => dispatch({ type: 'MOVE', direction })}><b aria-hidden="true">{arrow[direction]}</b><small>{text(`thinking.${direction}`)}</small></button>{/each}</div>
					</div>
				{/if}
			</div>
			{#if hint}
				<div class="hint" role="status" data-testid="thinking-hint">
					{#if hint.kind === 'sequence-memory' && hint.token}{text('thinking.hint.memory')} <ThinkingTokenView token={hint.token} size={42} />
					{:else if hint.kind === 'number-pattern'}{text('thinking.hint.pattern')} <strong>{numeral(hint.step)}</strong>
					{:else if hint.kind === 'grid-path'}{text('thinking.hint.path')}
					{:else if hint.kind === 'odd-one-out'}{text(`thinking.hint.${hint.attribute}`)}{/if}
				</div>
			{/if}
			<footer>
				{#if progress.phase === 'success'}<p class="success" role="status">✓ {text(stage?.successKey ?? 'thinking.success')}</p><button class="primary" data-testid="thinking-next" disabled={$paused} onclick={nextLesson}>{text(picnic ? picnic.stageIndex === 3 ? 'picnic.finish' : 'picnic.continue' : 'thinking.more')} →</button>
				{:else}<button class="quiet" disabled={$paused} onclick={() => dispatch({ type: 'RESET' })}>{text('thinking.restart')}</button>
					{#if progress.phase === 'play'}<button class="quiet" data-testid="thinking-help" disabled={progress.attempts < 2 || progress.hintVisible || $paused} title={progress.attempts < 2 ? text('thinking.help.wait') : undefined} onclick={() => dispatch({ type: 'HINT' })}>{text('thinking.help')}</button>{/if}
				{/if}
			</footer>
		</section>
	{/if}
</div>
</div>
{/if}

<style>
	.thinking-shell { display: flex; flex-direction: column; flex: 1; min-height: 0; }
	.arithmetic-launcher { display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin:18px 0; }
	.treasure-hero { border:3px dashed var(--learn-green); border-radius:24px; padding:20px; margin:24px 0; background:var(--surface); }
	.treasure-hero h2 { margin:0; font-size:30px; }
	.treasure-hero p { font-size:22px; color:var(--text-secondary); margin:10px 0 18px; }
	.thinking-shell.creative-open > :global(header .caption) { font-size: 22px; line-height: 1.3; height: 3.9em; min-height: 0; overflow: auto; }
	.picnic-hero { display: flex; align-items: center; gap: 24px; padding: 20px 28px; margin: 24px 0; border: 3px solid var(--border-soft); border-radius: var(--radius-xl); background: var(--surface); text-align: start; }
	.hero-art { width: 38%; flex-shrink: 0; }
	.hero-copy h2 { font-size: 30px; margin: 0 0 6px; }
	.hero-copy p { margin: 0 0 14px; color: var(--text-secondary); font-size: 22px; }
	.hero-copy .primary { min-height: 64px; font-size: 23px; padding: 8px 22px; }
	.hero-buttons { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
	.practice-title { font-size: 24px; font-weight: 600; margin: 24px 0 16px; }
	.picnic-intro { max-width: 1000px; margin: 0 auto; text-align: center; }
	.story-copy { max-width: 780px; margin: 24px auto; font-size: 26px; color: var(--text-secondary); line-height: 1.5; }
	.story-actions { display: flex; justify-content: center; gap: 16px; flex-wrap: wrap; margin: 20px 0; }
	.picnic-strip { max-width: 350px; margin: 0 auto; }
	.round-done button { margin: 8px; }
	.bridge { padding: 16px; border-radius: 24px; background: var(--bg-secondary); border-bottom: 8px solid var(--learn-blue); }
	.bridge .number-group { background: var(--surface); border-color: var(--text-secondary); }
	.bridge .repaired { background: var(--bg-secondary); border-style: solid; outline: 3px solid var(--learn-green); }
	@media (max-width: 600px) { .picnic-hero { flex-direction: column; padding: 18px; gap: 10px; text-align: center; } .hero-art { width: 85%; } .story-copy { font-size: 22px; margin: 16px auto; } .story-actions button { width: 100%; } }
	@media (max-width: 600px) {
		.thinking-shell.creative-open > :global(header .caption) { font-size: 18px; height: 5.2em; }
		.thinking-shell > :global(header) { grid-template-columns: auto 1fr; gap: 8px; padding: 10px 12px; }
		.thinking-shell > :global(header .right) { grid-column: 2; grid-row: 1; justify-self: end; }
		.thinking-shell > :global(header .caption) { grid-column: 1 / -1; grid-row: 2; font-size: 20px; line-height: 1.3; }
		.thinking-shell > :global(header .icon) { width: 56px; height: 56px; }
	}
	.thinking { flex: 1; min-height: 0; overflow: auto; padding: 4px 28px 24px; }
	.hub, .activity, .round-done { max-width: 1080px; margin: 0 auto; text-align: center; }
	h1 { margin: 8px 0; font-size: clamp(28px, 3.2vw, 44px); line-height: 1.25; }
	.eyebrow { font-size: 16px; letter-spacing: 0.08em; color: var(--text-secondary); }
	.subtitle, .instruction { margin: 8px 0 20px; color: var(--text-secondary); font-size: 24px; }
	.age-bands { display: flex; justify-content: center; flex-wrap: wrap; gap: 12px; margin: 22px 0; }
	button { cursor: pointer; border: 3px solid var(--border-soft); border-radius: var(--radius-lg); background: var(--surface); min-height: 64px; }
	button:disabled { opacity: 0.55; cursor: default; }
	.age-bands button { padding: 10px 28px; font-size: 24px; }
	.age-bands .chosen { border-color: var(--text-primary); background: var(--bg-secondary); font-weight: 700; }
	.lesson-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
	.lesson-card { display: flex; align-items: center; text-align: start; gap: 18px; padding: 24px; min-height: 150px; }
	.lesson-card:hover, .option:hover:not(:disabled) { border-color: var(--text-secondary); background: var(--bg-secondary); }
	.lesson-card h2 { margin: 0 0 6px; font-size: 28px; }
	.lesson-card p { margin: 0; font-size: 19px; color: var(--text-secondary); }
	.card-symbol { color: var(--learn-blue); font-size: 28px; white-space: nowrap; min-width: 98px; font-weight: 700; }
	.card-arrow { margin-left: auto; font-size: 32px; }
	.activity-heading { display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 18px; color: var(--text-secondary); }
	.quiet { padding: 8px 20px; font-size: 21px; }
	.primary { background: var(--text-primary); color: var(--bg-primary); padding: 12px 30px; min-height: 72px; font-size: 26px; font-weight: 700; }
	.workspace { display: flex; flex-direction: column; align-items: center; gap: 24px; margin: 22px 0; }
	.observation-options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); width: 100%; gap: 16px; max-width: 850px; }
	.option { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; padding: 12px; min-width: 88px; min-height: 100px; font-size: 20px; }
	.objects { min-height: 80px; display: flex; justify-content: center; flex-wrap: wrap; align-items: center; gap: 2px; max-width: 220px; }
	.memory-sequence, .memory-options, .number-sequence, .number-options { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; }
	.memory-slot { border: 3px dashed var(--border-soft); border-radius: 20px; width: 112px; height: 124px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 36px; }
	.memory-slot small { font-size: 16px; color: var(--text-secondary); }
	.memory-slot.current { border-color: var(--text-primary); border-style: solid; }
	.memory-options .option { min-width: 150px; }
	.number-group { width: 145px; min-height: 120px; border: 3px solid var(--border-soft); border-radius: 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; gap: 6px; }
	.number-group strong, .missing { font-size: 36px; }
	.missing { border-style: dashed; }
	.dots { display: grid; grid-template-columns: repeat(5, 12px); gap: 5px; }
	.dots i { width: 12px; height: 12px; border: 2px solid var(--text-primary); border-radius: 50%; background: var(--learn-blue); }
	.path-workspace { display: flex; gap: 36px; align-items: center; justify-content: center; }
	.path-grid { display: flex; flex-direction: column; gap: 7px; }
	.grid-row { display: grid; gap: 7px; }
	.cell { width: 66px; height: 66px; border-radius: 14px; background: var(--surface); border: 2px solid var(--border-soft); display: grid; place-items: center; font-size: 36px; }
	.cell.wall { background: var(--border-soft); color: var(--text-secondary); }
	.cell.clue { outline: 4px dashed var(--text-primary); outline-offset: -7px; }
	.ball-marker { color: var(--learn-blue); font-size: 50px; line-height: 1; }
	.directions { display: grid; grid-template-columns: repeat(2, 92px); gap: 10px; }
	.direction { min-height: 100px; }
	.direction b { font-size: 40px; line-height: 1; }
	.direction small { font-size: 18px; }
	.hint { border-radius: 20px; background: var(--bg-secondary); border: 2px solid var(--border-soft); padding: 10px 20px; margin: 12px auto; display: flex; align-items: center; justify-content: center; gap: 10px; max-width: 750px; font-size: 22px; }
	footer { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 16px; margin: 20px 0 8px; }
	.success { font-size: 24px; font-weight: 600; margin: 0; }
	.round-done { padding: 50px 16px; }
	.round-done p { font-size: 25px; margin: 20px 0 32px; }
	.done-symbol { color: var(--learn-green); font-size: 90px; }
	@media (max-width: 850px) { .lesson-card { padding: 16px; gap: 12px; } .card-symbol { min-width: 65px; font-size: 20px; } .lesson-card h2 { font-size: 24px; } .card-arrow { display: none; } .activity-heading { flex-wrap: wrap; justify-content: center; } }
	@media (max-width: 560px) { .thinking { padding: 4px 12px 20px; } .lesson-cards { grid-template-columns: 1fr; } .lesson-card { min-height: 112px; } .observation-options { grid-template-columns: repeat(2, minmax(0, 1fr)); } .memory-slot { width: 82px; height: 110px; } .memory-options .option { min-width: 120px; } .number-group { width: 110px; } .path-workspace { flex-direction: column; gap: 18px; } .cell { width: 60px; height: 60px; } .directions { grid-template-columns: repeat(4, 64px); } .direction { min-width: 64px; padding: 4px; } .instruction, .subtitle { font-size: 21px; } }
</style>
