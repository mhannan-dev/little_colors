import type { Locale } from '../types/colors.ts';
import type { AudioPlayer, PlaybackResult, SpeechFallback } from './types.ts';
import { narrationText } from './voiceManifest.ts';

/**
 * Spec 08 — narration manager.
 *
 * Playback order per line (AU-08): packaged file → speech fallback → silent.
 * The caption is always published first, so gameplay never depends on audio.
 */
export interface AudioSettings {
	locale: Locale;
	soundEnabled: boolean;
	islamicExpressionsEnabled: boolean;
	volume: number; // 0..1
}

export interface AudioManagerDeps {
	player: AudioPlayer;
	speech: SpeechFallback;
	/** Returns a playable file for the key, or null when no recording exists yet. */
	resolveFile: (key: string, locale: Locale) => string | null;
	getSettings: () => AudioSettings;
	onCaption: (text: string) => void;
}

export type NarrateMode = 'interrupt' | 'queue';

export interface AudioManager {
	/** Resolves when the line finished, was skipped, or was cancelled. */
	narrate(key: string, opts?: { mode?: NarrateMode }): Promise<void>;
	/** Narrates the key and remembers it for replayInstruction (AU-07). */
	instruct(key: string): Promise<void>;
	replayInstruction(): Promise<void>;
	stopAll(): void;
	setMuted(muted: boolean): void;
}

interface Item {
	key: string;
	done: () => void;
}

export function createAudioManager(deps: AudioManagerDeps): AudioManager {
	const queue: Item[] = [];
	let current: Item | null = null;
	/** Incremented on every stop so stale playbacks are ignored. */
	let generation = 0;
	let lastInstruction: string | null = null;

	async function playLine(key: string, gen: number): Promise<PlaybackResult | 'skipped'> {
		const s = deps.getSettings();
		const text = narrationText(key, s.locale, s.islamicExpressionsEnabled);
		if (!text) return 'skipped';
		deps.onCaption(text);
		if (!s.soundEnabled) return 'skipped';

		const file = deps.resolveFile(key, s.locale);
		if (file) {
			try {
				const r = await deps.player.play(file, { volume: s.volume });
				if (r !== 'failed' || gen !== generation) return r;
			} catch {
				/* fall through to speech */
			}
		}
		if (gen !== generation) return 'stopped';
		try {
			if (await deps.speech.isAvailable(s.locale)) {
				if (gen !== generation) return 'stopped';
				return await deps.speech.speak(text, s.locale);
			}
		} catch {
			/* silent: caption already shown */
		}
		return 'skipped';
	}

	async function pump() {
		if (current) return;
		const next = queue.shift();
		if (!next) return;
		current = next;
		const gen = generation;
		try {
			await playLine(next.key, gen);
		} finally {
			next.done();
			if (current === next) current = null;
			if (gen === generation) void pump();
		}
	}

	function stopAll() {
		generation++;
		for (const item of queue.splice(0)) item.done();
		const playing = current;
		current = null;
		playing?.done();
		try {
			deps.player.stopAll();
		} catch {
			/* ignore */
		}
		try {
			deps.speech.stop();
		} catch {
			/* ignore */
		}
	}

	function narrate(key: string, opts: { mode?: NarrateMode } = {}): Promise<void> {
		if ((opts.mode ?? 'queue') === 'interrupt') stopAll();
		return new Promise<void>((resolve) => {
			let settled = false;
			queue.push({
				key,
				done: () => {
					if (!settled) {
						settled = true;
						resolve();
					}
				}
			});
			void pump();
		});
	}

	return {
		narrate,
		instruct(key) {
			lastInstruction = key;
			return narrate(key, { mode: 'interrupt' });
		},
		replayInstruction() {
			return lastInstruction ? narrate(lastInstruction, { mode: 'interrupt' }) : Promise.resolve();
		},
		stopAll,
		setMuted(muted) {
			try {
				deps.player.setMuted(muted);
			} catch {
				/* ignore */
			}
			if (muted) {
				try {
					deps.speech.stop();
				} catch {
					/* ignore */
				}
			}
		}
	};
}
