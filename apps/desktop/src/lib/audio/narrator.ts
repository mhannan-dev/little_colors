import { get, writable } from 'svelte/store';
import { audioPathFor, createAudioManager, type AudioManager } from '@little-colors/core';
import { settings } from '../stores/settings.ts';
import { bundledAudioUrl, createHtmlAudioPlayer, createSpeechFallback } from '../platform/audio.ts';

/**
 * App-wide narration (spec 08), backed by the core AudioManager:
 * recorded file → Speech Synthesis placeholder → caption only. Audio never blocks gameplay.
 */
export const caption = writable('');

let manager: AudioManager | null = null;

function getManager(): AudioManager | null {
	if (typeof window === 'undefined') return null;
	if (!manager) {
		manager = createAudioManager({
			player: createHtmlAudioPlayer(),
			speech: createSpeechFallback(),
			resolveFile: (key, locale, neutral) => bundledAudioUrl(audioPathFor(key, locale, neutral)),
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

function armIdle() {
	if (idleTimer) clearTimeout(idleTimer);
	idleTimer = null;
	if (!idleKey || idleRepeats >= IDLE_MAX_REPEATS || typeof window === 'undefined') return;
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

/** Set what to repeat when the child is idle (null = nothing). Resets the repeat count. */
export function setIdlePrompt(key: string | null): void {
	listenForActivity();
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
}

export function clearCaption(): void {
	caption.set('');
}
