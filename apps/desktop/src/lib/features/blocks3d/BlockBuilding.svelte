<script lang="ts">
	import { onMount } from 'svelte';
	import TopBar from '#lib/components/ui/TopBar.svelte';
	import { settings } from '#lib/stores/settings.ts';
	import { instruct, leaveScreen, say, speakLabel } from '#lib/audio/narrator.ts';
	import { firstTime, hideHand, showHand } from '#lib/game/hand.ts';
	import { PALETTE, SIZE, HEIGHT, SAVE_KEY, columnTop, inside, key, readBuild, template, type Block, type Cell, type Template } from './blocks.ts';
	import { paint, pick, type ScreenFace } from './render.ts';

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
		{ id: 'rainbow', icon: '▰', bn: 'রংধনু সিঁড়ি', en: 'Rainbow steps' }
	] as const;
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
		if (!inside(cell)) { announce('blocks.limit',true); return; }
		const existing = blocks.find(b=>key(b)===key(cell));
		if (erase) {
			if (!existing) return;
			commit(blocks.filter(b=>key(b)!==key(cell))); announce('blocks.removed');
		} else {
			if (existing) return;
			commit([...blocks,{...cell,color}]); announce('blocks.placed');
		}
		hideHand();
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
	function loadPreset(id: Template) {
		commit(template(id)); tool='build'; cursor={x:0,y:0,z:5}; announce('blocks.template',true);
	}
	function locate(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		return pick(faces,(event.clientX-rect.left)*canvas.clientWidth/rect.width,(event.clientY-rect.top)*canvas.clientHeight/rect.height);
	}
	function point(event: PointerEvent, apply = false) {
		if (unavailable || (apply && event.button!==0)) return;
		const hit = locate(event); if (!hit) return;
		// Young children cannot aim at a thin roof: tapping anywhere on a column (floor tile,
		// side or top of a block) stacks onto that column; erase takes its top block.
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
	$effect(()=>{ blocks; color; cursor; tool; angle; zoom; render(); });
	onMount(()=>{
		try { blocks=readBuild(localStorage.getItem(SAVE_KEY)); } catch { storageOk=false; }
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
			const preview=tool==='build' && inside(cursor) && !blocks.some(b=>key(b)===key(cursor)) ? {...cursor,color} : undefined;
			faces=paint(ctx,width,height,blocks,angle,zoom,preview);
		};
		const observer=new ResizeObserver(()=>render()); observer.observe(canvas);
		instruct('blocks.intro');
		if (firstTime('blocks3d')) showHand(['[data-block-color]','[data-building-board]']);
		return ()=>{ observer.disconnect(); hideHand(); leaveScreen(); render=()=>{}; };
	});
</script>

