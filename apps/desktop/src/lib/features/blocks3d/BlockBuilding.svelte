<script lang="ts">
	import { onMount, tick } from 'svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { instruct, leaveScreen, say, setIdlePrompt, speakLabel } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { PALETTE, SIZE, HEIGHT, SAVE_KEY, columnTop, inside, isLockedColumn, key, readBuild, template, type Block, type Cell, type Template } from './blocks.ts';
	import { cellCenter, paint, pick, type ScreenFace } from './render.ts';
	import { FREE_IDEAS, freeTile, ideaForMission, nextCell, placeIdea, type Guide } from './ideas.ts';
	import { addSaved, MAX_SAVED, readSaved, removeSaved, SAVED_KEY, type SavedBuild } from './savedBuilds.ts';
	import { formatNumeral, narrationText } from '@little-colors/core';
	import { playPlaceSound, playRemoveSound, playCelebrationSound } from './sfx.ts';
	import { MISSIONS, readUnlockedBadges, saveUnlockedBadge, type Mission } from './missions.ts';

	let canvas: HTMLCanvasElement;
	let board: HTMLDivElement;
	let blocks = $state<Block[]>([]);
	let undoStack = $state<Block[][]>([]);
	let redoStack = $state<Block[][]>([]);
	let color = $state<string>(PALETTE[0].hex);
	let tool = $state<'build' | 'erase'>('build');
	let angle = $state(Math.PI/4);
	let zoom = $state(1);
	let cursor = $state<Cell>({x:4,y:0,z:5});
	let message = $state('blocks.welcome');
	let storageOk = $state(true);
	let unavailable = $state(false);
	let ready = $state(false);
	let render = () => {};
	let faces: ScreenFace[] = [];
	const bn = $derived($settings.language === 'bn-BD');
	const colorName = $derived(PALETTE.find(c=>c.hex===color)!);
	const presets = [
		{ id: 'house', icon: '⌂', bn: 'ছোট বাড়ি', en: 'Little house' },
		{ id: 'tower', icon: '▥', bn: 'রঙিন টাওয়ার', en: 'Color tower' },
		{ id: 'rainbow', icon: '▰', bn: 'রঙিন সিঁড়ি', en: 'Colorful steps' },
		{ id: 'kaaba', icon: '■', bn: 'কাবা ঘর', en: 'The Kaaba' }
	] as const;

	// ── Missions & Gamification State ──
	let activeMissionId = $state<string | null>(null);
	let unlockedBadges = $state<string[]>([]);
	let showCelebration = $state(false);
	let lastCelebratedId = $state<string | null>(null);
	let activeTab = $state<'build' | 'missions'>('build');

	const activeMission = $derived(MISSIONS.find(m => m.id === activeMissionId) ?? null);
	const progress = $derived(activeMission ? activeMission.check(blocks) : null);


	// ── Hints (PR-25): idle hand, 💡 idea shadows, and a pointer when stuck ──
	let guide = $state<Guide | null>(null);
	let ideaTurn = 0;
	let handPoint = $state<{ x: number; y: number } | null>(null);
	/** The block top the hand points at; its screen point is recomputed on every redraw. */
	let handCell: Cell | null = null;
	function placeHand() {
		if (!handCell || !canvas) return;
		const [x,y] = cellCenter(canvas.clientWidth,canvas.clientHeight,blocks,angle,zoom,handCell,guide ?? undefined);
		handPoint = {x,y};
	}
	const guideNext = $derived(guide ? nextCell(guide, blocks) : null);
	const HINT_KEYS = new Set(['blocks.idea','blocks.idea-done','blocks.idea-full']);
	/** Point the ghost hand at the tile/block a child should tap to fill `cell`. */
	async function pointAt(cell: Cell | null, show = true) {
		if (!cell || !canvas) return;
		handCell = {x:cell.x,y:cell.y-1,z:cell.z};
		placeHand();
		await tick();
		if (show) showHand(['[data-guide-target]']);
	}
	function giveIdea() {
		if (guide) { guide = null; hideHand(); setIdlePrompt('blocks.intro'); return; }
		const id = ideaForMission(activeMissionId) ?? FREE_IDEAS[ideaTurn++ % FREE_IDEAS.length]!;
		const placed = placeIdea(id,blocks);
		if (!placed) { announce('blocks.idea-full',true); return; }
		guide = placed; tool = 'build';
		const next = nextCell(placed,blocks);
		if (next) color = next.color;
		announce('blocks.idea',true);
		setIdlePrompt('blocks.idea');
		void pointAt(next);
	}
	/** After each change: follow the shadow, or celebrate when it is all filled. */
	function followGuide() {
		if (!guide) return;
		const next = nextCell(guide,blocks);
		if (!next) {
			guide = null; setIdlePrompt('blocks.intro');
			announce('blocks.idea-done',true);
			playCelebrationSound($settings.soundEnabled ? $settings.volume : 0);
			return;
		}
		color = next.color;
		void pointAt(next,false);
	}
	// Idle: show what to do (at most twice until the child does something). Free building is never nagged.
	let idleTimer: ReturnType<typeof setTimeout> | null = null;
	let idleShown = 0;
	function onIdle() {
		if (galleryOpen || showCelebration || idleShown >= 2) return;
		idleShown += 1;
		if (guide && guideNext) void pointAt(guideNext);
		else if (!blocks.some(b=>!b.locked)) showHand(['[data-block-color]','[data-building-board]']);
		armIdle();
	}
	function armIdle() { if (idleTimer) clearTimeout(idleTimer); idleTimer = setTimeout(onIdle,10000); }
	function activity() { idleShown = 0; armIdle(); }

	function announce(id: string, narration = false) {
		message = id;
		if (narration) say(id,{interrupt:true});
	}
	function save() {
		try { localStorage.setItem(SAVE_KEY,JSON.stringify(blocks)); storageOk = true; }
		catch { storageOk = false; }
	}
	function commit(next: Block[]) {
		undoStack = [...undoStack.slice(-39),blocks]; redoStack = [];
		blocks = next; save();
	}
	function edit(cell: Cell, erase = tool==='erase') {
		if (!ready || unavailable) return;
		// The Kaaba model stays whole: nothing is taken away from it or piled on it (PR-13).
		if (isLockedColumn(blocks,cell.x,cell.z)) { announce('blocks.kaaba',true); void pointAt(freeTile(blocks,angle)); return; }
		if (!inside(cell)) { announce('blocks.limit',true); void pointAt(freeTile(blocks,angle)); return; }
		const existing = blocks.find(b=>key(b)===key(cell));
		const vol = $settings.soundEnabled ? $settings.volume : 0;
		if (erase) {
			if (!existing) return;
			commit(blocks.filter(b=>key(b)!==key(cell)));
			playRemoveSound(vol);
			announce('blocks.removed');
		} else {
			if (existing) return;
			commit([...blocks,{...cell,color}]);
			playPlaceSound(color, vol);
			announce('blocks.placed');
		}
		hideHand();
		followGuide();
	}
	function undo() {
		const previous = undoStack.at(-1); if (!previous) return;
		redoStack = [...redoStack,blocks]; blocks = previous; undoStack = undoStack.slice(0,-1);
		save(); announce('blocks.undone');
	}
	function redo() {
		const next = redoStack.at(-1); if (!next) return;
		undoStack = [...undoStack,blocks]; blocks = next; redoStack = redoStack.slice(0,-1);
		save(); announce('blocks.redone');
	}

	// ── Missions Actions ──
	function startMission(m: Mission) {
		activeMissionId = m.id;
		activeTab = 'missions';
		showCelebration = false;
		announce(bn ? `${m.titleBn}: ${m.goalBn}` : `${m.titleEn}: ${m.goalEn}`);
	}
	function closeCelebration() {
		showCelebration = false;
	}
	function nextMission() {
		showCelebration = false;
		if (!activeMission) return;
		const idx = MISSIONS.findIndex(m => m.id === activeMission.id);
		const next = MISSIONS[(idx + 1) % MISSIONS.length];
		startMission(next);
	}

	// ── My builds: keep finished creations and open them again (stored on this device) ──
	let savedList = $state<SavedBuild[]>([]);
	let galleryOpen = $state(false);
	let confirmDelete = $state<string | null>(null);
	let justSaved = $state(false);
	const SAY_KEYS = new Set(['blocks.saved','blocks.already','blocks.full','blocks.opened','blocks.deleted','blocks.save-failed']);
	const num = (n: number) => formatNumeral(n, $settings.numeralStyle);
	function persistSaved(next: SavedBuild[]): boolean {
		try { localStorage.setItem(SAVED_KEY,JSON.stringify(next)); savedList = next; return true; }
		catch { return false; }
	}
	function snapshot(): string {
		const c = document.createElement('canvas'); c.width = 240; c.height = 160;
		const g = c.getContext('2d'); if (!g) return '';
		paint(g,240,160,blocks,angle,1);
		return c.toDataURL('image/jpeg',0.8);
	}
	function saveBuild() {
		if (!blocks.length) return;
		const result = addSaved(savedList,blocks,snapshot(),Date.now());
		if (result.status === 'already') { announce('blocks.already',true); return; }
		if (result.status === 'full') { announce('blocks.full',true); galleryOpen = true; return; }
		if (result.status !== 'saved') return;
		if (!persistSaved(result.list)) { announce('blocks.save-failed',true); return; }
		announce('blocks.saved',true);
		justSaved = true; setTimeout(()=>justSaved=false,1200);
	}
	function openSaved(s: SavedBuild) {
		guide=null; commit(s.blocks.map(b=>({...b}))); tool='build'; galleryOpen=false; confirmDelete=null;
		announce('blocks.opened',true);
	}
	function deleteSaved(id: string) {
		if (confirmDelete !== id) { confirmDelete = id; return; }
		persistSaved(removeSaved(savedList,id)); confirmDelete = null; announce('blocks.deleted');
	}
	function closeGallery() { galleryOpen = false; confirmDelete = null; }
	const focusIn = (node: HTMLElement) => { node.focus({ preventScroll: true }); };
	function loadPreset(id: Template) {
		guide=null; commit(template(id)); tool='build'; cursor={x:0,y:0,z:5}; announce('blocks.template',true);
	}
	function locate(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		return pick(faces,(event.clientX-rect.left)*canvas.clientWidth/rect.width,(event.clientY-rect.top)*canvas.clientHeight/rect.height);
	}
	function point(event: PointerEvent, apply = false) {
		if (unavailable || (apply && event.button!==0)) return;
		const hit = locate(event); if (!hit) return;
		const top = columnTop(blocks,hit.cell.x,hit.cell.z);
		const cell = {x:hit.cell.x,y:tool==='erase' ? top-1 : top,z:hit.cell.z};
		cursor = {x:cell.x,y:cell.y,z:cell.z};
		if (apply) { board.focus({preventScroll:true}); edit(cell); }
	}
	function keyboard(event: KeyboardEvent) {
		if (event.altKey || event.metaKey || event.ctrlKey) return;
		const delta: Record<string,[number,number]> = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
		if (delta[event.key]) {
			event.preventDefault(); const [dx,dz] = delta[event.key];
			const x = Math.max(0,Math.min(SIZE-1,cursor.x+dx)), z = Math.max(0,Math.min(SIZE-1,cursor.z+dz));
			const top=columnTop(blocks,x,z); cursor={x,y:tool==='erase' ? Math.max(0,top-1) : top,z};
		} else if (event.key==='Enter' || event.key===' ') {
			event.preventDefault();
			const top=columnTop(blocks,cursor.x,cursor.z);
			edit({...cursor,y:tool==='erase' ? top-1 : top});
			cursor={...cursor,y:columnTop(blocks,cursor.x,cursor.z)};
		} else if (event.key==='Backspace' || event.key==='Delete') {
			event.preventDefault(); edit({...cursor,y:columnTop(blocks,cursor.x,cursor.z)-1},true);
			cursor={...cursor,y:columnTop(blocks,cursor.x,cursor.z)};
		}
	}
	function help() {
		instruct('blocks.intro'); showHand(['[data-block-color]','[data-building-board]']);
	}

	$effect(()=>{ blocks; color; cursor; tool; angle; zoom; guide; render(); });

	// Trigger celebration when active mission goal is met
	$effect(()=>{
		if (activeMission && progress?.done && lastCelebratedId !== activeMission.id) {
			lastCelebratedId = activeMission.id;
			unlockedBadges = saveUnlockedBadge(activeMission.id);
			playCelebrationSound($settings.soundEnabled ? $settings.volume : 0);
			showCelebration = true;
		}
	});

	onMount(()=>{
		try { blocks=readBuild(localStorage.getItem(SAVE_KEY)); } catch { storageOk=false; }
		try { savedList=readSaved(localStorage.getItem(SAVED_KEY)); } catch { savedList=[]; }
		try { unlockedBadges=readUnlockedBadges(); } catch { unlockedBadges=[]; }
		ready=true;
		const ctx=canvas.getContext('2d');
		if (!ctx) { unavailable=true; return () => { hideHand(); leaveScreen(); }; }
		render=()=>{
			const width=canvas.clientWidth,height=canvas.clientHeight;
			const ratio=Math.min(window.devicePixelRatio || 1,2);
			if (canvas.width!==Math.round(width*ratio) || canvas.height!==Math.round(height*ratio)) {
				canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
			}
			ctx.setTransform(ratio,0,0,ratio,0,0);
			const preview=tool==='build' && !guide && inside(cursor) && !isLockedColumn(blocks,cursor.x,cursor.z) && !blocks.some(b=>key(b)===key(cursor)) ? {...cursor,color} : undefined;
			faces=paint(ctx,width,height,blocks,angle,zoom,preview,guide ? {cells:guide.cells,next:nextCell(guide,blocks)} : undefined);
			placeHand();
		};
		const observer=new ResizeObserver(()=>render()); observer.observe(canvas);
		instruct('blocks.intro');
		if (firstTime('blocks3d')) showHand(['[data-block-color]','[data-building-board]']);
		window.addEventListener('pointerdown',activity); window.addEventListener('keydown',activity); armIdle();
		return ()=>{ observer.disconnect(); hideHand(); leaveScreen(); render=()=>{}; if (idleTimer) clearTimeout(idleTimer); window.removeEventListener('pointerdown',activity); window.removeEventListener('keydown',activity); };
	});
