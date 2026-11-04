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
			resolveFile: (key, locale) => bundledAudioUrl(audioPathFor(key, locale)),
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

/** Speak an activity instruction and remember it for the replay button (AU-07). */
export function instruct(key: string): void {
	void getManager()?.instruct(key);
}

export function replayInstruction(): void {
	void getManager()?.replayInstruction();
}

export function stopNarration(): void {
	getManager()?.stopAll();
}

export function clearCaption(): void {
	caption.set('');
}