<svelte:head><title>3D Block Building · Little Colors</title></svelte:head>
<TopBar onreplay={()=>instruct('blocks.intro')} />
<section class="builder">
	<div class="heading">
		<div><p class="eyebrow">{bn ? 'কল্পনা করি • তৈরি করি • খেলি' : 'IMAGINE · BUILD · PLAY'}</p><h1>{bn ? 'থ্রিডি ব্লক বিল্ডিং' : '3D Block Building'}</h1></div>
		<p class="saved" role="status">{storageOk ? (bn ? '✓ এই ডিভাইসে সেভ থাকে' : '✓ Saved on this device') : (bn ? 'এইবারের ডিজাইন সেভ করা যাচ্ছে না' : 'Saving is unavailable this time')}</p>
	</div>
	<div class="workspace">
		<aside>
			<div class="tool-section"><h2>{bn ? 'রং বেছে নিই' : 'Pick a color'}</h2>
				<div class="palette" role="group" aria-label={bn ? 'ব্লকের রং' : 'Block colors'}>
					{#each PALETTE as c}
						<button data-block-color style:--swatch={c.hex} class="swatch" aria-label={bn ? c.bn : c.en} aria-pressed={color===c.hex} onclick={()=>{color=c.hex;tool='build';}}><span aria-hidden="true">{color===c.hex ? '✓' : ''}</span></button>
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
			<button class="help" onclick={help}>☞ {bn ? 'দেখিয়ে দাও' : 'Show me how'}</button>
		</aside>
		<div class="stage">
			<!-- A canvas editor needs application semantics and focus to receive its documented building keys. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
			<div class="board" bind:this={board} data-building-board tabindex="0" role="application" aria-label={bn ? 'থ্রিডি ব্লক তৈরির জায়গা' : '3D building area'} aria-describedby="building-help"
				onpointermove={(e)=>point(e)} onpointerdown={(e)=>point(e,true)} onkeydown={keyboard}>
				<canvas bind:this={canvas} aria-hidden="true"></canvas>
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
			</div>
		</div>
	</div>
	<div class="bottom-bar">
		<div id="building-help"><strong>{bn ? 'ঘরে বা ব্লকে ট্যাপ করি, নতুন ব্লক উপরে বসবে' : 'Tap a tile or a block: the new block goes on top'}</strong><small>{bn ? 'কিবোর্ড: তীর দিয়ে ঘর বাছি • Enter বসায় • Backspace সরায়' : 'Keyboard: arrows choose a tile · Enter adds · Backspace removes'}</small></div>
		<div class="history">
			<button aria-label={bn ? 'আগের ধাপে যাই' : 'Undo'} disabled={!undoStack.length} onclick={undo}>↶ {bn ? 'আগের ধাপ' : 'Undo'}</button>
			<button aria-label={bn ? 'পরের ধাপে যাই' : 'Redo'} disabled={!redoStack.length} onclick={redo}>↷ {bn ? 'পরের ধাপ' : 'Redo'}</button>
			<button disabled={!blocks.length} onclick={()=>{commit([]);announce('blocks.cleared');}}>▧ {bn ? 'খালি করি' : 'Clear'}</button>
		</div>
	</div>
	<p class="feedback" aria-live="polite">{#if message==='blocks.limit'}{bn ? `এই জায়গায় আর ব্লক বসবে না। সর্বোচ্চ ${HEIGHT.toLocaleString('bn-BD')} তলা বানাই।` : `Try another spot. You can build up to ${HEIGHT} blocks high.`}{:else if message==='blocks.placed'}{bn ? 'ব্লক বসেছে! এবার কী বানাবো?' : 'Block added. What shall we build?'}{:else if message==='blocks.removed'}{bn ? 'ব্লক সরেছে। নতুন করে সাজাই!' : 'Block removed. Make room for a new idea!'}{:else if message==='blocks.undone'}{bn ? 'আগের ধাপে ফিরে এসেছি।' : 'Back to the previous step.'}{:else if message==='blocks.redone'}{bn ? 'ধাপটি আবার ফিরেছে।' : 'That step is back.'}{:else if message==='blocks.cleared'}{bn ? 'আবার নতুন কিছু বানাই! আগের ধাপে গেলে ডিজাইন ফিরে আসবে।' : 'A fresh canvas! Undo brings your design back.'}{:else if message==='blocks.template'}{bn ? 'এবার নিজের মতো করে সাজাই!' : 'Now make it your own!'}{:else}{bn ? 'বাড়ি, টাওয়ার, সিঁড়ি—যা ইচ্ছে বানাই!' : 'A house, a tower, some steps. Build anything you imagine!'}{/if}</p>
</section>

<style>
	.builder { display:flex; flex-direction:column; flex:1; min-height:0; width:100%; max-width:1560px; padding:0 28px 12px; margin:auto; gap:12px; }
	.heading { display:flex; align-items:center; justify-content:space-between; gap:16px; }
	h1 { margin:0; font-size:34px; line-height:1.2; } .eyebrow { margin:0 0 4px; font-size:14px; color:var(--text-secondary); letter-spacing:0.1em; }
	.saved { margin:0; padding:8px 14px; border-radius:12px; background:#e6eddf; color:#506d51; font-size:17px; }
	.workspace { display:flex; gap:20px; flex:1; min-height:0; }
	aside { display:flex; flex-direction:column; width:232px; flex-shrink:0; gap:10px; padding:12px; border:2px solid var(--border-soft); border-radius:24px; background:var(--surface); overflow-y:auto; min-height:0; line-height:1.2; }
	h2 { margin:0 0 9px; font-size:20px; } button { border:2px solid var(--border-soft); border-radius:13px; background:var(--surface); min-height:48px; padding:7px 12px; cursor:pointer; font-weight:600; font-size:18px; }
	button:hover { background:#edf1e6; } button:disabled { opacity:0.4; cursor:default; } button[aria-pressed='true'] { border-color:#526e63; background:#e9efe1; }
	.palette { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; } .swatch { padding:3px; min-height:38px; height:38px; border-radius:11px; background:var(--swatch); box-shadow:inset 0 0 0 3px #ffffff80; } .swatch[aria-pressed='true'] { background:var(--swatch); outline:2px solid #526e63; outline-offset:2px; } .swatch span { font-size:22px; color:#304c4a; }
	.selected-color { margin:6px 0 0; font-size:14px; color:var(--text-secondary); } .tools { display:flex; gap:7px; } .tools button { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; font-size:15px; padding:5px; min-height:64px; } .tools button span { font-size:25px; }
	.presets { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; } .presets h2 { grid-column:1/-1; margin-bottom:2px; } .presets button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:13px; padding:5px 3px; min-height:70px; } .preset-icon { font-size:27px; color:#9b765b; } .go { display:none; } .help { margin-top:auto; font-size:16px; min-height:44px; }
	.stage { display:flex; flex:1; min-width:0; flex-direction:column; gap:8px; } .board { position:relative; flex:1; min-height:220px; overflow:hidden; border:2px solid #b7cdba; border-radius:24px; background:#dfedec; touch-action:manipulation; cursor:crosshair; } canvas { position:absolute; display:block; width:100%; height:100%; } .board-label { position:absolute; top:16px; left:18px; border-radius:10px; padding:5px 11px; background:#fffcf0d9; font-size:15px; font-weight:600; pointer-events:none; color:#567465; }
	.view-tools { display:flex; align-items:center; justify-content:center; gap:9px; } .view-tools button { min-width:48px; font-size:24px; } .view-tools span { font-size:16px; color:var(--text-secondary); } .divider { width:1px; height:25px; background:var(--border-soft); margin:0 8px; }
	.bottom-bar { display:flex; align-items:center; justify-content:space-between; gap:14px; } #building-help { display:flex; flex-direction:column; } strong { font-size:21px; } small { font-size:16px; color:var(--text-secondary); } .history { display:flex; gap:8px; } .feedback { margin:0; font-size:17px; text-align:center; color:var(--text-secondary); min-height:25px; } .unavailable { position:absolute; inset:0; display:grid; place-items:center; background:#fff8e8e8; padding:30px; text-align:center; }
	@media(max-height:720px) { .builder { gap:8px; } .eyebrow { display:none; } h1 { font-size:28px; } aside { gap:9px; padding:12px; } .workspace { min-height:0; } }
</style>