</script>

<svelte:window onkeydown={(e)=>{ if (galleryOpen && e.key==='Escape') closeGallery(); if (showCelebration && e.key==='Escape') closeCelebration(); }} />
<svelte:head><title>3D Block Building · Little Colors</title></svelte:head>
<TopBar onreplay={()=>instruct('blocks.intro')} />
<section class="builder">
	<div class="heading">
		<div>
			<p class="eyebrow">{bn ? 'কল্পনা করি • তৈরি করি • খেলি' : 'IMAGINE · BUILD · PLAY'}</p>
			<h1>{bn ? 'থ্রিডি ব্লক বিল্ডিং' : '3D Block Building'}</h1>
		</div>
		<div class="heading-actions">
			{#if unlockedBadges.length > 0}
				<div class="badges-strip" title={bn ? 'অর্জিত ব্যাজ' : 'Earned Badges'}>
					{#each unlockedBadges as bId}
						{@const m = MISSIONS.find(x => x.id === bId)}
						{#if m}
							<span class="badge-pill" title={bn ? m.badgeNameBn : m.badgeNameEn}>{m.badge}</span>
						{/if}
					{/each}
				</div>
			{/if}
			<button class="gallery-button" class:pop={justSaved} data-testid="my-builds" onclick={()=>{galleryOpen=true;}} onfocus={()=>speakLabel('blocks.gallery')}>
				<span aria-hidden="true">🖼</span> {bn ? 'আমার বানানো' : 'My builds'} <span class="count">{num(savedList.length)}</span>
			</button>
			<p class="saved" role="status">{storageOk ? (bn ? '✓ এই ডিভাইসে সেভ থাকে' : '✓ Saved on this device') : (bn ? 'এইবারের ডিজাইন সেভ করা যাচ্ছে না' : 'Saving is unavailable this time')}</p>
		</div>
	</div>

	<!-- Active Mission Banner -->
	{#if activeMission && progress}
		<div class="mission-banner" class:complete={progress.done}>
			<div class="mission-info">
				<span class="mission-icon" aria-hidden="true">{activeMission.badge}</span>
				<div>
					<strong>{bn ? activeMission.titleBn : activeMission.titleEn}:</strong>
					<span>{bn ? activeMission.goalBn : activeMission.goalEn}</span>
					<small class="mission-summary">({bn ? progress.summaryBn : progress.summaryEn})</small>
				</div>
			</div>
			<div class="mission-meter">
				<div class="meter-bar" style:width="{Math.min(100, Math.round((progress.current / progress.target) * 100))}%"></div>
			</div>
			<button class="exit-mission" onclick={() => { activeMissionId = null; }}>✕ {bn ? 'মুক্ত খেলা' : 'Free Play'}</button>
		</div>
	{/if}

	<div class="workspace">
		<aside>
			<!-- Mode switch: Tools vs Missions -->
			<div class="mode-tabs" role="tablist">
				<button role="tab" aria-selected={activeTab==='build'} class:tab-active={activeTab==='build'} onclick={()=>activeTab='build'}>
					🎨 {bn ? 'টুলস' : 'Build'}
				</button>
				<button role="tab" aria-selected={activeTab==='missions'} class:tab-active={activeTab==='missions'} onclick={()=>activeTab='missions'}>
					🎯 {bn ? 'মিশন' : 'Missions'}
				</button>
			</div>

			{#if activeTab === 'build'}
				<div class="tool-section"><h2>{bn ? 'রং বেছে নিই' : 'Pick a color'}</h2>
					<div class="palette" role="group" aria-label={bn ? 'ব্লকের রং' : 'Block colors'}>
						{#each PALETTE as c}
							<button data-block-color style:--swatch={c.hex} class="swatch" class:dark={c.hex==='#2f3437'} class:light={c.hex==='#ffffff'} aria-label={bn ? c.bn : c.en} aria-pressed={color===c.hex} onclick={()=>{color=c.hex;tool='build';}}><span aria-hidden="true">{color===c.hex ? '✓' : ''}</span></button>
						{/each}
					</div><p class="selected-color">{bn ? colorName.bn : colorName.en}</p>
				</div>
				<div class="tool-section"><h2>{bn ? 'কী করতে চাই?' : 'Your tools'}</h2>
					<div class="tools" role="group" aria-label={bn ? 'ব্লকের কাজ' : 'Building tools'}>
						<button aria-pressed={tool==='build'} onclick={()=>{tool='build';}} onfocus={()=>speakLabel('blocks.add')}><span aria-hidden="true">＋</span>{bn ? 'ব্লক বসাই' : 'Add block'}</button>
						<button aria-pressed={tool==='erase'} onclick={()=>{tool='erase';}} onfocus={()=>speakLabel('blocks.erase')}><span aria-hidden="true">−</span>{bn ? 'ব্লক সরাই' : 'Remove block'}</button>
					</div>
				</div>
				<div class="tool-section presets"><h2>{bn ? 'এগুলো দিয়ে শুরু করি' : 'Start with an idea'}</h2>
					{#each presets as preset}<button onclick={()=>loadPreset(preset.id)}><span class="preset-icon" aria-hidden="true">{preset.icon}</span>{bn ? preset.bn : preset.en}<span class="go" aria-hidden="true">↗</span></button>{/each}
				</div>
			{:else}
				<div class="tool-section">
					<h2>{bn ? 'চ্যালেঞ্জ মিশন' : 'Fun Missions'}</h2>
					<p class="mission-desc">{bn ? 'যেকোনো একটি মিশন বেছে নিয়ে শেখা শুরু করো!' : 'Choose a challenge to build and learn!'}</p>
					<div class="missions-list">
						{#each MISSIONS as m}
							{@const isDone = unlockedBadges.includes(m.id)}
							<button class="mission-card" class:active-card={activeMissionId === m.id} onclick={() => startMission(m)}>
								<span class="m-badge" aria-hidden="true">{m.badge}</span>
								<div class="m-text">
									<strong>{bn ? m.titleBn : m.titleEn}</strong>
									<small>{bn ? m.goalBn : m.goalEn}</small>
								</div>
								{#if isDone}
									<span class="m-tick" title={bn ? 'সম্পন্ন' : 'Completed'}>✓</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/if}

		</aside>

		<div class="stage">
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<div class="board" bind:this={board} data-building-board tabindex="0" role="application" aria-label={bn ? 'থ্রিডি ব্লক তৈরির জায়গা' : '3D building area'} aria-describedby="building-help"
				onpointermove={(e)=>point(e)} onpointerdown={(e)=>point(e,true)} onkeydown={keyboard}>
				<canvas bind:this={canvas} aria-hidden="true"></canvas>
				{#if handPoint}<span class="guide-target" data-guide-target aria-hidden="true" style:left="{handPoint.x}px" style:top="{handPoint.y}px"></span>{/if}
				<div class="board-label" aria-hidden="true">{tool==='build' ? '＋' : '−'} {bn ? (tool==='build' ? 'ব্লক বসাই' : 'ব্লক সরাই') : (tool==='build' ? 'BUILD MODE' : 'REMOVE MODE')}</div>
				{#if unavailable}<div class="unavailable" role="status">{bn ? 'তৈরির জায়গাটি খুলতে পারিনি। আবার খুলি।' : 'The building area could not open. Please reopen the game.'}</div>{/if}
			</div>
			<div class="view-tools" role="group" aria-label={bn ? 'চারদিক দেখি' : 'Camera controls'}>
				<button aria-label={bn ? 'বামে ঘোরাই' : 'Rotate left'} onclick={()=>angle-=Math.PI/4}>↶</button>
				<span>{bn ? 'চারদিক দেখি' : 'Look around'}</span>
				<button aria-label={bn ? 'ডানে ঘোরাই' : 'Rotate right'} onclick={()=>angle+=Math.PI/4}>↷</button>
				<div class="divider"></div>
				<button aria-label={bn ? 'দূর থেকে দেখি' : 'Zoom out'} disabled={zoom<=0.65} onclick={()=>zoom=Math.max(0.65,zoom-0.15)}>−</button>
				<button aria-label={bn ? 'কাছ থেকে দেখি' : 'Zoom in'} disabled={zoom>=1.45} onclick={()=>zoom=Math.min(1.45,zoom+0.15)}>＋</button>
				<div class="divider"></div>
				<button class="idea" class:on={!!guide} data-testid="idea" aria-pressed={!!guide} onclick={giveIdea} onfocus={()=>speakLabel('blocks.idea-button')}><span aria-hidden="true">{guide ? '✕' : '💡'}</span> {guide ? (bn ? 'ছায়া বন্ধ' : 'Hide idea') : (bn ? 'আইডিয়া দাও' : 'Give me an idea')}</button>
				<button class="help" onclick={help}>☞ {bn ? 'দেখিয়ে দাও' : 'Show me how'}</button>
			</div>
		</div>
	</div>

	<div class="bottom-bar">
		<div id="building-help"><strong>{bn ? 'ঘরে বা ব্লকে ট্যাপ করি, নতুন ব্লক উপরে বসবে' : 'Tap a tile or a block: the new block goes on top'}</strong><small>{bn ? 'কিবোর্ড: তীর দিয়ে ঘর বাছি • Enter বসায় • Backspace সরায়' : 'Keyboard: arrows choose a tile · Enter adds · Backspace removes'}</small></div>
		<div class="history">
			<button class="save-button" data-testid="save-build" disabled={!blocks.length} onclick={saveBuild} onfocus={()=>speakLabel('blocks.save')}><span aria-hidden="true">💾</span> {bn ? 'সেভ করি' : 'Save'}</button>
			<button aria-label={bn ? 'আগের ধাপে যাই' : 'Undo'} disabled={!undoStack.length} onclick={undo}>↶ {bn ? 'আগের ধাপ' : 'Undo'}</button>
			<button aria-label={bn ? 'পরের ধাপে যাই' : 'Redo'} disabled={!redoStack.length} onclick={redo}>↷ {bn ? 'পরের ধাপ' : 'Redo'}</button>
			<button disabled={!blocks.length} onclick={()=>{guide=null;commit([]);announce('blocks.cleared');}}>▧ {bn ? 'খালি করি' : 'Clear'}</button>
		</div>
	</div>
	<p class="feedback" aria-live="polite">{#if message==='blocks.limit'}{bn ? `এই জায়গায় আর ব্লক বসবে না। সর্বোচ্চ ${HEIGHT.toLocaleString('bn-BD')} তলা বানাই।` : `Try another spot. You can build up to ${HEIGHT} blocks high.`}{:else if message==='blocks.placed'}{bn ? 'ব্লক বসেছে! এবার কী বানাবো?' : 'Block added. What shall we build?'}{:else if message==='blocks.removed'}{bn ? 'ব্লক সরেছে। নতুন করে সাজাই!' : 'Block removed. Make room for a new idea!'}{:else if message==='blocks.undone'}{bn ? 'আগের ধাপে ফিরে এসেছি।' : 'Back to the previous step.'}{:else if message==='blocks.redone'}{bn ? 'ধাপটি আবার ফিরেছে।' : 'That step is back.'}{:else if message==='blocks.cleared'}{bn ? 'আবার নতুন কিছু বানাই! আগের ধাপে গেলে ডিজাইন ফিরে আসবে।' : 'A fresh canvas! Undo brings your design back.'}{:else if message==='blocks.kaaba'}{bn ? 'কাবা ঘর যেমন আছে তেমনই থাকুক। চারপাশের উঠানে সাজাই!' : 'The Kaaba stays just as it is. Let’s build in the courtyard around it!'}{:else if SAY_KEYS.has(message) || HINT_KEYS.has(message)}{narrationText(message,$settings.language,$settings.islamicExpressionsEnabled)}{:else if message==='blocks.template'}{bn ? 'এবার নিজের মতো করে সাজাই!' : 'Now make it your own!'}{:else}{bn ? 'বাড়ি, টাওয়ার, সিঁড়ি—যা ইচ্ছে বানাই!' : 'A house, a tower, some steps. Build anything you imagine!'}{/if}</p>

	<!-- Celebration Modal -->
	{#if showCelebration && activeMission}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="scrim" onclick={closeCelebration}></div>
		<div class="celebration-dialog" role="dialog" aria-modal="true" tabindex="-1">
			<div class="confetti-ring">✨ 🌟 💫 🎈 🏆</div>
			<h2>{$settings.islamicExpressionsEnabled ? (bn ? 'মাশাআল্লাহ! চমৎকার হয়েছে!' : 'MashaAllah! Great Job!') : (bn ? 'চমৎকার হয়েছে!' : 'Great job!')}</h2>
			<div class="celebration-badge">
				<span class="big-badge">{activeMission.badge}</span>
				<p><strong>{bn ? activeMission.badgeNameBn : activeMission.badgeNameEn}</strong> {bn ? 'ব্যাজ অর্জন করেছো!' : 'Badge Unlocked!'}</p>
			</div>
			<div class="celebration-actions">
				<button class="celebrate-btn next" onclick={nextMission}>
					{bn ? 'পরের মিশন ➔' : 'Next Mission ➔'}
				</button>
				<button class="celebrate-btn close-btn" onclick={closeCelebration}>
					{bn ? 'চালিয়ে যাই' : 'Keep Building'}
				</button>
			</div>
		</div>
	{/if}

	{#if galleryOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="scrim" onclick={closeGallery}></div>
		<div class="gallery" role="dialog" aria-modal="true" aria-label={bn ? 'আমার বানানো' : 'My builds'} tabindex="-1" use:focusIn>
			<div class="gallery-head">
				<h2><span aria-hidden="true">🖼</span> {bn ? 'আমার বানানো' : 'My builds'} <small>{num(savedList.length)} / {num(MAX_SAVED)}</small></h2>
				<button class="close" aria-label={bn ? 'বন্ধ করি' : 'Close'} onclick={closeGallery}>✕</button>
			</div>
			{#if savedList.length === 0}
				<p class="gallery-empty"><span aria-hidden="true">💾</span> {bn ? 'এখনো কিছু সেভ করা নেই। বানিয়ে "সেভ করি" চাপি!' : 'Nothing saved yet. Build something and press "Save"!'}</p>
			{:else}
				<div class="gallery-grid">
					{#each savedList as s, i (s.id)}
						<div class="saved-card" data-saved-id={s.id}>
							<button class="open" aria-label={bn ? `বানানো ${num(savedList.length - i)} খুলি` : `Open build ${savedList.length - i}`} onclick={()=>openSaved(s)}>
								<img src={s.thumb} alt="" />
								<span class="badge">{num(savedList.length - i)}</span>
							</button>
							<button class="delete" class:confirm={confirmDelete===s.id} aria-label={confirmDelete===s.id ? (bn ? 'হ্যাঁ, মুছে ফেলি' : 'Yes, delete') : (bn ? 'মুছে ফেলি' : 'Delete')} onclick={()=>deleteSaved(s.id)}>{confirmDelete===s.id ? '✓' : '🗑'}</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</section>

<style>
	.builder { display:flex; flex-direction:column; flex:1; min-height:0; width:100%; max-width:1560px; padding:0 28px 12px; margin:auto; gap:12px; }
	.heading { display:flex; align-items:center; justify-content:space-between; gap:16px; }
	h1 { margin:0; font-size:34px; line-height:1.2; } .eyebrow { margin:0 0 4px; font-size:14px; color:var(--text-secondary); letter-spacing:0.1em; }
	.saved { margin:0; padding:8px 14px; border-radius:12px; background:#e6eddf; color:#506d51; font-size:17px; }
	.badges-strip { display:flex; gap:6px; align-items:center; background:#f4f7ee; padding:4px 10px; border-radius:12px; border:1px solid #d4dec8; }
	.badge-pill { font-size:20px; }
	.mission-banner { display:flex; align-items:center; justify-content:space-between; gap:16px; background:#eef5e9; border:2px solid #b2cca6; border-radius:16px; padding:10px 18px; }
	.mission-banner.complete { background:#dcf5d8; border-color:#65bb5d; }
	.mission-info { display:flex; align-items:center; gap:12px; font-size:17px; }
	.mission-icon { font-size:26px; }
	.mission-summary { margin-left:8px; color:#557850; font-weight:600; font-size:15px; }
	.mission-meter { flex:1; max-width:260px; height:12px; background:#d7e2ce; border-radius:6px; overflow:hidden; }
	.meter-bar { height:100%; background:#4e9949; border-radius:6px; transition:width 300ms ease-out; }
	.exit-mission { font-size:14px; padding:4px 10px; min-height:36px; border-radius:10px; background:#fff; border:1px solid #c2d4bc; }
	.workspace { display:flex; gap:20px; flex:1; min-height:0; }
	aside { display:flex; flex-direction:column; width:262px; flex-shrink:0; gap:10px; padding:12px; border:2px solid var(--border-soft); border-radius:24px; background:var(--surface); overflow-y:auto; min-height:0; line-height:1.2; }
	.mode-tabs { display:flex; gap:6px; margin-bottom:4px; }
	.mode-tabs button { flex:1; padding:6px 4px; font-size:15px; min-height:40px; border-radius:12px; border:1px solid var(--border-soft); background:#f7f9f3; }
	.mode-tabs button.tab-active { background:#4f7061; color:#fff; border-color:#3e584c; font-weight:700; }
	.mission-desc { font-size:14px; color:var(--text-secondary); margin:0 0 8px; }
	.missions-list { display:flex; flex-direction:column; gap:8px; }
	.mission-card { display:flex; align-items:center; gap:10px; padding:8px 10px; text-align:left; border-radius:14px; border:1.5px solid var(--border-soft); background:#fafcf7; min-height:60px; }
	.mission-card:hover { background:#eef4e6; }
	.mission-card.active-card { border-color:#4f7061; background:#e7efe0; box-shadow:0 0 0 1px #4f7061; }
	.m-badge { font-size:24px; flex-shrink:0; }
	.m-text { display:flex; flex-direction:column; flex:1; }
	.m-text strong { font-size:15px; line-height:1.2; }
	.m-text small { font-size:12px; color:var(--text-secondary); }
	.m-tick { font-size:18px; color:#3e8c46; font-weight:700; }
	h2 { margin:0 0 9px; font-size:20px; } button { border:2px solid var(--border-soft); border-radius:13px; background:var(--surface); min-height:48px; padding:7px 12px; cursor:pointer; font-weight:600; font-size:18px; }
	button:hover { background:#edf1e6; } button:disabled { opacity:0.4; cursor:default; } button[aria-pressed='true'] { border-color:#526e63; background:#e9efe1; }
	.palette { display:grid; grid-template-columns:repeat(6,1fr); gap:6px; } .swatch { padding:3px; min-height:38px; height:38px; border-radius:11px; background:var(--swatch); box-shadow:inset 0 0 0 3px #ffffff80; } .swatch[aria-pressed='true'] { background:var(--swatch); outline:2px solid #526e63; outline-offset:2px; } .swatch span { font-size:22px; color:#304c4a; } .swatch.dark span { color:#ffffff; } .swatch.light { box-shadow:inset 0 0 0 2px #c9c2b4; }
	.selected-color { margin:6px 0 0; font-size:14px; color:var(--text-secondary); } .tools { display:flex; gap:7px; } .tools button { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-size:15px; padding:5px; min-height:64px; } .tools button span { font-size:25px; }
	.presets { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; } .presets h2 { grid-column:1/-1; margin-bottom:2px; } .presets button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:13px; padding:4px 3px; min-height:52px; } .preset-icon { font-size:27px; color:#9b765b; } .go { display:none; } .help { margin-top:auto; font-size:16px; min-height:44px; }
	.stage { display:flex; flex:1; min-width:0; flex-direction:column; gap:8px; } .board { position:relative; flex:1; min-height:220px; overflow:hidden; border:2px solid #b7cdba; border-radius:24px; background:#dfedec; touch-action:manipulation; cursor:crosshair; } canvas { position:absolute; display:block; width:100%; height:100%; } .board-label { position:absolute; top:16px; left:18px; border-radius:10px; padding:5px 11px; background:#fffcf0d9; font-size:15px; font-weight:600; pointer-events:none; color:#567465; }
	.guide-target { position:absolute; width:2px; height:2px; pointer-events:none; }
	.idea { font-size:17px; } .idea.on { background:#fff3c4; border-color:#d9b23c; } .help { font-size:16px; }
	.view-tools { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:9px; } .view-tools button { min-width:48px; font-size:24px; } .view-tools span { font-size:16px; color:var(--text-secondary); } .divider { width:1px; height:25px; background:var(--border-soft); margin:0 8px; }
	.bottom-bar { display:flex; align-items:center; justify-content:space-between; gap:14px; } #building-help { display:flex; flex-direction:column; } strong { font-size:21px; } small { font-size:16px; color:var(--text-secondary); } .history { display:flex; gap:8px; } .feedback { margin:0; font-size:17px; text-align:center; color:var(--text-secondary); min-height:25px; } .unavailable { position:absolute; inset:0; display:grid; place-items:center; background:#fff8e8e8; padding:30px; text-align:center; }
	.heading-actions { display:flex; align-items:center; gap:10px; } .gallery-button { display:flex; align-items:center; gap:6px; } .gallery-button .count { min-width:28px; padding:0 7px; border-radius:10px; background:#e6eddf; color:#506d51; } .gallery-button.pop { animation:pop 600ms ease-out; }
	.save-button { background:#3f8f5f; border-color:#2f6f49; color:#ffffff; } .save-button:hover:not(:disabled) { background:#357d52; }
	.scrim { position:fixed; inset:0; background:#2a2f2a66; z-index:40; }
	.celebration-dialog { position:fixed; z-index:42; left:50%; top:50%; transform:translate(-50%,-50%); width:min(440px,90vw); padding:24px 20px; border-radius:28px; background:var(--surface); box-shadow:0 24px 60px #00000040; text-align:center; display:flex; flex-direction:column; align-items:center; gap:12px; border:3px solid #84bb79; animation:pop 400ms ease-out; }
	.confetti-ring { font-size:32px; letter-spacing:6px; }
	.celebration-dialog h2 { margin:0; font-size:26px; color:#2d6935; }
	.celebration-badge { display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 20px; background:#f4faee; border-radius:20px; border:2px dashed #9bc892; width:100%; box-sizing:border-box; }
	.big-badge { font-size:52px; }
	.celebration-actions { display:flex; gap:10px; width:100%; margin-top:8px; }
	.celebrate-btn { flex:1; min-height:48px; font-size:17px; border-radius:14px; }
	.celebrate-btn.next { background:#3f8f5f; color:#fff; border-color:#2f6f49; }
	.celebrate-btn.close-btn { background:#edf1e6; }
	.gallery { position:fixed; z-index:41; left:50%; top:50%; transform:translate(-50%,-50%); width:min(860px,92vw); max-height:84vh; overflow:auto; padding:18px 22px 22px; border-radius:24px; background:var(--surface); box-shadow:0 20px 50px #0003; }
	.gallery-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; } .gallery-head h2 { margin:0; font-size:26px; } .gallery-head small { font-size:17px; color:var(--text-secondary); margin-left:6px; } .close { min-width:52px; font-size:22px; }
	.gallery-empty { font-size:20px; text-align:center; padding:30px 10px; color:var(--text-secondary); }
	.gallery-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px; }
	.saved-card { position:relative; } .saved-card .open { width:100%; padding:6px; border-radius:16px; display:block; } .saved-card img { width:100%; aspect-ratio:3/2; display:block; border-radius:11px; object-fit:cover; }
	.badge { position:absolute; left:14px; top:14px; min-width:30px; padding:1px 8px; border-radius:10px; background:#fffcf0e6; font-size:17px; }
	.delete { position:absolute; right:10px; top:10px; min-height:40px; min-width:40px; padding:2px 8px; font-size:18px; background:#fffcf0e6; } .delete.confirm { background:#c4553f; border-color:#a03f2c; color:#ffffff; }
	@keyframes pop { 0% { transform:scale(1); } 40% { transform:scale(1.12); } 100% { transform:scale(1); } }
	@media (prefers-reduced-motion: reduce) { .gallery-button.pop, .celebration-dialog { animation:none; } }
	@media(max-height:720px) { .builder { gap:8px; } .eyebrow { display:none; } h1 { font-size:28px; } aside { gap:9px; padding:12px; } .workspace { min-height:0; } }
</style>
