<script lang="ts">
	/**
	 * Voice recording studio (dev only, adult-facing): record every narration clip/line in
	 * one consistent human voice. Files land in src/lib/assets/audio/bn-BD/*.wav and replace
	 * TTS / device speech automatically. See dev/recorderPlugin.ts for the save endpoint.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { audioPathFor, composeLine, getClip, NARRATION_CATALOG, recordingPlan, toBengaliNumeral as bn, type RecordingGroup, type RecordingItem } from '@little-colors/core';
	import { processTake, type ProcessedTake } from './processAudio.ts';

	const plan = recordingPlan();
	const GROUPS: { id: RecordingGroup | 'all'; label: string; note: string }[] = [
		{ id: 'basics', label: '১. মূল টুকরো', note: 'রং, আকার, সংখ্যা আর ছোট শব্দ। এগুলো জোড়া লাগিয়ে অনেক বাক্য তৈরি হয়।' },
		{ id: 'core', label: '২. খেলার বাক্য', note: 'নির্দেশ, উৎসাহ আর বোতামের নাম।' },
		{ id: 'lessons', label: '৩. অন্য পাঠ', note: 'গল্পের পাঠগুলোর লম্বা বাক্য (পরে করলেও চলবে)।' },
		{ id: 'all', label: 'সব', note: '' }
	];

	const fileOf = (i: RecordingItem) => audioPathFor(i.key, 'bn-BD', i.neutral).replace(/\.mp3$/, '.wav');
	const STATE_KEY = 'lc.record.state';

	let recorded = $state<Set<string>>(new Set());
	let group = $state<RecordingGroup | 'all'>('basics');
	let onlyMissing = $state(true);
	let cursor = $state(0);
	let loadError = $state('');

	let phase = $state<'idle' | 'recording' | 'processing' | 'review' | 'saving'>('idle');
	let take = $state<ProcessedTake | null>(null);
	let takeUrl = $state<string | null>(null);
	let level = $state(0);
	let message = $state('');

	let stream: MediaStream | null = null;
	let recorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let meterCtx: AudioContext | null = null;
	let meterRaf = 0;
	let player: HTMLAudioElement | null = null;

	const visible = $derived(
		plan.filter((i) => (group === 'all' || i.group === group) && (!onlyMissing || !recorded.has(fileOf(i))))
	);
	const item = $derived<RecordingItem | undefined>(visible[Math.min(cursor, Math.max(0, visible.length - 1))]);
	const stats = $derived(
		GROUPS.filter((g) => g.id !== 'all').map((g) => {
			const items = plan.filter((i) => i.group === g.id);
			return { ...g, done: items.filter((i) => recorded.has(fileOf(i))).length, total: items.length };
		})
	);
	const isRecorded = $derived(item ? recorded.has(fileOf(item)) : false);

	/** Lines that use this clip, for "hear it in a sentence". */
	const examples = $derived.by(() => {
		if (!item || item.group !== 'basics') return [];
		const seen = new Set<string>();
		return NARRATION_CATALOG.filter((e) => {
			if (!composeLine(e.key)?.includes(item.key) || seen.has(e.bn)) return false;
			seen.add(e.bn); // e.g. match.name / match.correct share the same sentence
			return true;
		}).slice(0, 3);
	});

	async function refresh() {
		try {
			const res = await fetch('/__record/list');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			recorded = new Set((await res.json()) as string[]);
			loadError = '';
		} catch (e) {
			loadError = `রেকর্ডিং সার্ভার পাওয়া যায়নি (${(e as Error).message}). "pnpm --filter desktop dev" দিয়ে চালান।`;
		}
	}

	function saveState() {
		try {
			sessionStorage.setItem(STATE_KEY, JSON.stringify({ group, onlyMissing, key: item?.key, neutral: item?.neutral }));
		} catch {
			/* ignore */
		}
	}

	function restoreState() {
		try {
			const s = JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null');
			if (!s) return;
			group = s.group ?? group;
			onlyMissing = s.onlyMissing ?? onlyMissing;
			const i = visible.findIndex((x) => x.key === s.key && x.neutral === s.neutral);
			if (i >= 0) cursor = i;
		} catch {
			/* ignore */
		}
	}

	function stopPlayback() {
		player?.pause();
		player = null;
	}

	function discardTake() {
		if (takeUrl) URL.revokeObjectURL(takeUrl);
		takeUrl = null;
		take = null;
		phase = 'idle';
	}

	function go(delta: number) {
		if (phase === 'recording' || phase === 'saving') return;
		discardTake();
		stopPlayback();
		message = '';
		cursor = Math.max(0, Math.min(visible.length - 1, cursor + delta));
		saveState();
	}

	async function ensureMic(): Promise<MediaStream> {
		if (stream) return stream;
		stream = await navigator.mediaDevices.getUserMedia({
			audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: false }
		});
		return stream;
	}

	function startMeter(s: MediaStream) {
		meterCtx = new AudioContext();
		const analyser = meterCtx.createAnalyser();
		analyser.fftSize = 1024;
		meterCtx.createMediaStreamSource(s).connect(analyser);
		const data = new Float32Array(analyser.fftSize);
		const tick = () => {
			analyser.getFloatTimeDomainData(data);
			let peak = 0;
			for (const v of data) peak = Math.max(peak, Math.abs(v));
			level = Math.max(peak, level * 0.85);
			meterRaf = requestAnimationFrame(tick);
		};
		tick();
	}

	function stopMeter() {
		cancelAnimationFrame(meterRaf);
		void meterCtx?.close();
		meterCtx = null;
		level = 0;
	}

	async function startRecording() {
		if (!item || phase === 'recording' || phase === 'saving') return;
		discardTake();
		stopPlayback();
		message = '';
		try {
			const s = await ensureMic();
			chunks = [];
			recorder = new MediaRecorder(s);
			recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
			recorder.onstop = () => void finishTake();
			recorder.start();
			startMeter(s);
			phase = 'recording';
		} catch (e) {
			message = `মাইক চালু করা যায়নি: ${(e as Error).message}`;
			phase = 'idle';
		}
	}

	function stopRecording() {
		if (phase !== 'recording') return;
		stopMeter();
		phase = 'processing';
		recorder?.stop();
	}

	async function finishTake() {
		try {
			take = await processTake(new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' }));
			takeUrl = URL.createObjectURL(take.wav);
			phase = 'review';
			message = take.tooQuiet
				? '⚠️ আওয়াজ খুব কম। মাইকের আরেকটু কাছে এসে আবার বলুন।'
				: take.clipped
					? '⚠️ আওয়াজ ফেটে যাচ্ছে। মাইক থেকে একটু দূরে সরে আবার বলুন।'
					: '';
			play(takeUrl);
		} catch (e) {
			message = `রেকর্ডিং প্রক্রিয়া করা যায়নি: ${(e as Error).message}`;
			phase = 'idle';
		}
	}

	function play(url: string): Promise<void> {
		stopPlayback();
		return new Promise((resolve) => {
			const a = new Audio(url);
			player = a;
			a.onended = () => resolve();
			a.onerror = () => resolve();
			a.play().catch(() => resolve());
		});
	}

	async function playSequence(urls: string[]) {
		for (const u of urls) await play(u);
	}

	/** Dev server serves project files by root-relative path; cache-bust after re-recording. */
	const devUrl = (rel: string) => `/src/lib/assets/${rel}?v=${Date.now()}`;

	async function playExample(key: string) {
		const clips = composeLine(key) ?? [];
		const files = clips.map((c) => audioPathFor(c, 'bn-BD').replace(/\.mp3$/, '.wav'));
		const urls: string[] = [];
		for (const f of files) {
			if (takeUrl && item && f === fileOf(item)) urls.push(takeUrl);
			else if (recorded.has(f)) urls.push(devUrl(f));
			else {
				message = `এই বাক্যের জন্য আরও টুকরো রেকর্ড করতে হবে: ${clips.filter((c, i) => !recorded.has(files[i]!) && !(item && files[i] === fileOf(item))).map((c) => getClip(c)?.bn ?? c).join(', ')}`;
				return;
			}
		}
		message = '';
		await playSequence(urls);
	}

	async function save() {
		if (!item || !take || phase !== 'review') return;
		phase = 'saving';
		const path = fileOf(item);
		try {
			const res = await fetch(`/__record/save?path=${encodeURIComponent(path)}`, { method: 'POST', body: take.wav });
			if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
			recorded = new Set([...recorded, path]);
			discardTake();
			message = '✓ সেভ হয়েছে';
			if (!onlyMissing) cursor = Math.min(visible.length - 1, cursor + 1);
			else cursor = Math.min(cursor, Math.max(0, visible.length - 1));
			saveState();
		} catch (e) {
			message = `সেভ করা যায়নি: ${(e as Error).message}`;
			phase = 'review';
		}
	}

	async function remove() {
		if (!item || !isRecorded || !confirm(`"${item.bn}" এর রেকর্ডিং মুছে ফেলবেন?`)) return;
		await fetch(`/__record/delete?path=${encodeURIComponent(fileOf(item))}`, { method: 'DELETE' });
		const next = new Set(recorded);
		next.delete(fileOf(item));
		recorded = next;
	}

	function onKey(e: KeyboardEvent) {
		const t = e.target as HTMLElement;
		if (t.closest('input, select, textarea')) return;
		if (e.code === 'Space') {
			e.preventDefault();
			if (phase === 'recording') stopRecording();
			else void startRecording();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			void save();
		} else if (e.key.toLowerCase() === 'p') {
			if (takeUrl) void play(takeUrl);
			else if (item && isRecorded) void play(devUrl(fileOf(item)));
		} else if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
	}

	onMount(async () => {
		await refresh();
		restoreState();
		window.addEventListener('keydown', onKey);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') window.removeEventListener('keydown', onKey);
		stopMeter();
		stopPlayback();
		stream?.getTracks().forEach((t) => t.stop());
		if (takeUrl) URL.revokeObjectURL(takeUrl);
	});
</script>

<div class="studio" data-testid="record-studio">
	<header>
		<h1>🎙️ কণ্ঠ রেকর্ডিং</h1>
		<p class="tips">
			একজনই পুরোটা বলবেন · শান্ত ঘর, ফ্যান বন্ধ · মুখ থেকে এক বিঘত দূরে মাইক · হাসিমুখে, ধীরে, যেন সামনে বাচ্চা বসে আছে
		</p>
	</header>

	{#if loadError}<p class="error" role="alert">{loadError}</p>{/if}

	<nav class="groups">
		{#each GROUPS as g (g.id)}
			{@const s = stats.find((x) => x.id === g.id)}
			<button
				class:active={group === g.id}
				data-group={g.id}
				onclick={() => {
					group = g.id;
					cursor = 0;
					discardTake();
					saveState();
				}}
			>
				{g.label}
				{#if s}<small>{bn(s.done)}/{bn(s.total)}</small>{/if}
			</button>
		{/each}
		<label class="missing">
			<input type="checkbox" bind:checked={onlyMissing} onchange={() => { cursor = 0; saveState(); }} />
			শুধু বাকিগুলো
		</label>
	</nav>
	{#if GROUPS.find((g) => g.id === group)?.note}<p class="note">{GROUPS.find((g) => g.id === group)?.note}</p>{/if}

	{#if !item}
		<div class="card done-card">
			<p>🎉 এই গ্রুপের সব রেকর্ড করা হয়ে গেছে!</p>
		</div>
	{:else}
		<div class="card" data-testid="record-item" data-key={item.key} data-neutral={item.neutral}>
			<div class="meta">
				<span>{bn(Math.min(cursor, visible.length - 1) + 1)} / {bn(visible.length)}</span>
				{#if item.neutral}<span class="tag">ইসলামিক অভিব্যক্তি ছাড়া সংস্করণ</span>{/if}
				{#if isRecorded}<span class="tag ok">✓ রেকর্ড করা আছে</span>{/if}
				{#if item.usedBy > 1}<span class="tag">{bn(item.usedBy)}টা বাক্যে লাগে</span>{/if}
			</div>
			<p class="line" lang="bn">{item.bn}</p>
			<p class="file"><code>{fileOf(item)}</code></p>

			<div class="meter" aria-hidden="true"><span style:width="{Math.min(100, level * 110)}%" class:hot={level > 0.95}></span></div>

			<div class="controls">
				<button class="nav" onclick={() => go(-1)} disabled={cursor === 0} aria-label="আগেরটা">◀</button>
				{#if phase === 'recording'}
					<button class="rec stop" onclick={stopRecording} data-testid="record-stop">⏹ থামাই <kbd>Space</kbd></button>
				{:else}
					<button class="rec" onclick={startRecording} disabled={phase === 'processing' || phase === 'saving'} data-testid="record-start">
						🎙️ {isRecorded || take ? 'আবার রেকর্ড' : 'রেকর্ড'} <kbd>Space</kbd>
					</button>
				{/if}
				<button onclick={() => (takeUrl ? play(takeUrl) : item && isRecorded && play(devUrl(fileOf(item))))} disabled={!takeUrl && !isRecorded} data-testid="record-play">▶ শুনি <kbd>P</kbd></button>
				<button class="save" onclick={save} disabled={phase !== 'review'} data-testid="record-save">✓ সেভ <kbd>Enter</kbd></button>
				<button class="nav" onclick={() => go(1)} disabled={cursor >= visible.length - 1} aria-label="পরেরটা">▶▶</button>
			</div>

			{#if phase === 'processing'}<p class="status">প্রক্রিয়া চলছে…</p>{/if}
			{#if take}<p class="status">দৈর্ঘ্য {bn(Number(take.seconds.toFixed(1)))} সেকেন্ড</p>{/if}
			{#if message}<p class="status" data-testid="record-message">{message}</p>{/if}

			{#if examples.length}
				<div class="examples">
					<p>বাক্যের ভেতরে শুনে দেখুন:</p>
					{#each examples as ex (ex.key)}
						<button onclick={() => playExample(ex.key)}>▶ {ex.bn}</button>
					{/each}
				</div>
			{/if}

			{#if isRecorded && phase === 'idle'}
				<button class="delete" onclick={remove}>🗑 রেকর্ডিং মুছি</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.studio {
		flex: 1;
		overflow: auto;
		padding: 20px 28px 40px;
		max-width: 1000px;
		margin: 0 auto;
		width: 100%;
		-webkit-user-select: text;
		user-select: text;
	}
	h1 {
		margin: 0;
		font-size: 34px;
	}
	.tips,
	.note {
		margin: 6px 0 14px;
		color: var(--text-secondary);
		font-size: 18px;
	}
	.error {
		padding: 12px 16px;
		border-radius: var(--radius-lg);
		background: #fdecea;
		color: #8a1c14;
	}
	.groups {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px;
	}
	button {
		min-height: 48px;
		padding: 8px 16px;
		border: 3px solid var(--border-soft);
		border-radius: var(--radius-lg);
		background: var(--surface);
		cursor: pointer;
		font-size: 19px;
		font-weight: 600;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.groups button.active {
		border-color: var(--text-primary);
	}
	.groups small {
		margin-left: 6px;
		color: var(--text-secondary);
	}
	.missing {
		margin-left: auto;
		font-size: 18px;
	}
	.card {
		margin-top: 12px;
		padding: 24px;
		border: 3px solid var(--border-soft);
		border-radius: var(--radius-xl);
		background: var(--surface);
	}
	.done-card {
		text-align: center;
		font-size: 26px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		color: var(--text-secondary);
		font-size: 17px;
	}
	.tag {
		padding: 2px 10px;
		border-radius: 12px;
		background: var(--bg-secondary);
	}
	.tag.ok {
		background: #e4f4ea;
		color: #1d6b3f;
	}
	.line {
		margin: 18px 0 4px;
		font-size: clamp(34px, 5vw, 56px);
		font-weight: 700;
		line-height: 1.25;
	}
	.file {
		margin: 0 0 16px;
		color: var(--text-secondary);
		font-size: 14px;
	}
	.meter {
		height: 14px;
		border-radius: 7px;
		background: var(--bg-secondary);
		overflow: hidden;
	}
	.meter span {
		display: block;
		height: 100%;
		background: var(--learn-green);
		transition: width 60ms linear;
	}
	.meter span.hot {
		background: var(--learn-red);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 16px;
	}
	.rec {
		background: var(--learn-red);
		border-color: var(--text-primary);
		color: #fff;
		min-width: 200px;
	}
	.rec.stop {
		background: var(--text-primary);
	}
	.save {
		background: var(--learn-green);
		border-color: var(--text-primary);
		color: #fff;
	}
	kbd {
		margin-left: 6px;
		padding: 0 6px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.12);
		font-size: 14px;
	}
	.status {
		margin: 12px 0 0;
		font-size: 18px;
	}
	.examples {
		margin-top: 18px;
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.examples p {
		margin: 0;
		width: 100%;
		color: var(--text-secondary);
	}
	.delete {
		margin-top: 18px;
		font-size: 16px;
	}
</style>
