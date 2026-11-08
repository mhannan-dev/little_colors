import { get, writable } from 'svelte/store';
import { audioPathFor, composeLine, createAudioManager, type AudioManager, type Locale } from '@little-colors/core';
import { settings } from '../stores/settings.ts';
import { paused } from '../stores/pause.ts';
import { bundledAudioUrl, createHtmlAudioPlayer, createSpeechFallback } from '../platform/audio.ts';

/**
 * App-wide narration (spec 08), backed by the core AudioManager:
 * recorded file → Speech Synthesis placeholder → caption only. Audio never blocks gameplay.
 */
export const caption = writable('');

let manager: AudioManager | null = null;

/**
 * Whole-line recording first; otherwise, for templated Bengali lines, the recorded clips
 * in order ("এটা" + "লাল" + "তারা"); otherwise nothing (speech fallback / caption).
 */
export function resolveAudio(key: string, locale: Locale, neutral = false): string | string[] | null {
	// Order: human whole line → human clips (all present) → TTS whole line. A TTS .mp3
	// must never hide human clips, and a sentence never mixes human and TTS voices.
	const path = audioPathFor(key, locale, neutral);
	const humanWhole = bundledAudioUrl(path, 'wav');
	if (humanWhole) return humanWhole;
	const clips = locale === 'bn-BD' && !neutral ? composeLine(key) : null;
	if (clips) {
		const urls = clips.map((c) => bundledAudioUrl(audioPathFor(c, locale), 'wav'));
		if (urls.every((u): u is string => u !== null)) return urls;
	}
	return bundledAudioUrl(path, 'mp3');
}

function getManager(): AudioManager | null {
	if (typeof window === 'undefined') return null;
	if (!manager) {
		manager = createAudioManager({
			player: createHtmlAudioPlayer(),
			speech: createSpeechFallback(),
			resolveFile: resolveAudio,
			getSettings: () => {
				const s = get(settings);
				return {
					locale: s.language,
					soundEnabled: s.soundEnabled,
					islamicExpressionsEnabled: s.islamicExpressionsEnabled,
					volume: s.volume
				};
			},
			onCaption: (text) => caption.set(text)
		});
		let prevSound = get(settings).soundEnabled;
		settings.subscribe((s) => {
			if (s.soundEnabled !== prevSound) manager?.setMuted(!s.soundEnabled);
			prevSound = s.soundEnabled;
		});
	}
	return manager;
}

/** Queue a line; `interrupt` cancels whatever is playing first. */
export function say(key: string, opts: { interrupt?: boolean } = {}): void {
	void getManager()?.narrate(key, { mode: opts.interrupt ? 'interrupt' : 'queue' });
}

/** Speak a button's name without replacing the on-screen instruction (PR-26). */
export function speakLabel(key: string): void {
	if (typeof document !== 'undefined' && (document.hidden || !document.hasFocus())) return;
	void getManager()?.narrate(key, { mode: 'interrupt', caption: false });
}

// ── Idle prompt (PR-25) ─────────────────────────────────────────────────────
// Non-readers depend on hearing what to do. If the child does nothing for a while,
// repeat the current prompt gently, at most twice, then stay quiet.
export const IDLE_PROMPT_MS = 8000;
const IDLE_MAX_REPEATS = 2;
let idleKey: string | null = null;
let idleRepeats = 0;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let idleListening = false;
let idleHeld = false;

/**
 * Keep the idle prompt quiet while the app itself is talking/animating and the child
 * can't act (e.g. a counting explanation); the timer restarts when released.
 */
export function holdIdle(held: boolean): void {
	idleHeld = held;
	armIdle();
}

function armIdle() {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = null;
	if (idleHeld || !idleKey || idleRepeats >= IDLE_MAX_REPEATS || typeof window === 'undefined') return;
	idleTimer = setTimeout(() => {
		idleTimer = null;
		// Skip while the window is hidden or unfocused (the game is paused then).
		if (!idleKey || document.hidden || !document.hasFocus()) return armIdle();
		idleRepeats++;
		document.body.dataset.idlePrompts = String(Number(document.body.dataset.idlePrompts ?? 0) + 1);
		void getManager()?.narrate(idleKey, { mode: 'interrupt' });
		armIdle();
	}, IDLE_PROMPT_MS);
}

function listenForActivity() {
	if (idleListening || typeof window === 'undefined') return;
	idleListening = true;
	const onActivity = () => armIdle();
	window.addEventListener('pointerdown', onActivity, true);
	window.addEventListener('keydown', onActivity, true);
}

// Pausing (window hidden / unfocused) cuts off the line that was playing. When the child
// comes back after more than a moment, say the current prompt again so they know what to do.
let pausedAt: number | null = null;
let pauseWatching = false;
function watchPause() {
	if (pauseWatching || typeof window === 'undefined') return;
	pauseWatching = true;
	paused.subscribe((p) => {
		if (p) {
			pausedAt = Date.now();
			return;
		}
		const away = pausedAt === null ? 0 : Date.now() - pausedAt;
		pausedAt = null;
		if (away > 1500 && idleKey && !idleHeld) {
			void getManager()?.narrate(idleKey, { mode: 'interrupt' });
			armIdle();
		}
	});
}

/** Set what to repeat when the child is idle (null = nothing). Resets the repeat count. */
export function setIdlePrompt(key: string | null): void {
	listenForActivity();
	watchPause();
	if (key === null) idleHeld = false; // leaving a screen / round never keeps a stale hold
	idleKey = key;
	idleRepeats = 0;
	armIdle();
}

/** Speak an activity instruction, remember it for replay (AU-07) and idle repeats (PR-25). */
export function instruct(key: string): void {
	void getManager()?.instruct(key);
	setIdlePrompt(key);
}

export function replayInstruction(): void {
	void getManager()?.replayInstruction();
}

export function stopNarration(): void {
	getManager()?.stopAll();
}

/** Leaving a screen: stop speech and forget the idle prompt. */
export function leaveScreen(): void {
	setIdlePrompt(null);
	getManager()?.stopAll();
	caption.set('');
}

export function clearCaption(): void {
	caption.set('');
}
